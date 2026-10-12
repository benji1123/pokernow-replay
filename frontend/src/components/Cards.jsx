import React from "react";
import { SUITS } from "../hands.js";

export function Card({ card, size = "md" }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (
    <span className={`card card-${size} suit-${suit}`}>
      <span className="rank">{rank}</span>
      <span className="suit">{SUITS[suit] ?? suit}</span>
    </span>
  );
}

export function Cards({ cards, placeholder = "—", size = "md" }) {
  if (!cards || cards.length === 0) return placeholder ? <span className="muted">{placeholder}</span> : null;
  return (
    <span className="cards">
      {cards.map((c, i) => (
        <Card key={i} card={c} size={size} />
      ))}
    </span>
  );
}

export function HiddenCards({ size = "md" }) {
  return (
    <span className="cards">
      <span className={`card card-${size} card-back`} />
      <span className={`card card-${size} card-back`} />
    </span>
  );
}
