import type { Difficulty, Question } from '../content/types';

const DAY = 24 * 60 * 60 * 1000;
const REVIEW_DAYS = [1, 3, 7];
const ORDER: Difficulty[] = ['scout', 'ranger', 'expert'];

export interface Success {
  day: string;
  questionId: string;
  difficulty: Difficulty;
}

export interface ObjectiveProgress {
  stage: number;
  nextDue: number;
  missed: boolean;
  successes: Success[];
}

export type Learning = Record<string, ObjectiveProgress>;

/** The device's local date, because "two different days" should match a child's own calendar. */
export const localDay = (now: number) => new Date(now).toLocaleDateString('en-CA');

const blank = (): ObjectiveProgress => ({ stage: 0, nextDue: 0, missed: false, successes: [] });

/**
 * Updates an objective after an answer. A right answer that followed seeing the
 * answer, or used help, is not independent evidence, so it schedules nothing.
 */
export function recordAnswer(learning: Learning, q: Question, correct: boolean, now: number, assisted: boolean): Learning {
  const p = learning[q.objectiveId] ?? blank();
  if (!correct) return { ...learning, [q.objectiveId]: { ...p, stage: 0, nextDue: now, missed: true } };
  if (assisted) return learning;
  const stage = Math.min(p.stage + 1, REVIEW_DAYS.length);
  const days = REVIEW_DAYS[stage - 1] as number;
  return {
    ...learning,
    [q.objectiveId]: {
      stage,
      nextDue: now + days * DAY,
      missed: false,
      successes: [...p.successes, { day: localDay(now), questionId: q.id, difficulty: q.difficulty }].slice(-12),
    },
  };
}

/** Three unaided successes on two days with two variants, at this difficulty or harder. A game heuristic, not an assessment. */
export function isFamiliar(p: ObjectiveProgress | undefined, difficulty: Difficulty): boolean {
  if (!p) return false;
  const counted = p.successes.filter((s) => ORDER.indexOf(s.difficulty) >= ORDER.indexOf(difficulty));
  return counted.length >= 3 && new Set(counted.map((s) => s.day)).size >= 2 && new Set(counted.map((s) => s.questionId)).size >= 2;
}

export const isDue = (p: ObjectiveProgress | undefined, now: number) => !!p && p.nextDue <= now;
