import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import type { Question } from '../content/types';
import { EGG_METER, eggPool, eggReady, feedEggs, fillMeter, hatchling, layEgg, MAX_EGGS, studyRank } from './eggs';
import { blankMapSearch, easeStudy, isExpeditionComplete, newSave, reduce, rollShiny, strugglingObjectives, STUDY_SHINY_BOOST, studyPool, type Command, type SaveData } from './game';
import { Rng } from './rng';

const NOW = 1_800_000_000_000;
// No rare encounters, so trails play the same every run.
const PLAIN = { ...PACK, species: PACK.species.filter((o) => !o.rare) };
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PLAIN, NOW);
const math = { topic: 'math', difficulty: 'expert' } as Question;

/** Plays a whole Math trail with every answer right. */
function mathTrail(s: SaveData, difficulty: 'scout' | 'expert' = 'scout'): SaveData {
  const offer = s.offers.find((o) => o.regionId === 'us-west')!;
  let next = step(step(s, { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty, trail: 'short', focus: 'math' }), { type: 'depart' });
  for (let i = 0; i < 400 && !isExpeditionComplete(next.expedition!); i++) {
    const e = next.expedition!;
    if (e.discovery === 'searching') next = step(next, { type: 'guess', locationId: e.targetId });
    else if (e.event) next = e.event.result ? step(next, { type: 'continue' }) : step(next, { type: 'answer', optionId: e.event.question.acceptedId });
    else if (e.battle) {
      const b = e.battle;
      if (b.phase === 'choose') next = step(next, { type: 'chooseAction', action: b.befriending ? 'befriend' : 'attack' });
      else if (b.phase === 'question') next = step(next, { type: 'answer', optionId: b.question.acceptedId });
      else next = step(next, { type: 'continue' });
    } else next = step(next, { type: 'enterEncounter' });
  }
  return step(next, { type: 'claimReward' });
}

