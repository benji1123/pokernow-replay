"""Trading-card ratings: four 0-99 numbers that summarise a player's style at a glance.

Each rating maps a stat onto a fixed range typical of home games (not relative to the table), so the same
number means the same thing across sessions. A rating is None when its sample is too thin to say anything.
"""

from __future__ import annotations

MIN_HANDS = 20
MIN_SHOWN = 5


def _scale(value: float, lo: float, hi: float) -> int:
    """Linear map of [lo, hi] onto 0..99, clamped."""
    t = (value - lo) / (hi - lo)
    return int(round(max(0.0, min(1.0, t)) * 99))


def _value(r: dict | None) -> float | None:
    return None if not r or r.get("d", 0) == 0 else r["value"]


def ratings(stats: dict, profile: dict) -> list[dict]:
    """[{key, label, value (0-99 or None), detail}] in display order."""
    thin = stats.get("hands", 0) < MIN_HANDS
    out: list[dict] = []

    # Looseness: VPIP 10% -> 0, 75% -> 99.
    vpip = _value(stats.get("vpip"))
    out.append({"key": "loose", "label": "Looseness", "value": None if thin or vpip is None else _scale(vpip, 0.10, 0.75),
                "detail": f"VPIP {vpip:.0%}" if vpip is not None else "VPIP -"})

    # Aggression: postflop AF 0 -> 0, 4 -> 99, blended 60/40 with PFR 0% -> 0, 35% -> 99.
    af = stats.get("af_postflop") or {}
    pfr = _value(stats.get("pfr"))
    af_v = af["value"] if af.get("n", 0) + af.get("d", 0) >= 10 else None
    if thin or af_v is None or pfr is None:
        aggr = None
    else:
        aggr = int(round(0.6 * _scale(af_v, 0.0, 4.0) + 0.4 * _scale(pfr, 0.0, 0.35)))
    out.append({"key": "aggr", "label": "Aggression", "value": aggr,
                "detail": f"AF {af_v:.1f} · PFR {pfr:.0%}" if af_v is not None and pfr is not None else "AF -"})

    # Bluffing: share of shown bets and raises (any street) that were air or a draw. 0% -> 0, 60% -> 99.
    shown = bluffs = 0
    for cell in profile.get("meanings", []):
        for lab, ids in cell.get("strengths", {}).items():
            shown += len(ids)
            if lab in ("air", "draw"):
                bluffs += len(ids)
    out.append({"key": "bluff", "label": "Bluffing", "value": None if shown < MIN_SHOWN else _scale(bluffs / shown, 0.0, 0.60),
                "detail": f"{bluffs} of {shown} shown bets were air or a draw" if shown else "no shown bets"})

    # Stubbornness: how rarely they fold when bet into (open, c-bet, river bet), averaged over the spots they
    # faced. Fold 80% -> 0, fold 20% -> 99.
    lines = profile.get("lines", {})
    folds = faced = 0
    for r in (stats.get("fold_to_pfr"), lines.get("fold_to_cbet"), lines.get("river_fold")):
        if r and r.get("d", 0):
            folds += r["n"]
            faced += r["d"]
    out.append({"key": "stubborn", "label": "Stubbornness", "value": None if thin or faced < 10 else _scale(1 - folds / faced, 0.20, 0.80),
                "detail": f"folded {folds} of {faced} times facing a bet" if faced else "never faced a bet"})
    return out
