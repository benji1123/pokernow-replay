import React, { useMemo, useState } from "react";
import PixelAvatar from "./PixelAvatar.jsx";
import { Cards } from "./Cards.jsx";
import { rng, shuffle } from "../quiz.js";
import { SPOTS, SPOT_GROUPS, heroDecisions, spotStats, checklist, choices, describeAction } from "../decisions.js";
import { equity, categoryOf } from "../equity.js";

const ROUND = 10;
const pct = (v) => `${Math.round(v * 100)}%`;
const STREET = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };

// "What would you do": your own decision points, replayed one at a time. There is no solver here; the reveal is
// what you did, what happened, your equity against any cards that were shown, and how the table plays this spot.
export default function Decide({ hands, players, colors, hero, onOpen }) {
  const [group, setGroup] = useState("all");
  const [seed, setSeed] = useState(() => Date.now() % 1e9);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [matched, setMatched] = useState(0);

  const all = useMemo(() => heroDecisions(hands, hero), [hands, hero]);
  const round = useMemo(() => {
    const pool = all.filter((d) => group === "all" || SPOTS[d.spot].group === group);
    return shuffle(pool, rng(seed)).slice(0, ROUND);
  }, [all, group, seed]);
  const name = (p) => players.find((x) => x.player_id === p)?.name ?? "?";

  const reset = (g = group) => {
    setGroup(g);
    setSeed((s) => s + 1);
    setI(0);
    setPicked(null);
    setShowAnswers(false);
    setMatched(0);
  };

  if (!hero) {
    return (
      <p className="hint">
        Decision replays need your own hole cards, which PokerNow only writes into the log you download yourself. Upload a log from your account and this mode lights up.
      </p>
    );
  }
  if (!all.length) return <p className="hint">No decisions of yours were found in these logs.</p>;

  const d = round[i];
  const filters = (
    <nav className="seg study-filters" role="group" aria-label="Spot filter">
      {SPOT_GROUPS.map(([key, label]) => (
        <button key={key} className={`seg-btn ${group === key ? "on" : ""}`} onClick={() => reset(key)} aria-pressed={group === key}>
          {label}
        </button>
      ))}
    </nav>
  );

  if (!d) {
    return (
      <>
        {filters}
        <section className="panel study-card study-done">
          <h3>{round.length ? "Round over" : "No spots of that kind"}</h3>
          {round.length > 0 && <p className="study-score-big">{matched} / {round.length}</p>}
          <p className="muted">{round.length ? "times you chose what you actually did at the table." : "Try another filter."}</p>
          {round.length > 0 && <button type="button" className="btn primary" onClick={() => reset()}>New round</button>}
        </section>
      </>
    );
  }

  const color = colors[hero]?.main;
  const { opts, actual } = choices(d);
  const items = checklist(d, players);
  const pick = (key) => {
    if (picked) return;
    setPicked(key);
    if (key === actual) setMatched((m) => m + 1);
  };
  const next = () => {
    setPicked(null);
    setShowAnswers(false);
    setI((n) => n + 1);
  };

  return (
    <>
      {filters}
      <section className="panel study-card decide" style={{ "--c": color }}>
        <header className="study-head">
          <span className="study-progress">{i + 1} / {round.length}</span>
          <span className="spot-chip" title={SPOTS[d.spot].desc}>{SPOTS[d.spot].label}</span>
          <span className="muted small-text study-pool">
            Hand #{d.hand.number} · {STREET[d.street]} · {d.pos} · {d.inHand.length} players
          </span>
        </header>

        <div className="decide-table">
          <div className="decide-you">
            <PixelAvatar id={hero} color={color} size={28} />
            <Cards cards={d.cards} size="md" />
            <span className="muted small-text">stack {d.stack}</span>
          </div>
          <div className="decide-board">
            <span className="muted small-text">Board</span>
            <Cards cards={d.board} size="sm" placeholder="preflop" />
          </div>
          <div className="decide-pot">
            <b>Pot {d.pot}</b>
            {d.toCall > 0 && <span> · {d.toCall} to call</span>}
          </div>
        </div>

        <div className="decide-trail">
          {Object.keys(STREET).filter((st) => st === d.street || d.trail.some((t) => t.street === st)).map((st) => {
            const acts = d.trail.filter((t) => t.street === st);
            const current = st === d.street;
            return (
              <p key={st} className={current ? "current" : ""}>
                <span className="decide-street">{STREET[st]}</span>
                {acts.length ? acts.map((t) => describeAction(t, name)).join(" · ") : current ? (st === "preflop" ? "Folded to you" : "Checked to you") : "checked around"}
                {current && <b> · you?</b>}
              </p>
            );
          })}
        </div>

        <div className="decide-ask">
          <div className="decide-ask-head">
            <span>Ask yourself</span>
            <button type="button" className="link" onClick={() => setShowAnswers((v) => !v)}>
              {showAnswers ? "Hide the answers" : "Show the answers"}
            </button>
          </div>
          <ol>
            {items.map((it) => (
              <li key={it.q}>
                <span className="decide-q">{it.q}</span>
                {showAnswers && <span className="decide-a">{it.a}</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="study-options decide-opts" role="group">
          {opts.map((o) => {
            const state = picked == null ? "" : o.key === actual ? "right" : o.key === picked ? "wrong" : "dim";
            return (
              <button key={o.key} type="button" className={`study-opt ${state}`} onClick={() => pick(o.key)} disabled={picked != null}>
                {o.label}
              </button>
            );
          })}
        </div>

        {picked && <Reveal d={d} hero={hero} players={players} colors={colors} name={name} hands={hands} picked={picked} actual={actual} onOpen={onOpen} onNext={next} last={i + 1 >= round.length} />}
      </section>
    </>
  );
}

function youDid(d) {
  const a = d.action;
  const allIn = a.all_in ? " all-in" : "";
  switch (a.kind) {
    case "fold": return "folded";
    case "check": return "checked";
    case "call": return `called ${a.amount}${allIn}`;
    case "bet": return `bet ${a.amount}${d.pot ? ` (${Math.round(100 * a.frac)}% pot)` : ""}${allIn}`;
    case "raise": return `raised to ${a.raise_to ?? a.amount}${allIn}`;
    default: return a.kind;
  }
}

function Reveal({ d, hero, players, colors, name, hands, picked, actual, onOpen, onNext, last }) {
  const vill = d.villainsShown;
  const eq = useMemo(() => (vill.length ? equity([d.cards, ...vill.map(([, c]) => c)], d.board) : null), [d, vill]);
  const table = useMemo(() => spotStats(hands, d.spot), [hands, d.spot]);
  const mix = Object.entries(table.mix).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${pct(n / table.n)}`).join(" · ");
  const you = youDid(d);
  const finalCat = d.hand.board.length === 5 ? categoryOf([...d.cards, ...d.hand.board]) : null;
  return (
    <div className={`study-reveal ${picked === actual ? "right" : "neutral"}`}>
      <p className="study-verdict">
        <b>At the table you {you}.</b> {picked === actual ? "Same as you picked." : "Different from what you picked now."}
        {d.tookDown === true && " Everyone folded."}
      </p>
      {d.after.length > 0 && <p className="decide-after"><span className="muted">Then:</span> {d.after.map((t) => describeAction(t, name)).join(" · ")}.</p>}
      {eq && (
        <p className="decide-equity">
          {vill.map(([p, c]) => (
            <span key={p} className="decide-villain" style={{ "--c": colors[p]?.main }}>
              <PixelAvatar id={p} color={colors[p]?.main} size={20} /> {name(p)} <Cards cards={c} size="xs" />
            </span>
          ))}
          <span>
            {" "}your equity here was <b>{pct(eq.shares[0])}</b>
            {eq.exact ? "" : " (sampled)"}
            {d.toCall > 0 && ` · needed ${pct(d.toCall / (d.pot + d.toCall))} to call`}
          </span>
        </p>
      )}
      {!eq && <p className="muted small-text">No opponent's cards were seen in this hand, so there is no equity to compute.</p>}
      <p className="decide-result">
        Result: <b className={d.net >= 0 ? "pos" : "neg"}>{d.net > 0 ? `+${d.net}` : d.net}</b>
        {finalCat && ` · you ended with ${finalCat}`}
        {" · "}won by {Object.keys(d.hand.collected).map(name).join(", ")}
      </p>
      <p className="decide-table-stats">
        <span className="muted">At this table, {SPOTS[d.spot].label.toLowerCase()} ({table.n} decisions):</span> {mix}
        {table.aggr > 0 && ` · aggression took it down ${table.tookDown} of ${table.aggr}`}
      </p>
      <div className="study-actions">
        <button type="button" className="link" onClick={() => onOpen(hero, d.hand.hand_id)}>Open hand #{d.hand.number}</button>
        <button type="button" className="btn primary" onClick={onNext} autoFocus>{last ? "Finish" : "Next"}</button>
      </div>
    </div>
  );
}
