import json
from pathlib import Path

import pytest

from pokernow_analyzer.analyze import AnalysisError, analyze, analyze_json, room_from_filename

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
ROOM = "sample"


def fixture_csv(entries=None):
    entries = entries or json.loads((FIXTURES / f"{ROOM}.json").read_text())
    # PokerNow's download shape: entry,at,order, newest first.
    rows = ["entry,at,order"] + ['"{}",{},{}'.format(e["msg"].replace('"', '""'), e["at"], e["created_at"]) for e in reversed(entries)]
    return "\n".join(rows)


def test_single_csv_returns_players_and_hands():
    body = analyze([(f"poker_now_log_{ROOM}.csv", "\ufeff" + fixture_csv())])  # Excel-style BOM must not matter
    assert body["room"] == ROOM and body["hand_count"] == 63
    assert body["games"] == [{"room": ROOM, "hand_count": 63}]
    assert [p["name"] for p in body["players"]] == ["Rocky", "Tex", "Fish", "Ace", "Bluffy Jr."]
    rocky = body["players"][0]
    assert rocky["net"] == -627
    assert rocky["vpip"] == {"n": 38, "d": 63, "value": 38 / 63}
    assert rocky["nemesis"] == {"player_id": "Kw9sDf3Jq_", "amount": 234} and rocky["best_friend"] is None
    assert [b["key"] for b in rocky["archetypes"]] == ["whale", "loose_cannon", "draw_chaser"]
    assert body["hands"][21]["number"] == 22 and body["hands"][21]["net"]["Kw9sDf3Jq_"] == 212
    assert body["hands"][21]["game"] == ROOM


def test_multiple_files_merge_and_dedupe():
    entries = json.loads((FIXTURES / f"{ROOM}.json").read_text())
    entries.sort(key=lambda e: int(e["created_at"]))
    # Hands 1-10 again under a second room code (duplicates), plus the whole log: dedupe must leave 63.
    cut = next(i for i, e in enumerate(entries) if e["msg"].startswith("-- ending hand #10 "))
    body = analyze([(f"poker_now_log_{ROOM}.csv", fixture_csv()), ("poker_now_log_otherRoom.csv", fixture_csv(entries[: cut + 1]))])
    assert body["hand_count"] == 63 and body["room"] == ROOM
    assert body["players"][0]["net"] == -627

    # Two genuinely different games: hands 1-10 relabelled with fresh ids count as a second game.
    second = [dict(e, msg=e["msg"].replace("(id: ", "(id: x")) for e in entries[: cut + 1]]
    body = analyze([(f"poker_now_log_{ROOM}.csv", fixture_csv()), ("poker_now_log_otherRoom.csv", fixture_csv(second))])
    assert body["room"] == "2 games" and body["hand_count"] == 73
    assert body["games"] == [{"room": ROOM, "hand_count": 63}, {"room": "otherRoom", "hand_count": 10}]
    assert sorted(h["game"] for h in body["hands"]).count("otherRoom") == 10
    # Chronological order across games, so the duplicate-timestamp hands interleave by (started_at, number).
    assert [h["started_at"] for h in body["hands"]] == sorted(h["started_at"] for h in body["hands"])


def test_wrong_file_rejected():
    with pytest.raises(AnalysisError, match=r"^ledger\.csv:"):
        analyze([("ledger.csv", "player_nickname,net\nBob,10\n")])
    with pytest.raises(AnalysisError, match="No complete hands"):
        analyze([("poker_now_log_x.csv", "entry,at,order\n")])


def two_christs():
    """Fixture log plus a 10-hand second game where Rocky shows up under a new id. Returns (files, rocky_id, new_id)."""
    entries = json.loads((FIXTURES / f"{ROOM}.json").read_text())
    entries.sort(key=lambda e: int(e["created_at"]))
    cut = next(i for i, e in enumerate(entries) if e["msg"].startswith("-- ending hand #10 "))
    second = [dict(e, msg=e["msg"].replace("(id: ", "(id: x").replace("Rocky @ Mx2cPj5Wor", "Rocky @ NEWDEVICE")) for e in entries[: cut + 1]]
    return [(f"poker_now_log_{ROOM}.csv", fixture_csv()), ("poker_now_log_otherRoom.csv", fixture_csv(second))], "Mx2cPj5Wor", "NEWDEVICE"


