import React from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { highlights } from "../insights.js";

// "The night in numbers": a strip of headline cards above the players table. Cards tied to a player open
// that player's page with the hand in question selected.
export default function Highlights({ hands, players, colors, series, onOpen }) {
  const items = highlights(hands, players, series);
  if (!items.length) return null;
  return (
    <section className="highlights">
      {items.map((it) => {
        const c = it.pid ? colors[it.pid]?.main : undefined;
        const clickable = it.pid && it.hand;
        return (
          <div
            key={it.key}
            className={`highlight panel ${clickable ? "clickable" : ""}`}
            style={c ? { "--c": c } : undefined}
            onClick={() => clickable && onOpen(it.pid, it.hand.hand_id)}
            title={clickable ? `${it.long}. Click to open the hand.` : it.long}
          >
            <span className="highlight-label">{it.label}</span>
            <span className="highlight-value">{it.value}</span>
            <span className="highlight-sub">
              {it.pid && <PixelAvatar id={it.pid} color={c} size={16} />}
              <span className="highlight-sub-text">{it.sub}</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}
