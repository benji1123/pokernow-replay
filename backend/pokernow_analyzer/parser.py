"""Parse PokerNow log lines (JSON `log` endpoint entries or the downloadable CSV) into Hands."""
from __future__ import annotations

import csv
import io
import re
from typing import Iterable

from .models import Action, Hand, Seat, Street

PLAYER = r'"(?P<name>.+?) @ (?P<pid>[A-Za-z0-9_-]+)"'
_RE = {
    "start": re.compile(r"^-- starting hand #(?P<num>\d+) +\(id: (?P<hid>\w+)\) .*\(dealer: " + PLAYER + r"\) --$"),
    "start_dead": re.compile(r"^-- starting hand #(?P<num>\d+) +\(id: (?P<hid>\w+)\) .*\(dead button\) --$"),
    "end": re.compile(r"^-- ending hand #(?P<num>\d+) --$"),
    "stacks": re.compile(r"^Player stacks: (?P<rest>.+)$"),
    "seat": re.compile(r"#(?P<seat>\d+) " + PLAYER + r" \((?P<stack>[\d.]+)\)"),
    "post": re.compile(
        "^" + PLAYER + r" posts (?:a |an )?(?P<what>small blind|big blind|straddle|ante|missing small blind|missed big blind|missing big blind) of (?P<amt>[\d.]+)(?P<allin> and go all in)?$"
    ),
    "fold": re.compile("^" + PLAYER + r" folds$"),
    "check": re.compile("^" + PLAYER + r" checks$"),
    "call": re.compile("^" + PLAYER + r" calls (?P<amt>[\d.]+)(?P<allin> and go all in)?$"),
    "bet": re.compile("^" + PLAYER + r" bets (?P<amt>[\d.]+)(?P<allin> and go all in)?$"),
    "raise": re.compile("^" + PLAYER + r" raises to (?P<amt>[\d.]+)(?P<allin> and go all in)?$"),
    "flop": re.compile(r"^Flop: +\[(?P<cards>[^\]]+)\]$"),
    "turn": re.compile(r"^Turn: .*\[(?P<cards>[^\]]+)\]$"),
    "river": re.compile(r"^River: .*\[(?P<cards>[^\]]+)\]$"),
    "uncalled": re.compile(r"^Uncalled bet of (?P<amt>[\d.]+) returned to " + PLAYER + "$"),
    "collected": re.compile("^" + PLAYER + r" collected (?P<amt>[\d.]+) from pot"),
    "shows": re.compile("^" + PLAYER + r" shows a (?P<cards>.+)\.$"),
    "your_hand": re.compile(r"^Your hand is (?P<cards>.+)$"),
}
_POST_KIND = {
    "small blind": "post_sb",
    "big blind": "post_bb",
    "straddle": "post_straddle",
    "ante": "post_ante",
    "missing small blind": "post_missing_sb",
    "missed big blind": "post_missing_bb",
    "missing big blind": "post_missing_bb",
}
_SUITS = {"♠": "s", "♥": "h", "♦": "d", "♣": "c"}


def _num(s: str) -> int | float:
    f = float(s)
    return int(f) if f.is_integer() else f


def normalize_card(card: str) -> str:
    """'10♠' -> 'Ts', 'A♦' -> 'Ad'."""
    card = card.strip()
    rank, suit = card[:-1], card[-1]
    rank = "T" if rank == "10" else rank
    return rank + _SUITS.get(suit, suit)


def _cards(s: str) -> list[str]:
    return [normalize_card(c) for c in s.split(",") if c.strip()]


class _HandBuilder:
    def __init__(self, number: int, hand_id: str, started_at: str, dealer_id: str):
        self.hand = Hand(number=number, hand_id=hand_id, started_at=started_at, dealer_id=dealer_id, seats=[])
        self.street: Street = "preflop"
        self.committed: dict[str, int | float] = {}

    def new_street(self, street: Street, cards: list[str]) -> None:
        self.street = street
        self.committed = {}
        self.hand.board.extend(cards)

    def act(self, pid: str, kind: str, total: int | float | None = None, all_in: bool = False) -> None:
        amount: int | float = 0
        raise_to = None
        if kind in ("post_ante", "post_missing_sb"):
            amount = total or 0  # dead money: it goes in the pot but doesn't count toward matching the street's bet
        elif total is not None:
            prev = self.committed.get(pid, 0)
            amount = max(total - prev, 0)
            self.committed[pid] = max(prev, total)
            if kind == "raise":
                raise_to = total
        self.hand.actions.append(Action(self.street, pid, kind, amount, raise_to, all_in))  # type: ignore[arg-type]

    def finish(self) -> Hand:
        self.hand.positions = assign_positions(self.hand)
        return self.hand


