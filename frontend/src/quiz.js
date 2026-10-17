// Read-the-player flashcards: questions generated from the session's own stats, so studying means memorizing
// how *these* opponents actually play. Pure functions; the Study tab owns the state.

const MIN_HANDS = 20;

export function rng(seed) {
  // mulberry32: small, deterministic, good enough for shuffling
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rand) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pct = (v) => `${Math.round(v * 100)}%`;

// Each source: where the stat lives, the smallest denominator worth asking about, the band considered ordinary
// (same as the table tints), and what a high or low value should change about how you play against them.
// `biased` marks stats computed from shown cards only; players with complete cards (uploaded exports) are left out of
// "who at the table" comparisons for those.
export const SOURCES = [
  {
    id: "vpip", min: 20, band: [0.22, 0.35],
    get: (p) => p.vpip,
    ask: (n) => `How often does ${n} voluntarily put chips in preflop (VPIP)?`,
    who: ["Who plays the most hands?", "Who plays the fewest hands?"],
    high: "Loose. Their range is wide, so value-bet thinner and bluff them less; they rarely have a hand strong enough to fold.",
    low: "Tight. When they enter, they have it: respect their raises and attack their blinds.",
  },
  {
    id: "pfr", min: 20, band: [0.15, 0.25],
    get: (p) => p.pfr,
    ask: (n) => `How often does ${n} raise preflop (PFR)?`,
    who: ["Who raises preflop most often?", "Who raises preflop least often?"],
    high: "Raises a lot. Their opens are wide: 3-bet them lighter and call with hands that play well against a wide range.",
    low: "Rarely raises. A raise from them is a narrow, strong range; fold hands you'd normally defend.",
  },
  {
    id: "three_bet", min: 10, band: [0.05, 0.1],
    get: (p) => p.three_bet,
    ask: (n) => `When ${n} faces a raise, how often do they re-raise (3-bet)?`,
    who: ["Who 3-bets most often?"],
    high: "Aggressive 3-bettor. Their 3-bets include bluffs: 4-bet or call with more, don't fold medium strength.",
    low: "Almost never 3-bets. When they do, it's the top of their range; fold all but premiums.",
  },
  {
    id: "fold_to_pfr", min: 10, band: [0.55, 0.7],
    get: (p) => p.fold_to_pfr,
    ask: (n) => `When ${n} faces a preflop raise, how often do they fold?`,
    who: ["Who folds to a preflop raise most often?", "Who folds to a preflop raise least often?"],
    high: "Folds a lot to raises. Open wider when they're behind you, especially from the button.",
    low: "Calls raises with almost anything. Open bigger with value and skip light opens into them.",
  },
  {
    id: "fold_to_cbet", min: 8, band: [0.4, 0.6],
    get: (p) => p.profile?.lines?.fold_to_cbet,
    ask: (n) => `When ${n} calls preflop and faces a flop bet, how often do they fold?`,
    who: ["Who folds to a flop c-bet most often?", "Who folds to a flop c-bet least often?"],
    high: "Folds to c-bets. Bet every flop against them, small, with anything.",
    low: "Sticky on the flop. C-bet for value only; bluffs need a turn and river plan, not one bet.",
  },
  {
    id: "cbet", min: 8, band: [0.5, 0.75],
    get: (p) => p.profile?.lines?.cbet,
    ask: (n) => `When ${n} raised preflop and sees a flop, how often do they bet it (c-bet)?`,
    who: ["Who c-bets the flop most often?"],
    high: "C-bets nearly always. Their flop bet means little: float and raise more, fold less.",
    low: "Only c-bets with a hand. A flop bet from them is real; a check often means weakness you can attack.",
  },
  {
    id: "wtsd", min: 10, band: [0.22, 0.32],
    get: (p) => p.wtsd,
    ask: (n) => `When ${n} sees a flop, how often do they reach showdown?`,
    who: ["Who goes to showdown most often?", "Who goes to showdown least often?"],
    high: "Goes to showdown a lot. Don't bluff them; bet your medium hands for value on every street.",
    low: "Gives up before showdown. Barrel turns and rivers; they fold their way out of pots.",
  },
  {
    id: "wsd", min: 8, band: [0.45, 0.55],
    get: (p) => p.wsd,
    ask: (n) => `When ${n} reaches showdown, how often do they win it?`,
    who: ["Who wins the most at showdown?", "Who wins the least at showdown?"],
    high: "Wins at showdown. They get there with the goods; fold marginal hands when they keep betting.",
    low: "Loses at showdown. They call down too light: value-bet thin, never bluff.",
  },
  {
    id: "river_fold", min: 6, band: [0.4, 0.6],
    get: (p) => p.profile?.lines?.river_fold,
    ask: (n) => `When ${n} faces a river bet, how often do they fold?`,
    who: ["Who folds to river bets most often?", "Who folds to river bets least often?"],
    high: "Folds rivers. The river bluff works against them; bet when the board is scary.",
    low: "Calls rivers. Bet the river only with a hand that beats their calls.",
  },
  {
    id: "takedown", min: 10, band: [0.4, 0.6],
    get: (p) => p.takedown,
    ask: (n) => `When ${n} bets or raises after the flop, how often does everyone fold right there?`,
    who: ["Whose postflop bets take the pot down most often?"],
    high: "Their bets get folds. Call them down more; they're being paid for aggression.",
    low: "Their bets get called. They either bet too thin or get little respect; raise their bets with your strong hands.",
  },
  {
    id: "bluffs_shown", min: 5, band: [0.2, 0.4], biased: true,
    get: (p) => p.bluffs_shown,
    ask: (n) => `Of ${n}'s postflop bets where the cards were later seen, what share were bluffs (air or a draw)?`,
    who: ["Whose shown postflop bets were bluffs most often?"],
    high: "Bluffs a lot. Call down with any pair; raise their bets on scary boards.",
    low: "Bets with the goods. Fold more to their bets, especially big river bets.",
  },
  {
    id: "limp", min: 10, band: [0.1, 0.3],
    get: (p) => p.profile?.preflop?.limp,
    ask: (n) => `When the pot is unopened in front of ${n}, how often do they limp in?`,
    who: ["Who limps the most?"],
    high: "Habitual limper. Raise their limps with a wide range; they call and then fold flops.",
    low: "Rarely limps. When they do, it's often a trap or a small pair; don't auto-raise.",
  },
  {
    id: "steal", min: 8, band: [0.25, 0.45],
    get: (p) => p.profile?.preflop?.steal,
    ask: (n) => `When it folds to ${n} in late position, how often do they raise (steal)?`,
    who: ["Who steals the blinds most often?"],
    high: "Steals a lot. Defend your blinds wider against them and 3-bet their late opens.",
    low: "Doesn't steal. Their late-position raise is a real hand; fold your blinds.",
  },
];

