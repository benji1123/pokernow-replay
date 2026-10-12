// Renders every avatar sprite to a PNG contact sheet for eyeballing. Usage (from frontend/):
//   node scripts/sprite-sheet.mjs <out.png> [scale]
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { SPRITE_NAMES, SPRITE_SIZE, spriteRows } from "../src/sprites.js";

const out = process.argv[2];
const scale = Number(process.argv[3] ?? 8);
if (!out) throw new Error("usage: node scripts/sprite-sheet.mjs <out.png> [scale]");

const COLORS = ["#4c6ef5", "#e8590c", "#12b886", "#be4bdb", "#f59f00", "#e64980", "#1098ad", "#7950f2"];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const FILL = { w: hex("#f4f1ea"), o: hex("#1b1b1f"), r: hex("#e5484d"), y: hex("#f5b800") };
const BG = hex("#fbfaf6");
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const cols = 4, pad = 1;
const cell = SPRITE_SIZE + pad * 2;
const W = cols * cell * scale, H = Math.ceil(SPRITE_NAMES.length / cols) * cell * scale;
const px = new Uint8Array(W * H * 3);
const put = (x, y, rgb) => { const i = (y * W + x) * 3; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, BG);

SPRITE_NAMES.forEach((name, n) => {
  const color = hex(COLORS[n % COLORS.length]);
  const ox = (n % cols) * cell + pad, oy = Math.floor(n / cols) * cell + pad;
  spriteRows(name).forEach((row, y) => {
    [...row].forEach((ch, x) => {
      let rgb = mix(BG, color, 0.13); // the faint tinted square behind every avatar
      if (ch === "#") rgb = color;
      else if (ch === "+") rgb = mix(BG, color, 0.55);
      else if (ch in FILL) rgb = FILL[ch];
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put((ox + x) * scale + dx, (oy + y) * scale + dy, rgb);
    });
  });
});

// Minimal PNG writer (RGB, no filter).
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.subarray(y * W * 3, (y + 1) * W * 3).forEach((v, i) => { raw[y * (W * 3 + 1) + 1 + i] = v; }); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`${out}: ${SPRITE_NAMES.length} sprites, ${W}x${H}`);
