import React, { useEffect, useMemo, useRef, useState } from "react";
import { analyzeLogs, warmUp } from "./analyzer.js";
import { forgetLastSession, loadLastSession, saveLastSession } from "./storage.js";
import FloatingIcons from "./components/FloatingIcons.jsx";
import UploadScreen from "./components/UploadScreen.jsx";
import PlayersTable from "./components/PlayersTable.jsx";
import Study from "./components/Study.jsx";
import PlayerView from "./components/PlayerView.jsx";
import { assignColors } from "./theme.js";
import { sessionSpanParts } from "./hands.js";
import ThemeToggle from "./components/ThemeToggle.jsx";
import KofiButton from "./components/KofiButton.jsx";
import Awards from "./components/Awards.jsx";
import ProfitRace from "./components/ProfitRace.jsx";
import StyleMap from "./components/StyleMap.jsx";
import { cumulativeNets, pace } from "./insights.js";

const UPLOAD = { page: "upload" };
const DEMO_FILE = "poker_now_log_demo.csv"; // anonymized sample game in public/, made by pokernow_analyzer.make_demo
const TABS = [["table", "Players"], ["timeline", "Profit race"], ["style", "Style map"], ["study", "Study"]];
const hasHistory = typeof window !== "undefined" && !!window.history?.pushState;

