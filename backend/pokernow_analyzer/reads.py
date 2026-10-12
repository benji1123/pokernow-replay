"""Rule-based "reads": short exploit notes derived from a player's stats and profile, each with the number that
triggered it. Heuristics, not measurements: thresholds live in RULES and every read carries its evidence (n / d)
so the reader can judge it. A rule only fires above a minimum sample.
"""
from __future__ import annotations

from .profile import SIZES


def _ratio(r: dict | None) -> tuple[int, int, float | None]:
    if not r:
        return 0, 0, None
    return r["n"], r["d"], r.get("value")


def _pct(n: int, d: int) -> str:
    return f"{round(100 * n / d)}% ({n}/{d})"


def _shown_share(meanings: list[dict], street: str, kinds: tuple[str, ...], sizes: tuple[str, ...], labels: tuple[str, ...]) -> tuple[int, int]:
    """(hands with a strength in `labels`, hands shown) over the given street / kinds / size buckets."""
    hit = tot = 0
    for m in meanings:
        if m["street"] == street and m["kind"] in kinds and m["size"] in sizes:
            for lab, ids in m["strengths"].items():
                tot += len(ids)
                hit += len(ids) if lab in labels else 0
    return hit, tot


def reads(stats: dict, profile: dict, hands: int) -> list[dict]:
    """stats: the player's stat dict (vpip, fold_to_pfr, three_bet ... as {n, d, value}). Returns up to 5 reads,
    strongest evidence first: [{"text", "evidence", "key"}]."""
    pf, lines, streets, meanings = profile["preflop"], profile["lines"], profile["streets"], profile["meanings"]
    out: list[dict] = []

    def add(key: str, text: str, n: int, d: int, weight: float) -> None:
        out.append({"key": key, "text": text, "evidence": _pct(n, d), "weight": weight})

    n, d, v = _ratio(lines.get("fold_to_cbet"))
    if d >= 8 and v is not None:
        if v >= 0.5:
            add("cbet_often", "Folds to c-bets a lot: c-bet them often", n, d, v)
        elif v <= 0.3:
            add("cbet_value", "Rarely folds to a c-bet: c-bet for value, not as a bluff", n, d, 1 - v)

    n, d, v = _ratio(lines.get("river_fold"))
    if d >= 8 and v is not None and v >= 0.6:
        add("bluff_river", "Folds to river bets often: bluff them on the river", n, d, v)

    n, d, v = _ratio(lines.get("river_call_won"))
    if d >= 8 and v is not None:
        if v <= 0.3:
            add("value_thin", "Calls river bets and rarely wins: value-bet rivers thin", n, d, 1 - v)
        elif v >= 0.55:
            add("no_river_bluff", "Picks river calls well: don't bluff them on the river", n, d, v)

    n, d, v = _ratio(pf.get("limp"))
    if d >= 15 and v is not None and v >= 0.7:
        add("isolate", "Limps most pots: isolate their limps with a raise", n, d, v)

    n, d, v = _ratio(pf.get("steal"))
    if d >= 10 and v is not None:
        if v <= 0.25:
            add("real_steals", "Rarely steals: a late-position raise from them is real", n, d, 1 - v)
        elif v >= 0.5:
            add("defend", "Steals from late position often: defend your blinds and 3-bet light", n, d, v)

    n, d, v = _ratio(stats.get("fold_to_pfr"))
    if d >= 10 and v is not None and v <= 0.3:
        add("raise_for_value", "Hardly ever folds to an open: raise for value, not to steal", n, d, 1 - v)

    n, d, v = _ratio(stats.get("three_bet"))
    if d >= 15 and v is not None and v >= 0.1:
        add("wide_three_bet", "3-bets a lot: their 3-bet range is wide, call or 4-bet with playable hands", n, d, v)

    n, d, v = _ratio(lines.get("cbet"))
    if d >= 10 and v is not None and v <= 0.35:
        add("flop_bet_real", "C-bets rarely: when they do bet the flop it is usually real", n, d, 1 - v)

    hit, tot = _shown_share(meanings, "river", ("bet", "raise"), ("big", "over"), ("two_pair_plus",))
    if tot >= 5 and hit / tot >= 0.8:
        add("fold_river_big", "Big river bets shown were almost all two pair or better: fold to them", hit, tot, hit / tot)

    hit, tot = _shown_share(meanings, "river", ("bet", "raise"), tuple(SIZES), ("air", "weak_pair"))
    if tot >= 5 and hit / tot >= 0.35:
        add("call_river", "Often caught bluffing the river: call down their river bets", hit, tot, hit / tot)

    hit, tot = _shown_share(meanings, "flop", ("bet",), tuple(SIZES), ("air", "draw"))
    if tot >= 5 and hit / tot >= 0.4:
        add("call_flop", "Flop bets shown were often air or a draw: call flop bets wider", hit, tot, hit / tot)

    cr = sum(s.get("check_raise", 0) for s in streets.values())
    if hands >= 100 and cr <= max(1, hands // 200):
        add("cr_monster", "Almost never check-raises: a check-raise from them is a monster", cr, hands, 1.0)

    out.sort(key=lambda r: -r["weight"])
    return [{k: v for k, v in r.items() if k != "weight"} for r in out[:5]]
