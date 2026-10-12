import React from "react";
import { Cards, HiddenCards } from "./Cards.jsx";
import PixelAvatar from "./PixelAvatar.jsx";
import { Net } from "./PlayersTable.jsx";
import { STREETS, boardForStreet, describeAction, playerName } from "../hands.js";

// Text view of one hand. The replay will replace this pane; it consumes the same `actions` list.
export default function HandDetail({ hand, focus, colors, gameLabel }) {
  const byStreet = STREETS.map((s) => [s, hand.actions.filter((a) => a.street === s)]).filter(([, acts]) => acts.length);
  const colorOf = (pid) => colors[pid]?.main ?? "#888";
  let pot = 0;
  return (
    <div className="hand-detail">
      <h3>
        <span className="pixel small">Hand</span> #{hand.number}
        {gameLabel && <span className="game-tag" title={hand.game}>{gameLabel}</span>}
      </h3>
      <ul className="seats">
        {hand.seats.map((s) => (
          <li key={s.player_id} className={`seat ${s.player_id === focus ? "focus" : ""}`} style={{ "--c": colorOf(s.player_id) }}>
            <PixelAvatar id={s.player_id} color={colorOf(s.player_id)} size={18} />
            <span className="seat-name">{s.name}</span>
            <span className="pos-badge">{hand.positions[s.player_id] ?? ""}</span>
            <span className="muted">{s.stack}</span>
            {hand.shown[s.player_id] ? <Cards cards={hand.shown[s.player_id]} size="xs" /> : <HiddenCards size="xs" />}
          </li>
        ))}
      </ul>

      {byStreet.map(([street, acts]) => (
        <section key={street} className="street">
          <h4>
            <span className="street-name">{street}</span>
            <Cards cards={boardForStreet(hand.board, street)} placeholder="" size="sm" />
          </h4>
          <ol className="actions">
            {acts.map((a, i) => {
              pot += a.amount;
              return (
                <li key={i} className={`action kind-${a.kind} ${a.player_id === focus ? "focus" : ""}`} style={{ "--c": colorOf(a.player_id) }}>
                  <span className="dot" />
                  <span className="action-text">{describeAction(a, playerName(hand, a.player_id))}</span>
                  <span className="pot">pot {pot}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <section className="result">
        <h4>
          <span className="street-name">Result</span>
        </h4>
        {Object.entries(hand.collected).map(([pid, amt]) => (
          <p key={pid}>
            <b style={{ color: colorOf(pid) }}>{playerName(hand, pid)}</b> collects {amt}
          </p>
        ))}
        {Object.entries(hand.uncalled).map(([pid, amt]) => (
          <p key={pid} className="muted">
            {amt} uncalled returned to {playerName(hand, pid)}
          </p>
        ))}
        <div className="nets">
          {hand.seats.map((s) => (
            <span key={s.player_id} className="net-row" style={{ "--c": colorOf(s.player_id) }}>
              <span className="dot" />
              {s.name} <Net net={hand.net[s.player_id]} />
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
