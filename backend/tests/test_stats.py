import json
from pathlib import Path

import pytest

from pokernow_analyzer.parser import parse_json_entries, parse_messages
from pokernow_analyzer.stats import compute_stats, hand_facts, money_flow

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
ROCKY, FISH, TEX, BLUFFY, ACE = "Mx2cPj5Wor", "Kw9sDf3Jq_", "Tz6gBn1Vel", "Hn4vRt8Ybc", "Qp7zLm2Xa1"


@pytest.fixture(scope="module")
def hands():
    return parse_json_entries(json.loads((FIXTURES / "sample.json").read_text()))


@pytest.fixture(scope="module")
def stats(hands):
    return compute_stats(hands)


def by_number(hands, n):
    return next(h for h in hands if h.number == n)


def test_net_matches_pokernow_ledger(stats):
    ledger = json.loads((FIXTURES / "sample.ledger.json").read_text())["playersInfos"]
    assert {pid: s.net for pid, s in stats.items()} == {pid: p["net"] for pid, p in ledger.items()}


def test_hands_dealt(stats):
    assert {s.name: s.hands for s in stats.values()} == {"Rocky": 63, "Tex": 62, "Fish": 41, "Bluffy Jr.": 17, "Ace": 32}


def test_hand_22_facts(hands):
    # Rocky opens to 7, Fish 3-bets to 15, blinds fold, Rocky calls; showdown, Fish wins.
    f = hand_facts(by_number(hands, 22))
    assert f[ROCKY].vpip and f[ROCKY].pfr and f[ROCKY].opened_and_faced_3bet and not f[ROCKY].folded_to_3bet
    assert f[ROCKY].showdown and not f[ROCKY].won_at_showdown
    assert f[FISH].faced_open and f[FISH].three_bet and f[FISH].won_at_showdown
    # Blinds folded facing two raises: that is not a fold-to-open opportunity.
    assert not f[TEX].faced_open and not f[BLUFFY].faced_open and not f[TEX].vpip
    assert not f[TEX].saw_flop and f[FISH].saw_flop
    assert f[ROCKY].aggr == {"preflop": 1, "postflop": 2} and f[ROCKY].calls == {"preflop": 1, "postflop": 0}
    assert f[FISH].calls == {"preflop": 0, "postflop": 2}


def test_hand_9_opener_folds_river_is_not_showdown(hands):
    f = hand_facts(by_number(hands, 9))
    assert f[ROCKY].saw_flop and not f[ROCKY].showdown
    assert f[TEX].three_bet and not f[TEX].showdown


def test_stat_values_for_bluffy(stats):
    s = stats[BLUFFY]
    assert (s.vpip.n, s.vpip.d) == (14, 17)
    assert s.pfr.n == 0
    assert s.af_preflop.value == 0.0
    assert s.fold_to_three_bet.value is None  # never opened into a 3-bet


def test_blind_posts_are_not_voluntary():
    lines = [
        ("t0", '-- starting hand #1 (id: abc)  No Limit Texas Hold\'em (dealer: "A @ a1") --'),
        ("t1", 'Player stacks: #1 "A @ a1" (100) | #2 "B @ b2" (100) | #3 "C @ c3" (100)'),
        ("t2", '"B @ b2" posts a small blind of 1'),
        ("t3", '"C @ c3" posts a big blind of 2'),
        ("t4", '"A @ a1" folds'),
        ("t5", '"B @ b2" calls 2'),
        ("t6", '"C @ c3" checks'),
        ("t7", "Flop:  [2♣, 3♣, 4♣]"),
        ("t8", '"B @ b2" bets 2'),
        ("t9", '"C @ c3" folds'),
        ("t10", 'Uncalled bet of 2 returned to "B @ b2"'),
        ("t11", '"B @ b2" collected 4 from pot'),
        ("t12", "-- ending hand #1 --"),
    ]
    s = compute_stats(parse_messages(lines))
    assert s["b2"].vpip.n == 1 and s["c3"].vpip.n == 0 and s["a1"].vpip.n == 0
    assert s["b2"].pfr.n == 0
    assert s["b2"].af_postflop.n == 1 and s["b2"].af_preflop.d == 1
    # No raise preflop, so nobody faced an open.
    assert all(p.three_bet.d == 0 for p in s.values())
    assert s["b2"].wtsd.d == 1 and s["b2"].wtsd.n == 0


