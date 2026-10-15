// Hand-strength classes at a street: a port of profile.strength_label (Python), kept identical so the quiz
// agrees with the "What a bet means" grid. Made hands win over draws; nothing is a draw on the river.
import { evaluate, rankOf } from "./equity.js";

export const STRENGTHS = ["air", "draw", "weak_pair", "top_pair_plus", "two_pair_plus"];
export const STRENGTH_LABEL = { air: "Air", draw: "A draw", weak_pair: "A weak pair", top_pair_plus: "Top pair", two_pair_plus: "Two pair or better" };

const category = (cards) => (cards.length >= 5 ? Math.floor(evaluate(cards) / 15 ** 5) : -1);

function hasFlushDraw(hole, board) {
  const suits = {};
  for (const c of [...hole, ...board]) suits[c[1]] = (suits[c[1]] || 0) + 1;
  return Object.entries(suits).some(([s, n]) => n === 4 && hole.some((c) => c[1] === s));
}

// Ranks that complete a straight using a hole card: 2+ is an open-ender or double gutshot, 1 a gutshot.
function straightOuts(hole, board) {
  const known = [...hole, ...board];
  const suits = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of known) suits[c[1]]++;
  const dummy = "shdc".split("").reduce((a, b) => (suits[b] < suits[a] ? b : a)); // can't complete a flush
  let outs = 0;
  for (const r of "23456789TJQKA") {
    const card = r + dummy;
    if (category([...known, card]) >= 4 && category([...board, card]) < 4) outs++;
  }
  return outs;
}

export function strengthLabel(hole, board) {
  const cat = category([...hole, ...board]);
  if (cat >= 2) return "two_pair_plus";
  if (cat === 1) {
    const boardRanks = new Set(board.map((c) => c[0]));
    const pocket = hole[0][0] === hole[1][0];
    const hits = hole.filter((c) => boardRanks.has(c[0]));
    if (pocket || hits.length) {
      const top = Math.max(...board.map(rankOf));
      const rank = pocket ? rankOf(hole[0]) : Math.max(...hits.map(rankOf));
      return rank >= top ? "top_pair_plus" : "weak_pair";
    }
  }
  if (board.length >= 3 && board.length <= 4 && (hasFlushDraw(hole, board) || straightOuts(hole, board) >= 1)) return "draw";
  return "air";
}