def assign_positions(hand: Hand) -> dict[str, str]:
    """BTN from the dealer line, SB/BB from who actually posted, the rest by seat order after the BB."""
    pos: dict[str, str] = {}
    for a in hand.actions:
        if a.kind == "post_sb" and "SB" not in pos.values():
            pos[a.player_id] = "SB"
        elif a.kind == "post_bb" and "BB" not in pos.values():
            pos[a.player_id] = "BB"
    if hand.dealer_id in hand.player_ids:
        pos.setdefault(hand.dealer_id, "BTN")
    order = [s.player_id for s in sorted(hand.seats, key=lambda s: s.seat)]
    if not order:
        return pos
    # Rotate so the seat after the BB (or after the dealer, if no BB) comes first.
    anchor = next((p for p, l in pos.items() if l == "BB"), hand.dealer_id)
    if anchor in order:
        i = order.index(anchor)
        order = order[i + 1:] + order[: i + 1]
    rest = [p for p in order if p not in pos]
    # Label from the back (CO, HJ, LJ) and from the front (UTG, UTG+1, ...); 5-handed reads UTG/CO, 6-handed UTG/HJ/CO.
    n_late = 0 if not rest else 1 if len(rest) <= 2 else 2 if len(rest) <= 4 else 3
    for label, p in zip(["CO", "HJ", "LJ"][:n_late], reversed(rest)):
        pos[p] = label
    for idx, p in enumerate(rest[: len(rest) - n_late]):
        pos[p] = "UTG" if idx == 0 else f"UTG+{idx}"
    return pos


def parse_messages(entries: Iterable[tuple[str, str]]) -> list[Hand]:
    """entries: (timestamp, msg) in chronological order. Returns only complete hands."""
    hands: list[Hand] = []
    b: _HandBuilder | None = None
    for at, msg in entries:
        msg = msg.strip()
        if m := _RE["start"].match(msg):
            b = _HandBuilder(int(m["num"]), m["hid"], at, m["pid"])
        elif m := _RE["start_dead"].match(msg):
            b = _HandBuilder(int(m["num"]), m["hid"], at, "")
        if b is None:
            continue
        b.hand.raw.append(msg)
        if _RE["end"].match(msg):
            hands.append(b.finish())
            b = None
        elif m := _RE["stacks"].match(msg):
            b.hand.seats = [
                Seat(int(s["seat"]), s["pid"], s["name"], _num(s["stack"])) for s in _RE["seat"].finditer(m["rest"])
            ]
        elif m := _RE["post"].match(msg):
            b.act(m["pid"], _POST_KIND[m["what"]], _num(m["amt"]), bool(m["allin"]))
        elif m := _RE["fold"].match(msg):
            b.act(m["pid"], "fold")
        elif m := _RE["check"].match(msg):
            b.act(m["pid"], "check")
        elif m := _RE["call"].match(msg):
            b.act(m["pid"], "call", _num(m["amt"]), bool(m["allin"]))
        elif m := _RE["bet"].match(msg):
            b.act(m["pid"], "bet", _num(m["amt"]), bool(m["allin"]))
        elif m := _RE["raise"].match(msg):
            b.act(m["pid"], "raise", _num(m["amt"]), bool(m["allin"]))
        elif m := _RE["flop"].match(msg):
            b.new_street("flop", _cards(m["cards"]))
        elif m := _RE["turn"].match(msg):
            b.new_street("turn", _cards(m["cards"]))
        elif m := _RE["river"].match(msg):
            b.new_street("river", _cards(m["cards"]))
        elif m := _RE["uncalled"].match(msg):
            b.hand.uncalled[m["pid"]] = b.hand.uncalled.get(m["pid"], 0) + _num(m["amt"])
        elif m := _RE["collected"].match(msg):
            b.hand.collected[m["pid"]] = b.hand.collected.get(m["pid"], 0) + _num(m["amt"])
        elif m := _RE["shows"].match(msg):
            b.hand.shown[m["pid"]] = _cards(m["cards"])
        elif m := _RE["your_hand"].match(msg):
            b.hand.hero_cards = _cards(m["cards"])
    return hands


def parse_json_entries(entries: list[dict]) -> list[Hand]:
    """Entries from the /games/<id>/log endpoint, any order."""
    ordered = sorted(entries, key=lambda e: int(e["created_at"]))
    return parse_messages((e["at"], e["msg"]) for e in ordered)


def parse_csv(text: str) -> list[Hand]:
    """The downloadable poker_now_log_<id>.csv: columns entry,at,order; newest first."""
    rows = list(csv.DictReader(io.StringIO(text)))
    rows.sort(key=lambda r: int(r["order"]))
    return parse_messages((r["at"], r["entry"]) for r in rows)
