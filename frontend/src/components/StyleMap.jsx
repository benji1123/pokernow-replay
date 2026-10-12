import React from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { ticks } from "../insights.js";

// VPIP × PFR scatter with each player as their avatar. PFR can never exceed VPIP, so everything sits under the
// diagonal; the dashed lines split the classic four styles: tight/loose at VPIP 28%, passive/aggressive where
// fewer than half of the hands played were raised (PFR < VPIP / 2).
const W = 720, H = 400, PAD = { l: 48, r: 24, t: 20, b: 40 };
const TIGHT_LOOSE = 28;
const MIN_HANDS = 20;

export default function StyleMap({ players, colors, onSelect }) {
  const pts = players.map((p) => ({ p, vpip: (p.vpip.value ?? 0) * 100, pfr: (p.pfr.value ?? 0) * 100 }));
  const xMax = Math.min(100, Math.max(50, Math.ceil((Math.max(...pts.map((q) => q.vpip)) + 10) / 10) * 10));
  const yMax = Math.min(100, Math.max(30, Math.ceil((Math.max(...pts.map((q) => q.pfr)) + 10) / 10) * 10));
  const x = (v) => PAD.l + (v / xMax) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + ((yMax - v) / yMax) * (H - PAD.t - PAD.b);
  const xT = x(TIGHT_LOOSE);

  return (
    <section className="panel stylemap">
      <header className="race-head">
        <h3>Style map</h3>
        <span className="muted small-text">how often each player enters a pot (VPIP) vs. how often they do it raising (PFR)</span>
      </header>
      <svg className="stylemap-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Players plotted by VPIP and PFR">
        {ticks(0, xMax, 5).map((v) => (
          <g key={`x${v}`} className="grid">
            <line x1={x(v)} x2={x(v)} y1={PAD.t} y2={H - PAD.b} />
            <text x={x(v)} y={H - PAD.b + 16} textAnchor="middle">{v}%</text>
          </g>
        ))}
        {ticks(0, yMax, 4).map((v) => (
          <g key={`y${v}`} className="grid">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text x={PAD.l - 8} y={y(v)} dy="0.35em" textAnchor="end">{v}%</text>
          </g>
        ))}
        <text className="axis-label" x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle">VPIP · plays more hands →</text>
        <text className="axis-label" transform={`translate(12, ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle">PFR · raises more →</text>

        {/* Feasible region: PFR ≤ VPIP. Shade what is impossible so the empty corner reads as intended. */}
        <polygon className="impossible" points={`${x(0)},${y(0)} ${x(Math.min(xMax, yMax))},${y(Math.min(xMax, yMax))} ${x(0)},${y(Math.min(xMax, yMax))}`} />
        <line className="divider" x1={xT} x2={xT} y1={PAD.t} y2={H - PAD.b} />
        <line className="divider" x1={x(0)} y1={y(0)} x2={x(Math.min(xMax, yMax * 2))} y2={y(Math.min(xMax, yMax * 2) / 2)} />

        <text className="quadrant" x={xT - 10} y={PAD.t + 16} textAnchor="end">tight · aggressive</text>
        <text className="quadrant" x={xT + 10} y={PAD.t + 16}>loose · aggressive</text>
        <text className="quadrant" x={xT - 10} y={H - PAD.b - 10} textAnchor="end">tight · passive</text>
        <text className="quadrant" x={W - PAD.r - 6} y={H - PAD.b - 10} textAnchor="end">loose · passive</text>

        {pts.map(({ p, vpip, pfr }) => {
          const thin = p.hands < MIN_HANDS;
          const size = 30;
          return (
            <g key={p.player_id} className={`style-pt ${thin ? "thin" : ""} clickable`} transform={`translate(${x(vpip) - size / 2}, ${y(pfr) - size / 2})`} onClick={() => onSelect(p.player_id)}>
              <title>{`${p.name}: VPIP ${Math.round(vpip)}%, PFR ${Math.round(pfr)}% over ${p.hands} hands${thin ? " (small sample)" : ""}`}</title>
              <PixelAvatar id={p.player_id} color={colors[p.player_id].main} size={size} />
              <text className="style-name" x={size / 2} y={size + 13} textAnchor="middle" fill={colors[p.player_id].main}>{p.name}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
