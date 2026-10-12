// Session-level derived data for the players page: cumulative profit per player and the night's awards.
// Pure functions over the session JSON so they are easy to check without a browser.

// hands are chronological. Returns { [player_id]: [{ i, cum, hand }] } where i is the hand's index in `hands`
// and the series only has points for hands the player was dealt into.
export function cumulativeNets(hands, players) {
  const series = Object.fromEntries(players.map((p) => [p.player_id, []]));
  const cum = Object.fromEntries(players.map((p) => [p.player_id, 0]));
  hands.forEach((hand, i) => {
    for (const [pid, net] of Object.entries(hand.net)) {
      if (!(pid in series)) continue;
      cum[pid] += net;
      series[pid].push({ i, cum: cum[pid], hand });
    }
  });
  return series;
}

export const potSize = (hand) => Object.values(hand.collected).reduce((a, b) => a + b, 0);

// Longest run of consecutive dealt-in hands with a positive net, per player; returns the best overall.
function longestHeater(series) {
  let best = { length: 0 };
  for (const [pid, pts] of Object.entries(series)) {
    let run = 0, start = null;
    pts.forEach((pt, k) => {
      if (pt.hand.net[pid] > 0) {
        if (run === 0) start = k;
        run++;
        if (run > best.length) best = { length: run, pid, from: pts[start].hand, to: pt.hand, won: pts[k].cum - (start > 0 ? pts[start - 1].cum : 0) };
      } else run = 0;
    });
  }
  return best.length >= 3 ? best : null;
}

// Largest climb from a player's lowest point to their final stack. The trough has to be a real hole, at least
// a fifth of the session's biggest swing, so digging out of a posted blind does not count.
function biggestComeback(series) {
  const scale = Math.max(1, ...Object.values(series).flat().map((p) => Math.abs(p.cum)));
  let best = { climb: 0 };
  for (const [pid, pts] of Object.entries(series)) {
    if (!pts.length) continue;
    let low = pts[0], lowK = 0;
    pts.forEach((pt, k) => {
      if (pt.cum < low.cum) { low = pt; lowK = k; }
    });
    const climb = pts[pts.length - 1].cum - low.cum;
    if (low.cum <= -0.2 * scale && climb > best.climb) best = { climb, pid, low: low.cum, from: low.hand, final: pts[pts.length - 1].cum };
  }
  return best.climb > 0 ? best : null;
}

// Session awards: one winner per category, sillier than a stat table. Rate-based awards need MIN_HANDS so a
// 6-hand cameo cannot win Entertainer; counting awards need more than one occurrence; ties go to more hands.
const MIN_HANDS = 20;

const pct = (v) => `${Math.round(v * 100)}%`;
const ratio = (r) => (r && r.d ? r.value : null);

function pick(players, score, { min = MIN_HANDS, higher = true, floor = 0 } = {}) {
  let best = null, bestV = null;
  for (const p of players) {
    if (p.hands < min) continue;
    const v = score(p);
    if (v == null || Number.isNaN(v)) continue;
    const better = bestV == null || (higher ? v > bestV : v < bestV) || (v === bestV && p.hands > best.hands);
    if (better) { best = p; bestV = v; }
  }
  if (best == null || (higher ? bestV <= floor : false)) return null;
  return { p: best, v: bestV };
}

