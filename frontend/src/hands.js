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

// One-line description of what a player did preflop, e.g. "raise 7 → call 15".
export function preflopSummary(hand, pid) {
  const parts = [];
  for (const a of hand.actions) {
    if (a.street !== "preflop" || a.player_id !== pid) continue;
    if (a.kind.startsWith("post_")) continue;
    if (a.kind === "raise") parts.push(`raise ${a.raise_to}`);
    else if (a.kind === "call") parts.push(`call${a.all_in ? " (all-in)" : ""}`);
    else parts.push(a.kind);
  }
  if (parts.length === 0) {
    // No voluntary action: either walked (BB) or was all-in from a post.
    return hand.actions.some((a) => a.player_id === pid) ? "no action" : "sat out";
  }
  return parts.join(" → ");
}

export function describeAction(a, name) {
  const allIn = a.all_in ? " (all-in)" : "";
  switch (a.kind) {
    case "post_sb": return `${name} posts SB ${a.amount}`;
    case "post_bb": return `${name} posts BB ${a.amount}`;
    case "post_straddle": return `${name} straddles ${a.amount}`;
    case "post_ante": return `${name} antes ${a.amount}`;
    case "post_missing_sb": return `${name} posts dead SB ${a.amount}`;
    case "post_missing_bb": return `${name} posts missed BB ${a.amount}`;
    case "fold": return `${name} folds`;
    case "check": return `${name} checks`;
    case "call": return `${name} calls ${a.amount}${allIn}`;
    case "bet": return `${name} bets ${a.amount}${allIn}`;
    case "raise": return `${name} raises to ${a.raise_to}${allIn}`;
    default: return `${name} ${a.kind}`;
  }
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
