"""Fold several PokerNow player ids into one person.

PokerNow ids are per-browser guest tokens, so one person who joins from two devices gets two ids. Two sources of merges:
  auto    ids that used the exact same display name and never sat in the same hand
  manual  groups the user picked in the UI; refused when two of them sat in the same hand (they can't be one person)
Merging rewrites the Hand objects in place before stats run, so every downstream number sees one player.
"""
from __future__ import annotations

from collections import defaultdict

from .models import Hand


class _Union:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: str, b: str) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def shared_hand(hands: list[Hand], a: str, b: str) -> Hand | None:
    return next((h for h in hands if a in h.player_ids and b in h.player_ids), None)


def auto_groups(hands: list[Hand]) -> list[set[str]]:
    by_name: dict[str, set[str]] = defaultdict(set)
    for h in hands:
        for s in h.seats:
            by_name[s.name.strip()].add(s.player_id)
    uf = _Union()
    for ids in by_name.values():
        ordered = sorted(ids)
        for i, a in enumerate(ordered):
            for b in ordered[i + 1:]:
                if shared_hand(hands, a, b) is None:
                    uf.union(a, b)
    groups: dict[str, set[str]] = defaultdict(set)
    for pid in uf.parent:
        groups[uf.find(pid)].add(pid)
    return [g for g in groups.values() if len(g) > 1]


def resolve(hands: list[Hand], groups: list[set[str]]) -> dict[str, str]:
    """id -> canonical id (the one dealt the most hands) for every id in a group of size > 1."""
    uf = _Union()
    for g in groups:
        first, *rest = sorted(g)
        for other in rest:
            uf.union(first, other)
    dealt: dict[str, int] = defaultdict(int)
    for h in hands:
        for pid in h.player_ids:
            dealt[pid] += 1
    members: dict[str, set[str]] = defaultdict(set)
    for pid in uf.parent:
        members[uf.find(pid)].add(pid)
    mapping: dict[str, str] = {}
    for ids in members.values():
        canonical = max(ids, key=lambda p: (dealt[p], p))
        mapping.update({pid: canonical for pid in ids if pid != canonical})
    return mapping


def apply(hands: list[Hand], mapping: dict[str, str]) -> None:
    def m(pid: str) -> str:
        return mapping.get(pid, pid)

    for h in hands:
        h.dealer_id = m(h.dealer_id)
        for s in h.seats:
            s.player_id = m(s.player_id)
        for a in h.actions:
            a.player_id = m(a.player_id)
        for attr in ("shown", "collected", "uncalled", "positions"):
            setattr(h, attr, {m(k): v for k, v in getattr(h, attr).items()})


def merge_players(hands: list[Hand], manual: list[list[str]], auto: bool = True) -> dict[str, list[str]]:
    """Merge in place. Returns canonical id -> the other ids folded into it. Raises ValueError for an impossible manual group."""
    for group in manual:
        ids = sorted(set(group))
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                if (h := shared_hand(hands, a, b)) is not None:
                    raise ValueError(f"{a} and {b} both sat in hand #{h.number}, so they can't be the same person")
    # Manual first, then auto on the rewritten hands so its shared-hand check sees merged people.
    mapping = resolve(hands, [set(g) for g in manual if len(set(g)) > 1])
    apply(hands, mapping)
    if auto:
        auto_map = resolve(hands, auto_groups(hands))
        apply(hands, auto_map)
        mapping = {pid: auto_map.get(c, c) for pid, c in mapping.items()} | auto_map
    merged: dict[str, list[str]] = defaultdict(list)
    for pid, canonical in sorted(mapping.items()):
        merged[canonical].append(pid)
    return dict(merged)
