"""Per-player statistics over a list of Hands.

Every stat is a Stat(numerator, denominator) so the UI can show the sample size next to the value.
Definitions (posts never count as voluntary actions):
  VPIP          hands with a preflop call/bet/raise                          / hands dealt
  PFR           hands with a preflop raise                                   / hands dealt
  3-bet         raised when facing exactly one preflop raise                 / times faced exactly one preflop raise
  Fold to PFR   folded when facing exactly one preflop raise                 / times faced exactly one preflop raise
  Fold to 3-bet opened, then folded when facing the 3-bet                    / times an opener faced a 3-bet
  AF            (bets + raises) / calls, on the given streets (ratio, not a percentage)
  WTSD          reached showdown                                             / saw the flop
  W$SD          won chips at showdown                                        / reached showdown
  Takedown      postflop bets/raises after which everyone folded              / postflop bets + raises
  vs            per opponent, chips taken from them minus chips lost to them (see money_flow)
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .models import AGGRESSIVE_KINDS, POST_KINDS, Hand


@dataclass
class Stat:
    n: int = 0
    d: int = 0

    def add(self, hit: bool, opportunity: bool = True) -> None:
        if opportunity:
            self.d += 1
            self.n += int(hit)

    @property
    def value(self) -> float | None:
        return None if self.d == 0 else self.n / self.d

    def to_dict(self) -> dict:
        return {"n": self.n, "d": self.d, "value": self.value}


@dataclass
class PlayerStats:
    player_id: str
    name: str
    hands: int = 0
    net: int | float = 0
    hands_won: int = 0
    # Every display name this player (after merging) used, in first-seen order; `name` is the most recent.
    names: list[str] = field(default_factory=list)
    vpip: Stat = field(default_factory=Stat)
    pfr: Stat = field(default_factory=Stat)
    three_bet: Stat = field(default_factory=Stat)
    fold_to_pfr: Stat = field(default_factory=Stat)
    fold_to_three_bet: Stat = field(default_factory=Stat)
    af_total: Stat = field(default_factory=Stat)  # n = bets+raises, d = calls
    af_preflop: Stat = field(default_factory=Stat)
    af_postflop: Stat = field(default_factory=Stat)
    wtsd: Stat = field(default_factory=Stat)
    wsd: Stat = field(default_factory=Stat)
    takedown: Stat = field(default_factory=Stat)  # n = postflop bets/raises that ended the hand, d = postflop bets/raises
    # opponent id -> chips taken from (positive) or lost to (negative) that opponent, summed over hands.
    vs: dict[str, float] = field(default_factory=dict)

    def _extreme_vs(self, sign: int) -> dict | None:
        best = max(((pid, amt * sign) for pid, amt in self.vs.items()), key=lambda x: x[1], default=None)
        return None if best is None or best[1] <= 0 else {"player_id": best[0], "amount": round(best[1])}

    @property
    def best_friend(self) -> dict | None:
        return self._extreme_vs(+1)

    @property
    def nemesis(self) -> dict | None:
        return self._extreme_vs(-1)

    def to_dict(self) -> dict:
        d = {"player_id": self.player_id, "name": self.name, "names": self.names, "hands": self.hands, "net": self.net, "hands_won": self.hands_won}
        for k, v in self.__dict__.items():
            if isinstance(v, Stat):
                d[k] = v.to_dict()
        d["vs"] = {pid: round(amt) for pid, amt in self.vs.items()}
        d["nemesis"], d["best_friend"] = self.nemesis, self.best_friend
        return d


def money_flow(hand: Hand) -> dict[str, dict[str, float]]:
    """loser id -> winner id -> chips, splitting each winner's gain across losers in proportion to what they lost.
    Exact for one winner; an approximation for multiway side pots, where the log doesn't say whose chips went where."""
    nets = {pid: hand.net(pid) for pid in hand.player_ids}
    losses = {pid: -n for pid, n in nets.items() if n < 0}
    total_lost = sum(losses.values())
    if total_lost == 0:
        return {}
    return {
        loser: {winner: gain * lost / total_lost for winner, gain in nets.items() if gain > 0}
        for loser, lost in losses.items()
    }


