import type { Difficulty, Pack, Species } from '../content/types';

const BASE_CHANCE = 0.02;
const MAX_CHANCE = 0.25;
const DIFFICULTY_SCORE: Record<Difficulty, number> = { scout: 0, ranger: 10, expert: 20 };
const MIN_ANSWERS = 3;

interface TrailStats {
  answered: number;
  correct: number;
  streak?: number;
  difficulty: Difficulty;
}

/** How well this trip is going, 0 to 100. Accuracy counts most, then the current streak, then difficulty. */
export function trailScore(e: TrailStats): number {
  const accuracy = e.answered >= MIN_ANSWERS ? (e.correct / e.answered) * 50 : 0;
  const streak = Math.min(e.streak ?? 0, 10) * 3;
  return Math.round(Math.min(100, accuracy + streak + DIFFICULTY_SCORE[e.difficulty]));
}

/** The chance the next battle is a rare encounter. */
export const rareChance = (score: number) => BASE_CHANCE + (score / 100) * (MAX_CHANCE - BASE_CHANCE);

/** The rares a lucky battle can bring: the region's rares the child doesn't have yet, or else all of them, so a rare can be befriended again. */
export function rarePool(pack: Pack, regionId: string, owned: readonly string[]): Species[] {
  const rares = pack.species.filter((s) => s.rare && s.homes.includes(regionId));
  const fresh = rares.filter((s) => !owned.includes(s.id));
  return fresh.length > 0 ? fresh : rares;
}
