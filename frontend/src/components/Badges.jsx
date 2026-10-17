import React from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import Tip from "./Tip.jsx";
import { signed } from "../hands.js";

// variant: default (pill with label), "compact" (bare emoji), "row" (emoji-only tinted pills for a second line).
// Only the default shows the label; the others rely on the hover title.
export function Badges({ archetypes, compact, variant = compact ? "compact" : "" }) {
  if (!archetypes?.length) return null;
  return (
    <span className={`badges ${variant}`}>
      {archetypes.map((a) => (
        <Tip key={a.key} text={`${a.label}: ${a.blurb}`}>
          <span className={`badge badge-${a.key}`}>
            <span className="badge-emoji" aria-hidden="true">{a.emoji}</span>
            {variant === "" && <span className="badge-label">{a.label}</span>}
          </span>
        </Tip>
      ))}
    </span>
  );
}

// Who this player took the most from (best friend) and lost the most to (nemesis).
export function Rivals({ player, players, colors, onSelectPlayer }) {
  const cards = [
    { key: "best_friend", title: "Best friend", sub: "took the most from", ref: player.best_friend, sign: +1 },
    { key: "nemesis", title: "Nemesis", sub: "lost the most to", ref: player.nemesis, sign: -1 },
  ];
  return (
    <section className="rivals">
      {cards.map(({ key, title, sub, ref, sign }) => {
        const other = ref && players.find((p) => p.player_id === ref.player_id);
        return (
          <div key={key} className={`rival ${key} ${other ? "clickable" : "none"}`} style={other ? { "--c": colors[other.player_id].main } : undefined} onClick={() => other && onSelectPlayer(other.player_id)} title={other ? `${title}: ${sub} ${other.name}` : undefined}>
            <span className="rival-title">{title}</span>
            {other ? (
              <>
                <PixelAvatar id={other.player_id} color={colors[other.player_id].main} size={28} />
                <span className="rival-name">{other.name}</span>
                <span className={`net ${sign > 0 ? "pos" : "neg"}`}>{signed(sign * ref.amount)}</span>
                <span className="rival-sub">{sub}</span>
              </>
            ) : (
              <span className="rival-sub">{sign > 0 ? "Didn't come out ahead against anyone" : "Didn't lose to anyone"}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