describe('study eggs', () => {
  it('a nest holds three eggs', () => {
    let eggs = layEgg([], 'math', 'a');
    eggs = layEgg(layEgg(layEgg(eggs, 'words', 'b'), 'rare', 'c'), 'math', 'd');
    expect(eggs.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(eggs).toHaveLength(MAX_EGGS);
  });

  it('only right study answers warm an egg, and harder ones warm it faster', () => {
    const eggs = layEgg(layEgg([], 'words', 'w'), 'math', 'm');
    expect(feedEggs(eggs, math, false, 'expert')).toEqual(eggs);
    expect(feedEggs(eggs, { topic: 'location' } as Question, true, 'expert')).toEqual(eggs);
    expect(feedEggs(eggs, math, true, 'expert')!.find((e) => e.id === 'm')!.progress).toBe(3);
    expect(feedEggs(eggs, { topic: 'math', difficulty: 'scout' } as Question, true, 'scout')!.find((e) => e.id === 'm')!.progress).toBe(1);
    // A rare egg takes either subject.
    expect(feedEggs(layEgg([], 'rare', 'r'), { topic: 'word', difficulty: 'ranger' } as Question, true, 'ranger')![0]!.progress).toBe(2);
  });

  it('each egg hatches its own creatures, favoring new ones', () => {
    const mathPool = eggPool(PACK, 'math');
    expect(mathPool.sort()).toEqual(['centipod', 'emberbill', 'frostbill', 'gearbill', 'glowbill', 'numbanzee', 'pentastar', 'spiralnaut', 'stepant', 'webangle']);
    expect(eggPool(PACK, 'words').sort()).toEqual(['breezenose', 'chirpuga', 'digbill', 'lexibo', 'mynatter', 'pebblenose', 'sparkiwi', 'wordcollie']);
    // Egg creatures live nowhere else: no region, no study trail.
    for (const id of eggPool(PACK, 'rare')) expect(PACK.species.find((o) => o.id === id), id).toMatchObject({ homes: [] });
    for (const id of eggPool(PACK, 'rare')) expect(PACK.species.find((o) => o.id === id)!.subject, id).toBeUndefined();
    expect(eggPool(PACK, 'science').sort()).toEqual(['atomoth', 'boomardier', 'crystalisk', 'fizzalotl', 'gravitail', 'gyrosnail', 'lensowl', 'magnetle', 'metrodillo', 'phasepup', 'querifox', 'solubee']);
    expect(eggPool(PACK, 'rare').length).toBe(mathPool.length + eggPool(PACK, 'words').length + eggPool(PACK, 'science').length);
    const known = new Set(mathPool.slice(1));
    const rng = new Rng(3);
    const picks = Array.from({ length: 200 }, () => hatchling(PACK, 'math', known, rng));
    expect(picks.filter((p) => p.speciesId === mathPool[0]).length).toBeGreaterThan(120);
    expect(picks.filter((p) => p.shiny).length).toBeGreaterThan(10);
  });

  it('a Math trail lays eggs from the Egg Meter and at the end, its answers warm them, and they hatch at camp', () => {
    const s = mathTrail(newSave(PACK, 7, 'p1'));
    expect(s.eggs!.length).toBeGreaterThanOrEqual(1);
    expect(s.eggs!.every((e) => e.kind === 'math' || e.kind === 'rare')).toBe(true);
    expect(s.studyPoints!.math).toBeGreaterThan(5);
    let next = mathTrail(s);
    const ready = next.eggs!.find(eggReady)!;
    expect(ready).toBeDefined();
    const before = next.companions.length;
    next = step(next, { type: 'hatchEgg', eggId: ready.id });
    expect(next.companions).toHaveLength(before + 1);
    expect(eggPool(PACK, ready.kind)).toContain(next.companions.at(-1)!.speciesId);
    expect(next.hatched).toMatchObject({ kind: ready.kind });
    expect(next.eggs!.some((e) => e.id === ready.id)).toBe(false);
    expect(step(next, { type: 'dismissHatch' }).hatched).toBeNull();
  });

  it('every 8 right study answers lay an egg on the spot, every 4th one Rare, and a full nest makes the meter wait', () => {
    let meter: ReturnType<typeof fillMeter>['meter'] | undefined;
    let eggs: ReturnType<typeof fillMeter>['eggs'] = [];
    const laid: string[] = [];
    for (let i = 0; i < 8 * 4; i++) {
      const r = fillMeter(meter, eggs.slice(0, 1), 'math', `e${i}`);
      meter = r.meter;
      eggs = r.eggs;
      if (r.laid) laid.push(r.laid);
    }
    expect(laid).toEqual(['math', 'math', 'math', 'rare']);
    const full = [{ id: 'a', kind: 'math' as const, progress: 0 }, { id: 'b', kind: 'math' as const, progress: 0 }, { id: 'c', kind: 'math' as const, progress: 0 }];
    const waiting = fillMeter({ math: EGG_METER - 1, words: 0, laid: 0 }, full, 'math', 'd');
    expect(waiting.laid).toBeUndefined();
    expect(waiting.meter.math).toBe(EGG_METER);
    expect(fillMeter(waiting.meter, full.slice(1), 'math', 'd').laid).toBe('math');
  });

  it('a math skill a child keeps missing comes one difficulty easier until they get it again', () => {
    const miss = (correct: boolean, n: number) => ({ id: `a${n}`, context: 'battle', itemId: 'math-gcf-expert-1', itemVersion: 1, objectiveId: 'math-gcf', submitted: '1', correct, timestamp: n, assisted: false, expeditionId: 'x' }) as const;
    const struggling = [miss(false, 1), miss(true, 2), miss(false, 3), miss(false, 4)];
    expect(strugglingObjectives(struggling)).toEqual(new Set(['math-gcf']));
    const expertGcf = PACK.questions.filter((q) => q.objectiveId === 'math-gcf' && q.difficulty === 'expert');
    const eased = easeStudy(expertGcf, PACK, struggling);
    expect(eased.every((q) => q.difficulty === 'ranger')).toBe(true);
    // Three right in a row out of the last five brings it back.
    const better = [...struggling, miss(true, 5), miss(true, 6), miss(true, 7)];
    expect(strugglingObjectives(better).size).toBe(0);
    expect(easeStudy(expertGcf, PACK, better)).toEqual(expertGcf);
  });

  it('Math and Words trails search with a few choices, even on Expert', () => {
    expect(blankMapSearch({ difficulty: 'expert', focus: 'math' })).toBe(false);
    expect(blankMapSearch({ difficulty: 'expert', focus: 'all' })).toBe(true);
    let s = newSave(PACK, 7, 'p1');
    const offer = s.offers.find((o) => o.regionId === 'us-west')!;
    s = step(step(s, { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty: 'expert', trail: 'short', focus: 'math' }), { type: 'depart' });
    expect(s.expedition!.candidateIds.length).toBe(4);
  });

  it('an unready egg does not hatch', () => {
    const s = { ...newSave(PACK, 7, 'p1'), eggs: [{ id: 'cold', kind: 'math' as const, progress: 3 }] };
    expect(step(s, { type: 'hatchEgg', eggId: 'cold' })).toBe(s);
  });

  it('a typed math answer gives a Brain Blast charge', () => {
    let s = newSave(PACK, 7, 'p1');
    const offer = s.offers.find((o) => o.regionId === 'us-west')!;
    s = step(step(s, { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty: 'expert', trail: 'short', focus: 'math' }), { type: 'depart' });
    for (let i = 0; i < 50 && !s.expedition!.battle; i++) s = s.expedition!.discovery === 'searching' ? step(s, { type: 'guess', locationId: s.expedition!.targetId }) : s.expedition!.event ? step(step(s, { type: 'answer', optionId: s.expedition!.event.question.acceptedId }), { type: 'continue' }) : step(s, { type: 'enterEncounter' });
    // Find a typed question.
    for (let i = 0; i < 20 && s.expedition!.battle!.question.inputType !== 'typed'; i++) {
      s = step(step(step(s, { type: 'chooseAction', action: 'guard' }), { type: 'answer', optionId: s.expedition!.battle!.question.acceptedId }), { type: 'continue' });
    }
    const b = s.expedition!.battle!;
    expect(b.question.inputType).toBe('typed');
    const after = step(step(s, { type: 'chooseAction', action: 'attack' }), { type: 'answer', optionId: b.question.acceptedId });
    expect(after.expedition!.battle!.result!.brainBlast).toBe(true);
  });

  it('Math and Words trails double the shiny chance', () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `x-${i}`);
    const plain = ids.filter((id) => rollShiny(id, 'ranger')).length;
    const boosted = ids.filter((id) => rollShiny(id, 'ranger', STUDY_SHINY_BOOST)).length;
    expect(boosted / plain).toBeGreaterThan(1.7);
  });

  it('ranks rise with study points', () => {
    expect(studyRank(0)).toEqual({ name: 'Beginner', next: { name: 'Apprentice', left: 30 } });
    expect(studyRank(150).name).toBe('Adept');
    expect(studyRank(5000)).toEqual({ name: 'Archmage' });
  });
});

