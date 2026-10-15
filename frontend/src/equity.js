// Hold'em equity against known hands: exact enumeration of the remaining board on the flop and turn, seeded
// Monte Carlo preflop (C(48,5) is too many to enumerate in the browser). Cards are strings like "Ks", "Td".

const RANKS = "23456789TJQKA";
const SUITS = "cdhs";

export const rankOf = (c) => RANKS.indexOf(c[0]) + 2; // 2..14
export const suitOf = (c) => c[1];

export function deck(except = []) {
  const used = new Set(except);
  const out = [];
  for (const r of RANKS) for (const s of SUITS) if (!used.has(r + s)) out.push(r + s);
  return out;
}

// Score a 5-7 card hand as one integer: category in the top digit, then up to five tiebreak ranks in base 15.
export function evaluate(cards) {
  const counts = new Array(15).fill(0);
  const bySuit = { c: [], d: [], h: [], s: [] };
  for (const c of cards) {
    counts[rankOf(c)]++;
    bySuit[suitOf(c)].push(rankOf(c));
  }
  const flushSuit = Object.values(bySuit).find((rs) => rs.length >= 5);
  if (flushSuit) {
    const sf = straightHigh(flushSuit);
    if (sf) return score(8, [sf]);
  }
  const groups = []; // [count, rank] sorted by count desc then rank desc
  for (let r = 14; r >= 2; r--) if (counts[r]) groups.push([counts[r], r]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (groups[0][0] === 4) return score(7, [groups[0][1], kicker(groups, 1, 1)[0]]);
  if (groups[0][0] === 3 && groups[1]?.[0] >= 2) return score(6, [groups[0][1], groups[1][1]]);
  if (flushSuit) return score(5, flushSuit.sort((a, b) => b - a).slice(0, 5));
  const st = straightHigh(groups.map((g) => g[1]));
  if (st) return score(4, [st]);
  if (groups[0][0] === 3) return score(3, [groups[0][1], ...kicker(groups, 1, 2)]);
  if (groups[0][0] === 2 && groups[1]?.[0] === 2) return score(2, [groups[0][1], groups[1][1], kicker(groups, 2, 1)[0]]);
  if (groups[0][0] === 2) return score(1, [groups[0][1], ...kicker(groups, 1, 3)]);
  return score(0, groups.slice(0, 5).map((g) => g[1]));
}

function kicker(groups, from, n) {
  return groups.slice(from).map((g) => g[1]).sort((a, b) => b - a).slice(0, n);
}

function straightHigh(ranks) {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1); // wheel
  for (let hi = 14; hi >= 5; hi--) {
    if ([0, 1, 2, 3, 4].every((d) => set.has(hi - d))) return hi;
  }
  return 0;
}

function score(cat, ranks) {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (ranks[i] || 0);
  return s;
}

export const CATEGORY = ["high card", "a pair", "two pair", "three of a kind", "a straight", "a flush", "a full house", "four of a kind", "a straight flush"];
export const categoryOf = (cards) => CATEGORY[Math.floor(evaluate(cards) / 15 ** 5)];

function settle(hands, board, shares) {
  const scores = hands.map((h) => evaluate([...h, ...board]));
  const best = Math.max(...scores);
  const winners = scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
  for (const i of winners) shares[i] += 1 / winners.length;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Equity of each hand in `hands` (arrays of two cards) given `board` (0, 3, 4 or 5 cards). Returns shares summing to 1
 * and how many runouts were evaluated; `exact` is false when sampled. */
export function equity(hands, board, { samples = 4000, seed = 1 } = {}) {
  const shares = new Array(hands.length).fill(0);
  const rest = deck([...hands.flat(), ...board]);
  const need = 5 - board.length;
  let runs = 0;
  if (need === 0) {
    settle(hands, board, shares);
    runs = 1;
  } else if (need === 1) {
    for (const c of rest) settle(hands, [...board, c], shares);
    runs = rest.length;
  } else if (need === 2) {
    for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) settle(hands, [...board, rest[i], rest[j]], shares);
    runs = (rest.length * (rest.length - 1)) / 2;
  } else {
    const rand = mulberry(seed);
    for (let n = 0; n < samples; n++) {
      // partial Fisher-Yates for `need` cards
      const d = rest.slice();
      const draw = [];
      for (let k = 0; k < need; k++) {
        const j = k + Math.floor(rand() * (d.length - k));
        [d[k], d[j]] = [d[j], d[k]];
        draw.push(d[k]);
      }
      settle(hands, [...board, ...draw], shares);
    }
    runs = samples;
  }
  return { shares: shares.map((s) => s / runs), runs, exact: need <= 2 };
}
