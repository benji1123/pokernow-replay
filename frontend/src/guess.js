// Guess the hand: an opponent's line through some postflop action, with sizes; you say what they had at that
// moment. Built from hands where their cards were seen (showdown or shown), so the reveal is always real.
import { decisionPoints, sizeBucket, SIZE_LABEL } from "./decisions.js";
import { strengthLabel, STRENGTHS, STRENGTH_LABEL } from "./strength.js";
import { categoryOf } from "./equity.js";

const BOARD_CARDS = { flop: 3, turn: 4, river: 5 };

/** One question per (hand, opponent whose cards were seen): their line up to their last voluntary postflop action.
 * The hero is skipped: you knew your own cards. */
export function guessQuestions(hands, hero) {
  const out = [];
  for (const h of hands) {
    const shown = Object.entries(h.shown ?? {}).filter(([p, c]) => p !== hero && c?.length === 2);
    if (!shown.length || h.board.length < 3) continue;
    const all = decisionPoints(h);
    for (const [pid, cards] of shown) {
      const mine = all.filter((d) => d.pid === pid && d.street !== "preflop" && !d.free);
      if (!mine.length) continue;
      const d = mine.at(-1);
      const board = h.board.slice(0, BOARD_CARDS[d.street]);
      const answer = strengthLabel(cards, board);
      const options = STRENGTHS.filter((s) => d.street !== "river" || s !== "draw");
      out.push({
        hand: h, pid, cards, board, street: d.street, pos: d.pos, pot: d.pot, toCall: d.toCall, inHand: d.inHand,
        line: [...d.trail, { street: d.street, pid, ...d.action, pot: d.pot }],
        action: d.action,
        aggressive: d.action.kind === "bet" || d.action.kind === "raise",
        size: d.action.kind === "bet" || d.action.kind === "raise" ? sizeBucket(d.action.frac) : null,
        answer,
        options: options.map((s) => ({ key: s, label: STRENGTH_LABEL[s], correct: s === answer })),
        after: all.filter((x) => x.idx > d.idx).map((x) => ({ street: x.street, pid: x.pid, ...x.action, pot: x.pot })),
        net: h.net[pid],
        finalCategory: h.board.length === 5 ? categoryOf([...cards, ...h.board]) : null,
      });
    }
  }
  return out;
}

/** How this player's other shown actions of the same kind, size and street broke down, from the backend's grid. */
export function priorShown(player, q) {
  if (!q.aggressive) return null;
  const cell = (player?.profile?.meanings ?? []).find((m) => m.street === q.street && m.kind === q.action.kind && m.size === q.size);
  if (!cell) return null;
  const parts = STRENGTHS.map((s) => [s, (cell.strengths[s] ?? []).length]).filter(([, n]) => n > 0);
  const n = parts.reduce((a, [, k]) => a + k, 0);
  return { n, parts, sizeLabel: SIZE_LABEL[q.size] };
}

export const GUESS_FILTERS = [
  ["all", "All lines"],
  ["aggressive", "Bets and raises"],
  ["passive", "Calls and checks"],
  ["river", "River"],
];

export function filterGuess(qs, key) {
  if (key === "aggressive") return qs.filter((q) => q.aggressive);
  if (key === "passive") return qs.filter((q) => !q.aggressive);
  if (key === "river") return qs.filter((q) => q.street === "river");
  return qs;
}
