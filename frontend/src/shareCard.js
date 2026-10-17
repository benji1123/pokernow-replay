// "Awards of the night" image for the group chat: built as an SVG string (pure, checkable outside a browser),
// then rasterized to PNG in the browser and shared or downloaded.
import { hash } from "./theme.js";
import { spriteFor, spriteRuns, SPRITE_FILL, SPRITE_SIZE } from "./sprites.js";

export const SITE_URL = "benji1123.github.io/pokernow-replay";
const W = 1080;
const PAD = 48;
const GAP = 14;
const CARD_W = (W - 2 * PAD - GAP) / 2;
const CARD_H = 92;
const ROW_H = 46;
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const DARK = { bg: "#15151b", surface: "#1f1f28", ink: "#d8d4ca", muted: "#8f8b83", line: "#33333f", pos: "#5fd38d", neg: "#ff7b7b", accent: "#5fd38d" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-US");

function avatar(id, color, x, y, size) {
  const k = size / SPRITE_SIZE;
  const rects = spriteRuns(spriteFor(hash(id)))
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${SPRITE_FILL[r.ch] ?? color}"${r.ch === "+" ? ' fill-opacity="0.55"' : ""}/>`)
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${k})" shape-rendering="crispEdges"><rect width="${SPRITE_SIZE}" height="${SPRITE_SIZE}" fill="${color}" fill-opacity="0.13"/>${rects}</g>`;
}

// items: awards() output; colors: player id -> {main}; span: sessionSpanParts(); theme: CSS colors (dark by default).
export function awardsSvg({ items, players, colors, span, handCount, theme = DARK }) {
  const t = { ...DARK, ...theme };
  const name = (pid) => players.find((p) => p.player_id === pid)?.name ?? "?";
  const color = (pid) => colors[pid]?.main ?? t.accent;
  const standings = [...players].sort((a, b) => b.net - a.net);
  const awardsTop = 150;
  const awardsH = Math.ceil(items.length / 2) * (CARD_H + GAP);
  const standTop = awardsTop + awardsH + 30;
  const H = standTop + 46 + Math.ceil(standings.length / 2) * ROW_H + 70;
  const when = [span?.day, span?.time].filter(Boolean).join(" · ");
  const out = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(FONT)}">`);
  out.push(`<rect width="${W}" height="${H}" fill="${t.bg}"/>`);
  out.push(`<text x="${PAD}" y="${PAD + 34}" font-size="40" font-weight="800" fill="${t.ink}" letter-spacing="1">🏆 Awards of the night</text>`);
  out.push(`<text x="${PAD}" y="${PAD + 74}" font-size="22" fill="${t.muted}">${esc([when, `${handCount} hands`, `${players.length} players`].filter(Boolean).join(" · "))}</text>`);

  items.forEach((it, i) => {
    const x = PAD + (i % 2) * (CARD_W + GAP);
    const y = awardsTop + Math.floor(i / 2) * (CARD_H + GAP);
    const c = color(it.pid);
    out.push(`<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="8" fill="${t.surface}" stroke="${t.line}"/>`);
    out.push(`<rect x="${x}" y="${y}" width="6" height="${CARD_H}" rx="3" fill="${c}"/>`);
    out.push(`<text x="${x + 24}" y="${y + 60}" font-size="38">${it.emoji}</text>`);
    out.push(`<text x="${x + 80}" y="${y + 34}" font-size="15" font-weight="700" letter-spacing="1.5" fill="${t.muted}">${esc(it.label.toUpperCase())}</text>`);
    out.push(avatar(it.pid, c, x + 80, y + 46, 28));
    out.push(`<text x="${x + 118}" y="${y + 68}" font-size="22" font-weight="700" fill="${t.ink}">${esc(clip(name(it.pid), 16))}</text>`);
    out.push(`<text x="${x + CARD_W - 20}" y="${y + (it.sub ? 46 : 56)}" font-size="24" font-weight="800" text-anchor="end" fill="${c}">${esc(it.value)}</text>`);
    if (it.sub) out.push(`<text x="${x + CARD_W - 20}" y="${y + 70}" font-size="15" text-anchor="end" fill="${t.muted}">${esc(clip(String(it.sub), 22))}</text>`);
  });

  out.push(`<text x="${PAD}" y="${standTop + 26}" font-size="15" font-weight="700" letter-spacing="1.5" fill="${t.muted}">FINAL STANDINGS</text>`);
  const half = Math.ceil(standings.length / 2); // column-major, so the list reads top to bottom then continues on the right
  standings.forEach((p, i) => {
    const col = i < half ? 0 : 1;
    const x = PAD + col * (CARD_W + GAP);
    const y = standTop + 46 + (i - col * half) * ROW_H;
    const net = Math.round(p.net);
    out.push(`<text x="${x + 22}" y="${y + 29}" font-size="20" font-weight="700" text-anchor="end" fill="${t.muted}">${i + 1}</text>`);
    out.push(avatar(p.player_id, color(p.player_id), x + 36, y + 6, 30));
    out.push(`<text x="${x + 78}" y="${y + 29}" font-size="22" font-weight="600" fill="${t.ink}">${esc(clip(p.name, 22))}</text>`);
    out.push(`<text x="${x + CARD_W - 20}" y="${y + 29}" font-size="22" font-weight="800" text-anchor="end" fill="${net > 0 ? t.pos : net < 0 ? t.neg : t.muted}">${signed(net)}</text>`);
  });

  out.push(`<text x="${W / 2}" y="${H - 30}" font-size="18" text-anchor="middle" fill="${t.muted}">Made with ${SITE_URL}</text>`);
  out.push("</svg>");
  return { svg: out.join(""), width: W, height: H };
}

// Rasterize at 2x and hand it to the OS share sheet (phones), falling back to a download (desktop). Always the dark
// palette: player colors like sunflower are tuned for dark backgrounds and the image should look the same for everyone.
export async function shareAwards(args) {
  const { svg, width, height } = awardsSvg(args);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = () => fail(new Error("could not draw the image")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    const file = new File([blob], "poker-awards.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Awards of the night" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // user closed the share sheet
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
