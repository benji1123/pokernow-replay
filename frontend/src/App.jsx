import React, { useEffect, useMemo, useRef, useState } from "react";
import { analyzeLogs, warmUp } from "./analyzer.js";
import FloatingIcons from "./components/FloatingIcons.jsx";
import UploadScreen from "./components/UploadScreen.jsx";
import PlayersTable from "./components/PlayersTable.jsx";
import PlayerView from "./components/PlayerView.jsx";
import { assignColors } from "./theme.js";
import { sessionSpan } from "./hands.js";
import ThemeToggle from "./components/ThemeToggle.jsx";
import KofiButton from "./components/KofiButton.jsx";
import Awards from "./components/Awards.jsx";
import ProfitRace from "./components/ProfitRace.jsx";
import StyleMap from "./components/StyleMap.jsx";
import { cumulativeNets, pace } from "./insights.js";

const UPLOAD = { page: "upload" };
const TABS = [["table", "Players"], ["timeline", "Profit race"], ["style", "Style map"]];
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
  const colors = useMemo(() => (session ? assignColors(session.players) : {}), [session]);
  const series = useMemo(() => (session ? cumulativeNets(session.hands, session.players) : {}), [session]);
  const openPlayer = (id, handId) => setRoute(go({ page: "player", playerId: id, handId }));

  useEffect(() => {
    warmUp(setEngineStatus).catch((e) => setError(e.message)); // fetch Pyodide while the user finds their file
  }, []);

  useEffect(() => {
    if (!hasHistory) return;
    window.history.replaceState(UPLOAD, "");
    const onPop = (e) => setRoute(e.state ?? UPLOAD);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function load(newFiles, { append = false, merges: m = merges, autoMerge: a = autoMerge } = {}) {
    const all = append ? [...files, ...newFiles] : newFiles;
    setLoading(true);
    setError(null);
    try {
      setSession(await analyzeLogs(all, { merges: m, autoMerge: a }, setEngineStatus));
      setFiles(all);
      setMerges(m);
      setAutoMerge(a);
      if (route.page === "upload") setRoute(go({ page: "players" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  // Merges are applied inside the analysis, so changing them re-analyzes the same files.
  const reload = (opts) => load(files, opts);

  const player = route.page === "player" ? session?.players.find((p) => p.player_id === route.playerId) : null;
  return (
    <>
      <FloatingIcons />
      <ThemeToggle />
      <KofiButton />
      {!session || route.page === "upload" ? (
        <UploadScreen onUpload={load} loading={loading} error={error} engineStatus={engineStatus} />
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
            <span className="pixel small" title={session.games.map((g) => `${g.room}: ${g.hand_count} hands`).join("\n")}>
              {session.room}
            </span>
            <span className="muted">
              {session.hand_count} hands · {session.players.length} players{pace(session.hands) ? ` · ${pace(session.hands).perHour}/hr` : ""}
            </span>
            {error && <span className="error small">{error}</span>}
            <span className="muted session-date">{sessionSpan(session.hands)}</span>
          </header>
          {player ? (
            <PlayerView
              key={player.player_id}
              player={player}
              players={session.players}
              hands={session.hands}
              colors={colors}
              initialHandId={route.handId}
              onSelectPlayer={openPlayer}
            />
          ) : (
            <>
              <Awards hands={session.hands} players={session.players} colors={colors} series={series} onOpen={openPlayer} />
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
