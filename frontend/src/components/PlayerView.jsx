import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cards, HiddenCards } from "./Cards.jsx";
import HandDetail from "./HandDetail.jsx";
import PixelAvatar from "./PixelAvatar.jsx";
import TradingCard from "./TradingCard.jsx";
import { STAT_COLUMNS, STAT_GROUPS, HeroTag, Net, statTitle, statTone } from "./PlayersTable.jsx";
import { Badges, Rivals } from "./Badges.jsx";
import { preflopSummary, sample } from "../hands.js";
import { MeaningsTab, MoneyFlowTab, PreflopTab, ShowdownTab, StreetsTab } from "./DeepDive.jsx";

const TABS = [["hands", "Hands"], ["preflop", "Preflop"], ["streets", "Streets"], ["meanings", "What a bet means"], ["showdown", "Showdown"], ["flow", "Money flow"]];

// The detail pane is sticky, but until the page has scrolled far enough for it to stick its top sits below the
// header, so a fixed 100vh height runs off the bottom of the viewport. Size it to the room actually left below it.
const NARROW = "(max-width: 1000px)"; // below this the hand list and detail stack, and the detail becomes a bottom sheet

function useFitBelowTop(ref, margin = 16) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (window.matchMedia(NARROW).matches) { el.style.maxHeight = ""; return; }
      el.style.maxHeight = `${Math.max(240, window.innerHeight - el.getBoundingClientRect().top - margin)}px`;
    };
    fit();
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    return () => { window.removeEventListener("scroll", fit); window.removeEventListener("resize", fit); };
  });
}

// Who collected the pot, largest share first. A split pot lists every collector's avatar with one name.
function Winner({ hand, me, players, colors }) {
  const winners = Object.entries(hand.collected).sort((a, b) => b[1] - a[1]).map(([pid]) => pid);
  if (!winners.length) return <span className="muted small-text">–</span>;
  const name = (pid) => players.find((p) => p.player_id === pid)?.name ?? "?";
  const title = winners.map((pid) => `${name(pid)} ${hand.collected[pid]}`).join(", ");
  return (
    <span className={`winner ${winners.includes(me) ? "me" : ""}`} title={title}>
      {winners.map((pid) => <PixelAvatar key={pid} id={pid} color={colors[pid]?.main} size={16} />)}
      <span className="winner-name">{winners.length > 1 ? `${name(winners[0])} +${winners.length - 1}` : name(winners[0])}</span>
    </span>
  );
}

