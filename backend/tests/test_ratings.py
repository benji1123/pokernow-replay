from pokernow_analyzer.ratings import ratings


def ratio(n, d):
    return {"n": n, "d": d, "value": None if d == 0 else n / d}


def profile(meanings=(), **lines):
    return {"meanings": list(meanings), "lines": lines}


def by_key(out):
    return {r["key"]: r["value"] for r in out}


def test_scales_are_clamped_to_0_99():
    stats = {"hands": 100, "vpip": ratio(90, 100), "pfr": ratio(50, 100), "af_postflop": {"n": 50, "d": 5, "value": 10.0}, "fold_to_pfr": ratio(0, 20)}
    r = by_key(ratings(stats, profile(fold_to_cbet=ratio(0, 10), river_fold=ratio(0, 5))))
    assert r == {"loose": 99, "aggr": 99, "bluff": None, "stubborn": 99}
    stats.update(vpip=ratio(5, 100), pfr=ratio(0, 100), af_postflop={"n": 0, "d": 20, "value": 0.0}, fold_to_pfr=ratio(20, 20))
    r = by_key(ratings(stats, profile(fold_to_cbet=ratio(10, 10), river_fold=ratio(5, 5))))
    assert r == {"loose": 0, "aggr": 0, "bluff": None, "stubborn": 0}


def test_midpoints():
    stats = {"hands": 100, "vpip": ratio(425, 1000), "pfr": ratio(175, 1000), "af_postflop": {"n": 20, "d": 10, "value": 2.0}, "fold_to_pfr": ratio(10, 20)}
    r = by_key(ratings(stats, profile(fold_to_cbet=ratio(5, 10), river_fold=ratio(5, 10))))
    assert all(49 <= r[k] <= 50 for k in ("loose", "aggr", "stubborn"))


def test_bluffing_counts_air_and_draws_across_streets():
    meanings = [
        {"street": "flop", "kind": "bet", "size": "mid", "strengths": {"air": ["a", "b"], "draw": ["c"], "top_pair_plus": ["d"]}},
        {"street": "river", "kind": "raise", "size": "over", "strengths": {"two_pair_plus": ["e", "f"]}},
    ]
    r = by_key(ratings({"hands": 50}, profile(meanings)))
    assert r["bluff"] in (82, 83)  # 3 of 6 = 50% on a 0-60% scale
    meanings[0]["strengths"] = {"air": ["a"], "top_pair_plus": ["d"]}  # 4 shown, under the floor of 5
    assert by_key(ratings({"hands": 50}, profile(meanings)))["bluff"] is None


def test_thin_samples_are_none_but_keep_detail():
    stats = {"hands": 10, "vpip": ratio(5, 10), "pfr": ratio(2, 10), "af_postflop": {"n": 2, "d": 1, "value": 2.0}, "fold_to_pfr": ratio(1, 2)}
    out = ratings(stats, profile())
    assert [r["value"] for r in out] == [None] * 4
    assert [r["label"] for r in out] == ["Looseness", "Aggression", "Bluffing", "Stubbornness"]
    assert out[0]["detail"] == "VPIP 50%"
