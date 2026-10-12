import React from "react";

// Four 0-99 ratings as short bars, video-game style. A null rating means the sample was too thin to rate.
export default function TradingCard({ ratings, color }) {
  if (!ratings?.length) return null;
  return (
    <div className="tcard" style={{ "--c": color }} aria-label="Style ratings">
      {ratings.map((r) => (
        <div key={r.key} className={`tcard-row ${r.value == null ? "na" : ""}`} title={`${r.label}: ${r.detail}`}>
          <span className="tcard-label">{r.label}</span>
          <span className="tcard-bar">
            <span className="tcard-fill" style={{ width: `${r.value ?? 0}%` }} />
          </span>
          <span className="tcard-num">{r.value == null ? "–" : r.value}</span>
        </div>
      ))}
    </div>
  );
}