export function awards(hands, players, series = cumulativeNets(hands, players)) {
  if (!hands.length) return [];
  const byId = Object.fromEntries(players.map((p) => [p.player_id, p]));
  const name = (pid) => byId[pid]?.name ?? "?";
  const out = [];
  const add = (key, emoji, label, pid, value, sub, long, hand) => out.push({ key, emoji, label, pid, value, sub, long, hand });

  const big = hands.reduce((a, b) => (potSize(b) > potSize(a) ? b : a));
  const winner = Object.entries(big.collected).sort((a, b) => b[1] - a[1])[0][0];
  add("pot", "💰", "Pot of the night", winner, potSize(big), `#${big.number}`, `${name(winner)} won the biggest pot, ${potSize(big)}, in hand #${big.number}`, big);

  const heat = longestHeater(series);
  if (heat) add("heater", "🔥", "Heater", heat.pid, `${heat.length} in a row`, `#${heat.from.number}–${heat.to.number}`, `${name(heat.pid)} won ${heat.length} hands in a row, #${heat.from.number} to #${heat.to.number}, for ${heat.won}`, heat.from);

  const back = biggestComeback(series);
  if (back) add("comeback", "🧗", "Comeback", back.pid, `+${back.climb}`, `from ${back.low}`, `${name(back.pid)} was down ${back.low} at hand #${back.from.number} and finished ${back.final >= 0 ? "+" : ""}${back.final}`, back.from);

  // Counting awards straight from the hands: all-ins, pots taken without a showdown.
  const allins = {}, steals = {};
  for (const h of hands) {
    for (const a of h.actions) if (a.all_in) allins[a.player_id] = (allins[a.player_id] ?? 0) + 1;
    const shownAny = Object.keys(h.shown).length > 0;
    for (const pid of Object.keys(h.collected)) if (!shownAny) steals[pid] = (steals[pid] ?? 0) + 1;
  }
  let r = pick(players, (p) => allins[p.player_id] ?? 0, { min: 1, floor: 1 });
  if (r) add("allin", "🎰", "Slot machine", r.p.player_id, `${r.v} all-in${r.v === 1 ? "" : "s"}`, "", `${r.p.name} went all in ${r.v} times, more than anyone`);
  r = pick(players, (p) => steals[p.player_id] ?? 0);
  if (r) add("ninja", "🥷", "Ninja", r.p.player_id, `${r.v} pots`, "no showdown", `${r.p.name} took down ${r.v} pots without ever showing a card`);

  r = pick(players, (p) => ratio(p.vpip));
  if (r) add("entertainer", "🎪", "Entertainer", r.p.player_id, pct(r.v), "of hands played", `${r.p.name} played ${pct(r.v)} of hands dealt, the loosest at the table`);
  r = pick(players, (p) => ratio(p.vpip), { higher: false });
  if (r && out.every((a) => a.pid !== r.p.player_id || a.key !== "entertainer")) add("stonecold", "🧊", "Stone cold", r.p.player_id, pct(r.v), "of hands played", `${r.p.name} played only ${pct(r.v)} of hands dealt, the tightest at the table`);

  r = pick(players, (p) => p.profile?.showdown?.caught_bluff ?? 0, { floor: 1 });
  if (r) add("bluffer", "🤥", "Caught red-handed", r.p.player_id, `${r.v}×`, "river bluffs shown", `${r.p.name} was caught bluffing the river ${r.v} times`);
  r = pick(players, (p) => { const x = p.profile?.lines?.river_call_won; return x && x.d >= 3 ? x.value : null; });
  if (r) add("soulreader", "🔮", "Soul reader", r.p.player_id, pct(r.v), "river calls won", `${r.p.name} called river bets and won ${pct(r.v)} of the time`);
  r = pick(players, (p) => ratio(p.profile?.preflop?.limp), { floor: 0.3 });
  if (r) add("limper", "🐢", "Limp lord", r.p.player_id, pct(r.v), "of pots limped", `${r.p.name} limped into ${pct(r.v)} of unopened pots`);
  r = pick(players, (p) => Object.values(p.profile?.streets ?? {}).reduce((a, s) => a + (s.check_raise ?? 0), 0), { floor: 1 });
  if (r) add("trapper", "🪤", "Trapper", r.p.player_id, `${r.v}×`, "check-raises", `${r.p.name} check-raised ${r.v} times, the most at the table`);
  r = pick(players, (p) => p.profile?.lines?.donk ?? 0, { floor: 1 });
  if (r) add("donk", "🫏", "Donk", r.p.player_id, `${r.v}×`, "donk bets", `${r.p.name} led into the preflop raiser ${r.v} times`);
  return out;
}

// Kept for callers that still want the pace figure.
export function pace(hands) {
  const byGame = new Map();
  for (const h of hands) {
    const t = new Date(h.started_at).getTime();
    const g = byGame.get(h.game) ?? { min: t, max: t };
    byGame.set(h.game, { min: Math.min(g.min, t), max: Math.max(g.max, t) });
  }
  const hours = [...byGame.values()].reduce((a, g) => a + (g.max - g.min), 0) / 3.6e6;
  return hours > 0.1 ? { perHour: Math.round(hands.length / hours), hours } : null;
}

// Nice axis ticks: step is 1, 2 or 5 × 10^k so that there are about `count` ticks.
export function ticks(min, max, count = 5) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
