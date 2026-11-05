import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { VOCAB_UNITS, vocabQuestions } from '../content/vocab';
import type { Difficulty } from '../content/types';
import { makeOffers, newSave, reduce, regionHasFocus, type Command, type Focus, type SaveData } from './game';
import { Rng } from './rng';
import { isCorrect } from './questions';
import { isStudy } from './study';

const NOW = 1_800_000_000_000;
const PLAIN = { ...PACK, species: PACK.species.filter((o) => !o.rare) };
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PLAIN, NOW);
const fresh = (seed = 7) => newSave(PACK, seed, 'p1');
const withStudy = (s: SaveData, study: NonNullable<SaveData['settings']['study']>) => ({ ...s, settings: { ...s.settings, study } });

function trail(s: SaveData, focus: Focus, difficulty: Difficulty = 'scout', regionId = 'us-west') {
  const offer = s.offers.find((o) => o.regionId === regionId)!;
  let t = step(s, { type: 'start', offerId: offer.id, regionId, difficulty, trail: 'long', focus });
  t = step(t, { type: 'depart' });
  return step(t, { type: 'guess', locationId: t.expedition!.targetId });
}

/** Plays every stop, answering right, and collects each question asked. */
function playAll(s: SaveData) {
  const asked = [];
  let t = s;
  for (let i = 0; i < 200 && t.expedition; i++) {
    const e = t.expedition;
    if (e.discovery !== 'found') { t = step(t, { type: 'guess', locationId: e.targetId }); continue; }
    if (!e.battle && !e.event) { t = step(t, { type: 'enterEncounter' }); if (!t.expedition?.battle && !t.expedition?.event) break; continue; }
    if (e.event) {
      asked.push(e.event.question);
      t = step(step(t, { type: 'answer', optionId: e.event.question.acceptedId }), { type: 'continue' });
      continue;
    }
    const b = e.battle!;
    if (b.phase === 'choose') { t = step(t, { type: 'chooseAction', action: b.befriending ? 'befriend' : 'attack' }); continue; }
    if (b.phase === 'question') { asked.push(b.question); t = step(t, { type: 'answer', optionId: b.question.acceptedId }); continue; }
    t = step(t, { type: 'continue' });
  }
  return { asked, save: t };
}

describe('Math and Words trails', () => {
  it('can be picked in every region', () => {
    for (const r of PACK.regions) {
      expect(regionHasFocus(PACK, r.id, 'math'), r.id).toBe(true);
      expect(regionHasFocus(PACK, r.id, 'words'), r.id).toBe(true);
    }
  });

  it('a Math trail asks only math, and its battles are study creatures', () => {
    const s = trail(fresh(), 'math', 'ranger');
    expect(s.expedition!.focus).toBe('math');
    const scholars = PACK.species.filter((o) => o.subject === 'math').map((o) => o.id);
    for (const slot of s.expedition!.slots.filter((x) => x.kind === 'regular')) expect(scholars, slot.opponentId).toContain(slot.opponentId);
    const { asked } = playAll(s);
    expect(asked.length).toBeGreaterThan(3);
    for (const q of asked) expect(q.topic, q.id).toBe('math');
    expect(asked.some((q) => q.inputType === 'typed')).toBe(true);
  });

  it('a Words trail asks only the units a parent picked', () => {
    const unit = VOCAB_UNITS[0]!.id;
    const s = trail(withStudy(fresh(), { mix: 0, math: false, words: false, wordUnits: [unit] }), 'words');
    const { asked } = playAll(s);
    expect(asked.length).toBeGreaterThan(3);
    for (const q of asked) expect(q.objectiveId.startsWith(`word-${unit}-`), q.id).toBe(true);
  });

  it('math topics narrow what a Math trail asks', () => {
    const s = trail(withStudy(fresh(), { mix: 0, math: true, words: false, mathTopics: ['integers'] }), 'math', 'ranger');
    const { asked } = playAll(s);
    const integerSkills = ['compare-integers', 'add-integers', 'subtract-integers', 'integer-world'].map((k) => `math-${k}`);
    for (const q of asked) expect(integerSkills, q.id).toContain(q.objectiveId);
  });

  it('typed answers count right when correct and wrong when not', () => {
    // Walk the trail until a battle asks a typed question.
    let s = trail(fresh(), 'math', 'expert');
    for (let i = 0; i < 200 && s.expedition; i++) {
      const e = s.expedition;
      const b = e.battle;
      if (b?.phase === 'question' && b.question.inputType === 'typed') break;
      if (e.event) s = step(step(s, { type: 'answer', optionId: e.event.question.acceptedId }), { type: 'continue' });
      else if (!b) s = step(s, e.discovery === 'found' ? { type: 'enterEncounter' } : { type: 'guess', locationId: e.targetId });
      else if (b.phase === 'choose') s = step(s, { type: 'chooseAction', action: b.befriending ? 'befriend' : 'attack' });
      else if (b.phase === 'question') s = step(s, { type: 'answer', optionId: b.question.acceptedId });
      else s = step(s, { type: 'continue' });
    }
    const q = s.expedition!.battle!.question;
    expect(q.inputType).toBe('typed');
    expect(step(s, { type: 'answer', optionId: '   ' })).toBe(s);
    const wrong = step(s, { type: 'answer', optionId: '-987654' });
    expect(wrong.expedition!.battle!.result!.correct).toBe(false);
    expect(wrong.attempts.at(-1)!.submitted).toBe('-987654');
    expect(step(s, { type: 'answer', optionId: q.acceptedId }).expedition!.battle!.result!.correct).toBe(true);
  });
});

