import React from "react";
import { Cards, HiddenCards } from "./Cards.jsx";
import PixelAvatar from "./PixelAvatar.jsx";
import { Net } from "./PlayersTable.jsx";
import { STREETS, POST_LABEL, boardForStreet, describeVerb, groupActions, playerName } from "../hands.js";

const Name = ({ hand, pid, focus }) => <span className={pid === focus ? "focus-name" : ""}>{playerName(hand, pid)}</span>;

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
            <PixelAvatar id={s.player_id} color={colorOf(s.player_id)} size={22} />
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
            {groupActions(acts).map((row, i) => {
              pot += row.acts.reduce((n, a) => n + a.amount, 0);
              const many = row.acts.length > 1;
              return (
                <li key={i} className={`action kind-${row.post ? "post" : row.kind}`}>
                  <span className="dots">
                    {row.acts.map((a) => <span key={a.player_id} className="dot" style={{ "--c": colorOf(a.player_id) }} />)}
                  </span>
                  <span className="action-text">
                    {row.post
                      ? row.acts.map((a, j) => (
                          <React.Fragment key={a.player_id}>
                            {j > 0 && " · "}
                            <Name hand={hand} pid={a.player_id} focus={focus} /> {POST_LABEL[a.kind] ?? a.kind.slice(5)} {a.amount}
                          </React.Fragment>
                        ))
                      : (
                          <>
                            {row.acts.map((a, j) => (
                              <React.Fragment key={a.player_id}>
                                {j > 0 && ", "}
                                <Name hand={hand} pid={a.player_id} focus={focus} />
                              </React.Fragment>
                            ))}{" "}
                            {describeVerb(row.acts[0], many)}
                          </>
                        )}
                  </span>
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
        <p>
          {Object.entries(hand.collected).map(([pid, amt], i) => (
            <React.Fragment key={pid}>
              {i > 0 && " · "}
              <b style={{ color: colorOf(pid) }}>{playerName(hand, pid)}</b> collects {amt}
            </React.Fragment>
          ))}
          {Object.entries(hand.uncalled).map(([pid, amt]) => (
            <span key={pid} className="muted"> · {amt} uncalled back to {playerName(hand, pid)}</span>
          ))}
        </p>
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
