// Session-level derived data for the players page: cumulative profit per player and the night's highlights.
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

export function highlights(hands, players, series = cumulativeNets(hands, players)) {
  if (!hands.length) return [];
  const byId = Object.fromEntries(players.map((p) => [p.player_id, p]));
  const name = (pid) => byId[pid]?.name ?? "?";
  const out = [];

  const big = hands.reduce((a, b) => (potSize(b) > potSize(a) ? b : a));
  const winner = Object.entries(big.collected).sort((a, b) => b[1] - a[1])[0][0];
  out.push({ key: "pot", label: "Biggest pot", value: potSize(big), pid: winner, hand: big, sub: `won by ${name(winner)} in #${big.number}`, long: `won by ${name(winner)} in hand #${big.number}` });

  const heat = longestHeater(series);
  if (heat) out.push({ key: "heater", label: "Longest heater", value: `${heat.length} in a row`, pid: heat.pid, hand: heat.from, sub: `${name(heat.pid)}, #${heat.from.number}–${heat.to.number}, +${heat.won}`, long: `${name(heat.pid)}, hands #${heat.from.number} to #${heat.to.number}, won ${heat.won}` });

  const back = biggestComeback(series);
  if (back) out.push({ key: "comeback", label: "Biggest comeback", value: `+${back.climb}`, pid: back.pid, hand: back.from, sub: `${name(back.pid)}, ${back.low} → ${back.final >= 0 ? "+" : ""}${back.final}`, long: `${name(back.pid)} was down ${back.low} at hand #${back.from.number} and finished ${back.final >= 0 ? "+" : ""}${back.final}` });

  // Played time is summed per game, so two logs a week apart do not read as a 168-hour session.
  const byGame = new Map();
  for (const h of hands) {
    const t = new Date(h.started_at).getTime();
    const g = byGame.get(h.game) ?? { min: t, max: t };
    byGame.set(h.game, { min: Math.min(g.min, t), max: Math.max(g.max, t) });
  }
  const hours = [...byGame.values()].reduce((a, g) => a + (g.max - g.min), 0) / 3.6e6;
  if (hours > 0.1) out.push({ key: "pace", label: "Pace", value: `${Math.round(hands.length / hours)} hands/hr`, sub: `${hands.length} hands · ${hours < 1 ? `${Math.round(hours * 60)} min` : `${hours.toFixed(1)} h`}`, long: `${hands.length} hands over ${hours < 1 ? `${Math.round(hours * 60)} minutes` : `${hours.toFixed(1)} hours`} of play` });
  return out;
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
