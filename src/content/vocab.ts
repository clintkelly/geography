import { Rng } from '../engine/rng';
import type { Difficulty, Question, QuestionOption } from './types';

/** One vocabulary word, as `npm run vocab` writes it. A parent reviews these before the kids see them. */
export interface VocabWord {
  word: string;
  partOfSpeech: string;
  /** Short and kid-friendly. */
  definition: string;
  /** A sentence with ____ where the word goes, exactly as written in `word`. */
  sentence: string;
  /** Three definitions that sound plausible but are wrong for this word. */
  wrongDefinitions: string[];
  synonym: { right: string; wrong: string[] } | null;
  antonym: { right: string; wrong: string[] } | null;
  root: { part: string; meaning: string; wrongMeanings: string[] } | null;
}

export interface VocabUnit {
  id: string;
  title: string;
  /** Unit order, so the newest unit can be practiced most. */
  order: number;
  words: VocabWord[];
}

const files = import.meta.glob<VocabUnit>('./vocab/*.json', { eager: true, import: 'default' });
export const VOCAB_UNITS: VocabUnit[] = Object.values(files).sort((a, b) => a.order - b.order);

const choice = (right: string, wrong: readonly string[], rng: Rng): { options: QuestionOption[]; acceptedId: string } | null => {
  const picks = [...new Set(rng.shuffle(wrong.filter((w) => w.toLowerCase() !== right.toLowerCase())))].slice(0, 3);
  if (picks.length < 3) return null;
  const options = [right, ...picks].map((label, i) => ({ id: `o${i}`, label }));
  return { options, acceptedId: 'o0' };
};

const slug = (w: string) => w.toLowerCase().replace(/[^a-z]+/g, '-');

/**
 * Builds questions from each word. Scout asks what words mean, Ranger uses them in sentences
 * and with synonyms, antonyms and roots, and Expert asks the child to type the word.
 */
export function vocabQuestions(units: readonly VocabUnit[] = VOCAB_UNITS): Question[] {
  const out: Question[] = [];
  for (const unit of units) {
    const rng = new Rng(unit.order * 7919 + unit.words.length);
    for (const w of unit.words) {
      const others = unit.words.filter((o) => o !== w);
      const samePos = others.filter((o) => o.partOfSpeech === w.partOfSpeech);
      // Words of the same part of speech make the hardest wrong choices; any word fills in.
      const wordChoices = [...rng.shuffle(samePos), ...rng.shuffle(others)].map((o) => o.word);
      const id = `word-${unit.id}-${slug(w.word)}`;
      const base = {
        version: 1,
        objectiveId: id,
        regionId: 'study',
        sourceUrl: '',
        topic: 'word' as const,
        explanation: `${w.word} (${w.partOfSpeech}): ${w.definition}.`,
        hint: `"${w.sentence.replace('____', w.word)}"`,
      };
      const add = (suffix: string, difficulty: Difficulty, prompt: string, c: ReturnType<typeof choice>) => {
        if (c) out.push({ ...base, id: `${id}-${suffix}`, difficulty, prompt, inputType: 'choice', ...c });
      };
      add('means', 'scout', `What does "${w.word}" mean?`, choice(w.definition, [...w.wrongDefinitions, ...others.map((o) => o.definition)], rng));
      add('which', 'scout', `Which word means "${w.definition}"?`, choice(w.word, wordChoices, rng));
      add('blank', 'ranger', `Which word fits? "${w.sentence}"`, choice(w.word, wordChoices, rng));
      if (w.synonym) add('synonym', 'ranger', `Which word means almost the same as "${w.word}"?`, choice(w.synonym.right, w.synonym.wrong, rng));
      if (w.antonym) add('antonym', 'ranger', `Which word means the opposite of "${w.word}"?`, choice(w.antonym.right, w.antonym.wrong, rng));
      if (w.root) add('root', 'ranger', `"${w.word}" has the root "${w.root.part}". What does "${w.root.part}" mean?`, choice(w.root.meaning, w.root.wrongMeanings, rng));
      // Expert: type the word, which practices spelling too.
      out.push({ ...base, id: `${id}-spell`, difficulty: 'expert', prompt: `Type the word that means "${w.definition}". It starts with "${w.word[0]}".`, inputType: 'typed', typed: { kind: 'word', text: w.word }, options: [{ id: w.word, label: w.word }], acceptedId: w.word });
      out.push({ ...base, id: `${id}-spell-blank`, difficulty: 'expert', prompt: `Type the missing word: "${w.sentence}"`, inputType: 'typed', typed: { kind: 'word', text: w.word }, options: [{ id: w.word, label: w.word }], acceptedId: w.word });
      // The harder choice questions count on Expert too.
      for (const q of out.filter((x) => x.objectiveId === id && x.difficulty === 'ranger')) out.push({ ...q, id: `${q.id}-x`, difficulty: 'expert' });
    }
  }
  return out;
}
