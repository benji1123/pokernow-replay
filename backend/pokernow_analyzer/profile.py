"""Per-player deep dive: preflop habits, street-by-street action mix and bet sizing, c-bet / donk / check-raise
lines, river defense, and what a player's bets meant in the hands they later showed.

Everything is counts (n / d) so the UI can show sample sizes. Strength labels exist only for hands whose hole
cards were shown at showdown, so those cells are small and biased toward hands that went to showdown; every
cell carries the hand ids it was built from so the UI can link back to them.

Bet size buckets, as a fraction of the pot before the action: small < 40%, mid 40-80%, big 80-120%, over > 120%.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations
from statistics import median

from .models import AGGRESSIVE_KINDS, POST_KINDS, STREETS, Hand

RANKS = "23456789TJQKA"
POSTFLOP = ("flop", "turn", "river")
STRENGTHS = ("air", "draw", "weak_pair", "top_pair_plus", "two_pair_plus")
SIZES = ("small", "mid", "big", "over")
HOLE_CLASSES = ("pair", "broadway", "Ax", "suited_connector", "junk")


def hand_rank(cards: list[str]) -> tuple:
    """Best 5-of-N category: 8 SF, 7 quads, 6 FH, 5 flush, 4 straight, 3 trips, 2 two pair, 1 pair, 0 high."""
    best = (-1,)
    for combo in combinations(cards, 5):
        rs = sorted((RANKS.index(c[0]) for c in combo), reverse=True)
        flush = len({c[1] for c in combo}) == 1
        cnt = Counter(rs)
        groups = sorted(cnt.values(), reverse=True)
        uniq = sorted(set(rs), reverse=True)
        straight = len(uniq) == 5 and (uniq[0] - uniq[4] == 4 or uniq == [12, 3, 2, 1, 0])
        if straight and flush:
            cat = 8
        elif groups == [4, 1]:
            cat = 7
        elif groups == [3, 2]:
            cat = 6
        elif flush:
            cat = 5
        elif straight:
            cat = 4
        elif groups == [3, 1, 1]:
            cat = 3
        elif groups == [2, 2, 1]:
            cat = 2
        elif groups == [2, 1, 1, 1]:
            cat = 1
        else:
            cat = 0
        best = max(best, (cat, sorted(rs, key=lambda r: (cnt[r], r), reverse=True)))
    return best


def straight_outs(hole: list[str], board: list[str]) -> int:
    """Number of RANKS that would complete a straight using at least one hole card: 2+ = open-ender or double gutshot (8 cards), 1 = gutshot (4 cards)."""
    known = hole + board
    suits = Counter(c[1] for c in known)
    dummy_suit = min("shdc", key=lambda s: suits[s])  # cannot complete a flush, so only the straight is measured
    outs = 0
    for r in RANKS:
        card = r + dummy_suit
        if hand_rank(known + [card])[0] >= 4 and hand_rank(board + [card])[0] < 4:
            outs += 1
    return outs


def has_flush_draw(hole: list[str], board: list[str]) -> bool:
    suits = Counter(c[1] for c in hole + board)
    return any(n == 4 and any(c[1] == s for c in hole) for s, n in suits.items())


def strength_label(hole: list[str], board: list[str]) -> str:
    """air / draw / weak_pair / top_pair_plus / two_pair_plus for two hole cards against a board at some street.

    Made hands win over draws (a pair plus a flush draw is a weak pair here). A draw is a flush draw, an
    open-ender or a gutshot on the flop or turn; by the river nothing is a draw any more.
    """
    cat = hand_rank(hole + board)[0]
    if cat >= 2:
        return "two_pair_plus"
    if cat == 1:
        board_ranks = Counter(c[0] for c in board)
        pocket = hole[0][0] == hole[1][0]
        hits = [c for c in hole if board_ranks[c[0]]]
        if pocket or hits:
            top = max(RANKS.index(c[0]) for c in board) if board else -1
            rank = RANKS.index(hole[0][0]) if pocket else max(RANKS.index(c[0]) for c in hits)
            return "top_pair_plus" if rank >= top else "weak_pair"
    if 3 <= len(board) <= 4 and (has_flush_draw(hole, board) or straight_outs(hole, board) >= 1):
        return "draw"
    return "air"


def hole_class(hole: list[str]) -> str:
    r1, r2 = sorted((RANKS.index(hole[0][0]), RANKS.index(hole[1][0])), reverse=True)
    if r1 == r2:
        return "pair"
    if r1 >= RANKS.index("T") and r2 >= RANKS.index("T"):
        return "broadway"
    if r1 == RANKS.index("A"):
        return "Ax"
    if hole[0][1] == hole[1][1] and r1 - r2 <= 2:
        return "suited_connector"
    return "junk"


def combo(hole: list[str]) -> str:
    """Range-grid key: 'AKs', 'AKo' or 'KK' (high rank first)."""
    r1, r2 = sorted((hole[0][0], hole[1][0]), key=RANKS.index, reverse=True)
    if r1 == r2:
        return r1 + r2
    return r1 + r2 + ("s" if hole[0][1] == hole[1][1] else "o")


def preflop_line(kinds: list[str], raises_before: list[int]) -> str:
    """Summarize a player's preflop actions: raise (opened), 3bet (raised over a raise), call (called a raise),
    limp (called in an unopened pot) or check (never put money in voluntarily)."""
    for k, before in zip(kinds, raises_before):
        if k == "raise":
            return "raise" if before == 0 else "3bet"
    if any(k == "call" and before > 0 for k, before in zip(kinds, raises_before)):
        return "call"
    if "call" in kinds:
        return "limp"
    return "check"


def size_bucket(frac: float) -> str:
    return "small" if frac < 0.4 else "mid" if frac <= 0.8 else "big" if frac <= 1.2 else "over"


def pot_before(hand: Hand, index: int) -> float:
    return sum(a.amount for a in hand.actions[:index])


def bb_size(hand: Hand) -> float:
    for a in hand.actions:
        if a.kind == "post_bb":
            return a.raise_to or a.amount
    return 2


class Ratio:
    __slots__ = ("n", "d")

    def __init__(self) -> None:
        self.n = 0
        self.d = 0

    def add(self, hit: bool) -> None:
        self.d += 1
        self.n += int(hit)

    def to_dict(self) -> dict:
        return {"n": self.n, "d": self.d, "value": None if self.d == 0 else self.n / self.d}


class Profile:
    def __init__(self) -> None:
        self.actions = {s: Counter() for s in STREETS}
        self.sizes = {s: [] for s in POSTFLOP}  # bet/raise chips added as a fraction of the pot before the action
        self.check_raise = Counter()
        self.donk = 0
        self.allins = 0
        self.limp = Ratio()  # called (rather than raised) when entering an unopened pot
        self.steal = Ratio()  # raised from CO/BTN/SB when everyone before had folded
        self.open_bb: list[float] = []
        self.three_bet_mult: list[float] = []
        self.vpip_by_pos: dict[str, Ratio] = defaultdict(Ratio)
        self.cbet = Ratio()
        self.turn_barrel = Ratio()
        self.fold_to_cbet = Ratio()
        self.river_fold = Ratio()
        self.river_call_won = Ratio()
        self.river_aggr_shown = Counter()
        self.caught_bluff = 0  # bet or raised the river, showed air / weak pair, lost
        self.value_shown = 0
        # (street, kind, size) -> strength -> [hand ids], for hands later shown
        self.meanings: dict[tuple, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
        self.shown_preflop: dict[str, dict[str, list[str]]] = {"raised": defaultdict(list), "called": defaultdict(list)}
        self.range: list[dict] = []  # one entry per shown hand: combo, preflop line, position, net, hand id

    def to_dict(self) -> dict:
        def spread(xs: list[float]) -> dict | None:
            if not xs:
                return None
            buckets = Counter(size_bucket(x) for x in xs)
            return {"n": len(xs), "median": round(median(xs), 3), **{b: buckets[b] for b in SIZES}}

        return {
            "preflop": {
                "limp": self.limp.to_dict(),
                "steal": self.steal.to_dict(),
                "open_bb": {"n": len(self.open_bb), "median": round(median(self.open_bb), 2)} if self.open_bb else None,
                "three_bet_mult": {"n": len(self.three_bet_mult), "median": round(median(self.three_bet_mult), 2)} if self.three_bet_mult else None,
                "allins": self.allins,
                "vpip_by_pos": {pos: r.to_dict() for pos, r in sorted(self.vpip_by_pos.items())},
                "shown": {tag: {cls: ids for cls, ids in by.items()} for tag, by in self.shown_preflop.items()},
                "range": self.range,
            },
            "streets": {
                s: {"actions": dict(self.actions[s]), "sizes": spread(self.sizes[s]), "check_raise": self.check_raise[s]}
                for s in POSTFLOP
            },
            "lines": {
                "cbet": self.cbet.to_dict(),
                "turn_barrel": self.turn_barrel.to_dict(),
                "fold_to_cbet": self.fold_to_cbet.to_dict(),
                "donk": self.donk,
                "river_fold": self.river_fold.to_dict(),
                "river_call_won": self.river_call_won.to_dict(),
            },
            "showdown": {
                "river_aggr_shown": dict(self.river_aggr_shown),
                "caught_bluff": self.caught_bluff,
                "value_shown": self.value_shown,
            },
            "meanings": [
                {"street": st, "kind": kind, "size": size, "strengths": {lab: ids for lab, ids in by.items()}}
                for (st, kind, size), by in sorted(self.meanings.items(), key=lambda kv: (POSTFLOP.index(kv[0][0]), kv[0][1], SIZES.index(kv[0][2])))
            ],
        }


def compute_profiles(hands: list[Hand]) -> dict[str, dict]:
    profiles: dict[str, Profile] = defaultdict(Profile)
    for h in hands:
        bb = bb_size(h)
        pf_raises = 0
        open_to = None
        pf_agg = None
        folded_to_me = True
        checked: dict[str, set] = {s: set() for s in STREETS}
        first_bettor: dict[str, str | None] = {s: None for s in STREETS}
        cbet_by = None
        faced_cbet: set = set()
        river_aggr = None
        river_bettors: set = set()
        pf_lines: dict[str, list[tuple[str, int]]] = defaultdict(list)  # player -> [(kind, raises before it)]
        for i, a in enumerate(h.actions):
            p = profiles[a.player_id]
            if a.kind in POST_KINDS:
                continue
            p.actions[a.street][a.kind] += 1
            if a.all_in:
                p.allins += 1
            pot = pot_before(h, i)
            if a.street == "preflop":
                pos = h.positions.get(a.player_id, "?")
                pf_lines[a.player_id].append((a.kind, pf_raises))
                if pf_raises == 0 and a.kind in ("call", "raise"):
                    p.limp.add(a.kind == "call")
                if pf_raises == 0 and pos in ("CO", "BTN", "SB") and folded_to_me and a.kind in ("raise", "fold", "call"):
                    p.steal.add(a.kind == "raise")
                if a.kind in ("call", "raise"):
                    folded_to_me = False
                if a.kind == "raise":
                    pf_raises += 1
                    pf_agg = a.player_id
                    if pf_raises == 1:
                        open_to = a.raise_to
                        p.open_bb.append(a.raise_to / bb)
                    elif pf_raises == 2 and open_to:
                        p.three_bet_mult.append(a.raise_to / open_to)
                continue
            st = a.street
            if a.kind == "check":
                checked[st].add(a.player_id)
            if a.kind in AGGRESSIVE_KINDS:
                if pot > 0:
                    frac = a.amount / pot
                    p.sizes[st].append(frac)
                    hole = h.shown.get(a.player_id)
                    n_board = {"flop": 3, "turn": 4, "river": 5}[st]
                    if hole and len(hole) == 2 and len(h.board) >= n_board:
                        p.meanings[(st, a.kind, size_bucket(frac))][strength_label(hole, h.board[:n_board])].append(h.hand_id)
                if a.kind == "raise" and a.player_id in checked[st]:
                    p.check_raise[st] += 1
                if first_bettor[st] is None:
                    first_bettor[st] = a.player_id
                    if st == "flop" and pf_agg:
                        if a.player_id == pf_agg:
                            cbet_by = a.player_id
                        else:
                            p.donk += 1
                if st == "river":
                    river_aggr = a.player_id
                    river_bettors.add(a.player_id)
            if st == "flop" and cbet_by and a.player_id != cbet_by and a.player_id not in faced_cbet and a.kind in ("fold", "call", "raise"):
                faced_cbet.add(a.player_id)
                p.fold_to_cbet.add(a.kind == "fold")
            if st == "river" and river_aggr and a.player_id != river_aggr and a.kind in ("fold", "call"):
                p.river_fold.add(a.kind == "fold")
                if a.kind == "call":
                    p.river_call_won.add(h.collected.get(a.player_id, 0) > 0)
        # The preflop aggressor saw the flop: did they c-bet, and then barrel the turn?
        if pf_agg and len(h.board) >= 3 and pf_agg in {a.player_id for a in h.actions if a.street == "flop"}:
            pa = profiles[pf_agg]
            pa.cbet.add(cbet_by == pf_agg)
            if cbet_by == pf_agg and len(h.board) >= 4:
                pa.turn_barrel.add(any(a.street == "turn" and a.player_id == pf_agg and a.kind in AGGRESSIVE_KINDS for a in h.actions))
        for pid in h.player_ids:
            profiles[pid].vpip_by_pos[h.positions.get(pid, "?")].add(
                any(a.player_id == pid and a.street == "preflop" and a.kind in ("call", "raise") for a in h.actions)
            )
        for pid, hole in h.shown.items():
            if len(hole) != 2:
                continue
            pf = [a.kind for a in h.actions if a.player_id == pid and a.street == "preflop" and a.kind in ("raise", "call")]
            if pf:
                profiles[pid].shown_preflop["raised" if "raise" in pf else "called"][hole_class(hole)].append(h.hand_id)
            kinds, before = zip(*pf_lines[pid]) if pf_lines[pid] else ((), ())
            profiles[pid].range.append({"combo": combo(hole), "line": preflop_line(list(kinds), list(before)), "pos": h.positions.get(pid, "?"), "net": h.net(pid), "hand_id": h.hand_id})
            if len(h.board) == 5 and pid in river_bettors:
                lab = strength_label(hole, h.board)
                profiles[pid].river_aggr_shown[lab] += 1
                if lab in ("air", "weak_pair") and h.collected.get(pid, 0) == 0:
                    profiles[pid].caught_bluff += 1
                elif lab != "air":
                    profiles[pid].value_shown += 1
    return {pid: p.to_dict() for pid, p in profiles.items()}


def shown_bet_mix(profile: dict) -> tuple[int, int]:
    """(bluffs, shown): postflop bets and raises whose cards were later seen, and how many of those were air or a draw."""
    shown = bluffs = 0
    for cell in profile.get("meanings", []):
        for lab, ids in cell.get("strengths", {}).items():
            shown += len(ids)
            if lab in ("air", "draw"):
                bluffs += len(ids)
    return bluffs, shown
