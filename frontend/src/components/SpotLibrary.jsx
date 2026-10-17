import React, { useMemo } from "react";
import { SPOTS, spotLibrary, topAction } from "../decisions.js";

const pct = (v) => `${Math.round(v * 100)}%`;
const GROUP_LABEL = { preflop: "Preflop", aggressor: "Bet or check", facing: "Facing a bet", river: "River" };

// Spot library: which recurring spots you land in, how you play them and how the table does, so you know what to
// drill. The spot name opens your hand list filtered to those hands; "Drill" opens "What would you do" on that spot.
export default function SpotLibrary({ hands, hero, onDrill, onHands }) {
  const rows = useMemo(() => spotLibrary(hands, hero), [hands, hero]);
  const groups = [...new Set(rows.map((r) => r.group))];
  const withYou = rows.filter((r) => r.you);
  const most = withYou.length ? withYou.reduce((a, b) => (b.you.n > a.you.n ? b : a)) : null;
  const worst = withYou.filter((r) => r.you.hands >= 5).sort((a, b) => a.you.net - b.you.net)[0];

  return (
    <section className="panel spot-lib">
      <header className="spot-lib-head">
        <h3>Spot library</h3>
        {hero ? (
          <p className="muted">
            Your {withYou.reduce((n, r) => n + r.you.n, 0)} decisions by spot. {most && <>You are most often <b>{most.label.toLowerCase()}</b> ({pct(most.you.share)} of decisions)</>}
            {worst && worst.you.net < 0 && <>; the spot costing you most is <b>{worst.label.toLowerCase()}</b> ({worst.you.net} over {worst.you.hands} hands)</>}.
          </p>
        ) : (
          <p className="muted">How the table plays each spot. Your own columns appear when a log you downloaded yourself is loaded.</p>
        )}
      </header>
      <div className="spot-lib-scroll">
        <table className="spot-table">
          <thead>
            <tr>
              <th>Spot</th>
              {hero && <th className="num" title="How many of your decisions were in this spot">You</th>}
              {hero && <th title="Your most common action here">You usually</th>}
              {hero && <th className="num" title="Sum of your net over the hands where you faced this spot">Net</th>}
              {hero && <th className="num" title="Of your bets and raises here, how many made everyone fold">Took it</th>}
              <th className="num" title="Decisions by everyone at the table in this spot">Table</th>
              <th title="The table's most common action here">Table usually</th>
              <th className="num" title="Of the table's bets and raises here, how many made everyone fold">Took it</th>
              {hero && <th />}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g}>
                <tr className="spot-group"><td colSpan={hero ? 9 : 4}>{GROUP_LABEL[g]}</td></tr>
                {rows.filter((r) => r.group === g).map((r) => {
                  const yt = r.you ? topAction(r.you) : null;
                  const tt = topAction(r.table);
                  return (
                    <tr key={r.spot} className={r.you ? "" : "dim"}>
                      <td title={r.desc}>
                        {r.you ? (
                          <button type="button" className="link spot-link" onClick={() => onHands(r)} title={`${r.desc}. Show your ${r.you.hands} hands here`}>{r.label}</button>
                        ) : r.label}
                      </td>
                      {hero && <td className="num">{r.you ? <><b>{r.you.n}</b> <span className="muted">{pct(r.you.share)}</span></> : "—"}</td>}
                      {hero && <td>{yt ? <>{yt.kind} <span className="muted">{pct(yt.share)}</span></> : "—"}</td>}
                      {hero && <td className={`num ${r.you ? (r.you.net > 0 ? "pos" : r.you.net < 0 ? "neg" : "") : ""}`}>{r.you ? (r.you.net > 0 ? `+${r.you.net}` : r.you.net) : "—"}</td>}
                      {hero && <td className="num">{r.you?.aggr ? `${r.you.tookDown}/${r.you.aggr}` : "—"}</td>}
                      <td className="num">{r.table.n}</td>
                      <td>{tt ? <>{tt.kind} <span className="muted">{pct(tt.share)}</span></> : "—"}</td>
                      <td className="num">{r.table.aggr ? `${r.table.tookDown}/${r.table.aggr}` : "—"}</td>
                      {hero && <td>{r.you && <button type="button" className="link" onClick={() => onDrill(r.spot)}>Drill</button>}</td>}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint spot-lib-hint">Net is the whole hand's result, not the decision's, so a spot you fold early in looks cheap and a spot you win big from looks good whatever you did there.</p>
    </section>
  );
}
