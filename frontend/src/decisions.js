// Decision points: the state right before each voluntary action in a hand, classified into recurring spots.
// Built from the hands already in the session payload, so nothing is precomputed on the Python side.

export const SPOTS = {
  open: { label: "First in", group: "preflop", desc: "Nobody has entered the pot yet" },
  vs_limpers: { label: "Facing limpers", group: "preflop", desc: "One or more limps, no raise" },
  vs_raise: { label: "Facing a raise", group: "preflop", desc: "One raise in front of you" },
  vs_3bet: { label: "Facing a 3-bet", group: "preflop", desc: "Two or more raises in front of you" },
  aggressor: { label: "Bet or check as the raiser", group: "aggressor", desc: "You raised preflop, nobody has bet this street" },
  no_bet: { label: "Bet or check, not the raiser", group: "aggressor", desc: "Nobody has bet this street and you were a caller preflop" },
  vs_cbet: { label: "Facing a c-bet", group: "facing", desc: "The preflop raiser bets the flop" },
  vs_bet: { label: "Facing a bet", group: "facing", desc: "Facing a bet on the flop or turn" },
  vs_raise_post: { label: "Facing a raise", group: "facing", desc: "Your bet was raised, or a bet was raised before you" },
  vs_river_bet: { label: "Facing a river bet", group: "river", desc: "Last decision of the hand" },
};

export const SPOT_GROUPS = [
  ["all", "All spots"],
  ["preflop", "Preflop"],
  ["aggressor", "Bet or check"],
  ["facing", "Facing a bet"],
  ["river", "River"],
];

const BOARD_CARDS = { preflop: 0, flop: 3, turn: 4, river: 5 };

export function sizeBucket(frac) {
  return frac < 0.4 ? "small" : frac <= 0.8 ? "mid" : frac <= 1.2 ? "big" : "over";
}
export const SIZE_LABEL = { small: "small (under 40% pot)", mid: "medium (40-80% pot)", big: "big (80-120% pot)", over: "overbet" };

/** Every voluntary action in the hand with the state before it. Pass `pid` to keep one player's decisions only. */
export function decisionPoints(hand, pid = null) {
  const out = [];
  const committed = {}; // this street
  const contributed = {}; // whole hand
  const folded = new Set();
  const stacks = Object.fromEntries(hand.seats.map((s) => [s.player_id, s.stack]));
  let street = "preflop";
  let pot = 0;
  let raises = 0;
  let limps = 0;
  let aggressor = null; // last bettor/raiser this street
  let acted = new Set(); // voluntary actors this street
  let pfr = null;
  const trail = []; // compact history for display
  const limpers = [];

  hand.actions.forEach((a, idx) => {
    if (a.street !== street) {
      street = a.street;
      for (const k in committed) committed[k] = 0;
      raises = 0;
      aggressor = null;
      acted = new Set();
    }
    const isPost = a.kind.startsWith("post");
    if (!isPost && (pid == null || a.player_id === pid)) {
      const inHand = hand.seats.map((s) => s.player_id).filter((p) => !folded.has(p));
      const maxCommit = Math.max(0, ...Object.values(committed));
      const toCall = Math.max(0, maxCommit - (committed[a.player_id] || 0));
      const facing = aggressor ? trail.filter((t) => t.street === street && t.pid === aggressor && (t.kind === "bet" || t.kind === "raise")).at(-1) : null;
      out.push({
        free: a.kind === "fold" && toCall === 0, // a fold with nothing to call (a timed-out blind) is not a decision
        hand, idx, street, pid: a.player_id,
        board: hand.board.slice(0, BOARD_CARDS[street]),
        pot, toCall,
        stack: stacks[a.player_id] - (contributed[a.player_id] || 0),
        pos: hand.positions[a.player_id],
        inHand,
        behind: inHand.filter((p) => p !== a.player_id && (!acted.has(p) || (committed[p] || 0) < maxCommit)),
        raises, limps, limpers: [...limpers], aggressor, pfr, facing,
        spot: classify({ street, toCall, raises, limps, pid: a.player_id, pfr, aggressor }),
        trail: trail.slice(),
        action: { kind: a.kind, amount: a.amount, raise_to: a.raise_to, all_in: a.all_in, frac: pot ? a.amount / pot : 0 },
      });
    }
    // apply
    if (!isPost) {
      acted.add(a.player_id);
      if (a.kind === "fold") folded.add(a.player_id);
      if (a.kind === "raise") {
        raises++;
        aggressor = a.player_id;
        if (street === "preflop") pfr = a.player_id;
      }
      if (a.kind === "bet") aggressor = a.player_id;
      if (a.kind === "call" && street === "preflop" && raises === 0) {
        limps++;
        limpers.push(a.player_id);
      }
      trail.push({ street, pid: a.player_id, kind: a.kind, amount: a.amount, raise_to: a.raise_to, all_in: a.all_in, pot, idx });
    }
    pot += a.amount;
    committed[a.player_id] = (committed[a.player_id] || 0) + a.amount;
    contributed[a.player_id] = (contributed[a.player_id] || 0) + a.amount;
  });
  return out;
}

