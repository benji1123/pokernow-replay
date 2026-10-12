import React, { useMemo, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { signed } from "../hands.js";

// Deep-dive views for one player. All data comes from player.profile (see backend profile.py) plus the
// existing stats. `openHands(label, ids)` switches to the Hands tab filtered to those hand ids.

const STREETS = ["flop", "turn", "river"];
const STREET_LABEL = { flop: "Flop", turn: "Turn", river: "River" };
const POSITIONS = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

// One color family per kind of thing. Strength is a diverging ramp (bluff → value); actions warm = aggressive,
// cool = passive; bet sizes are one ramp of the player's own color.
const STRENGTHS = [
  { key: "air", label: "Air", color: "var(--neg)" },
  { key: "draw", label: "Draw", color: "var(--draw)", title: "Flush draw, open-ender or gutshot with no pair (flop and turn only)" },
  { key: "weak_pair", label: "Weak pair", color: "var(--hi)" },
  { key: "top_pair_plus", label: "Top pair", color: "var(--lo)" },
  { key: "two_pair_plus", label: "Two pair+", color: "var(--pos)" },
];
const ACTIONS = [
  { key: "raise", label: "Raise", color: "var(--hi)" },
  { key: "bet", label: "Bet", color: "color-mix(in srgb, var(--hi) 65%, var(--surface))" },
  { key: "call", label: "Call", color: "var(--lo)" },
  { key: "check", label: "Check", color: "color-mix(in srgb, var(--muted) 55%, var(--surface))" },
  { key: "fold", label: "Fold", color: "var(--line)" },
];
const SIZES = [
  { key: "small", label: "< 40%", mix: 30 },
  { key: "mid", label: "40–80%", mix: 55 },
  { key: "big", label: "80–120%", mix: 80 },
  { key: "over", label: "> 120%", mix: 100 },
];
const HOLE_CLASSES = [
  { key: "pair", label: "Pair", color: "var(--pos)" },
  { key: "broadway", label: "Broadway", color: "var(--lo)" },
  { key: "Ax", label: "Ax", color: "color-mix(in srgb, var(--lo) 50%, var(--surface))" },
  { key: "suited_connector", label: "Suited conn.", color: "var(--hi)" },
  { key: "junk", label: "Junk", color: "var(--neg)" },
];
const THIN = 5; // shown-hand cells with fewer samples are drawn faded

const pct = (r) => (r && r.d ? `${Math.round((100 * r.n) / r.d)}%` : "–");
const frac = (r) => (r ? `${r.n} / ${r.d}` : "");

function Tile({ label, value, sub, help }) {
  return (
    <div className="tile" title={help}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {sub != null && <span className="tile-sample">{sub}</span>}
    </div>
  );
}

// Horizontal stacked bar. segments: [{ key, label, n, color, onClick? }]. Shows counts inside wide segments.
function Bar({ segments, total = segments.reduce((a, s) => a + s.n, 0), height = 18, faded }) {
  if (!total) return <span className="muted small-text">–</span>;
  return (
    <span className={`bar ${faded ? "faded" : ""}`} style={{ height }}>
      {segments.filter((s) => s.n > 0).map((s) => (
        <span
          key={s.key}
          className={`bar-seg ${s.onClick ? "clickable" : ""}`}
          style={{ width: `${(100 * s.n) / total}%`, background: s.color }}
          title={`${s.label}: ${s.n} of ${total}${s.onClick ? " · click to see the hands" : ""}`}
          onClick={s.onClick}
        >
          {s.n / total > 0.12 && s.n}
        </span>
      ))}
    </span>
  );
}

function Legend({ items }) {
  return (
    <span className="legend">
      {items.map((it) => (
        <span key={it.key} className="legend-item" title={it.title}>
          <span className="swatch" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </span>
  );
}

const sizeColor = (color, mix) => `color-mix(in srgb, ${color} ${mix}%, var(--surface))`;

/* ---------------- Preflop range grid ---------------- */
const RANKS = "AKQJT98765432";
const LINE_GROUPS = [
  { key: "all", label: "All", lines: null },
  { key: "raised", label: "Raised", lines: ["raise", "3bet"], title: "Opened or 3-bet" },
  { key: "call", label: "Called", lines: ["call"], title: "Called a raise" },
  { key: "limp", label: "Limped", lines: ["limp"], title: "Called in an unopened pot" },
];
const POS_GROUPS = [
  { key: "all", label: "All", pos: null },
  { key: "early", label: "Early", pos: (p) => p.startsWith("UTG") || p === "LJ" || p === "HJ" },
  { key: "late", label: "CO/BTN", pos: (p) => p === "CO" || p === "BTN" },
  { key: "blinds", label: "Blinds", pos: (p) => p === "SB" || p === "BB" },
];
const LINE_LABEL = { raise: "raised", "3bet": "3-bet", call: "called", limp: "limped", check: "checked" };
const lineColor = (line) => (line === "raise" || line === "3bet" ? "var(--hi)" : line === "check" ? "var(--muted)" : "var(--lo)");
// Same classes as hole_class() in profile.py, derived from the combo key.
function comboClass(c) {
  const [a, b] = [RANKS.indexOf(c[0]), RANKS.indexOf(c[1])];
  if (a === b) return "pair";
  if (a <= RANKS.indexOf("T") && b <= RANKS.indexOf("T")) return "broadway";
  if (c[0] === "A") return "Ax";
  if (c[2] === "s" && b - a <= 2) return "suited_connector";
  return "junk";
}

export function RangeGrid({ player, color, openHands }) {
  const all = player.profile.preflop.range || [];
  const [lineKey, setLineKey] = useState("all");
  const [posKey, setPosKey] = useState("all");
  const lineGroup = LINE_GROUPS.find((g) => g.key === lineKey);
  const posGroup = POS_GROUPS.find((g) => g.key === posKey);
  const entries = all.filter((e) => (!lineGroup.lines || lineGroup.lines.includes(e.line)) && (!posGroup.pos || posGroup.pos(e.pos)));
  const cells = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const c = m.get(e.combo) || { n: 0, net: 0, ids: [], lines: {} };
      c.n += 1; c.net += e.net; c.ids.push(e.hand_id); c.lines[e.line] = (c.lines[e.line] || 0) + 1;
      m.set(e.combo, c);
    }
    return m;
  }, [entries]);
  const max = Math.max(1, ...[...cells.values()].map((c) => c.n));
  const raisedCombos = new Set(all.filter((e) => e.line === "raise" || e.line === "3bet").map((e) => e.combo)).size;
  const classSegs = HOLE_CLASSES.map((h) => {
    const ids = entries.filter((e) => comboClass(e.combo) === h.key).map((e) => e.hand_id);
    return { ...h, n: ids.length, onClick: ids.length ? () => openHands(`${lineGroup.label.toLowerCase()} preflop (${posGroup.label.toLowerCase()}) and showed ${h.label.toLowerCase()}`, ids) : undefined };
  });
  const Seg = ({ groups, value, onChange }) => (
    <span className="seg" role="radiogroup">
      {groups.map((g) => (
        <button key={g.key} role="radio" aria-checked={value === g.key} className={`seg-btn ${value === g.key ? "on" : ""}`} onClick={() => onChange(g.key)} title={g.title}>
          {g.label}
        </button>
      ))}
    </span>
  );
  return (
    <section className="panel dd-card range-card">
      <h4>
        Range <span className="muted small-text">shown hands only</span>
        <span className="range-summary muted small-text">
          shown {all.length} of {player.hands} hands · {new Set(all.map((e) => e.combo)).size} of 169 combos · raised with {raisedCombos}
        </span>
      </h4>
      <div className="range-controls">
        <Seg groups={LINE_GROUPS} value={lineKey} onChange={setLineKey} />
        <Seg groups={POS_GROUPS} value={posKey} onChange={setPosKey} />
        <span className="muted small-text">{entries.length} hands</span>
      </div>
      <div className="range-grid" style={{ "--c": color }}>
        {[...RANKS].map((r, i) =>
          [...RANKS].map((c, j) => {
            const key = i === j ? r + c : i < j ? r + c + "s" : c + r + "o";
            const cell = cells.get(key);
            const top = cell && Object.entries(cell.lines).sort((a, b) => b[1] - a[1])[0][0];
            const title = cell
              ? `${key} · ${cell.n} shown · ${Object.entries(cell.lines).map(([l, n]) => `${LINE_LABEL[l]} ${n}`).join(", ")} · net ${signed(cell.net)} · click to see the hands`
              : `${key} · never shown`;
            return (
              <button
                key={key}
                className={`range-cell ${i === j ? "pair" : i < j ? "suited" : "offsuit"} ${cell ? "seen clickable" : ""}`}
                style={cell ? { background: sizeColor(lineColor(top), 25 + Math.round((75 * cell.n) / max)) } : undefined}
                title={title}
                disabled={!cell}
                onClick={cell ? () => openHands(`showed ${key}`, cell.ids) : undefined}
              >
                <span className="range-combo">{key}</span>
                {cell && cell.n > 1 && <span className="range-n">{cell.n}</span>}
              </button>
            );
          })
        )}
      </div>
      <div className="range-foot">
        <Bar segments={classSegs} faded={entries.length < THIN} />
        <Legend items={HOLE_CLASSES} />
      </div>
      <p className="hint range-hint">
        Only hands revealed at showdown or shown voluntarily, so raises that won preflop and bluffs that got a fold never appear. Warm = raised, cool = called or limped; darker = seen more often. Click a cell or a segment to see those hands.
      </p>
    </section>
  );
}

/* ---------------- Preflop ---------------- */
export function PreflopTab({ player, color, openHands }) {
  const pf = player.profile.preflop;
  const posRows = POSITIONS.filter((p) => pf.vpip_by_pos[p]?.d).map((p) => ({ pos: p, ...pf.vpip_by_pos[p] }));
  return (
    <div className="dd">
      <section className="stat-tiles">
        <Tile label="Limp" value={pct(pf.limp)} sub={frac(pf.limp)} help="Entered an unopened pot by calling rather than raising / times entering an unopened pot" />
        <Tile label="Steal" value={pct(pf.steal)} sub={frac(pf.steal)} help="Raised from CO, BTN or SB when everyone before had folded / those spots" />
        <Tile label="Open size" value={pf.open_bb ? `${pf.open_bb.median} bb` : "–"} sub={pf.open_bb ? `median of ${pf.open_bb.n}` : "no opens"} help="Median first raise, in big blinds" />
        <Tile label="3-bet size" value={pf.three_bet_mult ? `${pf.three_bet_mult.median}× open` : "–"} sub={pf.three_bet_mult ? `median of ${pf.three_bet_mult.n}` : "no 3-bets"} help="Median 3-bet as a multiple of the open it was over" />
        <Tile label="All-ins" value={pf.allins} sub={`in ${player.hands} hands`} help="Actions that put the whole stack in" />
      </section>
      <RangeGrid player={player} color={color} openHands={openHands} />
      <div className="dd-grid">
        <section className="panel dd-card">
          <h4>VPIP by position</h4>
          <table className="dd-table">
            <tbody>
              {posRows.map((r) => (
                <tr key={r.pos}>
                  <td><span className="pos-badge">{r.pos}</span></td>
                  <td className="bar-cell"><Bar segments={[{ key: "in", label: "Played", n: r.n, color }, { key: "out", label: "Folded", n: r.d - r.n, color: "var(--line)" }]} /></td>
                  <td className="num">{pct(r)} <span className="muted small-text">{frac(r)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Streets ---------------- */
export function StreetsTab({ player, color }) {
  const { streets, lines } = player.profile;
  return (
    <div className="dd">
      <section className="stat-tiles">
        <Tile label="C-bet" value={pct(lines.cbet)} sub={frac(lines.cbet)} help="Bet the flop as the preflop raiser / flops seen as the preflop raiser" />
        <Tile label="Turn barrel" value={pct(lines.turn_barrel)} sub={frac(lines.turn_barrel)} help="Bet the turn after c-betting the flop / turns seen after a c-bet" />
        <Tile label="Fold to c-bet" value={pct(lines.fold_to_cbet)} sub={frac(lines.fold_to_cbet)} help="Folded to the preflop raiser's flop bet / times facing one" />
        <Tile label="Donk bets" value={lines.donk} sub="led into the raiser" help="Bet the flop first while not being the preflop raiser" />
        <Tile label="Fold to river bet" value={pct(lines.river_fold)} sub={frac(lines.river_fold)} help="Folded facing a river bet / river bets faced" />
        <Tile label="River call wins" value={pct(lines.river_call_won)} sub={frac(lines.river_call_won)} help="Called a river bet and won the pot / river bets called" />
      </section>
      <section className="panel dd-card">
        <table className="dd-table streets">
          <thead>
            <tr>
              <th>Street</th>
              <th>Actions</th>
              <th className="num">n</th>
              <th>Bet size <span className="muted">(% of pot)</span></th>
              <th className="num">Median</th>
              <th className="num">Check-raises</th>
            </tr>
          </thead>
          <tbody>
            {STREETS.map((st) => {
              const s = streets[st];
              const acts = ACTIONS.map((a) => ({ ...a, n: s.actions[a.key] || 0 }));
              const n = acts.reduce((a, x) => a + x.n, 0);
              const sizes = s.sizes ? SIZES.map((z) => ({ ...z, n: s.sizes[z.key], color: sizeColor(color, z.mix) })) : [];
              return (
                <tr key={st}>
                  <td><span className="street-name">{STREET_LABEL[st]}</span></td>
                  <td className="bar-cell"><Bar segments={acts} /></td>
                  <td className="num">{n}</td>
                  <td className="bar-cell"><Bar segments={sizes} /></td>
                  <td className="num">{s.sizes ? `${Math.round(s.sizes.median * 100)}%` : "–"} {s.sizes && <span className="muted small-text">n={s.sizes.n}</span>}</td>
                  <td className="num">{s.check_raise || "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="legends">
          <Legend items={ACTIONS} />
          <Legend items={SIZES.map((z) => ({ ...z, color: sizeColor(color, z.mix) }))} />
        </div>
      </section>
    </div>
  );
}

/* ---------------- What a bet means ---------------- */
export function MeaningsTab({ player, openHands }) {
  const cells = new Map(player.profile.meanings.map((m) => [`${m.street}|${m.kind}|${m.size}`, m.strengths]));
  const rows = [];
  for (const st of STREETS) for (const kind of ["bet", "raise"]) if (SIZES.some((z) => cells.has(`${st}|${kind}|${z.key}`))) rows.push({ st, kind });
  if (!rows.length) return <p className="hint">No hole cards were shown after a bet or raise, so there is nothing to read here yet.</p>;
  return (
    <div className="dd">
      <section className="panel dd-card">
        <table className="dd-table meanings">
          <thead>
            <tr>
              <th>Action</th>
              {SIZES.map((z) => <th key={z.key}>{z.label} pot</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, kind }) => (
              <tr key={`${st}${kind}`}>
                <td><span className="street-name">{STREET_LABEL[st]}</span> <span className="dd-rowlabel">{kind}</span></td>
                {SIZES.map((z) => {
                  const by = cells.get(`${st}|${kind}|${z.key}`);
                  if (!by) return <td key={z.key} className="muted small-text">–</td>;
                  const segs = STRENGTHS.map((s) => ({ ...s, n: (by[s.key] || []).length, onClick: by[s.key]?.length ? () => openHands(`${STREET_LABEL[st]} ${kind} ${z.label} pot · showed ${s.label.toLowerCase()}`, by[s.key]) : undefined }));
                  const total = segs.reduce((a, s) => a + s.n, 0);
                  return (
                    <td key={z.key} className="bar-cell">
                      <Bar segments={segs} faded={total < THIN} />
                      <span className="muted small-text">{total} shown</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="legends">
          <Legend items={STRENGTHS} />
          <span className="muted small-text">Only hands shown at showdown, graded against the board at that street. Faded cells have fewer than {THIN}. Click a segment to see those hands.</span>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Showdown ---------------- */
export function ShowdownTab({ player }) {
  const sd = player.profile.showdown;
  const { lines } = player.profile;
  const segs = STRENGTHS.map((s) => ({ ...s, n: sd.river_aggr_shown[s.key] || 0 }));
  const total = segs.reduce((a, s) => a + s.n, 0);
  return (
    <div className="dd">
      <section className="stat-tiles">
        <Tile label="WTSD" value={pct(player.wtsd)} sub={frac(player.wtsd)} help="Reached showdown / saw the flop" />
        <Tile label="W$SD" value={pct(player.wsd)} sub={frac(player.wsd)} help="Won at showdown / reached showdown" />
        <Tile label="Caught bluffing" value={sd.caught_bluff} sub="river bets shown as air or weak pair that lost" />
        <Tile label="Value shown" value={sd.value_shown} sub="river bets shown with a pair or better" />
        <Tile label="Fold to river bet" value={pct(lines.river_fold)} sub={frac(lines.river_fold)} />
        <Tile label="River call wins" value={pct(lines.river_call_won)} sub={frac(lines.river_call_won)} />
      </section>
      <section className="panel dd-card">
        <h4>River bets and raises that went to showdown</h4>
        <Bar segments={segs} height={24} faded={total < THIN} />
        <div className="legends">
          <Legend items={STRENGTHS} />
          <span className="muted small-text">{total} shown</span>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Money flow ---------------- */
export function MoneyFlowTab({ player, players, colors, onSelectPlayer }) {
  const rows = Object.entries(player.vs || {})
    .map(([pid, amt]) => ({ p: players.find((q) => q.player_id === pid), amt }))
    .filter((r) => r.p)
    .sort((a, b) => b.amt - a.amt);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amt)));
  return (
    <div className="dd">
      <section className="panel dd-card">
        <table className="dd-table flow">
          <tbody>
            {rows.map(({ p, amt }) => (
              <tr key={p.player_id} className="clickable" style={{ "--c": colors[p.player_id].main }} onClick={() => onSelectPlayer(p.player_id)}>
                <td>
                  <span className="player-chip simple">
                    <PixelAvatar id={p.player_id} color={colors[p.player_id].main} size={24} />
                    <span className="player-name">{p.name}</span>
                  </span>
                </td>
                <td className="flow-cell">
                  <span className="flow-track">
                    <span className={`flow-bar ${amt >= 0 ? "pos" : "neg"}`} style={{ width: `${(50 * Math.abs(amt)) / max}%` }} />
                  </span>
                </td>
                <td className="num"><span className={`net ${amt > 0 ? "pos" : amt < 0 ? "neg" : "zero"} net-flat`}>{signed(amt)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Positive: chips {player.name} took from that player over the session. Multiway pots are split in proportion to what each loser put in.</p>
      </section>
    </div>
  );
}
