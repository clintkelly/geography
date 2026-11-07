import { Rng } from '../engine/rng';
import type { Difficulty, Question } from './types';

/** One science question, written for the game from the ideas of a chapter. A parent reviews these before the kids see them. */
export interface ScienceItem {
  id: string;
  /** The idea it practices. Several questions can share one. */
  concept: string;
  difficulty: Difficulty;
  prompt: string;
  answer: string;
  wrong: string[];
  /** Shown after answering: why the answer is right. */
  explain: string;
}

export interface ScienceChapter {
  id: string;
  title: string;
  order: number;
  questions: ScienceItem[];
}

const files = import.meta.glob<ScienceChapter>('./science/*.json', { eager: true, import: 'default' });
export const SCIENCE_CHAPTERS: ScienceChapter[] = Object.values(files).sort((a, b) => a.order - b.order);

/** Every chapter's questions, as game questions. Options are shuffled once, so the right answer isn't always first. */
export function scienceQuestions(chapters: readonly ScienceChapter[] = SCIENCE_CHAPTERS): Question[] {
  const out: Question[] = [];
  for (const ch of chapters) {
    const rng = new Rng(ch.order * 104729 + ch.questions.length);
    for (const item of ch.questions) {
      if (item.wrong.length < 3) continue;
      const labels = rng.shuffle([item.answer, ...item.wrong.slice(0, 3)]);
      const options = labels.map((label, i) => ({ id: `o${i}`, label }));
      out.push({
        id: `science-${ch.id}-${item.id}`,
        version: 1,
        objectiveId: `science-${ch.id}-${item.concept}`,
        inputType: 'choice',
        prompt: item.prompt,
        options,
        acceptedId: options[labels.indexOf(item.answer)]!.id,
        explanation: item.explain,
        difficulty: item.difficulty,
        regionId: 'study',
        sourceUrl: '',
        topic: 'science',
      });
    }
  }
  return out;
}
