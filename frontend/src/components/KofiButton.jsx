import React from "react";
import { Sprite } from "./FloatingIcons.jsx";

// Plain link instead of Ko-fi's Widget_2.js: that script draws itself with document.write,
// which doesn't work after a SPA has loaded, and a static link keeps third-party code off the page.
export default function KofiButton() {
  return (
    <a className="kofi" href="https://ko-fi.com/M4M6HQ5J7" target="_blank" rel="noopener noreferrer" title="Support the analyzer on Ko-fi">
      <Sprite kind="cup" color="currentColor" size={18} />
      <span className="kofi-text pixel">Buy me a coffee</span>
    </a>
  );
}