def test_money_flow_hand_22(hands):
    # Fish won 212 = Rocky's 209 + the two blinds (Tex 1, Bluffy 2).
    assert money_flow(by_number(hands, 22)) == {ROCKY: {FISH: 209.0}, TEX: {FISH: 1.0}, BLUFFY: {FISH: 2.0}}


def test_vs_matrix_balances(stats):
    for pid, s in stats.items():
        assert sum(s.vs.values()) == pytest.approx(s.net)
        for other, amt in s.vs.items():
            assert stats[other].vs[pid] == pytest.approx(-amt)


def test_nemesis_and_best_friend(stats):
    rocky = stats[ROCKY]
    assert {pid: round(v) for pid, v in rocky.vs.items()} == {TEX: -54, BLUFFY: -157, FISH: -234, ACE: -182}
    assert rocky.nemesis == {"player_id": FISH, "amount": 234}
    assert rocky.best_friend is None  # Rocky lost to everyone
    assert stats[ACE].best_friend == {"player_id": ROCKY, "amount": 182}
    assert stats[ACE].nemesis == {"player_id": TEX, "amount": 68}
    assert stats[FISH].to_dict()["vs"] == {TEX: 9, ROCKY: 234, BLUFFY: 6, ACE: -27}


def test_money_flow_splits_across_losers_proportionally():
    lines = [
        ("t0", '-- starting hand #1 (id: abc)  No Limit Texas Hold\'em (dealer: "A @ a1") --'),
        ("t1", 'Player stacks: #1 "A @ a1" (100) | #2 "B @ b2" (100) | #3 "C @ c3" (100)'),
        ("t2", '"B @ b2" posts a small blind of 1'),
        ("t3", '"C @ c3" posts a big blind of 2'),
        ("t4", '"A @ a1" raises to 6'),
        ("t5", '"B @ b2" calls 6'),
        ("t6", '"C @ c3" calls 6'),
        ("t7", "Flop:  [2♣, 3♣, 4♣]"),
        ("t8", '"B @ b2" bets 10'),
        ("t9", '"C @ c3" folds'),
        ("t10", '"A @ a1" calls 10'),
        ("t11", "Turn: 2♣, 3♣, 4♣ [9♦]"),
        ("t12", '"B @ b2" checks'),
        ("t13", '"A @ a1" checks'),
        ("t14", "River: 2♣, 3♣, 4♣, 9♦ [9♠]"),
        ("t15", '"B @ b2" checks'),
        ("t16", '"A @ a1" checks'),
        ("t17", '"A @ a1" shows a A♠, K♠.'),
        ("t18", '"A @ a1" collected 38 from pot with Ace High'),
        ("t19", "-- ending hand #1 --"),
    ]
    hand = parse_messages(lines)[0]
    assert hand.net("a1") == 22 and hand.net("b2") == -16 and hand.net("c3") == -6
    assert money_flow(hand) == {"b2": {"a1": 16.0}, "c3": {"a1": 6.0}}


def test_takedown_is_a_postflop_bet_that_ends_the_hand(hands):
    # #2: Rocky bets the turn, Tex folds -> takedown. #11: Rocky's bets get called and the river checks through -> none.
    assert hand_facts(by_number(hands, 2))[ROCKY].takedowns == 1
    assert hand_facts(by_number(hands, 11))[ROCKY].takedowns == 0
    # Everyone folding to a preflop raise is a steal, not a postflop takedown.
    assert all(f.takedowns == 0 for h in hands if len(h.board) == 0 for f in hand_facts(h).values())


def test_takedown_stat_for_rocky(stats):
    assert (stats[ROCKY].takedown.n, stats[ROCKY].takedown.d) == (9, 22)
    assert stats[ROCKY].takedown.d == stats[ROCKY].af_postflop.n