function classify({ street, toCall, raises, limps, pid, pfr, aggressor }) {
  if (street === "preflop") {
    if (raises === 0) return limps ? "vs_limpers" : "open";
    if (raises === 1) return "vs_raise";
    return "vs_3bet";
  }
  if (toCall === 0) return pid === pfr ? "aggressor" : "no_bet";
  if (raises >= 1) return "vs_raise_post";
  if (street === "river") return "vs_river_bet";
  if (street === "flop" && aggressor === pfr) return "vs_cbet";
  return "vs_bet";
}

/** The hero's decision points across the session, with what happened after each. */
export function heroDecisions(hands, hero) {
  const out = [];
  for (const h of hands) {
    if (!hero || !h.shown?.[hero] || !h.seats.some((s) => s.player_id === hero)) continue;
    const all = decisionPoints(h);
    for (const d of all.filter((x) => x.pid === hero && !x.free)) {
      d.cards = h.shown[hero];
      d.after = all.filter((x) => x.idx > d.idx).map((x) => ({ street: x.street, pid: x.pid, ...x.action, pot: x.pot }));
      d.net = h.net[hero];
      d.villainsShown = Object.entries(h.shown).filter(([p]) => p !== hero && d.inHand.includes(p));
      d.tookDown = d.action.kind === "bet" || d.action.kind === "raise" ? everyoneFolded(h, d.idx) : null;
      out.push(d);
    }
  }
  return out;
}

function everyoneFolded(hand, idx) {
  for (const a of hand.actions.slice(idx + 1)) {
    if (a.kind.startsWith("post")) continue;
    if (a.kind !== "fold") return false;
  }
  return true;
}

/** How everyone at the table acted in a given spot: action mix and how often aggression ended the hand. */
export function spotStats(hands, spot) {
  const mix = { fold: 0, check: 0, call: 0, bet: 0, raise: 0 };
  let aggr = 0;
  let tookDown = 0;
  for (const h of hands) {
    for (const d of decisionPoints(h)) {
      if (d.spot !== spot || d.free) continue;
      mix[d.action.kind]++;
      if (d.action.kind === "bet" || d.action.kind === "raise") {
        aggr++;
        if (everyoneFolded(h, d.idx)) tookDown++;
      }
    }
  }
  const n = Object.values(mix).reduce((a, b) => a + b, 0);
  return { n, mix, aggr, tookDown };
}

