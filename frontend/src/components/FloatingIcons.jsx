import React from "react";

// Pixel-art suits and a chip, drawn as rect grids so they stay crisp. Drift slowly in the background.
const SPRITES = {
  spade: ["...##...", "..####..", ".######.", "########", "########", "..#..#..", "...##...", "..####.."],
  heart: [".##..##.", "########", "########", "########", ".######.", "..####..", "...##...", "........"],
  diamond: ["...##...", "..####..", ".######.", "########", ".######.", "..####..", "...##...", "........"],
  club: ["..####..", "..####..", "########", "########", "########", "..#..#..", "...##...", "..####.."],
  chip: ["..####..", ".#.##.#.", "###..###", "##....##", "##....##", "###..###", ".#.##.#.", "..####.."],
};

export function Sprite({ kind, color, size = 32 }) {
  const rows = SPRITES[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === "#" ? <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" fill={color} /> : null))
      )}
    </svg>
  );
}

const FLOATERS = [
  { kind: "spade", color: "#4c6ef5", left: "6%", top: "12%", size: 28, dur: 19 },
  { kind: "heart", color: "#ff6b6b", left: "88%", top: "18%", size: 36, dur: 23 },
  { kind: "chip", color: "#f5b800", left: "14%", top: "72%", size: 30, dur: 21 },
  { kind: "diamond", color: "#12b886", left: "80%", top: "70%", size: 26, dur: 17 },
  { kind: "club", color: "#7950f2", left: "48%", top: "88%", size: 24, dur: 25 },
  { kind: "chip", color: "#e64980", left: "60%", top: "6%", size: 22, dur: 27 },
];

export default function FloatingIcons() {
  return (
    <div className="floaters" aria-hidden="true">
      {FLOATERS.map((f, i) => (
        <span key={i} className="floater" style={{ left: f.left, top: f.top, animationDuration: `${f.dur}s`, animationDelay: `${-i * 3}s` }}>
          <Sprite kind={f.kind} color={f.color} size={f.size} />
        </span>
      ))}
    </div>
  );
}
