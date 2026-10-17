import React, { useRef, useState } from "react";
import { Sprite } from "./FloatingIcons.jsx";

function savedLabel({ files, summary, savedAt }) {
  const n = files.length;
  const parts = [`${n} log${n === 1 ? "" : "s"}`];
  if (summary) parts.push(`${summary.hand_count} hands`, `${summary.players} players`);
  parts.push(new Date(savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  return parts.join(" · ");
}

export default function UploadScreen({ onUpload, loading, error, engineStatus, saved, onLoadSaved, onForgetSaved, onDemo }) {
  const [over, setOver] = useState(false);
  const input = useRef();

  function pick(files) {
    const list = Array.from(files || []);
    if (list.length) onUpload(list);
  }

  return (
    <main className="upload-screen">
      <div className="hero">
        <div className="hero-suits">
          <Sprite kind="spade" color="#4c6ef5" size={22} />
          <Sprite kind="heart" color="#ff6b6b" size={22} />
          <Sprite kind="diamond" color="#12b886" size={22} />
          <Sprite kind="club" color="#7950f2" size={22} />
        </div>
        <h1 className="pixel">Session Replay</h1>
        <p className="lede">Every hand, every player, every stat from your PokerNow game.</p>
      </div>

      <div
        className={`dropzone ${over ? "over" : ""} ${loading ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => !loading && input.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current.click()}
      >
        <Sprite kind="chip" color="#f5b800" size={40} />
        <p className="drop-title">{loading ? "Dealing…" : "Drop your PokerNow logs here"}</p>
        <p className="drop-sub">
          or <u>browse</u> for one or more <code>poker_now_log_….csv</code>
        </p>
        <input ref={input} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => pick(e.target.files)} />
      </div>
      {error ? <p className="error engine-status">{error}</p> : <p className="muted small engine-status">{engineStatus}</p>}

      {!saved && (
        <p className="demo-row">
          No log handy?{" "}
          <button className="btn small" disabled={loading} onClick={onDemo}>Try a demo session</button>
        </p>
      )}

      {saved && (
        <div className="saved-session panel">
          <span className="saved-text">
            <b>Last session</b> · {savedLabel(saved)}
          </span>
          <button className="btn primary small" disabled={loading} onClick={onLoadSaved}>Load</button>
          <button className="link small" onClick={onForgetSaved} title="Remove the cached logs from this browser">Forget</button>
        </div>
      )}

      <ul className="how">
        <li>In your PokerNow room: <b>Ledger → Download log</b></li>
        <li>Drop several games to combine them into one set of stats</li>
        <li>Everything is analyzed in your browser; the files never leave your device</li>
        <li>Your last upload and Study scores stay in this browser so you can reload them</li>
      </ul>
    </main>
  );
}
