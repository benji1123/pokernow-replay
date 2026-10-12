import json
from collections import Counter
from pathlib import Path

from pokernow_analyzer.models import POST_KINDS
from pokernow_analyzer.parser import parse_json_entries
from pokernow_analyzer.profile import compute_profiles, hole_class, size_bucket, straight_outs, strength_label

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
ROOM = "sample"
ROCKY, FISH = "Mx2cPj5Wor", "Kw9sDf3Jq_"


def load():
    return parse_json_entries(json.loads((FIXTURES / f"{ROOM}.json").read_text()))


def test_strength_label_by_street():
    assert strength_label(["Ad", "Ah"], ["Qd", "Ac", "9s"]) == "two_pair_plus"  # set
    assert strength_label(["Ks", "Jh"], ["Qd", "Ac", "9s", "Qs", "3c"]) == "air"
    assert strength_label(["Ks", "Jh"], ["Kd", "7c", "2s"]) == "top_pair_plus"
    assert strength_label(["7s", "6h"], ["Kd", "7c", "2s"]) == "weak_pair"
    assert strength_label(["9s", "9h"], ["Kd", "7c", "2s"]) == "weak_pair"  # pocket pair under the top card
    assert strength_label(["As", "Ah"], ["Kd", "7c", "2s"]) == "top_pair_plus"  # overpair counts as top pair+
    assert strength_label(["As", "4h"], ["Kd", "Kc", "2s"]) == "air"  # pair is only on the board


def test_draws_are_their_own_label_until_the_river():
    assert strength_label(["9s", "8h"], ["7d", "6c", "2s"]) == "draw"  # open-ended straight draw
    assert strength_label(["9s", "8h"], ["7d", "5c", "2s"]) == "draw"  # gutshot
    assert strength_label(["As", "5s"], ["Ks", "7s", "2d"]) == "draw"  # flush draw
    assert strength_label(["Ks", "Jh"], ["Qd", "Ac", "9s"]) == "draw"  # hand 22: Rocky's KJ is a gutshot on the flop
    assert strength_label(["As", "5s"], ["Ks", "7d", "2d"]) == "air"  # backdoor flush only
    assert strength_label(["Ah", "2h"], ["5d", "6c", "7s", "8h"]) == "air"  # straight would be the board's, not the player's
    assert strength_label(["9s", "8h"], ["7d", "6c", "2s", "Kd", "Qh"]) == "air"  # missed by the river
    assert strength_label(["7s", "6s"], ["Kd", "7c", "2s", "8s"]) == "weak_pair"  # a made pair outranks the flush draw
    assert straight_outs(["9s", "8h"], ["7d", "6c", "2s"]) == 2 and straight_outs(["9s", "8h"], ["7d", "5c", "2s"]) == 1


def test_hole_class_and_size_bucket():
    assert [hole_class(h) for h in (["Ad", "Ah"], ["Ks", "Jh"], ["As", "4h"], ["7s", "6s"], ["7s", "2h"])] == ["pair", "broadway", "Ax", "suited_connector", "junk"]
    assert [size_bucket(x) for x in (0.1, 0.39, 0.4, 0.8, 0.81, 1.2, 1.21)] == ["small", "small", "mid", "mid", "big", "big", "over"]


def test_fixture_profile_values():
    hands = load()
    rocky = compute_profiles(hands)[ROCKY]
    pf = rocky["preflop"]
    assert pf["limp"] == {"n": 5, "d": 25, "value": 0.2}
    assert pf["steal"]["n"] == 12 and pf["steal"]["d"] == 27
    assert pf["open_bb"] == {"n": 20, "median": 3.25} and pf["three_bet_mult"] == {"n": 1, "median": 3.0}
    assert pf["vpip_by_pos"]["BTN"]["n"] == 8 and pf["vpip_by_pos"]["BTN"]["d"] == 11
    assert pf["shown"]["raised"]["broadway"] == ["v8hpiajtqcds"]  # hand 22: raised KJ, lost to AA

    lines = rocky["lines"]
    assert (lines["cbet"]["n"], lines["cbet"]["d"]) == (3, 11)
    assert (lines["river_fold"]["n"], lines["river_fold"]["d"]) == (5, 6)
    assert lines["donk"] == 0

    assert rocky["streets"]["river"]["sizes"]["over"] == 3 and rocky["streets"]["flop"]["check_raise"] == 2
    assert rocky["showdown"] == {"river_aggr_shown": {"air": 2, "top_pair_plus": 1}, "caught_bluff": 2, "value_shown": 1}
    river_over = next(m for m in rocky["meanings"] if (m["street"], m["kind"], m["size"]) == ("river", "bet", "over"))
    assert "v8hpiajtqcds" in river_over["strengths"]["air"] and len(river_over["strengths"]["air"]) == 2


def test_action_counts_cover_every_postflop_action():
    hands = load()
    profiles = compute_profiles(hands)
    expected = Counter()
    for h in hands:
        for a in h.actions:
            if a.kind not in POST_KINDS and a.street != "preflop":
                expected[(a.player_id, a.street, a.kind)] += 1
    got = Counter()
    for pid, p in profiles.items():
        for st, data in p["streets"].items():
            for kind, n in data["actions"].items():
                got[(pid, st, kind)] += n
    assert got == expected


def test_meanings_only_from_shown_hands_and_in_order():
    hands = load()
    by_id = {h.hand_id: h for h in hands}
    for pid, p in compute_profiles(hands).items():
        for m in p["meanings"]:
            for ids in m["strengths"].values():
                assert all(pid in by_id[i].shown for i in ids)
        order = [("flop", "turn", "river").index(m["street"]) for m in p["meanings"]]
        assert order == sorted(order)
