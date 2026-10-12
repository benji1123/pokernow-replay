import React from "react";
import { hash } from "../theme.js";

// 8x8 mirrored pixel sprite derived from the player id: a little pixel "critter" in the player's color.
export default function PixelAvatar({ id, color, size = 36 }) {
  const h = hash(id);
  const cells = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const bit = (h >>> ((y * 4 + x) % 32)) & 1;
      const bit2 = (hash(id + y) >>> x) & 1;
      if (bit ^ bit2) cells.push([x, y], [7 - x, y]);
    }
  }
  // Eyes so it reads as a face.
  const eyeY = 2 + (h % 2);
  return (
    <svg className="pixel-avatar" width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <rect width="8" height="8" fill={`${color}22`} />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1" height="1" fill={color} />
      ))}
      <rect x="2" y={eyeY} width="1" height="1" fill="#1b1b1f" />
      <rect x="5" y={eyeY} width="1" height="1" fill="#1b1b1f" />
    </svg>
  );
}
