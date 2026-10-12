import json
from pathlib import Path

import pytest

from pokernow_analyzer.aliases import auto_groups, merge_players
from pokernow_analyzer.analyze import build_session
from pokernow_analyzer.parser import parse_json_entries, parse_messages
from pokernow_analyzer.stats import compute_stats

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"


def game(hand_no, names_ids, winner):
    """One tiny hand: everyone but `winner` folds to the winner's raise. names_ids: [(name, id), ...], first is dealer."""
    stacks = " | ".join(f'#{i + 1} "{n} @ {pid}" (100)' for i, (n, pid) in enumerate(names_ids))
    (dn, did), (sn, sid), (bn, bid), *rest = names_ids
    lines = [
        ("t0", f'-- starting hand #{hand_no} (id: h{hand_no}{did})  No Limit Texas Hold\'em (dealer: "{dn} @ {did}") --'),
        ("t1", f"Player stacks: {stacks}"),
        ("t2", f'"{sn} @ {sid}" posts a small blind of 1'),
        ("t3", f'"{bn} @ {bid}" posts a big blind of 2'),
    ]
    order = rest + [(dn, did), (sn, sid), (bn, bid)]
    for n, pid in order:
        lines.append(("t4", f'"{n} @ {pid}" raises to 6' if pid == winner else f'"{n} @ {pid}" folds'))
    lines += [("t5", f'Uncalled bet of 4 returned to "{dict((p, n) for n, p in names_ids)[winner]} @ {winner}"'),
              ("t6", f'"{dict((p, n) for n, p in names_ids)[winner]} @ {winner}" collected 5 from pot'),
              ("t7", f"-- ending hand #{hand_no} --")]
    return parse_messages(lines)


def test_auto_merges_same_name_across_games_but_not_within_a_hand():
    g1 = game(1, [("David", "d1"), ("Ace", "a1"), ("Ace", "a2")], "d1")  # two Alexes at one table: two people
    g2 = game(1, [("David", "d2"), ("Bob", "b1"), ("Ace", "a1")], "a1")  # David again from another device
    hands = g1 + g2
    assert auto_groups(hands) == [{"d1", "d2"}]
    merged = merge_players(hands, manual=[])
    assert merged == {"d1": ["d2"]} or merged == {"d2": ["d1"]}
    stats = compute_stats(hands)
    assert len(stats) == 4 and {s.name for s in stats.values()} == {"David", "Ace", "Bob"}
    david = next(s for s in stats.values() if s.name == "David")
    assert david.hands == 2 and david.net == 3  # game 1: collected 5 for 2 put in; game 2: dealer folds, 0
    assert all(len({s.player_id for s in h.seats}) == len(h.seats) for h in hands)


def test_manual_merge_and_refusal_when_they_shared_a_hand():
    g1 = game(1, [("Ben", "x1"), ("Jon", "j1"), ("Ace", "a1")], "x1")
    g2 = game(1, [("Bon", "x2"), ("Jon", "j1"), ("Ace", "a1")], "j1")
    hands = g1 + g2
    merged = merge_players(hands, manual=[["x1", "x2"]], auto=False)
    assert merged in ({"x1": ["x2"]}, {"x2": ["x1"]})
    assert {s.name for s in compute_stats(hands).values()} >= {"Jon", "Ace"} and len(compute_stats(hands)) == 3
    with pytest.raises(ValueError, match="both sat in hand #1"):
        merge_players(g1 + g2, manual=[["j1", "a1"]])


def test_canonical_id_is_the_one_with_most_hands():
    g1 = game(1, [("Sam", "s_many"), ("P", "p1"), ("Q", "q1")], "p1") + game(2, [("Sam", "s_many"), ("P", "p1"), ("Q", "q1")], "q1")
    g2 = game(1, [("Sam", "s_few"), ("P", "p1"), ("Q", "q1")], "p1")
    assert merge_players(g1 + g2, manual=[]) == {"s_many": ["s_few"]}


def test_fixture_session_has_nothing_to_merge():
    hands = parse_json_entries(json.loads((FIXTURES / "sample.json").read_text()))
    body = build_session([("room", hands)])
    assert all(p["merged_ids"] == [] for p in body["players"])
    assert body["players"][0]["net"] == -627
