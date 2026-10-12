import React, { useEffect, useState } from "react";

// index.html applies the saved theme before first paint; this just keeps the attribute and localStorage in step.
const initial = () => (typeof document === "undefined" ? "light" : document.documentElement.dataset.theme || "light");

export default function ThemeToggle() {
  const [theme, setTheme] = useState(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  const dark = theme === "dark";
  return (
    <button className="theme-toggle" onClick={() => setTheme(dark ? "light" : "dark")} title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle dark mode">
      <span className="pixel">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
