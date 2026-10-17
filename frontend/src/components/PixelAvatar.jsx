import React, { useMemo } from "react";
import { hash } from "../theme.js";
import { spriteFor, spriteRuns, SPRITE_FILL as FILL, SPRITE_SIZE } from "../sprites.js";

// Poker-themed 16x16 pixel character picked by the player id, drawn in the player's colour.
export default function PixelAvatar({ id, color, size = 36 }) {
  const name = spriteFor(hash(id));
  const runs = useMemo(() => spriteRuns(name), [name]);
  return (
    <svg className={`pixel-avatar sprite-${name}`} width={size} height={size} viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`} shapeRendering="crispEdges" aria-hidden="true">
      <rect width={SPRITE_SIZE} height={SPRITE_SIZE} fill={`${color}22`} />
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={FILL[r.ch] ?? color} fillOpacity={r.ch === "+" ? 0.55 : 1} />
      ))}
    </svg>
  );
}
