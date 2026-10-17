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
import Awards from "${process.cwd()}/src/components/Awards.jsx";
import UploadScreen from "${process.cwd()}/src/components/UploadScreen.jsx";
import ProfitRace from "${process.cwd()}/src/components/ProfitRace.jsx";
import StyleMap from "${process.cwd()}/src/components/StyleMap.jsx";
import { assignColors } from "${process.cwd()}/src/theme.js";
import { cumulativeNets, awards } from "${process.cwd()}/src/insights.js";
import * as DD from "${process.cwd()}/src/components/DeepDive.jsx";
import Study from "${process.cwd()}/src/components/Study.jsx";
import { buildQuestions, makeRound } from "${process.cwd()}/src/quiz.js";
import Decide from "${process.cwd()}/src/components/Decide.jsx";
import { decisionPoints, heroDecisions, checklist, choices, SPOTS } from "${process.cwd()}/src/decisions.js";
import { equity } from "${process.cwd()}/src/equity.js";
import Guess from "${process.cwd()}/src/components/Guess.jsx";
import SpotLibrary from "${process.cwd()}/src/components/SpotLibrary.jsx";
import { guessQuestions } from "${process.cwd()}/src/guess.js";
import { strengthLabel } from "${process.cwd()}/src/strength.js";
import { spotLibrary } from "${process.cwd()}/src/decisions.js";
import { awardsSvg } from "${process.cwd()}/src/shareCard.js";
import { recordRound, emptyScores } from "${process.cwd()}/src/storage.js";

