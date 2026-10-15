"""Hand model produced by the parser. Shaped so a replay can step through `actions` in order."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

Street = Literal["preflop", "flop", "turn", "river"]
STREETS: tuple[Street, ...] = ("preflop", "flop", "turn", "river")

ActionKind = Literal[
    "post_sb", "post_bb", "post_straddle", "post_ante", "post_missing_sb", "post_missing_bb",
    "fold", "check", "call", "bet", "raise",
]
POST_KINDS = {"post_sb", "post_bb", "post_straddle", "post_ante", "post_missing_sb", "post_missing_bb"}
AGGRESSIVE_KINDS = {"bet", "raise"}


@dataclass
class Seat:
    seat: int
    player_id: str
    name: str
    stack: int


@dataclass
class Action:
    street: Street
    player_id: str
    kind: ActionKind
    # Chips this action adds to the pot. For "raises to N" this is the increment, not N.
    amount: int = 0
    # For raises: the total the player has committed on this street after the raise ("raises to N").
    raise_to: int | None = None
    all_in: bool = False


@dataclass
class Hand:
    number: int
    hand_id: str
    started_at: str
    dealer_id: str
    seats: list[Seat]
    actions: list[Action] = field(default_factory=list)
    board: list[str] = field(default_factory=list)
    # player_id -> hole cards, only known when shown at showdown.
    shown: dict[str, list[str]] = field(default_factory=dict)
    # Hole cards of whoever downloaded the log ("Your hand is ..."), on every hand they were dealt into.
    hero_cards: list[str] | None = None
    # player_id -> chips collected from the pot (summed over side pots).
    collected: dict[str, int] = field(default_factory=dict)
    # player_id -> uncalled bet returned.
    uncalled: dict[str, int] = field(default_factory=dict)
    # player_id -> position label (BTN, SB, BB, UTG, ..., CO).
    positions: dict[str, str] = field(default_factory=dict)
    # Room code of the log this hand came from; lets several uploaded games share one session.
    game: str = ""
    raw: list[str] = field(default_factory=list)

    @property
    def player_ids(self) -> list[str]:
        return [s.player_id for s in self.seats]

    def contributed(self, player_id: str) -> int:
        return sum(a.amount for a in self.actions if a.player_id == player_id)

    def net(self, player_id: str) -> int:
        return (
            self.collected.get(player_id, 0)
            + self.uncalled.get(player_id, 0)
            - self.contributed(player_id)
        )

    def streets_reached(self) -> list[Street]:
        return list(STREETS[: 1 + len([c for c in (3, 4, 5) if len(self.board) >= c])])

    def to_dict(self) -> dict:
        d = asdict(self)
        d["net"] = {pid: self.net(pid) for pid in self.player_ids}
        return d