export function eligible(players) {
  return players.filter((p) => p.hands >= MIN_HANDS);
}

const stat = (src, p) => {
  const s = src.get(p);
  return s && s.value != null && s.d >= src.min ? s : null;
};

function tip(src, value) {
  if (value > src.band[1]) return src.high;
  if (value < src.band[0]) return src.low;
  return `Ordinary for this stat (${pct(src.band[0])}-${pct(src.band[1])}); nothing to exploit here.`;
}

// 3 wrong percentages around the right one, 12 points apart, clamped to 0-100, so guessing the band isn't enough.
function rateOptions(value, rand) {
  const v = Math.round(value * 100);
  const pool = [-36, -24, -12, 12, 24, 36].map((d) => v + d).filter((x) => x >= 0 && x <= 100 && x !== v);
  const wrong = shuffle(pool, rand).slice(0, 3);
  return [v, ...wrong].sort((a, b) => a - b).map((x) => ({ label: `${x}%`, correct: x === v }));
}

export function buildQuestions(players, rand = Math.random) {
  const pool = eligible(players);
  const out = [];
  for (const src of SOURCES) {
    const withStat = pool.map((p) => ({ p, s: stat(src, p) })).filter((x) => x.s);
    for (const { p, s } of withStat) {
      out.push({
        kind: "rate", source: src.id, player: p,
        text: src.ask(p.name),
        options: rateOptions(s.value, rand),
        answer: `${pct(s.value)} (${s.n} of ${s.d})`,
        tip: tip(src, s.value),
      });
    }
    const comparable = src.biased ? withStat.filter((x) => !x.p.complete) : withStat;
    if (comparable.length >= 3) {
      src.who.forEach((text, i) => {
        const sorted = [...comparable].sort((a, b) => (i === 0 ? b.s.value - a.s.value : a.s.value - b.s.value));
        const [top, second] = sorted;
        if (second && Math.abs(top.s.value - second.s.value) < 0.03) return; // too close to be a fair question
        const choices = shuffle(sorted.slice(0, 4), rand);
        out.push({
          kind: "who", source: src.id, player: top.p,
          text,
          options: choices.map((x) => ({ label: x.p.name, player: x.p, correct: x === top })),
          answer: `${top.p.name}: ${pct(top.s.value)} (${top.s.n} of ${top.s.d})`,
          detail: sorted.slice(0, 4).map((x) => `${x.p.name} ${pct(x.s.value)}`).join(" · "),
          tip: tip(src, top.s.value),
        });
      });
    }
  }
  // Money flow: who took the most from whom.
  for (const p of pool) {
    if (!p.nemesis || pool.length < 4) continue;
    const others = pool.filter((o) => o.player_id !== p.player_id);
    const nem = others.find((o) => o.player_id === p.nemesis.player_id);
    if (!nem) continue;
    const choices = shuffle([nem, ...shuffle(others.filter((o) => o !== nem), rand).slice(0, 3)], rand);
    out.push({
      kind: "who", source: "nemesis", player: p,
      text: `Who took the most money from ${p.name}?`,
      options: choices.map((o) => ({ label: o.name, player: o, correct: o === nem })),
      answer: `${nem.name}, ${p.nemesis.amount} over the session`,
      tip: `Watch how ${p.name} plays against ${nem.name}: the hands between them are where ${p.name} is losing.`,
    });
  }
  return out;
}

// A round: `size` questions, no two in a row about the same player when avoidable.
export function makeRound(players, seed, size = 10) {
  const rand = rng(seed);
  const all = shuffle(buildQuestions(players, rand), rand);
  const round = [];
  while (round.length < size && all.length) {
    const prev = round.at(-1);
    let i = all.findIndex((q) => !prev || q.player.player_id !== prev.player.player_id);
    if (i < 0) i = 0;
    round.push(all.splice(i, 1)[0]);
  }
  return round;
}
