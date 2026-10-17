import React, { useEffect, useMemo, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import Decide from "./Decide.jsx";
import Guess from "./Guess.jsx";
import SpotLibrary from "./SpotLibrary.jsx";
import { eligible, makeRound } from "../quiz.js";
import { emptyScores, recordRound, purgeStoredScores } from "../storage.js";

const ROUND = 10;

// Study tab: practice modes built from this session's data, plus the spot library that says what to drill.
// Scores per mode last for this visit only: module-level so switching tabs keeps them, a reload clears them.
const MODES = [["reads", "Read the players"], ["decide", "What would you do"], ["guess", "Guess the hand"], ["spots", "Spot library"]];
const MODE_LABEL = Object.fromEntries(MODES);
let visitScores = emptyScores();

export default function Study({ players, hands, hero, colors, onOpen }) {
  const [mode, setMode] = useState("reads");
  const [focus, setFocus] = useState({ spot: null, n: 0 }); // n remounts Decide so a repeated Drill re-applies the spot
  const [scores, setScoresState] = useState(visitScores);
  const setScores = (next) => setScoresState((s) => (visitScores = typeof next === "function" ? next(s) : next));
  useEffect(() => {
    purgeStoredScores();
  }, []);
  const finish = (m) => (correct, total) => setScores((s) => recordRound(s, m, correct, total));
  const drill = (spot) => {
    setFocus((f) => ({ spot, n: f.n + 1 }));
    setMode("decide");
  };
  const scored = MODES.filter(([k]) => scores.modes[k]);
  return (
    <div className="study">
      <div className="study-bar">
        <nav className="seg" role="tablist" aria-label="Study modes">
          {MODES.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={mode === key} className={`seg-btn ${mode === key ? "on" : ""}`} onClick={() => setMode(key)}>
              {label}
            </button>
          ))}
        </nav>
        {scored.length > 0 && (
          <div className="study-record" title="Your running score for this visit; not saved, a reload clears it">
            {scored.map(([k]) => {
              const m = scores.modes[k];
              return (
                <span key={k} className="study-record-item" title={`${MODE_LABEL[k]}: ${m.rounds} round${m.rounds === 1 ? "" : "s"}, best ${m.best}/${m.bestOf}, last ${m.last.correct}/${m.last.total}`}>
                  <span className="muted">{MODE_LABEL[k]}</span> <b>{Math.round((100 * m.correct) / m.total)}%</b> <span className="muted">of {m.total}</span>
                </span>
              );
            })}
            <button type="button" className="link small-text" onClick={() => setScores(emptyScores())}>Reset</button>
          </div>
        )}
      </div>
      {mode === "reads" && <Flashcards players={players} colors={colors} onOpen={onOpen} onFinish={finish("reads")} />}
      {mode === "decide" && <Decide key={focus.n} hands={hands} players={players} colors={colors} hero={hero} onOpen={onOpen} onFinish={finish("decide")} focusSpot={focus.spot} />}
      {mode === "guess" && <Guess hands={hands} players={players} colors={colors} hero={hero} onOpen={onOpen} onFinish={finish("guess")} />}
      {mode === "spots" && <SpotLibrary hands={hands} hero={hero} onDrill={drill} onHands={(r) => onOpen(hero, undefined, { label: `${r.label.toLowerCase()} spot`, ids: r.you.ids })} />}
    </div>
  );
}

export function Flashcards({ players, colors, onOpen, onFinish }) {
  const [seed, setSeed] = useState(() => Date.now() % 1e9);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null); // option index answered on the current card
  const [score, setScore] = useState(0);
  const round = useMemo(() => makeRound(players, seed, ROUND), [players, seed]);
  const pool = eligible(players);

  if (!round.length) {
    return <p className="hint">Flashcards need players with at least 20 hands; this session is too short.</p>;
  }

  const restart = () => {
    setSeed((s) => s + 1);
    setI(0);
    setPicked(null);
    setScore(0);
  };
  const q = round[i];
  const done = i >= round.length;

  if (done) {
    return (
      <section className="panel study-card study-done">
        <h3>Round over</h3>
        <p className="study-score-big">{score} / {round.length}</p>
        <p className="muted">
          {score === round.length ? "You know this table cold." : score >= round.length * 0.7 ? "Solid reads. The misses are the ones to remember." : "Worth another round before the next game."}
        </p>
        <button type="button" className="btn primary" onClick={restart}>New round</button>
      </section>
    );
  }

  const color = colors[q.player.player_id]?.main;
  const answer = (idx) => {
    if (picked != null) return;
    setPicked(idx);
    if (q.options[idx].correct) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= round.length) onFinish?.(score, round.length);
    setPicked(null);
    setI((n) => n + 1);
  };
  const correct = picked != null && q.options[picked].correct;

  return (
    <section className="panel study-card" style={{ "--c": color }}>
      <header className="study-head">
        <span className="study-progress">
          {i + 1} / {round.length}
        </span>
        <span className="study-score">{score} correct</span>
        <span className="muted small-text study-pool" title={`Players with 20+ hands this session: ${pool.map((p) => p.name).join(", ")}`}>
          {pool.length} players
        </span>
      </header>
      <p className="study-q">
        {q.kind === "rate" && <PixelAvatar id={q.player.player_id} color={color} size={28} />}
        <span>{q.text}</span>
      </p>
      <div className={`study-options ${q.kind}`} role="group">
        {q.options.map((o, idx) => {
          const state = picked == null ? "" : o.correct ? "right" : idx === picked ? "wrong" : "dim";
          const c = o.player ? colors[o.player.player_id]?.main : color;
          return (
            <button key={o.label} type="button" className={`study-opt ${state}`} style={{ "--c": c }} onClick={() => answer(idx)} disabled={picked != null}>
              {o.player && <PixelAvatar id={o.player.player_id} color={c} size={22} />}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      {picked != null && (
        <div className={`study-reveal ${correct ? "right" : "wrong"}`}>
          <p className="study-verdict">
            <b>{correct ? "Right." : "Not quite."}</b> {q.answer}
            {q.detail && <span className="muted"> · {q.detail}</span>}
          </p>
          <p className="study-tip">{q.tip}</p>
          <div className="study-actions">
            <button type="button" className="link" onClick={() => onOpen(q.player.player_id)}>
              Open {q.player.name}'s page
            </button>
            <button type="button" className="btn primary" onClick={next} autoFocus>
              {i + 1 < round.length ? "Next" : "Finish"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
