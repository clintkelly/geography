import type { CreatureType } from '../content/types';

/** The first seven types form a loop: each beats the next one, and the last beats the first. */
export const TYPE_LOOP: readonly CreatureType[] = ['tide', 'flame', 'leaf', 'gale', 'frost', 'stone', 'volt'];

/** Light and Spirit form a small triangle with Stone: Light beats Spirit, Spirit beats Stone, Stone beats Light. */
export const TYPE_TRIANGLE: readonly CreatureType[] = ['light', 'spirit', 'stone'];

/** Every type, in the order the guide and stable list them. */
export const ALL_TYPES: readonly CreatureType[] = [...TYPE_LOOP, 'light', 'spirit'];

export const STRONG_BONUS = 1;

export const TYPE_INFO: Record<CreatureType, { name: string }> = {
  tide: { name: 'Tide' },
  flame: { name: 'Flame' },
  leaf: { name: 'Leaf' },
  gale: { name: 'Gale' },
  frost: { name: 'Frost' },
  stone: { name: 'Stone' },
  volt: { name: 'Volt' },
  light: { name: 'Light' },
  spirit: { name: 'Spirit' },
};

const after = (ring: readonly CreatureType[], t: CreatureType) => ring[(ring.indexOf(t) + 1) % ring.length] as CreatureType;
const before = (ring: readonly CreatureType[], t: CreatureType) => ring[(ring.indexOf(t) + ring.length - 1) % ring.length] as CreatureType;
const rings = (t: CreatureType) => [TYPE_LOOP, TYPE_TRIANGLE].filter((r) => r.includes(t));

/** The types this one is strong against. Stone, in both the loop and the triangle, beats two. */
export const beatsAll = (type: CreatureType): CreatureType[] => rings(type).map((r) => after(r, type));
/** The types this one is weak against. */
export const losesToAll = (type: CreatureType): CreatureType[] => rings(type).map((r) => before(r, type));

/** Why one type beats another, in words a child can picture. */
export const WHY: Record<string, string> = {
  'tide>flame': 'Water puts out Flame.',
  'flame>leaf': 'Fire burns Leaf.',
  'leaf>gale': 'Rows of trees break the Gale.',
  'gale>frost': 'Warm wind melts Frost.',
  'frost>stone': 'Ice freezes in cracks and splits Stone.',
  'stone>volt': 'The ground soaks up Volt, like a lightning rod.',
  'volt>tide': 'Electricity zaps through Tide.',
  'light>spirit': 'Light chases away the shadows Spirits hide in.',
  'spirit>stone': 'Spirits float right through Stone walls.',
  'stone>light': 'Stone blocks Light and makes shade.',
};
export const why = (a: CreatureType, b: CreatureType) => WHY[`${a}>${b}`] ?? '';

/** 1 if `mine` beats `theirs`, -1 if it loses to it, otherwise 0. */
export function typeEdge(mine: CreatureType, theirs: CreatureType): number {
  if (beatsAll(mine).includes(theirs)) return STRONG_BONUS;
  return beatsAll(theirs).includes(mine) ? -STRONG_BONUS : 0;
}

/** A creature's types: one, or two for a dual-type creature. */
export const typesOf = (s: { type: CreatureType; secondType?: CreatureType }): CreatureType[] => (s.secondType ? [s.type, s.secondType] : [s.type]);

export interface Matchup {
  /** 1, 0 or -1. */
  edge: number;
  /** The attacker's type that counts: a dual-type creature uses whichever works best. */
  mine: CreatureType;
  /** The defender's type that decided it, for explaining a strong or weak matchup. */
  theirs: CreatureType;
}

/**
 * How one creature's attacks land on another. Against a dual-type defender the two
 * matchups add up, so strong against one type and weak against the other is even.
 */
export function matchup(attacker: { type: CreatureType; secondType?: CreatureType }, defender: { type: CreatureType; secondType?: CreatureType }): Matchup {
  const theirs = typesOf(defender);
  const options = typesOf(attacker).map((mine) => {
    const sum = theirs.reduce((n, t) => n + typeEdge(mine, t), 0);
    const edge = Math.max(-STRONG_BONUS, Math.min(STRONG_BONUS, sum));
    const decider = theirs.find((t) => typeEdge(mine, t) === Math.sign(edge)) ?? (theirs[0] as CreatureType);
    return { edge, mine, theirs: decider };
  });
  return options.reduce((best, o) => (o.edge > best.edge ? o : best));
}
