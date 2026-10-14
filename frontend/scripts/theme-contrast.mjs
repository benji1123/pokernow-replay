// Reports WCAG contrast ratios for each theme in styles.css. Usage: node scripts/theme-contrast.mjs
// Exits 1 if any body-text pair is under 4.5 or any secondary/bold pair under 3.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const blocks = [...css.matchAll(/:root(?:\[data-theme="(\w+)"\])?\s*\{([^}]*)\}/g)];
const base = {};
const themes = {};
for (const [, id, body] of blocks) {
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)) vars[m[1]] = m[2];
  if (!id) Object.assign(base, vars);
  else themes[id] = vars;
}
themes.sepia = {}; // the base :root block

const lum = (hex) => {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum]
const pairs = [
  ["ink", "bg", 4.5], ["ink", "surface", 4.5], ["ink-2", "surface", 4.5], ["muted", "surface", 3],
  ["accent-ink", "surface", 4.5], ["on-accent", "accent", 3], ["pos", "surface", 3], ["neg", "surface", 3],
  ["lo", "surface", 3], ["hi", "surface", 3], ["warm-ink", "warm-soft", 4.5], ["neg-ink", "neg-soft", 4.5],
  ["accent-ink", "accent-soft", 4.5], ["black-suit", "card-face", 4.5], ["red-suit", "card-face", 3],
  ["diamond-suit", "card-face", 3], ["club-suit", "card-face", 3], ["line", "surface", 1.15],
];

let bad = 0;
for (const [id, over] of Object.entries(themes)) {
  const v = { ...base, ...over };
  const cells = pairs.map(([f, b, min]) => {
    const r = ratio(v[f], v[b]);
    const ok = r >= min;
    if (!ok) bad++;
    return `${f}/${b} ${r.toFixed(1)}${ok ? "" : " !!"}`;
  });
  console.log(`\n${id}\n  ${cells.join("\n  ")}`);
}
if (bad) {
  console.error(`\n${bad} pair(s) below minimum`);
  process.exit(1);
}
