import React, { useMemo, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { Badges } from "./Badges.jsx";
import { approx, count, pct, ratio, sample, signed } from "../hands.js";

// `range` is the typical band for a 5-6 handed game (values are %, or a ratio for AF). Below it reads as
// tight/passive (cool tint), above as loose/aggressive (warm tint); inside it stays plain.
export const STAT_GROUPS = ["Preflop", "Aggression", "Showdown", "Bluffing"];
export const STAT_COLUMNS = [
  { key: "vpip", group: "Preflop", label: "VPIP", fmt: pct, range: [22, 35], help: "Voluntarily put chips in preflop / hands dealt" },
  { key: "pfr", group: "Preflop", label: "PFR", fmt: pct, range: [15, 25], help: "Raised preflop / hands dealt" },
  { key: "three_bet", group: "Preflop", label: "3-bet", fmt: pct, range: [5, 10], help: "Raised facing one raise / times facing one raise" },
  { key: "fold_to_pfr", group: "Preflop", label: "Fold→PFR", fmt: pct, range: [55, 70], help: "Folded facing one raise / times facing one raise" },
  { key: "fold_to_three_bet", group: "Preflop", table: false, label: "Fold→3bet", fmt: pct, range: [40, 60], help: "Opened then folded to a 3-bet / times opener faced a 3-bet" },
  { key: "af_total", group: "Aggression", label: "AF", fmt: ratio, range: [1.5, 3], help: "(bets + raises) / calls, all streets" },
  { key: "af_preflop", group: "Aggression", label: "AF pre", fmt: ratio, range: [2, 5], help: "(bets + raises) / calls, preflop" },
  { key: "af_postflop", group: "Aggression", label: "AF post", fmt: ratio, range: [1.5, 3], help: "(bets + raises) / calls, flop onward" },
  { key: "wtsd", group: "Showdown", label: "WTSD", fmt: pct, range: [22, 32], help: "Reached showdown / saw the flop" },
  { key: "wsd", group: "Showdown", label: "W$SD", fmt: pct, range: [45, 55], help: "Won at showdown / reached showdown" },
  // Bluffing: the log only reveals cards at showdown or when shown, so bluffs that worked are invisible. `asPct`
  // marks count columns whose value is a share, so the tint compares that share against the range.
  { key: "bluffs_shown", group: "Bluffing", label: "Bluffs", fmt: count, asPct: true, range: [20, 40], help: "Bets and raises from the flop on whose cards were later seen and were air or a draw at the time. Tint compares the share of shown bets that were bluffs." },
  { key: "est_bluffs", group: "Bluffing", table: false, label: "~Bluffs", fmt: approx, asPct: true, range: [20, 40], help: "Estimated bluffs: the shown-bluff share applied to every postflop bet and raise, seen or not. Assumes unseen bets have the same mix as shown ones; players show value more than bluffs, so this overstates. Needs 5 shown bets." },
  { key: "takedown", group: "Bluffing", label: "Takedown", fmt: pct, range: [40, 60], help: "Postflop bets and raises that won the pot on the spot (everyone folded) / postflop bets and raises. Under the same-mix assumption this is also the estimated bluff success rate." },
];

// `table: false` columns show only on the profile page; the table has to fit the page width without scrolling.
const TABLE_COLUMNS = STAT_COLUMNS.filter((c) => c.table !== false);
// First column of each group gets a left rule so the header groups read down the whole table.
const groupStart = (c) => TABLE_COLUMNS.find((x) => x.group === c.group) === c;

// What sorting and crowns compare: the displayed count for count columns, otherwise the stat's value.
// A count column's `value` is the share behind its tint, which would order 5/8 above 7/20.
const rankValue = (stat, col) => (col.fmt === count || col.fmt === approx ? (stat.value == null ? null : stat.n) : stat.value);

const MIN_SAMPLE = 10; // below this many opportunities the value is noise, so it is shown muted instead of tinted

// "lo" | "hi" | "mid" | "thin" for a stat against its column's typical range.
// An AF's evidence is every bet, raise and call (n + d), not just the calls it divides by.
const sampleSize = (stat, col) => (col.fmt === ratio ? stat.n + stat.d : stat.d);

export function statTone(stat, col) {
  if (!stat || sampleSize(stat, col) < MIN_SAMPLE) return "thin";
  if (stat.value == null) return col.fmt === ratio && stat.n > 0 ? "hi" : "thin"; // AF with zero calls is infinite
  const v = col.fmt === pct || col.asPct ? stat.value * 100 : stat.value;
  return v < col.range[0] ? "lo" : v > col.range[1] ? "hi" : "mid";
}

// "38 / 63 · above the typical 22–35%" style explanation shared by the table cells and the player tiles.
export function statTitle(stat, col) {
  const tone = statTone(stat, col);
  const [lo, hi] = col.range;
  const band = col.fmt === pct || col.asPct ? `${lo}–${hi}%` : `${lo}–${hi}`;
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

export function PlayerChip({ player, color, size = 28 }) {
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
    const col = STAT_COLUMNS.find((c) => c.key === sort.key);
    const value = (p) => (col ? rankValue(p[sort.key], col) : p[sort.key]);
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
      const top = Math.max(...eligible.map((p) => rankValue(p[c.key], c) ?? -Infinity));
      out[c.key] = new Set(eligible.filter((p) => rankValue(p[c.key], c) === top).map((p) => p.player_id));
    }
    return out;
  }, [players]);
  const Crown = ({ k, p }) => (leaders[k]?.has(p.player_id) ? <sup className="crown" title="Highest at the table">👑</sup> : null);
  // First click on a column shows the biggest values first; a second click flips it.
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const SortHeader = ({ k, title, children, className = "", ...rest }) => (
    <th className={`num sortable ${className} ${sort.key === k ? "sorted" : ""}`} onClick={() => toggleSort(k)} title={title ? `${title}\nClick to sort` : "Click to sort"} {...rest}>
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
          <tr className="group-row">
            {merging && <th rowSpan={2} />}
            <th className="player-col" rowSpan={2}>Player</th>
            <SortHeader k="hands" rowSpan={2}>Hands</SortHeader>
            <SortHeader k="net" rowSpan={2}>Net</SortHeader>
            {STAT_GROUPS.map((g) => (
              <th key={g} className="group group-start" colSpan={TABLE_COLUMNS.filter((c) => c.group === g).length}>
                {g}
              </th>
            ))}
          </tr>
          <tr>
            {TABLE_COLUMNS.map((c) => (
              <SortHeader key={c.key} k={c.key} title={c.help} className={groupStart(c) ? "group-start" : ""}>
                {c.label}
              </SortHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.player_id}
              className={`clickable ${picked.includes(p.player_id) ? "picked" : ""} ${leaders.net?.has(p.player_id) && p.net > 0 ? "winner-row" : ""}`}
              title={leaders.net?.has(p.player_id) && p.net > 0 ? "Biggest winner of the night" : undefined}
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
              {TABLE_COLUMNS.map((c) => (
                <td key={c.key} className={`num ${groupStart(c) ? "group-start" : ""}`}>
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
