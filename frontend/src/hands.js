// Helpers for rendering Hand JSON from the backend.

export const SUITS = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const STREETS = ["preflop", "flop", "turn", "river"];

export function pct(stat) {
  return stat.value == null ? "–" : `${Math.round(stat.value * 100)}%`;
}

export function ratio(stat) {
  if (stat.d === 0) return stat.n === 0 ? "–" : "∞";
  return (stat.n / stat.d).toFixed(1);
}

// Count stats: n is the figure, value (a share) only drives the tint and the "–" for thin samples.
export function count(stat) {
  return stat.value == null ? "–" : String(stat.n);
}

export function approx(stat) {
  return stat.value == null ? "–" : `~${stat.n}`;
}

export function sample(stat) {
  return `${stat.n} / ${stat.d}`;
}

export function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function playerName(hand, pid) {
  return hand.seats.find((s) => s.player_id === pid)?.name ?? pid;
}

// Board cards per street boundary: flop = first 3, turn = 4th, river = 5th.
export function boardForStreet(board, street) {
  const upto = { preflop: 0, flop: 3, turn: 4, river: 5 }[street];
  return board.slice(0, upto);
}

export const POST_LABEL = { post_sb: "SB", post_bb: "BB", post_straddle: "straddle", post_ante: "ante", post_missing_sb: "dead SB", post_missing_bb: "missed BB" };

// The verb part of an action ("calls 20 (all-in)"); `plural` for a row that names several players ("call 20").
export function describeVerb(a, plural = false) {
  const allIn = a.all_in ? " (all-in)" : "";
  const s = plural ? "" : "s";
  if (a.kind.startsWith("post_")) return `post${s} ${POST_LABEL[a.kind] ?? a.kind.slice(5)} ${a.amount}`;
  switch (a.kind) {
    case "fold": return `fold${s}`;
    case "check": return `check${s}`;
    case "call": return `call${s} ${a.amount}${allIn}`;
    case "bet": return `bet${s} ${a.amount}${allIn}`;
    case "raise": return `raise${s} to ${a.raise_to}${allIn}`;
    default: return a.kind;
  }
}

export function describeAction(a, name) {
  return `${name} ${describeVerb(a)}`;
}

// Consecutive posts, or consecutive identical passive actions (fold / check / call of the same amount), share one row.
export function groupActions(acts) {
  const rows = [];
  for (const a of acts) {
    const last = rows[rows.length - 1];
    const post = a.kind.startsWith("post_");
    const passive = a.kind === "fold" || a.kind === "check" || a.kind === "call";
    const joins = last && ((post && last.post) || (passive && !last.post && last.kind === a.kind && last.amount === a.amount && !!last.all_in === !!a.all_in));
    if (joins) last.acts.push(a);
    else rows.push({ kind: a.kind, post, amount: a.amount, all_in: a.all_in, acts: [a] });
  }
  return rows;
}

export function lastStreet(hand) {
  return STREETS[Math.max(0, [0, 3, 4, 5].filter((n) => hand.board.length >= n).length - 1)];
}

// "Oct 8, 2026 · 8:19 PM – 11:02 PM", or both dates when the session crosses midnight. Local time zone.
// { day, time } for the top bar chips; `day` is null and `time` carries both dates when the session crosses midnight.
export function sessionSpanParts(hands) {
  if (!hands.length) return null;
  const start = new Date(hands[0].started_at);
  const end = new Date(hands[hands.length - 1].started_at);
  const day = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return day(start) === day(end)
    ? { day: day(start), time: `${time(start)} – ${time(end)}` }
    : { day: null, time: `${day(start)} ${time(start)} – ${day(end)} ${time(end)}` };
}

export function sessionSpan(hands) {
  if (!hands.length) return "";
  const start = new Date(hands[0].started_at);
  const end = new Date(hands[hands.length - 1].started_at);
  const day = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return day(start) === day(end)
    ? `${day(start)} · ${time(start)} – ${time(end)}`
    : `${day(start)} ${time(start)} – ${day(end)} ${time(end)}`;
}
