import React, { useMemo, useRef, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { ticks } from "../insights.js";
import { signed } from "../hands.js";

// Cumulative profit per player over the session, one line per player in their color. Plain SVG in a fixed
// viewBox (the CSS pins the aspect ratio so mouse x maps straight onto hand index).
const W = 960, H = 300, PAD = { l: 52, r: 36, t: 16, b: 30 };

export default function ProfitRace({ hands, players, colors, series, onOpen }) {
  const svgRef = useRef();
  const [hover, setHover] = useState(null); // hand index under the cursor
  const [hidden, setHidden] = useState(() => new Set()); // players toggled off in the legend
  const shown = players.filter((p) => !hidden.has(p.player_id));
  const toggle = (pid) => setHidden((h) => { const n = new Set(h); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const solo = (pid) => setHidden(new Set(players.filter((p) => p.player_id !== pid).map((p) => p.player_id)));
  const touched = useRef(false); // a tap shows the tooltip; the tooltip's own button opens the hand

  const geo = useMemo(() => {
    const all = shown.flatMap((p) => series[p.player_id]).map((p) => p.cum); // y-range follows the visible lines
    const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const pad = (hi - lo || 100) * 0.08;
    const yMin = lo - pad, yMax = hi + pad;
    const n = Math.max(hands.length - 1, 1);
    const x = (i) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b);
    // Game boundaries, for sessions made of several logs.
    const bounds = hands.map((h, i) => (i > 0 && h.game !== hands[i - 1].game ? i : null)).filter((i) => i != null);
    return { x, y, yMin, yMax, bounds, yTicks: ticks(yMin, yMax, 5) };
  }, [hands, series, hidden]);

  function onMove(e) {
    const pt = e.touches ? e.touches[0] : e;
    const r = svgRef.current.getBoundingClientRect();
    const px = ((pt.clientX - r.left) / r.width) * W;
    const n = hands.length - 1;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * n);
    setHover(Math.max(0, Math.min(n, i)));
  }
  // Click opens the hand for whichever player's line is nearest the cursor.
  function onClick(e) {
    if (touched.current) { touched.current = false; return; }
    if (hover == null) return;
    const r = svgRef.current.getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * H;
    let best = null;
    for (const p of shown) {
      const pt = series[p.player_id].filter((q) => q.i <= hover).pop();
      if (!pt) continue;
      const d = Math.abs(geo.y(pt.cum) - py);
      if (!best || d < best.d) best = { d, pid: p.player_id, hand: hands[hover] };
    }
    if (best) onOpen(best.pid, best.hand.hand_id);
  }

  const atHover = hover == null ? null : shown.map((p) => {
    const pt = series[p.player_id].filter((q) => q.i <= hover).pop();
    return { p, cum: pt ? pt.cum : 0 };
  }).sort((a, b) => b.cum - a.cum);
  const games = [...new Set(hands.map((h) => h.game))];

  return (
    <section className="panel race">
      <header className="race-head">
        <h3>Profit race</h3>
        <span className="muted small-text">cumulative net by hand · <span className="pointer-only">hover to read, click to open the hand</span><span className="touch-only">tap or drag to read</span></span>
      </header>
      <div className="race-legend">
        {players.map((p) => (
          <button key={p.player_id} type="button" className={`chip ${hidden.has(p.player_id) ? "off" : ""}`} style={{ "--c": colors[p.player_id].main }} onClick={() => toggle(p.player_id)} onDoubleClick={() => solo(p.player_id)} title="Click to hide or show · double-click to show only this player">
            <PixelAvatar id={p.player_id} color={colors[p.player_id].main} size={16} />
            {p.name}
          </button>
        ))}
        {hidden.size > 0 && <button type="button" className="link small" onClick={() => setHidden(new Set())}>show all</button>}
      </div>
      <div className="race-body">
        <svg ref={svgRef} className="race-svg" viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} onTouchStart={(e) => { touched.current = true; onMove(e); }} onTouchMove={onMove} role="img" aria-label="Cumulative profit per player over the session">
          {geo.yTicks.map((v) => (
            <g key={v} className={`grid ${v === 0 ? "zero" : ""}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(v)} y2={geo.y(v)} />
              <text x={PAD.l - 8} y={geo.y(v)} dy="0.35em" textAnchor="end">{v}</text>
            </g>
          ))}
          {geo.bounds.map((i, k) => (
            <g key={i} className="game-bound">
              <line x1={geo.x(i)} x2={geo.x(i)} y1={PAD.t} y2={H - PAD.b} />
              <text x={geo.x(i) + 4} y={H - PAD.b + 14}>G{games.indexOf(hands[i].game) + 1}</text>
            </g>
          ))}
          {geo.bounds.length > 0 && <text className="game-bound-label" x={PAD.l + 4} y={H - PAD.b + 14}>G1</text>}
          <text className="axis-label" x={W - PAD.r} y={H - 6} textAnchor="end">hand {hands.length}</text>
          <text className="axis-label" x={PAD.l} y={H - 6}>hand 1</text>
          {shown.map((p) => {
            const pts = series[p.player_id];
            if (!pts.length) return null;
            const d = `M${geo.x(0)},${geo.y(0)} ` + pts.map((q) => `L${geo.x(q.i)},${geo.y(q.cum)}`).join(" ");
            const last = pts[pts.length - 1];
            return (
              <g key={p.player_id} className="race-line" style={{ "--c": colors[p.player_id].main }}>
                <path d={d} />
                <g transform={`translate(${geo.x(last.i) + 4}, ${geo.y(last.cum) - 9})`}>
                  <PixelAvatar id={p.player_id} color={colors[p.player_id].main} size={18} />
                </g>
              </g>
            );
          })}
          {hover != null && <line className="hover-line" x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={H - PAD.b} />}
          {hover != null && atHover.map(({ p, cum }) => <circle key={p.player_id} cx={geo.x(hover)} cy={geo.y(cum)} r="4" fill={colors[p.player_id].main} stroke="var(--surface)" strokeWidth="1.5" />)}
        </svg>
        {hover != null && (
          <div className="race-tip" style={{ left: `${(geo.x(hover) / W) * 100}%`, transform: geo.x(hover) > W * 0.7 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}>
            <div className="race-tip-head">
              {games.length > 1 && <span className="game-tag">G{games.indexOf(hands[hover].game) + 1}</span>}
              hand #{hands[hover].number}
              <button className="race-tip-open touch-only" onClick={() => onOpen(atHover[0].p.player_id, hands[hover].hand_id)}>open ↗</button>
            </div>
            {atHover.map(({ p, cum }) => (
              <div key={p.player_id} className="race-tip-row" style={{ "--c": colors[p.player_id].main }}>
                <span className="dot" />
                <span className="race-tip-name">{p.name}</span>
                <span className={`race-tip-num ${cum > 0 ? "pos" : cum < 0 ? "neg" : ""}`}>{signed(cum)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
