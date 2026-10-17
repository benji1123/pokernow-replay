import React, { useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { awards } from "../insights.js";
import { downloadAwards, shareAwards } from "../shareCard.js";

// Session awards strip above the players table: one winner per category. Clicking a card opens the winner's
// page, with the hand in question selected when the award is about a single hand.
export default function Awards({ hands, players, colors, series, span, onOpen }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null); // "copied" | "shared" | "downloaded", shown briefly on the button
  const items = awards(hands, players, series);
  if (!items.length) return null;
  const name = (pid) => players.find((p) => p.player_id === pid)?.name ?? "?";
  const args = { items, players, colors, span, handCount: hands.length };
  // Called straight from the click (no await before shareAwards) so Safari still allows the clipboard write.
  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    try {
      const how = await fn(args);
      setDone(how ?? "downloaded");
      setTimeout(() => setDone(null), 2500);
    } catch (e) {
      setErr(`Could not make the image: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const label = busy ? "Drawing…" : done === "copied" ? "Copied ✓" : done === "downloaded" ? "Saved ✓" : done === "shared" ? "Shared ✓" : "Copy image";
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
      <span className="award award-share panel">
        <button type="button" className="award-share-main" onClick={() => run(shareAwards)} disabled={busy} title="Copy the awards and final standings as an image for the group chat (on phones: share)">
          <span className="award-emoji" aria-hidden="true">📸</span>
          <span className="award-body">
            <span className="award-label">Share</span>
            <span className="award-who">{label}</span>
          </span>
        </button>
        <button type="button" className="link small award-share-dl" onClick={() => run(downloadAwards)} disabled={busy} title="Download as poker-awards.png" aria-label="Download as PNG">⬇</button>
      </span>
      {err && <span className="error small">{err}</span>}
    </section>
  );
}
