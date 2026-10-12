"""Archetype badges: rule-of-thumb labels derived from a player's stats.

Thresholds are the common PokerTracker-style cutoffs, so they are opinions, not facts; the UI shows each badge's
blurb so the reader knows why it was awarded. Stat-based badges need MIN_HANDS; a stat with too few opportunities
(below its `d` minimum) never fires. At most MAX_BADGES per player, in RULES order.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .stats import PlayerStats, Stat

MIN_HANDS = 20
MAX_BADGES = 3


@dataclass(frozen=True)
class Table:
    """Session-wide facts a rule can compare against."""
    biggest_winner: str | None
    biggest_loser: str | None


@dataclass(frozen=True)
class Archetype:
    key: str
    label: str
    emoji: str
    blurb: str
    test: Callable[[PlayerStats, Table], bool]

    def to_dict(self) -> dict:
        return {"key": self.key, "label": self.label, "emoji": self.emoji, "blurb": self.blurb}


def _at_least(stat: Stat, value: float, min_d: int = 1) -> bool:
    return stat.d >= min_d and stat.value is not None and stat.value >= value


def _at_most(stat: Stat, value: float, min_d: int = 1) -> bool:
    return stat.d >= min_d and stat.value is not None and stat.value <= value


def _af(stat: Stat) -> float:
    return float("inf") if stat.d == 0 else stat.n / stat.d


def _raise_share(s: PlayerStats) -> float:
    """How often a voluntary preflop entry was a raise rather than a call."""
    return 0.0 if s.vpip.n == 0 else s.pfr.n / s.vpip.n


RULES: list[Archetype] = [
    Archetype("rookie", "Small sample", "🐣", f"Fewer than {MIN_HANDS} hands, too early to call.",
              lambda s, t: s.hands < MIN_HANDS),
    Archetype("whale", "Whale", "🐳", "Biggest loser at the table, and plays a lot of hands getting there.",
              lambda s, t: s.player_id == t.biggest_loser and s.net < 0 and _at_least(s.vpip, 0.40)),
    Archetype("shark", "Shark", "🦈", "Biggest winner at the table.",
              lambda s, t: s.player_id == t.biggest_winner and s.net > 0),
    Archetype("maniac", "Maniac", "🔥", "Plays most hands, raises most of them, and keeps firing after the flop.",
              lambda s, t: _at_least(s.vpip, 0.45) and _at_least(s.pfr, 0.30) and _af(s.af_total) >= 2.5),
    Archetype("calling_station", "Calling Station", "📞", "Plays lots of hands but mostly by calling; rarely bets or raises.",
              lambda s, t: _at_least(s.vpip, 0.40) and _af(s.af_total) < 1.0 and _raise_share(s) < 0.5),
    Archetype("lag", "LAG", "⚡", "Loose-aggressive: plays many hands and plays them with bets and raises.",
              lambda s, t: 0.30 <= s.vpip.value < 0.45 and _at_least(s.pfr, 0.20) and _af(s.af_total) >= 2.0),
    Archetype("tag", "TAG", "🎯", "Tight-aggressive: picks hands carefully and plays them hard. The textbook style.",
              lambda s, t: 0.15 <= s.vpip.value <= 0.30 and _raise_share(s) >= 0.6 and _af(s.af_total) >= 1.5),
    Archetype("rock", "Rock", "🪨", "Folds almost everything preflop. When they bet, believe them.",
              lambda s, t: _at_most(s.vpip, 0.20)),
    Archetype("loose_cannon", "Loose Cannon", "🧨", "In more than half of all hands dealt.",
              lambda s, t: _at_least(s.vpip, 0.50)),
    Archetype("draw_chaser", "Draw Chaser", "🎣", "Goes to showdown often and usually loses there: paying to see the river.",
              lambda s, t: _at_least(s.wtsd, 0.30, 8) and _at_most(s.wsd, 0.40, 5)),
    Archetype("sheriff", "Sheriff", "🤠", "Rarely folds to a raise and calls down to keep everyone honest.",
              lambda s, t: _at_most(s.fold_to_pfr, 0.35, 8) and _at_least(s.wtsd, 0.30, 8)),
    Archetype("three_bet_machine", "3-Bet Machine", "💣", "Re-raises an opener far more often than most.",
              lambda s, t: _at_least(s.three_bet, 0.15, 10)),
    Archetype("pushover", "Pushover", "🏳️", "Folds to a raise most of the time.",
              lambda s, t: _at_least(s.fold_to_pfr, 0.70, 10)),
    Archetype("showdown_hero", "Showdown Hero", "🏆", "When they get to showdown, they usually have it.",
              lambda s, t: _at_least(s.wsd, 0.70, 5)),
]


def table_facts(stats: dict[str, PlayerStats]) -> Table:
    if not stats:
        return Table(None, None)
    by_net = sorted(stats.values(), key=lambda s: s.net)
    return Table(biggest_winner=by_net[-1].player_id, biggest_loser=by_net[0].player_id)


def archetypes_for(s: PlayerStats, table: Table) -> list[Archetype]:
    if s.hands < MIN_HANDS:
        return [RULES[0]]
    return [a for a in RULES[1:] if a.test(s, table)][:MAX_BADGES]


def assign_archetypes(stats: dict[str, PlayerStats]) -> dict[str, list[dict]]:
    table = table_facts(stats)
    return {pid: [a.to_dict() for a in archetypes_for(s, table)] for pid, s in stats.items()}
