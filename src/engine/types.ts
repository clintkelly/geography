import type { CreatureType } from '../content/types';

/** Each type beats the next one, and the last beats the first. */
export const TYPE_LOOP: readonly CreatureType[] = ['tide', 'flame', 'leaf', 'stone', 'gale', 'frost'];

export const STRONG_BONUS = 1;

export const TYPE_INFO: Record<CreatureType, { name: string; why: string }> = {
  tide: { name: 'Tide', why: 'Water puts out Flame.' },
  flame: { name: 'Flame', why: 'Fire burns Leaf.' },
  leaf: { name: 'Leaf', why: 'Roots crack Stone.' },
  stone: { name: 'Stone', why: 'Rock stands firm against Gale.' },
  gale: { name: 'Gale', why: 'Warm wind melts Frost.' },
  frost: { name: 'Frost', why: 'Ice freezes Tide.' },
};

export const beats = (type: CreatureType) => TYPE_LOOP[(TYPE_LOOP.indexOf(type) + 1) % TYPE_LOOP.length] as CreatureType;
export const losesTo = (type: CreatureType) => TYPE_LOOP[(TYPE_LOOP.indexOf(type) + TYPE_LOOP.length - 1) % TYPE_LOOP.length] as CreatureType;

/** 1 if `mine` beats `theirs`, -1 if it loses to it, otherwise 0. */
export function typeEdge(mine: CreatureType, theirs: CreatureType): number {
  if (beats(mine) === theirs) return STRONG_BONUS;
  return beats(theirs) === mine ? -STRONG_BONUS : 0;
}