/** Spot library rows: how often each spot comes up, what the hero does there and how it went, next to the table. */
export function spotLibrary(hands, hero) {
  const rows = Object.keys(SPOTS).map((spot) => ({ spot, ...SPOTS[spot], you: null, table: spotStats(hands, spot) }));
  if (!hero) return rows;
  const mine = heroDecisions(hands, hero);
  const seen = {};
  for (const d of mine) {
    const r = rows.find((x) => x.spot === d.spot);
    r.you ??= { n: 0, mix: { fold: 0, check: 0, call: 0, bet: 0, raise: 0 }, aggr: 0, tookDown: 0, net: 0, hands: 0, ids: [] };
    r.you.n++;
    r.you.mix[d.action.kind]++;
    if (d.tookDown != null) {
      r.you.aggr++;
      if (d.tookDown) r.you.tookDown++;
    }
    const key = `${d.spot}:${d.hand.hand_id}`;
    if (!seen[key]) {
      seen[key] = true;
      r.you.hands++;
      r.you.net += d.net;
      r.you.ids.push(d.hand.hand_id); // hand order, so the first id is the earliest hand
    }
  }
  const total = mine.length;
  for (const r of rows) if (r.you) r.you.share = r.you.n / total;
  return rows;
}

/** The most common action in a mix, as "raise 61%". */
export function topAction(stats) {
  const [kind, n] = Object.entries(stats.mix).sort((a, b) => b[1] - a[1])[0];
  return stats.n ? { kind, share: n / stats.n } : null;
}

// ---- the questions to ask in each spot, answered from the table's stats ----

const pct = (v) => `${Math.round(v * 100)}%`;
const show = (s, min = 5) => (s && s.value != null && s.d >= min ? `${pct(s.value)} (${s.n}/${s.d})` : "not enough data");

export function checklist(d, players) {
  const by = Object.fromEntries(players.map((p) => [p.player_id, p]));
  const name = (p) => by[p]?.name ?? "?";
  const P = (p) => by[p] ?? {};
  const prof = (p) => P(p).profile ?? {};
  const villains = d.inHand.filter((p) => p !== d.pid);
  const items = [];
  const each = (ids, f) => ids.map((p) => `${name(p)} ${f(P(p), prof(p))}`).join(" · ");

  items.push({ q: "Who is in the hand, and who still acts after me?", a: `${villains.length} opponent${villains.length === 1 ? "" : "s"}: ${villains.map(name).join(", ")}${d.behind.length ? ` · behind you: ${d.behind.map(name).join(", ")}` : " · you close the action"}` });

  if (d.street === "preflop") {
    if (d.spot === "open" || d.spot === "vs_limpers") {
      if (d.limpers.length) items.push({ q: "Do the limpers fold to a raise?", a: each(d.limpers, (p) => `folds ${show(p.fold_to_pfr)}`) });
      items.push({ q: "Who behind me 3-bets, and how often?", a: d.behind.length ? each(d.behind, (p) => `3-bets ${show(p.three_bet, 4)}`) : "nobody behind you" });
      items.push({ q: "If I get called, do they fold to a flop bet?", a: each(villains, (p, pr) => `${show(pr.lines?.fold_to_cbet)}`) });
      items.push({ q: "How wide do they play? (VPIP)", a: each(villains, (p) => pct(p.vpip?.value ?? 0)) });
    } else {
      const r = d.aggressor;
      items.push({ q: `How wide does ${name(r)} raise${d.spot === "vs_3bet" ? " and 3-bet" : ""}?`, a: `PFR ${show(P(r).pfr)} · 3-bet ${show(P(r).three_bet, 4)} · steals ${show(prof(r).preflop?.steal, 4)}` });
      items.push({ q: `Does ${name(r)} fold to a 3-bet?`, a: show(P(r).fold_to_three_bet, 3) });
      items.push({ q: `If I call, does ${name(r)} c-bet, and keep barreling?`, a: `c-bets ${show(prof(r).lines?.cbet, 4)} · barrels the turn ${show(prof(r).lines?.turn_barrel, 3)}` });
      if (d.behind.length) items.push({ q: "Who behind me might squeeze?", a: each(d.behind, (p) => `3-bets ${show(p.three_bet, 4)}`) });
    }
  } else if (d.toCall === 0) {
    items.push({ q: "How much fold equity do I have against each of them?", a: each(villains, (p, pr) => `folds to a c-bet ${show(pr.lines?.fold_to_cbet)}`) });
    items.push({ q: "Do they go to showdown, or give up?", a: each(villains, (p) => `showdown ${show(p.wtsd)}`) });
    items.push({ q: "If I bet and get raised, is it a bluff?", a: each(villains, (p) => `shown bluffs ${show(p.bluffs_shown, 3)}`) });
  } else {
    const b = d.aggressor;
    const frac = d.facing && d.facing.pot ? d.facing.amount / d.facing.pot : null;
    const bucket = frac != null ? sizeBucket(frac) : null;
    const meaning = bucket ? (prof(b).meanings ?? []).find((m) => m.street === d.street && m.kind === d.facing.kind && m.size === bucket) : null;
    const dist = meaning ? Object.entries(meaning.strengths).map(([k, ids]) => `${STRENGTH[k] ?? k} ${ids.length}`).join(", ") : "never shown";
    items.push({ q: `What does a ${bucket ? SIZE_LABEL[bucket] : ""} ${d.facing?.kind ?? "bet"} on the ${d.street} mean from ${name(b)}?`, a: `shown with: ${dist}` });
    items.push({ q: `How often are ${name(b)}'s bets bluffs, and do they get folds?`, a: `shown bluffs ${show(P(b).bluffs_shown, 3)} · takedown ${show(P(b).takedown)}` });
    if (d.street === "flop") items.push({ q: `If I call, does ${name(b)} barrel the turn?`, a: show(prof(b).lines?.turn_barrel, 3) });
    if (d.street === "river") {
      const ra = prof(b).showdown?.river_aggr_shown ?? {};
      const tot = Object.values(ra).reduce((x, y) => x + y, 0);
      items.push({ q: `When ${name(b)} bets the river and shows, what do they have?`, a: tot ? Object.entries(ra).map(([k, n]) => `${STRENGTH[k] ?? k} ${n}`).join(", ") : "never shown" });
    }
    const odds = d.toCall / (d.pot + d.toCall);
    items.push({ q: "What price am I getting?", a: `call ${d.toCall} to win ${d.pot}: need ${pct(odds)} equity${d.behind.length ? ` · ${d.behind.length} still behind` : ""}` });
  }
  const spr = d.pot ? (d.stack / d.pot).toFixed(1) : "-";
  items.push({ q: "How deep am I relative to the pot?", a: `stack ${d.stack}, pot ${d.pot}${d.toCall ? `, ${d.toCall} to call` : ""} · SPR ${spr}` });
  return items;
}

