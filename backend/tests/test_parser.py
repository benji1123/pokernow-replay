import json
from pathlib import Path

import pytest

from pokernow_analyzer.parser import parse_json_entries, parse_messages

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "sample.json"


@pytest.fixture(scope="module")
def hands():
    return parse_json_entries(json.loads(FIXTURE.read_text()))


def by_number(hands, n):
    return next(h for h in hands if h.number == n)


def test_parses_every_complete_hand(hands):
    assert len(hands) == 63
    assert [h.number for h in hands] == list(range(1, 64))


def test_pot_balances_in_every_hand(hands):
    # Chips in (all actions) minus uncalled returns equals chips collected. No rake in this game.
    for h in hands:
        chips_in = sum(a.amount for a in h.actions)
        assert chips_in - sum(h.uncalled.values()) == sum(h.collected.values()), f"hand {h.number}"


def test_net_sums_to_zero_in_every_hand(hands):
    for h in hands:
        assert sum(h.net(p) for p in h.player_ids) == 0, f"hand {h.number}"


def test_hand_9_raise_then_call_commits_the_difference(hands):
    h = by_number(hands, 9)
    rocky, tex = "Mx2cPj5Wor", "Tz6gBn1Vel"
    kinds = [(a.player_id, a.kind, a.amount) for a in h.actions if a.street == "preflop"]
    assert kinds == [
        (rocky, "post_sb", 1),
        (tex, "post_bb", 2),
        (rocky, "raise", 4),  # raises to 5, already has 1 in
        (tex, "raise", 13),  # raises to 15, already has 2 in
        (rocky, "call", 10),  # calls 15, already has 5 in
    ]
    assert h.actions[2].raise_to == 5
    assert h.board == ["4d", "7s", "3c", "Ts", "As"]
    assert h.uncalled == {tex: 60}
    assert h.collected == {tex: 60}
    assert h.net(tex) == 30 and h.net(rocky) == -30
    # Heads-up: dealer posts the small blind.
    assert h.dealer_id == rocky
    assert h.positions == {rocky: "SB", tex: "BB"}


def test_hand_22_all_in_call_and_showdown(hands):
    h = by_number(hands, 22)
    fish, rocky = "Kw9sDf3Jq_", "Mx2cPj5Wor"
    river = [a for a in h.actions if a.street == "river"]
    assert river[0].kind == "bet" and river[0].amount == 169
    assert river[1].kind == "call" and river[1].amount == 161 and river[1].all_in
    assert h.shown == {rocky: ["Ks", "Jh"], fish: ["Ad", "Ah"]}
    assert h.collected == {fish: 421}
    assert h.net(fish) == 421 - 15 - 33 - 161
    # 4-handed: the lone non-blind, non-button seat is the cutoff.
    assert h.positions == {"Tz6gBn1Vel": "SB", "Hn4vRt8Ybc": "BB", rocky: "CO", fish: "BTN"}


def test_hand_40_missing_small_blind_is_dead_money(hands):
    h = by_number(hands, 40)
    ace = "Qp7zLm2Xa1"
    preflop = [(a.kind, a.amount) for a in h.actions if a.player_id == ace and a.street == "preflop"]
    # Dead SB (1) does not count toward the raise; the missed BB (2) does, so the raise to 6 adds 4.
    assert preflop == [("post_missing_sb", 1), ("post_missing_bb", 2), ("raise", 4), ("call", 12)]
    assert h.collected == {"Tz6gBn1Vel": 80}


def test_streets_reached(hands):
    h = by_number(hands, 9)
    assert h.streets_reached() == ["preflop", "flop", "turn", "river"]
    preflop_only = next(h for h in hands if not h.board)
    assert preflop_only.streets_reached() == ["preflop"]


def test_incomplete_trailing_hand_is_dropped():
    lines = [
        ("t0", '-- starting hand #1 (id: abc)  No Limit Texas Hold\'em (dealer: "A @ a1") --'),
        ("t1", 'Player stacks: #1 "A @ a1" (100) | #2 "B @ b2" (100)'),
        ("t2", '"A @ a1" posts a small blind of 1'),
    ]
    assert parse_messages(lines) == []


def test_six_handed_positions():
    seats = " | ".join(f'#{i} "P{i} @ p{i}" (100)' for i in range(1, 7))
    lines = [
        ("t0", '-- starting hand #1 (id: abc)  No Limit Texas Hold\'em (dealer: "P1 @ p1") --'),
        ("t1", f"Player stacks: {seats}"),
        ("t2", '"P2 @ p2" posts a small blind of 1'),
        ("t3", '"P3 @ p3" posts a big blind of 2'),
        ("t4", '"P4 @ p4" folds'),
        ("t5", '"P5 @ p5" folds'),
        ("t6", '"P6 @ p6" folds'),
        ("t7", '"P1 @ p1" folds'),
        ("t8", '"P2 @ p2" folds'),
        ("t9", 'Uncalled bet of 1 returned to "P3 @ p3"'),
        ("t10", '"P3 @ p3" collected 2 from pot'),
        ("t11", "-- ending hand #1 --"),
    ]
    (h,) = parse_messages(lines)
    assert h.positions == {"p1": "BTN", "p2": "SB", "p3": "BB", "p4": "UTG", "p5": "HJ", "p6": "CO"}
    assert h.net("p3") == 1 and h.net("p2") == -1


def test_your_hand_line_is_kept_as_hero_cards():
    lines = [
        ("t0", '-- starting hand #1 (id: abc)  No Limit Texas Hold\'em (dealer: "A @ a1") --'),
        ("t1", 'Player stacks: #1 "A @ a1" (100) | #2 "B @ b2" (100)'),
        ("t2", "Your hand is K♦, 9♠"),
        ("t3", '"B @ b2" posts a small blind of 1'),
        ("t4", '"A @ a1" posts a big blind of 2'),
        ("t5", '"B @ b2" folds'),
        ("t6", 'Uncalled bet of 1 returned to "A @ a1"'),
        ("t7", '"A @ a1" collected 2 from pot'),
        ("t8", "-- ending hand #1 --"),
    ]
    (h,) = parse_messages(lines)
    assert h.hero_cards == ["Kd", "9s"] and h.shown == {}
