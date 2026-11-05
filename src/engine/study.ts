import { MATH_TOPICS, type MathSkill, type MathTopic } from '../content/math/generate';
import type { Question } from '../content/types';

/** A child's math and vocabulary choices, set by a parent. */
export interface StudySettings {
  /** How often a question on an ordinary trail is math or vocabulary instead, from 0 to 1. */
  mix: number;
  /** Which subjects mix in. Math and Words trails can always be picked at camp. */
  math: boolean;
  words: boolean;
  /** Math topics to practice. Empty or missing means all of them. */
  mathTopics?: MathTopic[];
  /** Vocabulary units to practice. Empty or missing means all of them. */
  wordUnits?: string[];
}

export const DEFAULT_STUDY: StudySettings = { mix: 0, math: false, words: false };
export const MIX_CHOICES: readonly number[] = [0, 0.15, 0.3, 0.5];

export type Subject = 'math' | 'words';
export const isStudy = (q: Pick<Question, 'topic'>) => q.topic === 'math' || q.topic === 'word';
export const subjectOf = (q: Pick<Question, 'topic'>): Subject | undefined => (q.topic === 'math' ? 'math' : q.topic === 'word' ? 'words' : undefined);

const skillTopic = (objectiveId: string): MathTopic | undefined => {
  const skill = objectiveId.replace(/^math-/, '') as MathSkill;
  return (Object.keys(MATH_TOPICS) as MathTopic[]).find((t) => MATH_TOPICS[t].skills.includes(skill));
};
/** The vocabulary unit a question's objective comes from, like "starter-roots" in "word-starter-roots-audible". */
export const unitOf = (objectiveId: string, units: readonly string[]) => units.find((u) => objectiveId.startsWith(`word-${u}-`));

/** Study questions of one subject that this child's settings allow. */
export function studyMatches(subject: Subject, study: StudySettings | undefined, allUnits: readonly string[]) {
  const topics = study?.mathTopics?.length ? study.mathTopics : undefined;
  const units = study?.wordUnits?.length ? study.wordUnits : undefined;
  return (q: Question) => {
    if (subjectOf(q) !== subject) return false;
    if (subject === 'math') return !topics || topics.includes(skillTopic(q.objectiveId) as MathTopic);
    return !units || units.includes(unitOf(q.objectiveId, allUnits) ?? '');
  };
}
