import json
from pathlib import Path

import pytest

from pokernow_analyzer.archetypes import MAX_BADGES, MIN_HANDS, Table, archetypes_for, assign_archetypes
from pokernow_analyzer.parser import parse_json_entries
from pokernow_analyzer.stats import PlayerStats, Stat, compute_stats

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
ROCKY, FISH, TEX, BLUFFY, ACE = "Mx2cPj5Wor", "Kw9sDf3Jq_", "Tz6gBn1Vel", "Hn4vRt8Ybc", "Qp7zLm2Xa1"


@pytest.fixture(scope="module")
def stats():
    return compute_stats(parse_json_entries(json.loads((FIXTURES / "sample.json").read_text())))


def labels(badges):
    return [b["label"] for b in badges]


def test_fixture_session_badges(stats):
    badges = assign_archetypes(stats)
    # Rocky: biggest loser at 60% VPIP; 10/30 WTSD but only 2/10 W$SD.
    assert labels(badges[ROCKY]) == ["Whale", "Loose Cannon", "Draw Chaser"]
    # Tex: VPIP 42 / PFR 35 / AF 3.1, 3-bet 4 of 19.
    assert labels(badges[TEX]) == ["LAG", "3-Bet Machine"]
    # Fish: biggest winner, VPIP 49 with AF 0.4 and 4/20 raise share.
    assert labels(badges[FISH]) == ["Shark", "Calling Station"]
    assert labels(badges[ACE]) == ["Loose Cannon"]
    assert labels(badges[BLUFFY]) == ["Small sample"] and stats[BLUFFY].hands < MIN_HANDS
    assert badges[ROCKY][0] == {"key": "whale", "label": "Whale", "emoji": "🐳",
                                 "blurb": "Biggest loser at the table, and plays a lot of hands getting there."}


def player(**kw) -> PlayerStats:
    s = PlayerStats("p", "P", hands=kw.pop("hands", 50))
    for key, (n, d) in kw.items():
        setattr(s, key, Stat(n, d))
    return s


NOBODY = Table(biggest_winner=None, biggest_loser=None)


def test_rock_and_tag_are_tight():
    rock = player(vpip=(8, 50), pfr=(6, 50), af_total=(10, 4))
    assert labels(a.to_dict() for a in archetypes_for(rock, NOBODY)) == ["TAG", "Rock"]
    tag = player(vpip=(12, 50), pfr=(10, 50), af_total=(20, 10))
    assert labels(a.to_dict() for a in archetypes_for(tag, NOBODY)) == ["TAG"]


def test_maniac_outranks_loose_cannon_and_caps_at_three():
    s = player(vpip=(30, 50), pfr=(20, 50), af_total=(30, 10), three_bet=(5, 20), fold_to_pfr=(2, 20), wtsd=(10, 25))
    got = labels(a.to_dict() for a in archetypes_for(s, NOBODY))
    assert got == ["Maniac", "Loose Cannon", "Sheriff"] and len(got) == MAX_BADGES


def test_small_samples_never_fire_stat_badges():
    s = player(vpip=(25, 50), three_bet=(2, 4), wsd=(3, 3), fold_to_pfr=(4, 4))
    assert labels(a.to_dict() for a in archetypes_for(s, NOBODY)) == ["Loose Cannon"]


def test_whale_needs_loss_and_volume():
    tight_loser = player(vpip=(10, 50))
    tight_loser.net = -500
    assert labels(a.to_dict() for a in archetypes_for(tight_loser, Table(None, "p"))) == ["Rock"]
    loose_loser = player(vpip=(25, 50))
    loose_loser.net = -500
    assert labels(a.to_dict() for a in archetypes_for(loose_loser, Table(None, "p"))) == ["Whale", "Loose Cannon"]
