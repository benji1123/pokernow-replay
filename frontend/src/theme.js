// Player colors: one hue ramp, assigned in player order so a player keeps their color across views.
export const PALETTE = [
  { name: "coral", main: "#ff6b6b" },
  { name: "tangerine", main: "#ff922b" },
  { name: "sunflower", main: "#f5b800" },
  { name: "lime", main: "#74b816" },
  { name: "mint", main: "#12b886" },
  { name: "sky", main: "#15aabf" },
  { name: "blue", main: "#4c6ef5" },
  { name: "violet", main: "#7950f2" },
  { name: "pink", main: "#e64980" },
  { name: "grape", main: "#be4bdb" },
];

export function assignColors(players) {
  const map = {};
  players.forEach((p, i) => (map[p.player_id] = PALETTE[i % PALETTE.length]));
  return map;
}

export function soft(hex, alpha = "22") {
  return `${hex}${alpha}`;
}

// Small deterministic hash so avatars are "random" but stable for a player id.
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
