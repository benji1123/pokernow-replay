"""Turn uploaded PokerNow logs into one session dict. Pure stdlib so it runs in the browser under Pyodide.

JS calls `analyze_json(request_json)`; everything crosses the JS/Python boundary as JSON strings
so no proxy objects need converting. Nothing here touches the filesystem or network.
"""
from __future__ import annotations

import json
import re

from .aliases import merge_players
from .archetypes import assign_archetypes
from .models import Hand
from .parser import parse_csv
from .profile import compute_profiles
from .reads import reads
from .stats import compute_stats


class AnalysisError(ValueError):
    """A problem with the uploaded files, worded for the user."""


def room_from_filename(name: str | None) -> str:
    m = re.search(r"poker_now_log_([A-Za-z0-9_-]+)\.csv", name or "")
    return m.group(1) if m else (name or "upload")


def merge_games(games: list[tuple[str, list[Hand]]]) -> list[Hand]:
    """Tag each hand with its game, drop hands seen twice (same log uploaded again), order by time."""
    seen: set[str] = set()
    merged: list[Hand] = []
    for room, hands in games:
        for h in hands:
            if h.hand_id in seen:
                continue
            seen.add(h.hand_id)
            h.game = room
            merged.append(h)
    merged.sort(key=lambda h: (h.started_at, h.number))
    return merged


def build_session(games: list[tuple[str, list[Hand]]], merges: list[list[str]] = (), auto_merge: bool = True) -> dict:
    hands = merge_games(games)
    merged = merge_players(hands, list(merges), auto_merge)
    stats = compute_stats(hands)
    badges = assign_archetypes(stats)
    profiles = compute_profiles(hands)
    players = []
    for pid, s in stats.items():
        d = s.to_dict()
        d.update(archetypes=badges[pid], merged_ids=merged.get(pid, []), profile=profiles[pid])
        d["reads"] = reads(d, profiles[pid], s.hands)
        players.append(d)
    players.sort(key=lambda p: -p["hands"])
    rooms = list(dict.fromkeys(h.game for h in hands))  # first-hand order
    return {
        "room": rooms[0] if len(rooms) == 1 else f"{len(rooms)} games",
        "games": [{"room": r, "hand_count": sum(h.game == r for h in hands)} for r in rooms],
        "hand_count": len(hands),
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