export default function PlayerView({ player, players, hands, colors, initialHandId, onSelectPlayer }) {
  const [selected, setSelected] = useState(() => hands.find((h) => h.hand_id === initialHandId) ?? null);
  const [sort, setSort] = useState({ key: "number", dir: 1 });
  const [tab, setTab] = useState("hands");
  const [filter, setFilter] = useState(null); // { label, ids: Set } from a deep-dive cell, narrows the hand list
  const [shownOnly, setShownOnly] = useState(false); // only hands where this player's cards are known
  const [gameFilter, setGameFilter] = useState(null); // room code, or null for every game
  const [sheet, setSheet] = useState(false); // narrow screens: the detail pane is a bottom sheet, opened by picking a hand
  const pick = (h) => { setSelected(h); setSheet(true); };
  // Deep-dive cells link back to the hands they were built from.
  function openHands(label, ids) {
    setFilter({ label, ids: new Set(ids) });
    setSort({ key: "number", dir: 1 });
    setTab("hands");
    const first = hands.find((h) => ids.includes(h.hand_id));
    if (first) setSelected(first);
  }
  const color = colors[player.player_id];
  const pid = player.player_id;
  // Several uploaded logs share one session; label hands G1, G2... in first-hand order when there is more than one.
  const games = useMemo(() => [...new Set(hands.map((h) => h.game))], [hands]);
  const gameLabel = (h) => (games.length > 1 ? `G${games.indexOf(h.game) + 1}` : null);
  const playerHands = useMemo(() => {
    const mine = hands.filter((h) => h.seats.some((s) => s.player_id === pid) && (!filter || filter.ids.has(h.hand_id)) && (!shownOnly || h.shown[pid]) && (!gameFilter || h.game === gameFilter));
    // `hands` arrives in chronological order, which is what "#" means once several games are merged.
    const order = new Map(hands.map((h, i) => [h.hand_id, i]));
    const value = sort.key === "net" ? (h) => h.net[pid] : (h) => order.get(h.hand_id);
    return mine.sort((a, b) => sort.dir * (value(a) - value(b)) || order.get(a.hand_id) - order.get(b.hand_id));
  }, [hands, pid, sort, filter, shownOnly, gameFilter]);
  const shownCount = useMemo(() => hands.filter((h) => h.shown[pid]).length, [hands, pid]);

  // First click on Net shows the biggest wins first; on # restores hand order.
  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "net" ? -1 : 1 }));
  }
  const paneRef = useRef(null);
  useFitBelowTop(paneRef);
  // A new hand starts at the top of the pane; the scroll position belongs to the previous hand.
  useEffect(() => { paneRef.current?.scrollTo(0, 0); }, [selected?.hand_id]);
  const SortHeader = ({ k, children }) => (
    <th className={`num sortable ${sort.key === k ? "sorted" : ""}`} onClick={() => toggleSort(k)} title={`Sort by ${children}`}>
      {children}
      <span className="sort-arrow">{sort.key === k ? (sort.dir > 0 ? "↑" : "↓") : "↕"}</span>
    </th>
  );

  return (
    <div className="player-view" style={{ "--c": color.main }}>
      <header className="player-header panel">
        <PixelAvatar id={player.player_id} color={color.main} size={40} />
        <div className="player-title">
          <div className="title-row">
            <h2>{player.name}</h2>
            {player.hero && <HeroTag />}
            <Net net={player.net} big />
          </div>
          <p className="muted small-text">
            {player.hands} hands · won {player.hands_won}
          </p>
          <Badges archetypes={player.archetypes} />
        </div>
        <TradingCard ratings={player.ratings} color={color.main} />
        <Rivals player={player} players={players} colors={colors} onSelectPlayer={onSelectPlayer} />
      </header>

      <section className="stat-groups">
        {STAT_GROUPS.map((g) => (
          <div key={g} className="stat-group">
            <span className="stat-group-title">{g}</span>
            <div className="stat-tiles">
              {STAT_COLUMNS.filter((c) => c.group === g).map((c) => (
                <div key={c.key} className="tile" title={`${c.help}\n${statTitle(player[c.key], c)}`}>
                  <span className="tile-label">{c.label}</span>
                  <span className={`tile-value tone-${statTone(player[c.key], c)}`}>{c.fmt(player[c.key])}</span>
                  <span className="tile-sample">{sample(player[c.key])}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {player.reads?.length > 0 && (
        <section className="reads panel" title="Rule-based suggestions from the numbers shown; each carries the figure that triggered it">
          <span className="reads-title pixel">Reads</span>
          <ul>
            {player.reads.map((r) => (
              <li key={r.key}>
                {r.text} <span className="muted small-text">{r.evidence}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "preflop" && <PreflopTab player={player} color={color.main} openHands={openHands} />}
      {tab === "streets" && <StreetsTab player={player} color={color.main} />}
      {tab === "meanings" && <MeaningsTab player={player} openHands={openHands} />}
      {tab === "showdown" && <ShowdownTab player={player} />}
      {tab === "flow" && <MoneyFlowTab player={player} players={players} colors={colors} onSelectPlayer={onSelectPlayer} />}

      {tab === "hands" && (
        <div className="hands-toolbar" style={{ "--c": color.main }}>
          <button
            className={`toggle ${shownOnly ? "on" : ""}`}
            onClick={() => setShownOnly((v) => !v)}
            aria-pressed={shownOnly}
            title="Only hands where this player's hole cards were shown"
          >
            🂠 Known cards only <span className="toggle-n">{shownCount}</span>
          </button>
          {games.length > 1 && (
            <span className="seg" role="group" aria-label="Game">
              <button className={`seg-btn ${gameFilter === null ? "on" : ""}`} onClick={() => setGameFilter(null)}>All games</button>
              {games.map((g, i) => (
                <button key={g} className={`seg-btn ${gameFilter === g ? "on" : ""}`} onClick={() => setGameFilter(g)} title={g}>
                  G{i + 1}
                </button>
              ))}
            </span>
          )}
          {filter && (
            <span className="filter-chip">
              <b>{filter.label}</b>
              <button className="chip-x" onClick={() => setFilter(null)} aria-label="Clear filter">✕</button>
            </span>
          )}
          <span className="muted small-text toolbar-count">
            {playerHands.length} {playerHands.length === 1 ? "hand" : "hands"}
          </span>
        </div>
      )}
      {tab === "hands" && <div className="split">
        <section className="panel hands-panel">
          <table className="hands compact">
            <thead>
              <tr>
                <SortHeader k="number">#</SortHeader>
                <th>Pos</th>
                <th>Cards</th>
                <th>Preflop</th>
                <th>Board</th>
                <th>Winner</th>
                <SortHeader k="net">Net</SortHeader>
              </tr>
            </thead>
            <tbody>
              {playerHands.map((h) => (
                <tr
                  key={h.hand_id}
                  className={`clickable ${selected?.hand_id === h.hand_id ? "selected" : ""}`}
                  onClick={() => pick(h)}
                >
                  <td className="num muted">
                    {gameLabel(h) && <span className="game-tag" title={h.game}>{gameLabel(h)}</span>}
                    {h.number}
                  </td>
                  <td>
                    <span className="pos-badge">{h.positions[player.player_id] ?? "–"}</span>
                  </td>
                  <td>{h.shown[player.player_id] ? <Cards cards={h.shown[player.player_id]} size="xs" /> : <HiddenCards size="xs" />}</td>
                  <td className="preflop">{preflopSummary(h, player.player_id)}</td>
                  <td>{h.board.length ? <Cards cards={h.board} size="xs" /> : <span className="muted small-text">no flop</span>}</td>
                  <td><Winner hand={h} me={player.player_id} players={players} colors={colors} /></td>
                  <td className="num">
                    <Net net={h.net[player.player_id]} flat />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {sheet && selected && <div className="sheet-backdrop" onClick={() => setSheet(false)} />}
        <aside className={`detail-pane panel ${sheet && selected ? "sheet-open" : ""}`} ref={paneRef}>
          <button className="sheet-close touch-only" onClick={() => setSheet(false)} aria-label="Close hand">✕</button>
          {selected ? (
            <HandDetail hand={selected} focus={player.player_id} colors={colors} gameLabel={gameLabel(selected)} />
          ) : (
            <div className="empty">
              <PixelAvatar id={player.player_id} color={color.main} size={40} />
              <p>Pick a hand to see how it played out.</p>
            </div>
          )}
        </aside>
      </div>}
    </div>
  );
}
