import type { Question } from '../content/types';
import { typedCorrect } from './answers';
import type { Rng } from './rng';

/** How many recent questions must pass before a place can be the answer again. */
const PLACE_GAP = 4;

export interface PickContext {
  /** Asked this expedition, oldest first. */
  asked: readonly string[];
  /** Asked in recent expeditions. */
  recent: readonly string[];
  locationId: string;
}

/**
 * Chooses the next question. Each rule relaxes in turn, so a small pool yields
 * a tracked repeat rather than failing to start.
 */
export function pickQuestion(pool: readonly Question[], ctx: PickContext, rng: Rng): Question {
  const byId = new Map(pool.map((q) => [q.id, q]));
  const askedSet = new Set(ctx.asked);
  const recentSet = new Set(ctx.recent);
  const spaced = new Set(ctx.asked.slice(-2).map((id) => byId.get(id)?.objectiveId));
  // The same state or country shouldn't be the answer over and over.
  const lastPlaces = new Set(ctx.asked.slice(-PLACE_GAP).map((id) => byId.get(id)?.locationId).filter(Boolean));
  const newPlace = (q: Question) => !q.locationId || !lastPlaces.has(q.locationId);

  const fresh = pool.filter((q) => !askedSet.has(q.id));
  const tiers = [
    fresh.filter((q) => !spaced.has(q.objectiveId) && !recentSet.has(q.id) && newPlace(q)),
    fresh.filter((q) => !spaced.has(q.objectiveId) && newPlace(q)),
    fresh.filter(newPlace),
    fresh.filter((q) => !spaced.has(q.objectiveId) && !recentSet.has(q.id)),
    fresh.filter((q) => !spaced.has(q.objectiveId)),
    fresh,
    pool.filter((q) => !spaced.has(q.objectiveId)),
    pool,
  ];
  const tier = tiers.find((t) => t.length > 0);
  if (!tier) throw new Error('Question pool is empty');

  const wantLocal = rng.next() < 0.5;
  const local = tier.filter((q) => q.locationId === ctx.locationId);
  const source = wantLocal && local.length > 0 ? local : tier;
  return rng.shuffle(source)[0] as Question;
}

/** Fixes option order for a turn. Answers are matched by stable option id, never by position. */
export function presentQuestion(q: Question, rng: Rng): Question {
  return { ...q, options: rng.shuffle(q.options) };
}

/** For a typed question, `optionId` is what the child typed. */
export function isCorrect(q: Question, optionId: string): boolean {
  if (q.inputType === 'typed' && q.typed) return typedCorrect(q.typed, optionId);
  return q.acceptedId === optionId;
}

/** Whether an answer could belong to this question: one of its options, or anything typed. */
export const isAnswerFor = (q: Question, optionId: string) => (q.inputType === 'typed' ? optionId.trim().length > 0 && optionId.length <= 40 : q.options.some((o) => o.id === optionId));
