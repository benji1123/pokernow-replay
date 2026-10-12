// Server-side render check: there is no browser on the dev host, so render every screen with a real session
// to catch runtime errors. Usage (from frontend/): node scripts/render-check.mjs <session.json>
// Produce session.json with: cd backend && uv run python -m pokernow_analyzer.dump ../fixtures/sample.json
import { build } from "esbuild";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const sessionPath = process.argv[2];
if (!sessionPath) throw new Error("usage: node scripts/render-check.mjs <session.json>");

// Written next to this script (gitignored) so esbuild resolves react from frontend/node_modules.
const entry = join(process.cwd(), "scripts", ".render-check-entry.jsx");
const bundle = join(process.cwd(), "scripts", ".render-check-bundle.cjs");
writeFileSync(
  entry,
  `
import React from "react";
import { renderToString } from "react-dom/server";
import App from "${process.cwd()}/src/App.jsx";
import PlayersTable from "${process.cwd()}/src/components/PlayersTable.jsx";
import PlayerView from "${process.cwd()}/src/components/PlayerView.jsx";
import HandDetail from "${process.cwd()}/src/components/HandDetail.jsx";
import Highlights from "${process.cwd()}/src/components/Highlights.jsx";
import ProfitRace from "${process.cwd()}/src/components/ProfitRace.jsx";
import StyleMap from "${process.cwd()}/src/components/StyleMap.jsx";
import { assignColors } from "${process.cwd()}/src/theme.js";
import { cumulativeNets, highlights } from "${process.cwd()}/src/insights.js";
import * as DD from "${process.cwd()}/src/components/DeepDive.jsx";

export function run(session) {
  const colors = assignColors(session.players);
  const out = {};
  out.app = renderToString(React.createElement(App)).length;
  out.players = renderToString(React.createElement(PlayersTable, { players: session.players, colors, onSelect() {} }));
  const series = cumulativeNets(session.hands, session.players);
  out.highlights = highlights(session.hands, session.players, series);
  out.highlightsHtml = renderToString(React.createElement(Highlights, { hands: session.hands, players: session.players, colors, series, onOpen() {} })).length;
  out.race = renderToString(React.createElement(ProfitRace, { hands: session.hands, players: session.players, colors, series, onOpen() {} }));
  out.styleMap = renderToString(React.createElement(StyleMap, { players: session.players, colors, onSelect() {} })).length;
  // Every player's final cumulative net must equal their session net.
  out.cumMismatch = session.players.filter((p) => (series[p.player_id].at(-1)?.cum ?? 0) !== p.net).map((p) => p.name);
  out.playerViews = session.players.map((p) =>
    renderToString(React.createElement(PlayerView, { player: p, players: session.players, hands: session.hands, colors, onSelectPlayer() {} })).length
  );
  const tabs = { preflop: DD.PreflopTab, streets: DD.StreetsTab, meanings: DD.MeaningsTab, showdown: DD.ShowdownTab, flow: DD.MoneyFlowTab };
  out.deepDive = Object.fromEntries(Object.entries(tabs).map(([k, C]) => [k, session.players.map((p) =>
    renderToString(React.createElement(C, { player: p, players: session.players, colors, color: colors[p.player_id].main, openHands() {}, onSelectPlayer() {} })).length
  )]));
  // Preflop range grid: 169 cells for every player, and the seen-cell count must match the backend's shown hands.
  out.range = session.players.map((p) => {
    const html = renderToString(React.createElement(DD.RangeGrid, { player: p, color: colors[p.player_id].main, openHands() {} }));
    const combos = new Set(p.profile.preflop.range.map((e) => e.combo)).size;
    return { name: p.name, cells: (html.match(/class="range-cell /g) || []).length, seen: (html.match(/range-cell [^"]*seen/g) || []).length, combos, shown: p.profile.preflop.range.length };
  });
  out.handDetails = session.hands.map((h) =>
    renderToString(React.createElement(HandDetail, { hand: h, focus: h.seats[0].player_id, colors })).length
  );
  return out;
}
`
);

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: bundle,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "empty" },
  logLevel: "silent",
});
unlinkSync(entry);
const mod = createRequire(import.meta.url)(bundle);
unlinkSync(bundle);
const session = JSON.parse(readFileSync(sessionPath, "utf8"));
const out = mod.run(session);

const badgeCount = (out.players.match(/class="badge /g) || []).length;
if (out.players.includes("badge-label")) throw new Error("players table badges should be emoji-only");
console.log(`app shell: ${out.app} chars`);
console.log(`players table: ${out.players.length} chars, ${session.players.length} rows, ${badgeCount} badges`);
const tones = Object.fromEntries(["lo", "mid", "hi", "thin"].map((t) => [t, (out.players.match(new RegExp(`tone-${t}`, "g")) || []).length]));
console.log(`stat tones: ${Object.entries(tones).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`crowns: ${(out.players.match(/class="crown"/g) || []).length} (12 columns), merged tags: ${(out.players.match(/merged-tag/g) || []).length}`);
console.log(`player views: ${out.playerViews.length} rendered, min ${Math.min(...out.playerViews)} chars`);
for (const r of out.range) {
  if (r.cells !== 169 || r.seen !== r.combos) throw new Error(`range grid for ${r.name}: ${r.cells} cells, ${r.seen} seen vs ${r.combos} combos`);
}
console.log(`range grids: ${out.range.map((r) => `${r.name} ${r.seen} combos / ${r.shown} shown`).join(", ")}`);
console.log(`highlights (${out.highlightsHtml} chars):`);
for (const h of out.highlights) console.log(`  ${h.label}: ${h.value} — ${h.sub}`);
console.log(`profit race: ${out.race.length} chars, ${(out.race.match(/<path /g) || []).length} lines; style map: ${out.styleMap} chars`);
if (out.cumMismatch.length) throw new Error(`cumulative net != session net for ${out.cumMismatch.join(", ")}`);
console.log(`hand details: ${out.handDetails.length} rendered, min ${Math.min(...out.handDetails)} chars`);
console.log(`deep dive: ${Object.entries(out.deepDive).map(([k, v]) => `${k} min ${Math.min(...v)}`).join(", ")}`);
for (const [i, p] of session.players.entries()) {
  const html = out.players;
  if (!html.includes(p.name)) throw new Error(`player ${p.name} missing from table`);
  console.log(`  ${p.name}: ${p.archetypes.map((a) => a.label).join(", ") || "-"} | nemesis ${p.nemesis?.player_id ?? "-"} | friend ${p.best_friend?.player_id ?? "-"}`);
}
