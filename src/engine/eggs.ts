import type { Difficulty, Pack, Question } from '../content/types';
import type { Rng } from './rng';
import { subjectOf, type Subject } from './study';

/** Study eggs hatch only from math or vocabulary answers. A rare egg takes either. */
export type EggKind = Subject | 'rare';

export interface Egg {
  id: string;
  kind: EggKind;
  progress: number;
}

/** Points to hatch an egg. */
export const EGG_NEED: Record<EggKind, number> = { math: 15, words: 15, science: 15, rare: 24 };
/** Right answers that fill the Egg Meter and lay an egg on the spot, wherever they're answered. */
export const EGG_METER = 8;
/** Every few eggs from the meter is a Rare Egg. */
export const RARE_EVERY = 4;
export interface EggMeter { math: number; words: number; science?: number; laid: number }

/**
 * A right study answer fills its subject's Egg Meter. A full meter lays an egg, a Rare one every few eggs,
 * and starts again. With a full nest, the meter waits, full, until an egg hatches.
 */
export function fillMeter(meter: EggMeter | undefined, eggs: readonly Egg[], subject: Subject, id: string): { meter: EggMeter; eggs: Egg[]; laid?: EggKind } {
  const m = meter ?? { math: 0, words: 0, laid: 0 };
  const filled = Math.min(EGG_METER, (m[subject] ?? 0) + 1);
  if (filled < EGG_METER || eggs.length >= MAX_EGGS) return { meter: { ...m, [subject]: filled }, eggs: [...eggs] };
  const kind: EggKind = (m.laid + 1) % RARE_EVERY === 0 ? 'rare' : subject;
  return { meter: { ...m, [subject]: 0, laid: m.laid + 1 }, eggs: layEgg(eggs, kind, id), laid: kind };
}

/** Harder answers warm an egg faster, so harder questions are worth more. */
export const EGG_POINTS: Record<Difficulty, number> = { scout: 1, ranger: 2, expert: 3 };
/** Eggs waiting to hatch. A full nest lays no more until one hatches. */
export const MAX_EGGS = 3;
/** The chance a hatchling is shiny. Rare eggs are where shinies come from. */
export const EGG_SHINY: Record<EggKind, number> = { math: 0.15, words: 0.15, science: 0.15, rare: 0.5 };

export const eggReady = (egg: Egg) => egg.progress >= EGG_NEED[egg.kind];
export const eggName: Record<EggKind, string> = { math: 'Math Egg', words: 'Word Egg', science: 'Science Egg', rare: 'Rare Egg' };

/** Adds an egg if the nest has room. */
export function layEgg(eggs: readonly Egg[], kind: EggKind, id: string): Egg[] {
  return eggs.length >= MAX_EGGS ? [...eggs] : [...eggs, { id, kind, progress: 0 }];
}

/**
 * A right study answer warms the first egg that can take it: one of its own subject first, then a rare egg.
 * Wrong answers and geography questions do nothing.
 */
export function feedEggs(eggs: readonly Egg[] | undefined, q: Pick<Question, 'topic' | 'difficulty'>, correct: boolean, difficulty: Difficulty): Egg[] | undefined {
  const subject = subjectOf(q);
  if (!eggs || eggs.length === 0 || !correct || !subject) return eggs as Egg[] | undefined;
  const target = eggs.find((e) => e.kind === subject && !eggReady(e)) ?? eggs.find((e) => e.kind === 'rare' && !eggReady(e));
  if (!target) return eggs as Egg[];
  const gain = EGG_POINTS[q.difficulty ?? difficulty] ?? EGG_POINTS[difficulty];
  return eggs.map((e) => (e === target ? { ...e, progress: Math.min(EGG_NEED[e.kind], e.progress + gain) } : e));
}

/** What can hatch from an egg: creatures found only in eggs. A Rare Egg can hold any of them. */
export function eggPool(pack: Pack, kind: EggKind): string[] {
  const own = pack.species.filter((s) => (kind === 'rare' ? !!s.egg : s.egg === kind)).map((s) => s.id);
  // A subject without its own egg creatures yet hatches any of them.
  return own.length > 0 ? own : pack.species.filter((s) => !!s.egg).map((s) => s.id);
}

/** Picks the hatchling, favoring creatures the child hasn't met yet. */
export function hatchling(pack: Pack, kind: EggKind, known: ReadonlySet<string>, rng: Rng): { speciesId: string; shiny: boolean } {
  const pool = eggPool(pack, kind);
  const fresh = pool.filter((id) => !known.has(id));
  // Mostly new friends, but a familiar face now and then, which is another shot at a shiny.
  const from = fresh.length > 0 && rng.next() < 0.75 ? fresh : pool;
  const speciesId = from[Math.floor(rng.next() * from.length)] as string;
  return { speciesId, shiny: rng.next() < EGG_SHINY[kind] };
}

/** Math and Words ranks, from study points: each right answer earns its egg points. */
export const STUDY_RANKS = [
  { at: 0, name: 'Beginner' },
  { at: 30, name: 'Apprentice' },
  { at: 150, name: 'Adept' },
  { at: 400, name: 'Wizard' },
  { at: 1000, name: 'Archmage' },
] as const;

export function studyRank(points: number): { name: string; next?: { name: string; left: number } } {
  const i = STUDY_RANKS.findLastIndex((r) => points >= r.at);
  const next = STUDY_RANKS[i + 1];
  return { name: (STUDY_RANKS[i] ?? STUDY_RANKS[0]).name, ...(next ? { next: { name: next.name, left: next.at - points } } : {}) };
}
