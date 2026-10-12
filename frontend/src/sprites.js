// 16x16 poker-themed pixel sprites, each with a face and a prop so they read as characters.
// Legend: '.' transparent, '#' player color, '+' player color tinted, 'w' off-white, 'o' ink, 'r' red, 'y' gold.
// The player's id hash picks the sprite; the colour comes from the palette.
const SHEET = {
  // Shark in sunglasses, toothy grin.
  shark: [
    "................",
    "..........#.....",
    ".........##.....",
    ".........###....",
    "........####....",
    "...############.",
    "..#############.",
    ".##ooooo#######.",
    "###oooooo#####.#",
    "###############.",
    "#ooooooooooo..##",
    "#wowowowowo..###",
    ".wwwwwwwwww..#..",
    "..########......",
    "................",
    "................",
  ],
  // Whale, eyes closed and content, spouting.
  whale: [
    "....w..w........",
    ".....ww.........",
    ".....#..........",
    "...##########...",
    ".##############.",
    "###############.",
    "##o.o##########.",
    "###############.",
    "###oooo#######.#",
    "###############.",
    "#wwwwwwwwwww.###",
    "#wwwwwwwwww..##.",
    ".wwwwwwwww.##...",
    "..#######.......",
    "................",
    "................",
  ],
  // Fish with a big eye, pouty lips and bubbles.
  fish: [
    "..........w.....",
    ".........w......",
    "................",
    "....#####.......",
    "...#######...#..",
    "..####wo###..##.",
    ".###+#oo####.###",
    "r####++#########",
    "r####+##########",
    ".####+######.###",
    "..#########..##.",
    "...#######...#..",
    "....#####.......",
    "................",
    "................",
    "................",
  ],
  // Donkey with a goofy toothy grin.
  donkey: [
    "...##......##...",
    "...#+#....#+#...",
    "...#+#....#+#...",
    "...###....###...",
    "...##########...",
    "..############..",
    "..##wo####wo##..",
    "..##oo####oo##..",
    "..############..",
    "...##########...",
    "...+++++++++#...",
    "..+++o++++o+++..",
    "..++wwwwwwww++..",
    "..++w+w+w+w+++..",
    "...++++++++++...",
    "................",
  ],
  // Pet rock: googly eyes, flat mouth, a tuft of moss.
  rock: [
    "................",
    "................",
    "......++........",
    ".....+++#.......",
    "....##########..",
    "..############..",
    ".##wwww##wwww##.",
    ".##woow##woow##.",
    "###wwww##wwww###",
    "################",
    "################",
    ".######oooo####.",
    ".##############.",
    "..############..",
    "................",
    "................",
  ],
  // Cowboy: hat, mustache, cigar.
  cowboy: [
    "......####......",
    "......####......",
    "......####......",
    "..############..",
    "################",
    "....++++++++....",
    "....+o++++o+....",
    "....++++++++....",
    "....++++++++....",
    "....+oooooo+....",
    "....++oooo++....",
    ".....++++++.....",
    "......++ooooor..",
    "......####......",
    ".....######.....",
    "................",
  ],
  // Poker chip with a smirk.
  chip: [
    "................",
    ".....wwwwww.....",
    "...ww######ww...",
    "..w##########w..",
    ".w####++++####w.",
    ".w###++++++###w.",
    "w###+o++++o+###w",
    "w###++++++++###w",
    "w###++++++++###w",
    "w###+++++o++###w",
    ".w###+oooo+###w.",
    ".w####++++####w.",
    "..w##########w..",
    "...ww######ww...",
    ".....wwwwww.....",
    "................",
  ],
  // Ace of spades with a face.
  cards: [
    "................",
    "...wwwwwwwwww...",
    "...w#wwwwwwww...",
    "...w#wwwwwwww...",
    "...wwwww#wwww...",
    "...wwww###www...",
    "...www#####ww...",
    "...ww#######w...",
    "...ww#o###o#w...",
    "...ww#######w...",
    "...www##o##ww...",
    "...wwwww#wwww...",
    "...wwww###w#w...",
    "...wwwwwwww#w...",
    "...wwwwwwwwww...",
    "................",
  ],
  // Die with an angry face: pips for eyes, furrowed brows, a frown.
  dice: [
    "................",
    "..wwwwwwwwwwww..",
    ".wwwwwwwwwwwwww.",
    ".ww#wwwwwwww#ww.",
    ".wwwwwwwwwwwwww.",
    ".ww##wwwwww##ww.",
    ".ww#oowwww#oo#w.",
    ".ww#oowwwwoo##w.",
    ".wwwwwwwwwwwwww.",
    ".wwwwwwwwwwwwww.",
    ".wwwwoooooowwww.",
    ".wwwoowwwwoowww.",
    ".ww#wwwwwwww#ww.",
    ".wwwwwwwwwwwwww.",
    "..wwwwwwwwwwww..",
    "................",
  ],
  // King: crown, beard, raised eyebrow.
  crown: [
    "..y....yy....y..",
    "..yy..yyyy..yy..",
    "..yyyyyyyyyyyy..",
    "..yyyyryyryyyy..",
    "..yyyyyyyyyyyy..",
    "...++++++++++...",
    "...+oo++++++o+..",
    "...+o+++++++++..",
    "...++++++++++...",
    "...++++oo+++++..",
    "..############..",
    "..###++++++###..",
    "..############..",
    "...##########...",
    "....########....",
    "................",
  ],
  // Owl with huge eyes, one eyebrow up, a monocle.
  owl: [
    "................",
    "...#........#...",
    "...##......##...",
    "...##########...",
    "..############..",
    ".###wwww#wwww##.",
    ".##wwwww#wwwww#.",
    ".##wwoow#wwoow#.",
    ".##wwoow#wwoow#.",
    ".###wwww#wwww##.",
    ".######+######..",
    ".#####+++#####..",
    "..##+######++#..",
    "...##########...",
    "....#.####.#....",
    "................",
  ],
  // Fox with half-closed sly eyes and a smirk.
  fox: [
    "................",
    "..#..........#..",
    "..##........##..",
    "..#+#......#+#..",
    "..############..",
    "..############..",
    ".##oo######oo##.",
    ".###o######o###.",
    ".##############.",
    ".##############.",
    "..##wwwwwwww##..",
    "...wwwwowwwww...",
    "....wwwwwwww....",
    ".....wwooww.....",
    "......wwww......",
    "................",
  ],
  // Rubber duck in sunglasses.
  duck: [
    "................",
    ".....######.....",
    "....########....",
    "...##########...",
    "...oooooooooo...",
    "...oooooooooooy.",
    "...########yyyy.",
    "....######.yyyy.",
    "....######......",
    ".############...",
    "##############..",
    "###############.",
    "###############.",
    ".##############.",
    "..############..",
    "................",
  ],
  // Turtle poking its head out, half asleep.
  turtle: [
    "................",
    "................",
    "....#########...",
    "...###########..",
    "..##+##+##+####.",
    "..#+##+##+##+##.",
    "..##+##+##+####.",
    "..#+##+##+##+##.",
    "..##########.###",
    "...#########.#oo",
    "....##..##...###",
    "....##..##....#.",
    "................",
    "................",
    "................",
    "................",
  ],
  // Robot with antenna, LED eyes and a grill.
  robot: [
    ".......r........",
    ".......#........",
    "...##########...",
    "..############..",
    "..#++++++++++#..",
    "..#+oo++++oo+#..",
    "..#+oo++++oo+#..",
    "..#++++++++++#..",
    "..#+#o#o#o#o+#..",
    "..#++++++++++#..",
    "..############..",
    "...####..####...",
    "..############..",
    "..##.######.##..",
    "..##..####..##..",
    "................",
  ],
  // Ghost sticking its tongue out.
  ghost: [
    "................",
    ".....######.....",
    "...##########...",
    "..############..",
    "..############..",
    ".###oo####oo###.",
    ".###oo####oo###.",
    ".##############.",
    ".##############.",
    ".######oooo####.",
    ".#######rr#####.",
    ".#######rr#####.",
    ".##############.",
    ".##############.",
    ".#.###.##.###.#.",
    "................",
  ],
};

export const SPRITE_NAMES = Object.keys(SHEET);
export const SPRITE_SIZE = 16;

for (const [name, rows] of Object.entries(SHEET)) {
  if (rows.length !== SPRITE_SIZE || rows.some((r) => r.length !== SPRITE_SIZE)) throw new Error(`sprite ${name} is not ${SPRITE_SIZE}x${SPRITE_SIZE}`);
}

export function spriteRows(name) {
  return SHEET[name];
}

// Horizontal runs of the same legend character, so each sprite is a few dozen rects instead of 256.
export function spriteRuns(name) {
  const rows = SHEET[name];
  const runs = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== ".") runs.push({ x, y, w: end - x, ch });
      x = end;
    }
  });
  return runs;
}

export function spriteFor(hash) {
  return SPRITE_NAMES[hash % SPRITE_NAMES.length];
}