describe('switching after a faint', () => {
  it('works even in the middle of a Bold Befriend attempt', () => {
    const base = newSave(PACK, 7, 'p1');
    const lead = base.activeCompanionId;
    let s: SaveData = { ...base, companions: [...base.companions, { instanceId: 'p1-b', speciesId: 'lobsnap', bondXp: 0 }], lastTeamIds: [lead, 'p1-b'] };
    const offer = s.offers.find((o) => o.regionId === 'us-west')!;
    s = step(step(s, { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty: 'scout', trail: 'short', focus: 'all' }), { type: 'depart' });
    for (let i = 0; i < 50 && !s.expedition!.battle; i++) s = s.expedition!.discovery === 'searching' ? step(s, { type: 'guess', locationId: s.expedition!.targetId }) : s.expedition!.event ? step(step(s, { type: 'answer', optionId: s.expedition!.event.question.acceptedId }), { type: 'continue' }) : step(s, { type: 'enterEncounter' });
    const e = s.expedition!;
    const b = e.battle!;
    // The lead faints one right answer into a Bold Befriend.
    s = { ...s, expedition: { ...e, battle: { ...b, phase: 'choose', tameHits: 1, mustSwitch: true, combat: { ...b.combat, playerHp: 0 } } } };
    const after = step(s, { type: 'switchTo', instanceId: 'p1-b' });
    expect(after.expedition!.companionId).toBe('p1-b');
    expect(after.expedition!.battle!.mustSwitch).toBeUndefined();
    expect(after.expedition!.battle!.tameHits).toBe(1);
  });
});

describe('science', () => {
  it('a Science trail asks science questions, fills the Science meter and earns science points', () => {
    let s = newSave(PACK, 7, 'p1');
    const offer = s.offers.find((o) => o.regionId === 'us-west')!;
    s = step(step(s, { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty: 'scout', trail: 'short', focus: 'science' }), { type: 'depart' });
    const topics = new Set<string>();
    for (let i = 0; i < 400 && !isExpeditionComplete(s.expedition!); i++) {
      const e = s.expedition!;
      if (e.discovery === 'searching') s = step(s, { type: 'guess', locationId: e.targetId });
      else if (e.event) s = e.event.result ? step(s, { type: 'continue' }) : step(s, { type: 'answer', optionId: e.event.question.acceptedId });
      else if (e.battle) {
        const b = e.battle;
        if (b.phase === 'choose') s = step(s, { type: 'chooseAction', action: b.befriending ? 'befriend' : 'attack' });
        else if (b.phase === 'question') { topics.add(b.question.topic ?? ''); s = step(s, { type: 'answer', optionId: b.question.acceptedId }); }
        else s = step(s, { type: 'continue' });
      } else s = step(s, { type: 'enterEncounter' });
    }
    expect([...topics]).toEqual(['science']);
    expect(s.studyPoints!.science).toBeGreaterThan(0);
    expect((s.eggMeter!.science ?? 0) > 0 || (s.eggs ?? []).some((e) => e.kind === 'science' || e.kind === 'rare')).toBe(true);
  });

  it('parents can pick which chapters to practice', () => {
    const ch1 = studyPool(PACK, 'science', 'scout', { mix: 0, math: false, words: false, science: true, scienceUnits: ['ch-01'] });
    expect(ch1.length).toBeGreaterThan(3);
    expect(ch1.every((q) => q.objectiveId.startsWith('science-ch-01-'))).toBe(true);
  });
});
