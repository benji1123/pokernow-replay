"""Turn uploaded PokerNow logs into one session dict. Pure stdlib so it runs in the browser under Pyodide.

JS calls `analyze_json(request_json)`; everything crosses the JS/Python boundary as JSON strings
so no proxy objects need converting. Nothing here touches the filesystem or network.
"""
from __future__ import annotations

import json
import re
from collections import Counter

from .aliases import merge_players
from .archetypes import assign_archetypes
from .models import Hand
from .parser import parse_csv
from .profile import compute_profiles, shown_bet_mix
from .ratings import ratings
from .reads import reads
from .stats import compute_stats


class AnalysisError(ValueError):
    """A problem with the uploaded files, worded for the user."""


def room_from_filename(name: str | None) -> str:
    # Browsers rename repeat downloads to "... (1).csv"; the room code is what precedes that.
    m = re.search(r"poker_now_log_([A-Za-z0-9_-]+?)(?: \(\d+\))?\.csv", name or "")
    return m.group(1) if m else (name or "upload")


MIN_SHOWN_FOR_ESTIMATE = 5


def bluff_stats(profile: dict, postflop_aggr: int) -> dict:
    """bluffs_shown: shown postflop bets that were air/draw, over shown bets.
    est_bluffs: that share applied to every postflop bet and raise, seen or not. Assumes unseen bets have the same
    mix as shown ones; players tend to show value more than bluffs, so it overstates. Under that assumption the
    estimated bluff success rate equals the takedown rate, so no separate figure is published."""
    bluffs, shown = shown_bet_mix(profile)
    share = bluffs / shown if shown else None
    est = round(share * postflop_aggr) if shown >= MIN_SHOWN_FOR_ESTIMATE else None
    return {
        "bluffs_shown": {"n": bluffs, "d": shown, "value": share},
        "est_bluffs": {"n": est, "d": postflop_aggr, "value": share if est is not None else None},
    }


def merge_games(games: list[tuple[str, list[Hand]]]) -> tuple[list[Hand], set[str]]:
    """Tag each hand with its game and order by time. A hand seen twice is the same game exported by another player:
    the first copy is kept and the second contributes only its downloader's hole cards. Returns the hands and the
    downloaders of those dropped copies."""
    kept: dict[str, Hand] = {}
    extra: set[str] = set()
    for room, hands in games:
        hero = infer_hero(hands)
        for h in hands:
            if (first := kept.get(h.hand_id)) is None:
                h.game = room
                kept[h.hand_id] = h
            elif hero and h.hero_cards and hero in first.player_ids:
                first.shown.setdefault(hero, h.hero_cards)
                extra.add(hero)
    return sorted(kept.values(), key=lambda h: (h.started_at, h.number)), extra


def infer_hero(hands: list[Hand]) -> str | None:
    """Who downloaded this log: the player whose showdown cards match the "Your hand is" lines. Falls back to the
    only player seated in every hand that has them; None when it stays ambiguous."""
    dealt = [h for h in hands if h.hero_cards]
    if not dealt:
        return None
    candidates = set.intersection(*(set(h.player_ids) for h in dealt))
    matches = Counter(pid for h in dealt for pid, cards in h.shown.items() if set(cards) == set(h.hero_cards) and pid in candidates)
    if matches:
        return matches.most_common(1)[0][0]
    return next(iter(candidates)) if len(candidates) == 1 else None


def reveal_hero(hands: list[Hand]) -> set[str]:
    """Per game (each log has its own downloader), copy the hero's cards into `shown` so every view and stat that
    reads hole cards sees them. Returns the heroes found, one per game at most."""
    heroes = set()
    for room in dict.fromkeys(h.game for h in hands):
        game = [h for h in hands if h.game == room]
        if hero := infer_hero(game):
            heroes.add(hero)
            for h in game:
                if h.hero_cards and hero in h.player_ids:
                    h.shown.setdefault(hero, h.hero_cards)
    return heroes


def build_session(games: list[tuple[str, list[Hand]]], merges: list[list[str]] = (), auto_merge: bool = True) -> dict:
    hands, extra = merge_games(games)
    merged = merge_players(hands, list(merges), auto_merge)
    canonical = {pid: c for c, ids in merged.items() for pid in ids}
    heroes = reveal_hero(hands)
    # "You" only when every kept log was downloaded by the same person; with several downloaders of one game, the
    # first file's. Everyone whose log was uploaded has complete hole cards, which the showdown-only stats are not.
    hero = next(iter(heroes)) if len(heroes) == 1 else None
    complete = heroes | {canonical.get(p, p) for p in extra}
    stats = compute_stats(hands)
    badges = assign_archetypes(stats)
    profiles = compute_profiles(hands)
    players = []
    for pid, s in stats.items():
        d = s.to_dict()
        d.update(archetypes=badges[pid], merged_ids=merged.get(pid, []), profile=profiles[pid], hero=pid == hero, complete=pid in complete)
        d.update(bluff_stats(profiles[pid], s.af_postflop.n))
        d["reads"] = reads(d, profiles[pid], s.hands)
        d["ratings"] = ratings(d, profiles[pid])
        players.append(d)
    players.sort(key=lambda p: -p["hands"])
    rooms = list(dict.fromkeys(h.game for h in hands))  # first-hand order
    return {
        "room": rooms[0] if len(rooms) == 1 else f"{len(rooms)} games",
        "games": [{"room": r, "hand_count": sum(h.game == r for h in hands)} for r in rooms],
        "hand_count": len(hands),
        "hero": hero,
        "players": players,
        "hands": [h.to_dict() for h in hands],
    }


def analyze(files: list[tuple[str, str]], merges: list[list[str]] | None = None, auto_merge: bool = True) -> dict:
    """files: (filename, csv text) pairs. Raises AnalysisError for anything the user should fix."""
    merges = [] if merges is None else merges
    if not (isinstance(merges, list) and all(isinstance(g, list) and all(isinstance(i, str) for i in g) for g in merges)):
        raise AnalysisError("merges must be a list of lists of player ids")
    games = []
    for name, text in files:
        try:
            games.append((room_from_filename(name), parse_csv(text.lstrip("\ufeff"))))
        except (KeyError, ValueError):
            raise AnalysisError(f"{name}: expected the poker_now_log_<room>.csv download (columns entry,at,order)")
    if not any(hands for _, hands in games):
        raise AnalysisError("No complete hands found in those files")
    try:
        return build_session(games, merges, auto_merge)
    except ValueError as e:
        raise AnalysisError(str(e))


def analyze_json(request: str) -> str:
    """Browser entry point. request: {"files": [{"name", "text"}], "merges": [[id, ...]], "auto_merge": bool}.
    Returns {"session": ...} or {"error": "..."}; never raises, so JS sees no Python tracebacks."""
    req = json.loads(request)
    try:
        session = analyze([(f["name"], f["text"]) for f in req["files"]], req.get("merges", []), req.get("auto_merge", True))
    except AnalysisError as e:
        return json.dumps({"error": str(e)})
    return json.dumps({"session": session})
