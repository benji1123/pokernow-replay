import React, { useState } from "react";
import { createPortal } from "react-dom";

// Instant hover tooltip. Native `title` waits ~1s and can't be hurried; this renders a fixed-position bubble into
// <body> on mouseenter, so it also escapes panels that clip overflow. Tap toggles it on touch screens.
export default function Tip({ text, children, className = "" }) {
  const [at, setAt] = useState(null);
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const below = r.top < 56;
    const x = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150); // keep the bubble on screen
    setAt({ x, y: below ? r.bottom : r.top, below });
  };
  const hide = () => setAt(null);
  return (
    <span className={`tip-anchor ${className}`} onMouseEnter={show} onMouseLeave={hide} onClick={(e) => (at ? hide() : show(e))}>
      {children}
      {at && typeof document !== "undefined" && createPortal(
        <span className={`tip ${at.below ? "below" : ""}`} style={{ left: at.x, top: at.y }} role="tooltip">{text}</span>,
        document.body,
      )}
    </span>
  );
}
