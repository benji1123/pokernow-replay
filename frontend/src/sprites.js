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
  // Bulldog with jowls and a studded collar.
  bulldog: [
    "................",
    "..##........##..",
    ".#+##......##+#.",
    ".##############.",
    ".##############.",
    ".##oo######oo##.",
    ".###wo####ow###.",
    ".##############.",
    ".##++++++++++##.",
    ".#+++++oo+++++#.",
    ".#++++++++++++#.",
    ".#++o++++++o++#.",
    "..+++oooooo+++..",
    "..rrrwrrwrrwrr..",
    "....########....",
    "................",
  ],
  // Pirate cat with an eyepatch.
  cat: [
    "................",
    "..#.........#...",
    "..##.......##...",
    "..#+#.....#+#...",
    "..############..",
    "..############..",
    ".###########oo#.",
    ".##wo####oooo##.",
    ".##oo####oooo##.",
    ".##############.",
    "..#####r######..",
    "..###++++++###..",
    "...##o+++o###...",
    "....#+ooo+##....",
    ".....######.....",
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
  // Alien with big black eyes.
  alien: [
    "................",
    "......####......",
    "....########....",
    "...##########...",
    "..############..",
    "..############..",
    ".###oo####oo###.",
    ".##oooo##oooo##.",
    ".##oooo##oooo##.",
    ".###oo####oo###.",
    "..############..",
    "..############..",
    "...###oooo###...",
    "....########....",
    "......####......",
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
  // Penguin dealer in a bowtie.
  penguin: [
    "................",
    ".....######.....",
    "....########....",
    "...##########...",
    "...##wo##wo###..",
    "...##########...",
    "...###yyyy####..",
    "...##########...",
    "..###wwwwww###..",
    "..##wwrrwrrwww#.",
    "..##wwwrrrwwww#.",
    "..##wwwwwwwwww#.",
    "..###wwwwwwww##.",
    "...##########...",
    "..yy........yy..",
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
  // Pig in a top hat.
  pig: [
    "....oooooooo....",
    "....oooooooo....",
    "....oooooooo....",
    "..oooooooooooo..",
    "..############..",
    ".##############.",
    ".##wo######wo##.",
    ".##############.",
    ".###++++++++###.",
    ".###+oo++oo+###.",
    ".###++++++++###.",
    ".##############.",
    "..####oooo####..",
    "...##########...",
    "................",
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
  // Grumpy bear.
  bear: [
    "................",
    "..###......###..",
    ".##+##....##+##.",
    ".##############.",
    "..############..",
    ".##############.",
    ".##oo######oo##.",
    ".###oo####oo###.",
    ".##############.",
    ".#####++++++###.",
    ".####++oo+++###.",
    ".####++++++++##.",
    "..###+oooo++##..",
    "...##########...",
    "....##....##....",
    "................",
  ],
  // Lion with a spiky mane.
  lion: [
    "................",
    "...#..####..#...",
    "..############..",
    ".###++++++++###.",
    ".##++++++++++##.",
    "###++++++++++###",
    "###+wo++++wo+###",
    "###++++++++++###",
    "###+++oooo+++###",
    ".##++o++++o++##.",
    ".##+++oooo+++##.",
    ".###++++++++###.",
    "..############..",
    "...#..####..#...",
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
  // Bandit raccoon in a mask.
  raccoon: [
    "................",
    "...##......##...",
    "..#+#......#+#..",
    "..############..",
    "..############..",
    ".##############.",
    ".#oooooooooooo#.",
    ".#oowooooowooo#.",
    ".#oowooooowooo#.",
    ".##############.",
    "..###++++++###..",
    "..##++++o+++##..",
    "...+++oooo+++...",
    "....++++++++....",
    "................",
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
