import React, { useMemo, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { Cards, HiddenCards } from "./Cards.jsx";
import { rng, shuffle } from "../quiz.js";
import { describeAction } from "../decisions.js";
import { guessQuestions, priorShown, GUESS_FILTERS, filterGuess } from "../guess.js";
import { STRENGTH_LABEL } from "../strength.js";

const ROUND = 10;
const STREET = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };

// "Guess the hand": an opponent's line with sizes, you name their strength class at that point, then the cards.
export default function Guess({ hands, players, colors, hero, onOpen, onFinish }) {
  const [filter, setFilter] = useState("all");
  const [seed, setSeed] = useState(() => Date.now() % 1e9);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);

  const all = useMemo(() => guessQuestions(hands, hero), [hands, hero]);
  const round = useMemo(() => shuffle(filterGuess(all, filter), rng(seed)).slice(0, ROUND), [all, filter, seed]);
  const by = Object.fromEntries(players.map((p) => [p.player_id, p]));
  const name = (p) => by[p]?.name ?? "?";

  const reset = (f = filter) => {
    setFilter(f);
    setSeed((s) => s + 1);
    setI(0);
    setPicked(null);
    setScore(0);
  };

  if (!all.length) return <p className="hint">No opponent showed their cards after a postflop action in these logs, so there is nothing to guess yet.</p>;

  const filters = (
    <nav className="seg study-filters" role="group" aria-label="Line filter">
      {GUESS_FILTERS.map(([key, label]) => (
        <button key={key} className={`seg-btn ${filter === key ? "on" : ""}`} onClick={() => reset(key)} aria-pressed={filter === key}>
          {label}
        </button>
      ))}
    </nav>
  );

  const q = round[i];
  if (!q) {
    return (
      <>
        {filters}
        <section className="panel study-card study-done">
          <h3>{round.length ? "Round over" : "No lines of that kind"}</h3>
          {round.length > 0 && <p className="study-score-big">{score} / {round.length}</p>}
          <p className="muted">{round.length ? "hands read right." : "Try another filter."}</p>
          {round.length > 0 && <button type="button" className="btn primary" onClick={() => reset()}>New round</button>}
        </section>
      </>
    );
  }

  const color = colors[q.pid]?.main;
  const pick = (key) => {
    if (picked) return;
    setPicked(key);
    if (key === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= round.length) onFinish?.(score, round.length);
    setPicked(null);
    setI((n) => n + 1);
  };
  const correct = picked === q.answer;
  const prior = priorShown(by[q.pid], q);
  const others = q.inHand.filter((p) => p !== q.pid);

  return (
    <>
      {filters}
      <section className="panel study-card decide" style={{ "--c": color }}>
        <header className="study-head">
          <span className="study-progress">{i + 1} / {round.length}</span>
          <span className="study-score">{score} right</span>
          <span className="muted small-text study-pool">
            Hand #{q.hand.number} · {STREET[q.street]} · {q.inHand.length} players
          </span>
        </header>

        <div className="decide-table">
          <div className="decide-you">
            <PixelAvatar id={q.pid} color={color} size={28} />
            <span className="guess-who">
              <b>{name(q.pid)}</b> <span className="muted small-text">{q.pos}</span>
            </span>
            {picked ? <Cards cards={q.cards} size="md" /> : <HiddenCards size="md" />}
          </div>
          <div className="decide-board">
            <span className="muted small-text">Board</span>
            <Cards cards={q.board} size="sm" />
          </div>
          <div className="decide-pot">
            <b>Pot {q.pot}</b>
            {others.length > 0 && <span className="muted small-text"> · vs {others.map(name).join(", ")}</span>}
          </div>
        </div>

        <div className="decide-trail">
          {Object.keys(STREET).filter((st) => q.line.some((t) => t.street === st)).map((st) => {
            const acts = q.line.filter((t) => t.street === st);
            const current = st === q.street;
            return (
              <p key={st} className={current ? "current" : ""}>
                <span className="decide-street">{STREET[st]}</span>
                {acts.map((t, k) => {
                  const text = describeAction(t, name);
                  const isQ = current && k === acts.length - 1;
                  return (
                    <React.Fragment key={k}>
                      {k > 0 && " · "}
                      {isQ ? <b>{text}</b> : text}
                    </React.Fragment>
                  );
                })}
              </p>
            );
          })}
        </div>

        <p className="study-q guess-q">What does {name(q.pid)} have here?</p>
        <div className="study-options guess-opts" role="group">
          {q.options.map((o) => {
            const state = picked == null ? "" : o.correct ? "right" : o.key === picked ? "wrong" : "dim";
            return (
              <button key={o.key} type="button" className={`study-opt ${state}`} onClick={() => pick(o.key)} disabled={picked != null}>
                {o.label}
              </button>
            );
          })}
        </div>

        {picked && (
          <div className={`study-reveal ${correct ? "right" : "wrong"}`}>
            <p className="study-verdict">
              <b>{correct ? "Right." : "Not quite."}</b> {name(q.pid)} had <Cards cards={q.cards} size="xs" /> — {STRENGTH_LABEL[q.answer].toLowerCase()} on this {q.street}
              {q.finalCategory && `, ${q.finalCategory} by the river`}.
            </p>
            {q.after.length > 0 && <p className="decide-after"><span className="muted">Then:</span> {q.after.map((t) => describeAction(t, name)).join(" · ")}.</p>}
            <p className="decide-result">
              Result for {name(q.pid)}: <b className={q.net >= 0 ? "pos" : "neg"}>{q.net > 0 ? `+${q.net}` : q.net}</b>
              {" · "}won by {Object.keys(q.hand.collected).map(name).join(", ")}
            </p>
            {prior && (
              <p className="decide-table-stats">
                <span className="muted">{name(q.pid)}'s shown {q.action.kind === "raise" ? "raises" : "bets"} of this size ({prior.sizeLabel}) on the {q.street}, {prior.n} including this one:</span>{" "}
                {prior.parts.map(([s, n]) => `${STRENGTH_LABEL[s].toLowerCase()} ${n}`).join(" · ")}
              </p>
            )}
            <div className="study-actions">
              <button type="button" className="link" onClick={() => onOpen(q.pid, q.hand.hand_id)}>Open hand #{q.hand.number}</button>
              <button type="button" className="btn primary" onClick={next} autoFocus>{i + 1 >= round.length ? "Finish" : "Next"}</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
