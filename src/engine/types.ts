import type { CreatureType } from '../content/types';

/** Each type beats the next one, and the last beats the first. */
export const TYPE_LOOP: readonly CreatureType[] = ['tide', 'flame', 'leaf', 'gale', 'frost', 'stone', 'volt'];

export const STRONG_BONUS = 1;

export const TYPE_INFO: Record<CreatureType, { name: string; why: string }> = {
  tide: { name: 'Tide', why: 'Water puts out Flame.' },
  flame: { name: 'Flame', why: 'Fire burns Leaf.' },
  leaf: { name: 'Leaf', why: 'Rows of trees break the Gale.' },
  gale: { name: 'Gale', why: 'Warm wind melts Frost.' },
  frost: { name: 'Frost', why: 'Ice freezes in cracks and splits Stone.' },
  stone: { name: 'Stone', why: 'The ground soaks up Volt, like a lightning rod.' },
  volt: { name: 'Volt', why: 'Electricity zaps through Tide.' },
};

export const beats = (type: CreatureType) => TYPE_LOOP[(TYPE_LOOP.indexOf(type) + 1) % TYPE_LOOP.length] as CreatureType;
export const losesTo = (type: CreatureType) => TYPE_LOOP[(TYPE_LOOP.indexOf(type) + TYPE_LOOP.length - 1) % TYPE_LOOP.length] as CreatureType;

/** 1 if `mine` beats `theirs`, -1 if it loses to it, otherwise 0. */
export function typeEdge(mine: CreatureType, theirs: CreatureType): number {
  if (beats(mine) === theirs) return STRONG_BONUS;
  return beats(theirs) === mine ? -STRONG_BONUS : 0;
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
