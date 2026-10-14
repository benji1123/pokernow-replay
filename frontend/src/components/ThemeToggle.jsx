import React, { useEffect, useState } from "react";

// Ordered light -> dark so each click walks down the brightness ladder. Keep in step with styles.css and index.html.
export const THEMES = [
  { id: "light", name: "Paper", icon: "☀" },
  { id: "sepia", name: "Sepia", icon: "📜" },
  { id: "dusk", name: "Dusk", icon: "🌆" },
  { id: "felt", name: "Felt", icon: "🃏" },
  { id: "dark", name: "Midnight", icon: "☾" },
];
const ids = THEMES.map((t) => t.id);

// index.html applies the saved theme before first paint; this just keeps the attribute and localStorage in step.
const initial = () => {
  const t = typeof document === "undefined" ? "light" : document.documentElement.dataset.theme;
  return ids.includes(t) ? t : "light";
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  const i = ids.indexOf(theme);
  const next = THEMES[(i + 1) % THEMES.length];
  return (
    <button className="theme-toggle" onClick={() => setTheme(next.id)} title={`${THEMES[i].name} · click for ${next.name}`} aria-label={`Color scheme: ${THEMES[i].name}. Switch to ${next.name}`}>
      <span className="pixel">{THEMES[i].icon}</span>
    </button>
  );
}
