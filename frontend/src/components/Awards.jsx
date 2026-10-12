import React from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { awards } from "../insights.js";

// Session awards strip above the players table: one winner per category. Clicking a card opens the winner's
// page, with the hand in question selected when the award is about a single hand.
export default function Awards({ hands, players, colors, series, onOpen }) {
  const items = awards(hands, players, series);
  if (!items.length) return null;
  const name = (pid) => players.find((p) => p.player_id === pid)?.name ?? "?";
  return (
    <section className="awards" aria-label="Session awards">
      {items.map((it) => {
        const c = colors[it.pid]?.main;
        return (
          <button
            key={it.key}
            type="button"
            className="award panel"
            style={{ "--c": c }}
            onClick={() => onOpen(it.pid, it.hand?.hand_id)}
            title={`${it.long}. Click to open ${it.hand ? "the hand" : "their page"}.`}
          >
            <span className="award-emoji" aria-hidden="true">{it.emoji}</span>
            <span className="award-body">
              <span className="award-label">{it.label}</span>
              <span className="award-who">
                <PixelAvatar id={it.pid} color={c} size={16} />
                <span className="award-name">{name(it.pid)}</span>
              </span>
            </span>
            <span className="award-value">
              <b>{it.value}</b>
              {it.sub && <small>{it.sub}</small>}
            </span>
          </button>
        );
      })}
    </section>
  );
}