describe('mixing study into geography trails', () => {
  const studyShare = (s: SaveData) => {
    const { asked } = playAll(trail(s, 'all'));
    return asked.filter(isStudy).length / asked.length;
  };

  it('is off unless a parent turns it on', () => {
    expect(studyShare(fresh())).toBe(0);
    expect(studyShare(withStudy(fresh(), { mix: 0.5, math: false, words: false }))).toBe(0);
  });

  it('mixes in about as often as set', () => {
    let total = 0;
    for (let seed = 1; seed <= 8; seed++) total += studyShare(withStudy(fresh(seed), { mix: 0.5, math: true, words: true }));
    expect(total / 8).toBeGreaterThan(0.25);
    expect(total / 8).toBeLessThan(0.75);
  });

  it('never mixes geography into a Math trail', () => {
    const { asked } = playAll(trail(withStudy(fresh(), { mix: 0.5, math: true, words: true }), 'math'));
    for (const q of asked) expect(q.topic).toBe('math');
  });
});

describe('study creatures', () => {
  const scholars = PACK.species.filter((o) => o.subject);

  it('there are math and words creatures, and they never live in a region', () => {
    expect(scholars.filter((o) => o.subject === 'math').length).toBeGreaterThanOrEqual(3);
    expect(scholars.filter((o) => o.subject === 'words').length).toBeGreaterThanOrEqual(3);
    for (const o of scholars) expect(o.homes, o.id).toEqual([]);
  });

  it('are never camp sightings or opponents on geography trails', () => {
    const ids = new Set(scholars.map((o) => o.id));
    const { offers } = makeOffers(fresh(), PACK, new Rng(3));
    for (const o of offers) if (o.reward.kind === 'creature') expect(ids.has(o.reward.speciesId)).toBe(false);
    const s = trail(fresh(), 'all');
    for (const slot of s.expedition!.slots) expect(ids.has(slot.opponentId), slot.opponentId).toBe(false);
  });
});

describe('vocabulary questions', () => {
  const bank = vocabQuestions();

  it('every word gets meaning, sentence and spelling questions at the right levels', () => {
    for (const unit of VOCAB_UNITS) {
      for (const w of unit.words) {
        const mine = bank.filter((q) => q.objectiveId.startsWith(`word-${unit.id}-`) && q.objectiveId.endsWith(w.word.toLowerCase().replace(/[^a-z]+/g, '-')));
        expect(mine.some((q) => q.difficulty === 'scout'), w.word).toBe(true);
        expect(mine.some((q) => q.difficulty === 'ranger' && q.prompt.includes('____')), w.word).toBe(true);
        expect(mine.some((q) => q.difficulty === 'expert' && q.inputType === 'typed'), w.word).toBe(true);
      }
    }
  });

  it('choice questions have four different options with one right answer', () => {
    for (const q of bank.filter((x) => x.inputType === 'choice')) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.label.toLowerCase())).size, q.id).toBe(4);
      expect(q.options.filter((o) => o.id === q.acceptedId), q.id).toHaveLength(1);
    }
  });

  it('spelling ignores capitals and spaces at the ends, but not misspellings', () => {
    const q = bank.find((x) => x.inputType === 'typed')!;
    const word = q.acceptedId;
    expect(isCorrect(q, word)).toBe(true);
    expect(isCorrect(q, `  ${word.toUpperCase()} `)).toBe(true);
    expect(isCorrect(q, word.slice(0, -1))).toBe(false);
    expect(isCorrect(q, `${word}s`)).toBe(false);
  });
});