def test_auto_merge_folds_same_name_from_another_device():
    files, rocky, new = two_christs()
    body = analyze(files)
    assert [p["name"] for p in body["players"]].count("Rocky") == 1
    c = next(p for p in body["players"] if p["name"] == "Rocky")
    assert c["player_id"] == rocky and c["merged_ids"] == [new] and c["hands"] == 73
    assert c["names"] == ["Rocky"]  # same display name on both devices

    assert [p["name"] for p in analyze(files, auto_merge=False)["players"]].count("Rocky") == 2


def test_manual_merge_and_refusal():
    files, rocky, new = two_christs()
    body = analyze(files, merges=[[rocky, new]], auto_merge=False)
    assert [p["name"] for p in body["players"]].count("Rocky") == 1
    assert next(p for p in body["players"] if p["name"] == "Rocky")["merged_ids"] == [new]

    with pytest.raises(AnalysisError, match="both sat in hand #"):
        analyze(files, merges=[["Mx2cPj5Wor", "Kw9sDf3Jq_"]])  # Rocky and Fish sat together
    with pytest.raises(AnalysisError, match="merges must be"):
        analyze(files, merges=["not", "lists"])


def test_merged_player_lists_every_display_name():
    files, rocky, new = two_christs()
    (n1, t1), (n2, t2) = files
    renamed = [(n1, t1), (n2, t2.replace("Rocky @ NEWDEVICE", "Rock @ NEWDEVICE"))]
    body = analyze(renamed, merges=[[rocky, new]], auto_merge=False)
    c = next(p for p in body["players"] if p["player_id"] == rocky)
    assert c["names"] == ["Rocky", "Rock"]
    assert [p["names"] for p in analyze(files)["players"] if p["name"] == "Tex"] == [["Tex"]]


def test_analyze_json_is_the_browser_boundary():
    files, rocky, new = two_christs()
    req = {"files": [{"name": n, "text": t} for n, t in files], "merges": [[rocky, new]], "auto_merge": False}
    out = json.loads(analyze_json(json.dumps(req)))
    assert out["session"]["hand_count"] == 73
    assert next(p for p in out["session"]["players"] if p["name"] == "Rocky")["merged_ids"] == [new]

    out = json.loads(analyze_json(json.dumps({"files": [{"name": "ledger.csv", "text": "a,b\n1,2\n"}]})))
    assert out == {"error": "ledger.csv: expected the poker_now_log_<room>.csv download (columns entry,at,order)"}


def test_room_from_filename_handles_browser_copies():
    assert room_from_filename("poker_now_log_pglQyJjZdRs.csv") == "pglQyJjZdRs"
    assert room_from_filename("poker_now_log_pgl_Qy-Jj (1).csv") == "pgl_Qy-Jj"
    assert room_from_filename("poker_now_log_pglQyJjZdRs (12).csv") == "pglQyJjZdRs"
    assert room_from_filename("something_else.csv") == "something_else.csv"
    assert room_from_filename(None) == "upload"


def test_bluff_stats_on_fixture():
    body = analyze([(f"poker_now_log_{ROOM}.csv", fixture_csv())])
    rocky = next(p for p in body["players"] if p["name"] == "Rocky")
    tex = next(p for p in body["players"] if p["name"] == "Tex")
    assert rocky["bluffs_shown"] == {"n": 5, "d": 8, "value": 0.625}
    # 5/8 of shown bets were air or a draw, applied to all 22 postflop bets/raises -> ~14
    assert rocky["est_bluffs"] == {"n": 14, "d": 22, "value": 0.625}
    # Fewer than 5 shown bets: no estimate, but the shown count is still reported
    assert tex["bluffs_shown"]["d"] == 3 and tex["est_bluffs"]["n"] is None and tex["est_bluffs"]["value"] is None
