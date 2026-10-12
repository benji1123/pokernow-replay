import json
from pathlib import Path

from pokernow_analyzer.analyze import build_session
from pokernow_analyzer.parser import parse_json_entries
from pokernow_analyzer.reads import reads

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
ROOM = "sample"


def ratio(n, d):
    return {"n": n, "d": d, "value": None if d == 0 else n / d}


def empty_profile():
    return {
        "preflop": {"limp": ratio(0, 0), "steal": ratio(0, 0)},
        "lines": {"cbet": ratio(0, 0), "fold_to_cbet": ratio(0, 0), "river_fold": ratio(0, 0), "river_call_won": ratio(0, 0)},
        "streets": {s: {"check_raise": 0} for s in ("flop", "turn", "river")},
        "meanings": [],
    }


def test_rules_need_a_minimum_sample():
    prof = empty_profile()
    prof["lines"]["fold_to_cbet"] = ratio(5, 7)  # 71% but only 7 spots
    assert reads({}, prof, 50) == []
    prof["lines"]["fold_to_cbet"] = ratio(6, 8)
    assert [r["key"] for r in reads({}, prof, 50)] == ["cbet_often"]
    assert reads({}, prof, 50)[0]["evidence"] == "75% (6/8)"


def test_shown_hand_rules_and_ordering():
    prof = empty_profile()
    prof["meanings"] = [
        {"street": "river", "kind": "bet", "size": "over", "strengths": {"two_pair_plus": ["a", "b", "c", "d"], "top_pair_plus": ["e"]}},
        {"street": "flop", "kind": "bet", "size": "mid", "strengths": {"air": ["f", "g", "h"], "weak_pair": ["i", "j"]}},
    ]
    prof["lines"]["river_call_won"] = ratio(2, 10)  # 20%: value-bet thin, weight 0.8
    got = reads({}, prof, 50)
    keys = [r["key"] for r in got]
    assert set(keys) == {"fold_river_big", "value_thin", "call_flop"}
    assert keys[0] in ("fold_river_big", "value_thin")  # 0.8 ties sort ahead of the 0.6 flop-air read
    assert next(r for r in got if r["key"] == "fold_river_big")["evidence"] == "80% (4/5)"


def test_check_raise_rule_needs_many_hands():
    prof = empty_profile()
    assert "cr_monster" not in [r["key"] for r in reads({}, prof, 99)]
    assert [r["key"] for r in reads({}, prof, 300)] == ["cr_monster"]
    prof["streets"]["turn"]["check_raise"] = 2
    assert reads({}, prof, 300) == []


def test_fixture_reads():
    hands = parse_json_entries(json.loads((FIXTURES / f"{ROOM}.json").read_text()))
    by_name = {p["name"]: p["reads"] for p in build_session([("room", hands)])["players"]}
    assert [r["key"] for r in by_name["Rocky"]] == ["cbet_value", "flop_bet_real"]
    assert by_name["Rocky"][0]["evidence"] == "25% (2/8)"
    assert [r["key"] for r in by_name["Tex"]] == ["defend", "wide_three_bet"]
    assert by_name["Ace"] == []