export function run(session) {
  const colors = assignColors(session.players);
  const out = {};
  out.app = renderToString(React.createElement(App)).length;
  const saved = { files: [{ name: "a.csv" }, { name: "b.csv" }], summary: { hand_count: 988, players: 8, games: 2 }, savedAt: Date.now() };
  out.savedPanel = renderToString(React.createElement(UploadScreen, { onUpload() {}, saved, onLoadSaved() {}, onForgetSaved() {} })).includes("2 logs · 988 hands · 8 players");
  out.players = renderToString(React.createElement(PlayersTable, { players: session.players, colors, onSelect() {} }));
  const series = cumulativeNets(session.hands, session.players);
  out.awards = awards(session.hands, session.players, series);
  out.shareSvg = awardsSvg({ items: out.awards, players: session.players, colors, span: { day: "Oct 8", time: "1 PM" }, handCount: session.hand_count }).svg;
  out.demoButton = renderToString(React.createElement(UploadScreen, { onUpload() {}, onDemo() {} })).includes("Try a demo session");
  out.awardsHtml = renderToString(React.createElement(Awards, { hands: session.hands, players: session.players, colors, series, onOpen() {} }));
  out.ratings = session.players.map((p) => p.name + " " + p.ratings.map((r) => r.value ?? "-").join("/"));
  out.race = renderToString(React.createElement(ProfitRace, { hands: session.hands, players: session.players, colors, series, onOpen() {} }));
  out.styleMap = renderToString(React.createElement(StyleMap, { players: session.players, colors, onSelect() {} })).length;
  // Every player's final cumulative net must equal their session net.
  out.cumMismatch = session.players.filter((p) => (series[p.player_id].at(-1)?.cum ?? 0) !== p.net).map((p) => p.name);
  out.playerViewsHtml = session.players.map((p) =>
    renderToString(React.createElement(PlayerView, { player: p, players: session.players, hands: session.hands, colors, onSelectPlayer() {} }))
  );
  out.playerViews = out.playerViewsHtml.map((h) => h.length);
  out.tcardMissing = session.players.filter((p, i) => !out.playerViewsHtml[i].includes("tcard-row")).map((p) => p.name);
  // Every hand row shows a winner.
  out.winnerGap = session.players.map((p, i) => (out.playerViewsHtml[i].match(/class="winner /g) || []).length - p.hands).filter((d) => d !== 0).length;
  // Hero: the "you" tag appears on exactly the hero (table and profile), and none of their hand rows hide the cards.
  out.heroTags = { table: (out.players.match(/class="hero-tag"/g) || []).length, views: out.playerViewsHtml.map((h) => (h.match(/class="hero-tag"/g) || []).length) };
  out.heroHidden = session.players.map((p, i) => (p.hero ? (out.playerViewsHtml[i].match(/card-back/g) || []).length : 0));
  const tabs = { preflop: DD.PreflopTab, streets: DD.StreetsTab, meanings: DD.MeaningsTab, showdown: DD.ShowdownTab, flow: DD.MoneyFlowTab };
  out.deepDive = Object.fromEntries(Object.entries(tabs).map(([k, C]) => [k, session.players.map((p) =>
    renderToString(React.createElement(C, { player: p, players: session.players, colors, color: colors[p.player_id].main, openHands() {}, onSelectPlayer() {} })).length
  )]));
  // Preflop range grid: 169 cells for every player, and the seen-cell count must match the backend's shown hands.
  out.range = session.players.map((p) => {
    const html = renderToString(React.createElement(DD.RangeGrid, { player: p, color: colors[p.player_id].main, openHands() {} }));
    const combos = new Set(p.profile.preflop.range.filter((e) => e.line !== "check").map((e) => e.combo)).size;
    return { name: p.name, cells: (html.match(/class="range-cell /g) || []).length, seen: (html.match(/range-cell [^"]*seen/g) || []).length, combos, shown: p.profile.preflop.range.length };
  });
  // Study tab: every generated question has 3-4 options with exactly one correct, and the first card renders.
  const qs = buildQuestions(session.players, () => 0.5);
  out.quiz = { total: qs.length, bad: qs.filter((q) => q.options.length < 3 || q.options.filter((o) => o.correct).length !== 1).length, round: makeRound(session.players, 7).length };
  out.studyHtml = renderToString(React.createElement(Study, { players: session.players, colors, onOpen() {} }));
  out.studyOptions = (out.studyHtml.match(/class="study-opt /g) || []).length;
  // Decision replay: one decision per voluntary action, every spot known, checklist and choices build for each.
  const voluntary = session.hands.reduce((n, h) => n + h.actions.filter((a) => !a.kind.startsWith("post")).length, 0);
  const points = session.hands.flatMap((h) => decisionPoints(h));
  out.decisions = { voluntary, points: points.length, unknownSpot: points.filter((d) => !SPOTS[d.spot]).length, negative: points.filter((d) => d.toCall < 0 || d.pot < 0).length };
  const mine = heroDecisions(session.hands, session.hero);
  out.heroDecisions = mine.length;
  for (const d of mine) { if (!checklist(d, session.players).length || choices(d).opts.length < 2 || !choices(d).opts.some((o) => o.key === choices(d).actual)) throw new Error("bad decision in hand #" + d.hand.number + " " + d.street); }
  const h22 = session.hands.find((h) => h.number === 22);
  out.eq22 = h22 && Object.keys(h22.shown).length >= 2 ? Math.round(100 * equity([h22.shown[Object.keys(h22.shown)[0]], h22.shown[Object.keys(h22.shown)[1]]], h22.board.slice(0, 3)).shares[0]) : null;
  out.decideHtml = renderToString(React.createElement(Decide, { hands: session.hands, players: session.players, colors, hero: session.hero, onOpen() {} }));
  // Guess the hand: one question per shown opponent action, exactly one correct option, JS strength agrees with the
  // backend's meanings grid for every shown bet, and the card renders with the cards hidden until answered.
  const gq = guessQuestions(session.hands, session.hero);
  out.guess = { total: gq.length, bad: gq.filter((q) => q.options.filter((o) => o.correct).length !== 1 || (q.street === "river" && q.options.some((o) => o.key === "draw"))).length, hero: gq.filter((q) => q.pid === session.hero).length };
  const N = { flop: 3, turn: 4, river: 5 };
  out.strengthMismatch = 0; out.strengthChecked = 0;
  for (const p of session.players) for (const cell of p.profile.meanings ?? []) for (const [cls, ids] of Object.entries(cell.strengths)) for (const id of ids) {
    const h = session.hands.find((x) => x.hand_id === id);
    out.strengthChecked++;
    if (strengthLabel(h.shown[p.player_id], h.board.slice(0, N[cell.street])) !== cls) out.strengthMismatch++;
  }
  out.guessHtml = renderToString(React.createElement(Guess, { hands: session.hands, players: session.players, colors, hero: session.hero, onOpen() {} }));
  // Spot library: one row per spot, hero columns only with a hero; Drill focus narrows Decide to that spot.
  const lib = spotLibrary(session.hands, session.hero);
  out.spotLib = { spots: Object.keys(SPOTS).length, rows: lib.length, you: lib.filter((r) => r.you).length, youTotal: lib.reduce((n, r) => n + (r.you?.n ?? 0), 0), heroDecisions: mine.length };
  out.spotLibHtml = renderToString(React.createElement(SpotLibrary, { hands: session.hands, hero: session.hero, onDrill() {}, onHands() {} }));
  // Clicking a spot opens the hero's page filtered to that spot's hands: chip shown, row count = hands, first hand selected.
  const spotRow = lib.find((r) => r.you);
  if (spotRow) {
    const heroP = session.players.find((p) => p.player_id === session.hero);
    const spotLabel = spotRow.label.toLowerCase() + " spot";
    const html = renderToString(React.createElement(PlayerView, { player: heroP, players: session.players, hands: session.hands, colors, initialFilter: { label: spotLabel, ids: spotRow.you.ids }, onSelectPlayer() {} }));
    out.spotHands = { label: spotRow.label, ids: spotRow.you.ids.length, hands: spotRow.you.hands, chip: html.includes(spotLabel), rows: (html.match(/class="winner /g) || []).length, detail: html.includes("hand-detail") };
  }
  const focus = lib.find((r) => r.you)?.spot;
  out.focusHtml = focus ? renderToString(React.createElement(Decide, { hands: session.hands, players: session.players, colors, hero: session.hero, onOpen() {}, focusSpot: focus })) : "";
  out.focusLabel = focus ? SPOTS[focus].label : null;
  // Scores: two rounds fold into one record with the right totals and best.
  const sc = recordRound(recordRound(emptyScores(), "reads", 6, 10), "reads", 9, 10).modes.reads;
  out.scores = sc;
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
const winnerRows = (out.players.match(/winner-row/g) || []).length;
const topNet = Math.max(...session.players.map((p) => p.net));
if (winnerRows !== (topNet > 0 ? session.players.filter((p) => p.net === topNet).length : 0)) throw new Error(`winner rows: ${winnerRows}`);
for (const g of ["Preflop", "Aggression", "Showdown", "Bluffing"]) {
  if (!out.players.includes(`>${g}</th>`)) throw new Error(`players table header is missing the ${g} group`);
}
const groupRules = (out.players.match(/group-start/g) || []).length;
if (groupRules !== 4 * (session.players.length + 2)) throw new Error(`group rules: ${groupRules}, expected 4 per header row and per player row`);
console.log(`app shell: ${out.app} chars`);
console.log(`players table: ${out.players.length} chars, ${session.players.length} rows, ${badgeCount} badges`);
const tones = Object.fromEntries(["lo", "mid", "hi", "thin"].map((t) => [t, (out.players.match(new RegExp(`tone-${t}`, "g")) || []).length]));
console.log(`stat tones: ${Object.entries(tones).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`crowns: ${(out.players.match(/class="crown"/g) || []).length} (13 columns), merged tags: ${(out.players.match(/merged-tag/g) || []).length}`);
console.log(`player views: ${out.playerViews.length} rendered, min ${Math.min(...out.playerViews)} chars`);
for (const r of out.range) {
  if (r.cells !== 169 || r.seen !== r.combos) throw new Error(`range grid for ${r.name}: ${r.cells} cells, ${r.seen} seen vs ${r.combos} combos`);
}
console.log(`range grids: ${out.range.map((r) => `${r.name} ${r.seen} combos / ${r.shown} shown`).join(", ")}`);
const awardCards = (out.awardsHtml.match(/class="award panel"/g) || []).length;
if (awardCards !== out.awards.length) throw new Error(`awards: ${out.awards.length} computed, ${awardCards} rendered`);
if (out.awards.some((a) => !a.pid)) throw new Error("award without a winner");
if (!out.demoButton) throw new Error("upload screen has no demo button");
// Share image: every award and every player appears, names XML-escaped, and the markup has no stray unescaped "&" or "<".
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
for (const a of out.awards) if (!out.shareSvg.includes(esc(a.label.toUpperCase()))) throw new Error("share image misses award " + a.label);
for (const p of session.players) if (!out.shareSvg.includes(esc(p.name.length > 22 ? p.name.slice(0, 21) : p.name))) throw new Error("share image misses player " + p.name);
if (/&(?!amp;|lt;|gt;|quot;)/.test(out.shareSvg) || /<(?![a-z/])/.test(out.shareSvg)) throw new Error("share image has unescaped markup");
console.log(`share image: ${out.shareSvg.length} bytes, ${out.awards.length} awards, ${session.players.length} standings`);
console.log(`awards (${out.awards.length}):`);
for (const a of out.awards) console.log(`  ${a.emoji} ${a.label}: ${session.players.find((p) => p.player_id === a.pid).name} ${a.value} ${a.sub}`);
console.log(`ratings (loose/aggr/bluff/stubborn): ${out.ratings.join("; ")}`);
if (out.tcardMissing.length) throw new Error(`trading card missing for ${out.tcardMissing.join(", ")}`);
if (out.players.includes(">~Bluffs<") || out.players.includes(">Fold→3bet<")) throw new Error("profile-only columns leaked into the players table");
if (!out.playerViewsHtml.some((h) => /~\d+<\/span>/.test(h))) throw new Error("no estimated-bluff tile on any profile (fixture has one player with 5+ shown bets)");
if (!out.savedPanel) throw new Error("upload screen does not show the saved-session panel");
if (out.winnerGap) throw new Error(`${out.winnerGap} player views have hand rows without a winner cell`);
// One tag per player with complete cards: "you" for the hero, "cards" for other uploaded exports.
const heroCount = session.players.filter((p) => p.hero || p.complete).length;
if (out.heroTags.table !== heroCount || out.heroTags.views.filter(Boolean).length !== heroCount) throw new Error(`hero tag count mismatch: ${JSON.stringify(out.heroTags)} for ${heroCount} complete players`);
if ((out.players.match(/>cards</g) || []).length !== session.players.filter((p) => p.complete && !p.hero).length) throw new Error("cards tag count != complete non-hero players");
if (out.heroHidden.some(Boolean)) throw new Error(`hero's own hand rows still hide cards: ${JSON.stringify(out.heroHidden)}`);
console.log(`hero: ${session.hero ?? "none"}`);
if (out.quiz.bad) throw new Error(`${out.quiz.bad} malformed quiz questions`);
if (out.quiz.total && (out.quiz.round === 0 || out.studyOptions < 3)) throw new Error(`study tab did not render a card: ${JSON.stringify(out.quiz)} options=${out.studyOptions}`);
console.log(`quiz: ${out.quiz.total} questions, round of ${out.quiz.round}, first card ${out.studyOptions} options`);
if (out.decisions.points !== out.decisions.voluntary) throw new Error(`decision points ${out.decisions.points} != voluntary actions ${out.decisions.voluntary}`);
if (out.decisions.unknownSpot || out.decisions.negative) throw new Error(`decision extraction: ${JSON.stringify(out.decisions)}`);
if (session.hero && (!out.heroDecisions || !out.decideHtml.includes("decide-ask"))) throw new Error("decide card did not render for the hero");
if (!session.hero && !out.decideHtml.includes("hole cards")) throw new Error("decide mode should explain the missing hero");
console.log(`decisions: ${out.decisions.points} points, ${out.heroDecisions} for the hero; hand 22 flop equity ${out.eq22}%`);
if (out.guess.bad || out.guess.hero) throw new Error(`guess questions: ${JSON.stringify(out.guess)}`);
if (out.strengthMismatch) throw new Error(`${out.strengthMismatch} of ${out.strengthChecked} JS strength labels disagree with the backend grid`);
if (out.guess.total && (!out.guessHtml.includes("card-back") || (out.guessHtml.match(/class="study-opt /g) || []).length < 4)) throw new Error("guess card did not render hidden cards with options");
console.log(`guess: ${out.guess.total} questions, ${out.strengthChecked} strength labels match the backend`);
if (out.spotLib.rows !== out.spotLib.spots || out.spotLib.youTotal !== out.spotLib.heroDecisions) throw new Error(`spot library: ${JSON.stringify(out.spotLib)}`);
if ((out.spotLibHtml.match(/>Drill</g) || []).length !== out.spotLib.you) throw new Error("spot library drill buttons != spots with hero decisions");
if ((out.spotLibHtml.match(/class="link spot-link"/g) || []).length !== out.spotLib.you) throw new Error("spot library links != spots with hero decisions");
if (out.spotHands) {
  const s = out.spotHands;
  if (s.ids !== s.hands || !s.chip || s.rows !== s.hands || !s.detail) throw new Error(`spot hands view: ${JSON.stringify(s)}`);
  console.log(`spot hands: "${s.label}" opens ${s.rows} hands with the first selected`);
}
if (out.focusLabel && !out.focusHtml.replace(/<!-- -->/g, "").includes(`${out.focusLabel} only`)) throw new Error("decide did not show the focused spot filter");
console.log(`spot library: ${out.spotLib.rows} spots, hero in ${out.spotLib.you}${out.focusLabel ? `, drill focus "${out.focusLabel}" ok` : ""}`);
if (out.scores.rounds !== 2 || out.scores.correct !== 15 || out.scores.total !== 20 || out.scores.best !== 9 || out.scores.last.correct !== 9) throw new Error(`scores fold-in: ${JSON.stringify(out.scores)}`);
console.log(`scores: ${out.scores.correct}/${out.scores.total} over ${out.scores.rounds} rounds, best ${out.scores.best}/${out.scores.bestOf}`);
console.log(`profit race: ${out.race.length} chars, ${(out.race.match(/<path /g) || []).length} lines; style map: ${out.styleMap} chars`);
if (out.cumMismatch.length) throw new Error(`cumulative net != session net for ${out.cumMismatch.join(", ")}`);
console.log(`hand details: ${out.handDetails.length} rendered, min ${Math.min(...out.handDetails)} chars`);
console.log(`deep dive: ${Object.entries(out.deepDive).map(([k, v]) => `${k} min ${Math.min(...v)}`).join(", ")}`);
for (const [i, p] of session.players.entries()) {
  const html = out.players;
  if (!html.includes(p.name)) throw new Error(`player ${p.name} missing from table`);
  console.log(`  ${p.name}: ${p.archetypes.map((a) => a.label).join(", ") || "-"} | nemesis ${p.nemesis?.player_id ?? "-"} | friend ${p.best_friend?.player_id ?? "-"}`);
}