@dataclass
class HandFacts:
    """What one player did in one hand, as the stats need it."""
    vpip: bool = False
    pfr: bool = False
    faced_open: bool = False       # acted while exactly one preflop raise was in front
    three_bet: bool = False
    folded_to_open: bool = False
    opened_and_faced_3bet: bool = False
    folded_to_3bet: bool = False
    saw_flop: bool = False
    showdown: bool = False
    won_at_showdown: bool = False
    takedowns: int = 0             # postflop bets/raises that made everyone else fold (at most one per hand)
    aggr: dict[str, int] = field(default_factory=lambda: {"preflop": 0, "postflop": 0})
    calls: dict[str, int] = field(default_factory=lambda: {"preflop": 0, "postflop": 0})


def hand_facts(hand: Hand) -> dict[str, HandFacts]:
    facts = {pid: HandFacts() for pid in hand.player_ids}
    folded: set[str] = set()
    raises = 0
    opener: str | None = None
    for a in hand.actions:
        f = facts.setdefault(a.player_id, HandFacts())
        if a.kind in POST_KINDS:
            continue
        bucket = "preflop" if a.street == "preflop" else "postflop"
        if a.kind in AGGRESSIVE_KINDS:
            f.aggr[bucket] += 1
        elif a.kind == "call":
            f.calls[bucket] += 1
        if a.kind == "fold":
            folded.add(a.player_id)

        if a.street != "preflop":
            continue
        if a.kind in ("call", "bet", "raise"):
            f.vpip = True
        if raises == 1 and a.player_id != opener and not f.faced_open:
            f.faced_open = True
            f.three_bet = a.kind == "raise"
            f.folded_to_open = a.kind == "fold"
        if raises == 2 and a.player_id == opener and not f.opened_and_faced_3bet:
            f.opened_and_faced_3bet = True
            f.folded_to_3bet = a.kind == "fold"
        if a.kind == "raise":
            f.pfr = True
            raises += 1
            if raises == 1:
                opener = a.player_id

    alive = [pid for pid in hand.player_ids if pid not in folded]
    showdown = len(alive) >= 2
    folded_preflop = {a.player_id for a in hand.actions if a.kind == "fold" and a.street == "preflop"}
    for pid, f in facts.items():
        f.saw_flop = len(hand.board) >= 3 and pid not in folded_preflop
        f.showdown = showdown and pid in alive
        f.won_at_showdown = f.showdown and hand.collected.get(pid, 0) > 0
    if not showdown and alive:
        last = next((a for a in reversed(hand.actions) if a.kind in AGGRESSIVE_KINDS), None)
        if last is not None and last.street != "preflop" and last.player_id == alive[0]:
            facts[alive[0]].takedowns = 1
    return facts


def compute_stats(hands: list[Hand]) -> dict[str, PlayerStats]:
    stats: dict[str, PlayerStats] = {}
    for hand in hands:
        facts = hand_facts(hand)
        for seat in hand.seats:
            s = stats.setdefault(seat.player_id, PlayerStats(seat.player_id, seat.name))
            s.name = seat.name  # most recent display name wins
            if seat.name not in s.names:
                s.names.append(seat.name)
            f = facts[seat.player_id]
            s.hands += 1
            s.net += hand.net(seat.player_id)
            s.hands_won += int(hand.collected.get(seat.player_id, 0) > 0)
            s.vpip.add(f.vpip)
            s.pfr.add(f.pfr)
            s.three_bet.add(f.three_bet, f.faced_open)
            s.fold_to_pfr.add(f.folded_to_open, f.faced_open)
            s.fold_to_three_bet.add(f.folded_to_3bet, f.opened_and_faced_3bet)
            s.wtsd.add(f.showdown, f.saw_flop)
            s.wsd.add(f.won_at_showdown, f.showdown)
            s.takedown.n += f.takedowns
            s.takedown.d += f.aggr["postflop"]
            for bucket, target in (("preflop", s.af_preflop), ("postflop", s.af_postflop)):
                target.n += f.aggr[bucket]
                target.d += f.calls[bucket]
                s.af_total.n += f.aggr[bucket]
                s.af_total.d += f.calls[bucket]
        for loser, winners in money_flow(hand).items():
            for winner, chips in winners.items():
                stats[winner].vs[loser] = stats[winner].vs.get(loser, 0) + chips
                stats[loser].vs[winner] = stats[loser].vs.get(winner, 0) - chips
    return stats