const STRENGTH = { air: "air", draw: "a draw", weak_pair: "a weak pair", top_pair_plus: "top pair", two_pair_plus: "two pair or better" };

/** The buttons offered for a decision, and which one the hero's real action maps to. */
export function choices(d) {
  if (d.toCall > 0) {
    const opts = [{ key: "fold", label: "Fold" }, { key: "call", label: `Call ${d.toCall}` }, { key: "raise", label: "Raise" }];
    return { opts, actual: d.action.kind === "raise" ? "raise" : d.action.kind };
  }
  if (d.street === "preflop") {
    return { opts: [{ key: "check", label: "Check" }, { key: "raise", label: "Raise" }], actual: d.action.kind };
  }
  const opts = [{ key: "check", label: "Check" }, { key: "bet_small", label: "Bet small" }, { key: "bet_big", label: "Bet big" }];
  const actual = d.action.kind === "bet" ? (d.action.frac < 0.5 ? "bet_small" : "bet_big") : d.action.kind === "raise" ? "bet_big" : d.action.kind;
  return { opts, actual };
}

export function describeAction(t, name) {
  const who = name(t.pid);
  switch (t.kind) {
    case "fold": return `${who} folds`;
    case "check": return `${who} checks`;
    case "call": return `${who} calls ${t.amount}${t.all_in ? " all-in" : ""}`;
    case "bet": return `${who} bets ${t.amount}${t.pot ? ` (${Math.round((100 * t.amount) / t.pot)}% pot)` : ""}${t.all_in ? " all-in" : ""}`;
    case "raise": return `${who} raises to ${t.raise_to ?? t.amount}${t.all_in ? " all-in" : ""}`;
    default: return `${who} ${t.kind}`;
  }
}