// Each screen is a history entry so the browser's Back button walks player -> players -> upload.
function go(route) {
  if (hasHistory) window.history.pushState(route, "");
  return route;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]); // the File objects behind `session`, so more logs can be added later
  const [merges, setMerges] = useState([]); // id groups the user marked as one person; re-sent with every upload
  const [autoMerge, setAutoMerge] = useState(true);
  const [route, setRoute] = useState(UPLOAD);
  const [tab, setTab] = useState("table"); // players page view: table | timeline | style
  const addInput = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [engineStatus, setEngineStatus] = useState("");
  const [saved, setSaved] = useState(null); // last session cached in this browser, if any
  const [isDemo, setIsDemo] = useState(false);
  const colors = useMemo(() => (session ? assignColors(session.players) : {}), [session]);
  const series = useMemo(() => (session ? cumulativeNets(session.hands, session.players) : {}), [session]);
  // `filter` ({ label, ids }) opens the Hands tab narrowed to those hands, e.g. from a spot in the Study tab.
  const openPlayer = (id, handId, filter) => setRoute(go({ page: "player", playerId: id, handId, filter }));

  useEffect(() => {
    warmUp(setEngineStatus).catch((e) => setError(e.message)); // fetch Pyodide while the user finds their file
    loadLastSession().then(setSaved);
  }, []);

  useEffect(() => {
    if (!hasHistory) return;
    window.history.replaceState(UPLOAD, "");
    const onPop = (e) => setRoute(e.state ?? UPLOAD);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function load(newFiles, { append = false, merges: m = merges, autoMerge: a = autoMerge, demo = false } = {}) {
    const all = append ? [...files, ...newFiles] : newFiles;
    const isDemoSet = all.length > 0 && all.every((f) => f.name === DEMO_FILE);
    setLoading(true);
    setError(null);
    try {
      const next = await analyzeLogs(all, { merges: m, autoMerge: a }, setEngineStatus);
      setSession(next);
      setFiles(all);
      setMerges(m);
      setAutoMerge(a);
      setIsDemo(demo || isDemoSet);
      if (route.page === "upload") setRoute(go({ page: "players" }));
      if (demo || isDemoSet) return; // the demo must not replace a visitor's own cached session
      const summary = { hand_count: next.hand_count, players: next.players.length, games: next.games.length };
      saveLastSession(all, { merges: m, autoMerge: a }, summary).then(() => setSaved({ files: all, merges: m, autoMerge: a, summary, savedAt: Date.now() }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  // Merges are applied inside the analysis, so changing them re-analyzes the same files.
  const reload = (opts) => load(files, opts);

  async function loadDemo() {
    try {
      const res = await fetch(import.meta.env.BASE_URL + DEMO_FILE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load([new File([await res.text()], DEMO_FILE, { type: "text/csv" })], { merges: [], autoMerge: true, demo: true });
    } catch (e) {
      setError(`Could not load the demo: ${e.message}`);
    }
  }

  const player = route.page === "player" ? session?.players.find((p) => p.player_id === route.playerId) : null;
  const span = session ? sessionSpanParts(session.hands) : null;
  return (
    <>
      <FloatingIcons />
      <ThemeToggle />
      <KofiButton />
      {!session || route.page === "upload" ? (
        <UploadScreen
          onUpload={load}
          loading={loading}
          error={error}
          engineStatus={engineStatus}
          saved={saved}
          onLoadSaved={() => load(saved.files, { merges: saved.merges, autoMerge: saved.autoMerge })}
          onForgetSaved={() => forgetLastSession().then(() => setSaved(null))}
          onDemo={loadDemo}
        />
      ) : (
        <main className="app">
          <header className="topbar">
            {player && (
              <button className="link" onClick={() => setRoute(go({ page: "players" }))}>
                ← All players
              </button>
            )}
            <button className="link" onClick={() => setRoute(go(UPLOAD))}>
              {player ? "New log" : "← New log"}
            </button>
            <button className="link" onClick={() => addInput.current.click()} disabled={loading}>
              {loading ? "Dealing…" : "+ Add log"}
            </button>
            <input ref={addInput} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => { load(Array.from(e.target.files), { append: true }); e.target.value = ""; }} />
            <span className="meta" title={session.games.map((g) => `${g.room}: ${g.hand_count} hands`).join("\n")}>
              {isDemo && <span className="meta-item demo-pill" title="A sample game with made-up names. Drop your own PokerNow log via New log.">Demo</span>}
              <span className="meta-item"><b>{session.hand_count}</b> hands</span>
              <span className="meta-item"><b>{session.players.length}</b> players</span>
              {pace(session.hands) && <span className="meta-item"><b>{pace(session.hands).perHour}</b> hands/hr</span>}
            </span>
            {error && <span className="error small">{error}</span>}
            {span && (
              <span className="meta session-date">
                {span.day && <span className="meta-item">{span.day}</span>}
                <span className="meta-item">{span.time}</span>
              </span>
            )}
          </header>
          {player ? (
            <PlayerView
              key={`${player.player_id}:${route.filter?.label ?? ""}`}
              player={player}
              players={session.players}
              hands={session.hands}
              colors={colors}
              initialHandId={route.handId}
              initialFilter={route.filter}
              onSelectPlayer={openPlayer}
            />
          ) : (
            <>
              <Awards hands={session.hands} players={session.players} colors={colors} series={series} span={span} onOpen={openPlayer} />
              <section className="block data">
              <nav className="tabs" role="tablist">
                {TABS.map(([key, label]) => (
                  <button key={key} role="tab" aria-selected={tab === key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                    {label}
                  </button>
                ))}
              </nav>
              {tab === "timeline" && <ProfitRace hands={session.hands} players={session.players} colors={colors} series={series} onOpen={openPlayer} />}
              {tab === "style" && <StyleMap players={session.players} colors={colors} onSelect={openPlayer} />}
              {tab === "study" && <Study players={session.players} hands={session.hands} hero={session.hero} colors={colors} onOpen={openPlayer} />}
              {tab === "table" && <PlayersTable
                players={session.players}
                colors={colors}
                onSelect={openPlayer}
                merges={merges}
                autoMerge={autoMerge}
                busy={loading}
                onMerge={(ids) => reload({ merges: [...merges, ids] })}
                onClearMerges={() => reload({ merges: [] })}
                onToggleAuto={(on) => reload({ autoMerge: on })}
              />}
              </section>
            </>
          )}
        </main>
      )}
    </>
  );
}
