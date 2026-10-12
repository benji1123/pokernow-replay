import React, { useMemo, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { Badges } from "./Badges.jsx";
import { pct, ratio, sample, signed } from "../hands.js";

// `range` is the typical band for a 5-6 handed game (values are %, or a ratio for AF). Below it reads as
// tight/passive (cool tint), above as loose/aggressive (warm tint); inside it stays plain.
export const STAT_COLUMNS = [
  { key: "vpip", label: "VPIP", fmt: pct, range: [22, 35], help: "Voluntarily put chips in preflop / hands dealt" },
  { key: "pfr", label: "PFR", fmt: pct, range: [15, 25], help: "Raised preflop / hands dealt" },
  { key: "three_bet", label: "3-bet", fmt: pct, range: [5, 10], help: "Raised facing one raise / times facing one raise" },
  { key: "fold_to_pfr", label: "Fold→PFR", fmt: pct, range: [55, 70], help: "Folded facing one raise / times facing one raise" },
  { key: "fold_to_three_bet", label: "Fold→3bet", fmt: pct, range: [40, 60], help: "Opened then folded to a 3-bet / times opener faced a 3-bet" },
  { key: "af_total", label: "AF", fmt: ratio, range: [1.5, 3], help: "(bets + raises) / calls, all streets" },
  { key: "af_preflop", label: "AF pre", fmt: ratio, range: [2, 5], help: "(bets + raises) / calls, preflop" },
  { key: "af_postflop", label: "AF post", fmt: ratio, range: [1.5, 3], help: "(bets + raises) / calls, flop onward" },
  { key: "wtsd", label: "WTSD", fmt: pct, range: [22, 32], help: "Reached showdown / saw the flop" },
  { key: "wsd", label: "W$SD", fmt: pct, range: [45, 55], help: "Won at showdown / reached showdown" },
];

const MIN_SAMPLE = 10; // below this many opportunities the value is noise, so it is shown muted instead of tinted

// "lo" | "hi" | "mid" | "thin" for a stat against its column's typical range.
// An AF's evidence is every bet, raise and call (n + d), not just the calls it divides by.
const sampleSize = (stat, col) => (col.fmt === ratio ? stat.n + stat.d : stat.d);

export function statTone(stat, col) {
  if (!stat || sampleSize(stat, col) < MIN_SAMPLE) return "thin";
  if (stat.value == null) return col.fmt === ratio && stat.n > 0 ? "hi" : "thin"; // AF with zero calls is infinite
  const v = col.fmt === pct ? stat.value * 100 : stat.value;
  return v < col.range[0] ? "lo" : v > col.range[1] ? "hi" : "mid";
}

// "38 / 63 · above the typical 22–35%" style explanation shared by the table cells and the player tiles.
export function statTitle(stat, col) {
  const tone = statTone(stat, col);
  const [lo, hi] = col.range;
  const band = col.fmt === pct ? `${lo}–${hi}%` : `${lo}–${hi}`;
  const why = tone === "thin" ? `only ${stat ? sampleSize(stat, col) : 0} opportunities (need ${MIN_SAMPLE})` : tone === "mid" ? `typical: ${band}` : `${tone === "lo" ? "below" : "above"} the typical ${band}`;
  return `${sample(stat)} · ${why}`;
}

export function StatValue({ stat, col }) {
  return (
    <span className={`stat tone-${statTone(stat, col)}`} title={statTitle(stat, col)}>
      {col.fmt(stat)}
    </span>
  );
}

// `flat` drops the pill background for dense lists; the sign still carries the color.
export function Net({ net, big, flat }) {
  const cls = net > 0 ? "pos" : net < 0 ? "neg" : "zero";
  return <span className={`net ${cls} ${big ? "net-big" : ""} ${flat ? "net-flat" : ""}`}>{signed(net)}</span>;
}

export function PlayerChip({ player, color, size = 34 }) {
  const [open, setOpen] = useState(false);
  const merged = player.merged_ids?.length ?? 0;
  const otherNames = (player.names ?? []).filter((n) => n !== player.name);
  return (
    <span className="player-chip" style={{ "--c": color.main }}>
      <PixelAvatar id={player.player_id} color={color.main} size={size} />
      <span className="player-name">{player.name}</span>
      <Badges archetypes={player.archetypes} variant="row" />
      {merged > 0 && (
        <span className="merged-wrap" onClick={(e) => e.stopPropagation()}>
          <button className={`merged-tag ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} title="Show the other names and ids folded into this player">
            ⇄ {merged + 1} ids
          </button>
          {open && (
            <span className="merged-pop" onMouseLeave={() => setOpen(false)}>
              <span className="merged-pop-title">{otherNames.length ? "Also played as" : "Same name on every device"}</span>
              {otherNames.map((n) => (
                <span key={n} className="merged-name">{n}</span>
              ))}
              <span className="merged-ids">{[player.player_id, ...player.merged_ids].join(" · ")}</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default function PlayersTable({ players, colors, onSelect, merges = [], autoMerge = true, busy, onMerge, onClearMerges, onToggleAuto }) {
  const [merging, setMerging] = useState(false);
  const [picked, setPicked] = useState([]);
  const [sort, setSort] = useState({ key: "hands", dir: -1 });

  // Stats sort by value; a stat with no opportunities sorts last either way. Ties fall back to hands played.
  const sorted = useMemo(() => {
    const value = (p) => (sort.key === "hands" || sort.key === "net" ? p[sort.key] : p[sort.key].value);
    return [...players].sort((a, b) => {
      const va = value(a), vb = value(b);
      if (va == null || vb == null) return (va == null) - (vb == null);
      return sort.dir * (va - vb) || b.hands - a.hands;
    });
  }, [players, sort]);
  // Crown the largest value in each column. Stats on thin samples are not eligible, matching the grey tint.
  const leaders = useMemo(() => {
    const out = {};
    for (const key of ["hands", "net"]) {
      const top = Math.max(...players.map((p) => p[key]));
      out[key] = new Set(players.filter((p) => p[key] === top).map((p) => p.player_id));
    }
    for (const c of STAT_COLUMNS) {
      const eligible = players.filter((p) => statTone(p[c.key], c) !== "thin");
      const top = Math.max(...eligible.map((p) => p[c.key].value ?? -Infinity));
      out[c.key] = new Set(eligible.filter((p) => p[c.key].value === top).map((p) => p.player_id));
    }
    return out;
  }, [players]);
  const Crown = ({ k, p }) => (leaders[k]?.has(p.player_id) ? <sup className="crown" title="Highest at the table">👑</sup> : null);
  // First click on a column shows the biggest values first; a second click flips it.
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const SortHeader = ({ k, title, children }) => (
    <th className={`num sortable ${sort.key === k ? "sorted" : ""}`} onClick={() => toggleSort(k)} title={title ? `${title}\nClick to sort` : "Click to sort"}>
      {children}
      <span className="sort-arrow">{sort.key === k ? (sort.dir > 0 ? "↑" : "↓") : "↕"}</span>
    </th>
  );

  function rowClick(id) {
    if (!merging) return onSelect(id);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function confirmMerge() {
    onMerge(picked);
    setPicked([]);
    setMerging(false);
  }
  const pickedNames = picked.map((id) => players.find((p) => p.player_id === id)?.name).join(" + ");

  return (
    <section className="panel table-panel">
      <div className="toolbar">
        {merging ? (
          <>
            <span className="muted">{picked.length < 2 ? "Pick two or more rows that are the same person." : pickedNames}</span>
            <button className="btn primary" disabled={picked.length < 2 || busy} onClick={confirmMerge}>
              Merge {picked.length >= 2 ? picked.length : ""} as one player
            </button>
            <button className="btn" onClick={() => (setMerging(false), setPicked([]))}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setMerging(true)} disabled={busy || players.length < 2} title="Same person on two devices? Fold their ids together.">
              ⇄ Merge players
            </button>
            {merges.length > 0 && (
              <button className="link" onClick={onClearMerges} disabled={busy}>
                Undo manual merges ({merges.length})
              </button>
            )}
          </>
        )}
        <label className="toggle" title="Fold ids that used the same name and never sat in the same hand">
          <input type="checkbox" checked={autoMerge} disabled={busy} onChange={(e) => onToggleAuto(e.target.checked)} />
          Auto-merge same names
        </label>
      </div>
      <table className={`players ${merging ? "merging" : ""}`}>
        <thead>
          <tr>
            {merging && <th />}
            <th className="player-col">Player</th>
            <SortHeader k="hands">Hands</SortHeader>
            <SortHeader k="net">Net</SortHeader>
            {STAT_COLUMNS.map((c) => (
              <SortHeader key={c.key} k={c.key} title={c.help}>
                {c.label}
              </SortHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.player_id}
              className={`clickable ${picked.includes(p.player_id) ? "picked" : ""}`}
              style={{ "--c": colors[p.player_id].main }}
              onClick={() => rowClick(p.player_id)}
            >
              {merging && (
                <td className="pick">
                  <input type="checkbox" readOnly checked={picked.includes(p.player_id)} tabIndex={-1} />
                </td>
              )}
              <td className="player-col">
                <PlayerChip player={p} color={colors[p.player_id]} />
              </td>
              <td className="num">
                {p.hands}
                <Crown k="hands" p={p} />
              </td>
              <td className="num">
                <Net net={p.net} />
                <Crown k="net" p={p} />
              </td>
              {STAT_COLUMNS.map((c) => (
                <td key={c.key} className="num">
                  <StatValue stat={p[c.key]} col={c} />
                  <Crown k={c.key} p={p} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        {merging ? "Click rows to select them. Merging re-reads your files; nothing is saved anywhere." : "Blue runs tighter or more passive than a typical game, orange looser or more aggressive; grey means too few hands to tell. Hover a number for its sample. Click a player for their hands."}
      </p>
    </section>
  );
}
