import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { validatePack } from '../content/validate';
import { reduce, newSave, isExpeditionComplete, type Command, type SaveData } from './game';
import { clampView, EUROPE, project } from '../ui/WorldMap';
import { pickQuestion } from './questions';
import { Rng } from './rng';

const NOW = 1_800_000_000_000;
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PACK, NOW);
const fresh = (seed = 7) => newSave(PACK, seed, 'p1');

function discover(s: SaveData): SaveData {
  return step(s, { type: 'guess', locationId: s.expedition!.targetId });
}

function playTurn(s: SaveData, correct: boolean): SaveData {
  let next = step(s, { type: 'chooseAction', action: 'attack' });
  const q = next.expedition!.battle!.question;
  const optionId = correct ? q.acceptedId : (q.options.find((o) => o.id !== q.acceptedId)!.id);
  next = step(next, { type: 'answer', optionId });
  return step(next, { type: 'continue' });
}

function winBattle(s: SaveData): SaveData {
  let next = step(s, { type: 'enterEncounter' });
  while (next.expedition!.battle) next = playTurn(next, true);
  return next;
}

function fullExpedition(s: SaveData): SaveData {
  let next = discover(step(s, { type: 'start' }));
  for (let i = 0; i < 3; i++) next = winBattle(next);
  return step(next, { type: 'claimReward' });
}

describe('content', () => {
  it('the pack is valid', () => expect(validatePack(PACK)).toEqual([]));
});

describe('map', () => {
  it('shows every playable place, with margin, in the Europe view', () => {
    const v = clampView(EUROPE);
    const h = (v.w * 500) / 960;
    for (const p of PACK.places) {
      const [x, y] = project(p.lonLat);
      expect(x, p.name).toBeGreaterThan(v.x + v.w * 0.04);
      expect(x, p.name).toBeLessThan(v.x + v.w * 0.96);
      expect(y, p.name).toBeGreaterThan(v.y + h * 0.04);
      expect(y, p.name).toBeLessThan(v.y + h * 0.96);
    }
  });
});

describe('expedition loop', () => {
  it('runs discovery, three battles and a persistent reward, then allows another outing', () => {
    let s = fresh();
    const reward = s.offer.reward;
    s = discover(step(s, { type: 'start' }));
    expect(s.expedition!.reward).toEqual(reward);
    for (let i = 0; i < 3; i++) s = winBattle(s);
    expect(isExpeditionComplete(s.expedition!)).toBe(true);
    s = step(s, { type: 'claimReward' });
    expect(s.expedition).toBeNull();
    expect(s.souvenirIds).toHaveLength(1);
    expect(s.completedExpeditions).toBe(1);
    expect(s.lastSummary?.answered).toBeGreaterThanOrEqual(13);

    s = fullExpedition(s);
    expect(s.completedExpeditions).toBe(2);
    expect(new Set(s.souvenirIds).size).toBe(2);
  });

  it('offers an honest bond reward once souvenirs run out', () => {
    let s = fresh();
    for (let i = 0; i < PACK.souvenirs.length; i++) s = fullExpedition(s);
    expect(s.souvenirIds).toHaveLength(PACK.souvenirs.length);
    expect(s.offer.reward).toEqual({ kind: 'bond', xp: 10 });
    expect(fullExpedition(s).companion.bondXp).toBe(10);
  });

  it('round-trips through JSON at every step, as a save does', () => {
    let s = discover(step(fresh(), { type: 'start' }));
    s = step(s, { type: 'enterEncounter' });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('idempotency', () => {
  const inQuestion = () => {
    let s = discover(step(fresh(), { type: 'start' }));
    s = step(s, { type: 'enterEncounter' });
    return step(s, { type: 'chooseAction', action: 'attack' });
  };

  it('a repeated answer changes nothing', () => {
    const s = inQuestion();
    const once = step(s, { type: 'answer', optionId: s.expedition!.battle!.question.acceptedId });
    expect(step(once, { type: 'answer', optionId: s.expedition!.battle!.question.acceptedId })).toBe(once);
    expect(once.attempts.filter((a) => a.context === 'battle')).toHaveLength(1);
  });

  it('a repeated claim cannot duplicate a reward', () => {
    let s = discover(step(fresh(), { type: 'start' }));
    for (let i = 0; i < 3; i++) s = winBattle(s);
    s = step(s, { type: 'claimReward' });
    expect(step(s, { type: 'claimReward' })).toBe(s);
    expect(s.souvenirIds).toHaveLength(1);
  });

  it('an answer that is not an option of the current question is ignored', () => {
    const s = inQuestion();
    expect(step(s, { type: 'answer', optionId: 'nope' })).toBe(s);
  });

  it('the same seed and commands give the same expedition', () => {
    expect(inQuestion()).toEqual(inQuestion());
  });
});

describe('discovery', () => {
  const started = () => step(fresh(), { type: 'start' });
  const wrongId = (s: SaveData) => s.expedition!.candidateIds.find((id) => id !== s.expedition!.targetId)!;

  it('always includes the target among four distinct candidates', () => {
    for (let seed = 1; seed < 40; seed++) {
      const e = step(fresh(seed), { type: 'start' }).expedition!;
      expect(new Set(e.candidateIds).size).toBe(4);
      expect(e.candidateIds).toContain(e.targetId);
    }
  });

  it('an unaided first guess is unassisted', () => {
    const attempt = discover(started()).attempts.at(-1)!;
    expect(attempt).toMatchObject({ context: 'discovery', correct: true, assisted: false });
  });

  it.each([
    ['atlas', (s: SaveData) => step(s, { type: 'useAtlas' })],
    ['extra clue', (s: SaveData) => step(s, { type: 'revealClue' })],
    ['earlier wrong guess', (s: SaveData) => step(s, { type: 'guess', locationId: wrongId(s) })],
  ])('help from %s is recorded but keeps the expedition going', (_name, help) => {
    const s = discover(help(started()));
    expect(s.expedition!.discovery).toBe('found');
    expect(s.attempts.at(-1)!.assisted).toBe(true);
    expect(s.expedition!.reward).toEqual(s.offer.reward);
  });

  it('a wrong guess reveals the next clue and allows another try', () => {
    const s = started();
    const after = step(s, { type: 'guess', locationId: wrongId(s) });
    expect(after.expedition).toMatchObject({ discovery: 'searching', cluesShown: 2 });
  });

  it('cannot enter an encounter before discovery', () => {
    const s = started();
    expect(step(s, { type: 'enterEncounter' })).toBe(s);
  });
});

describe('retreat and retry', () => {
  it('keeps route, reward and earlier wins; awards nothing for the lost slot', () => {
    let s = discover(step(fresh(), { type: 'start' }));
    s = winBattle(s);
    const { slots, reward } = s.expedition!;
    const attemptsBefore = s.attempts.length;
    s = step(s, { type: 'enterEncounter' });
    while (s.expedition!.battle) s = playTurn(s, false);

    expect(s.expedition).toMatchObject({ retreated: true, slots, reward });
    expect(s.attempts.length).toBeGreaterThan(attemptsBefore);

    s = winBattle(s);
    expect(s.expedition!.slots[1]!.status).toBe('won');
    expect(s.expedition!.retreated).toBe(false);
  });

  it('abandoning grants no reward and keeps the collection', () => {
    let s = fullExpedition(fresh());
    const owned = s.souvenirIds;
    s = step(step(s, { type: 'start' }), { type: 'abandon' });
    expect(s.expedition).toBeNull();
    expect(s.souvenirIds).toEqual(owned);
    expect(s.completedExpeditions).toBe(1);
  });
});

describe('question selection', () => {
  it('never repeats within an expedition while the pool allows', () => {
    let s = discover(step(fresh(), { type: 'start' }));
    for (let i = 0; i < 3; i++) s = winBattle(s);
    const asked = s.expedition!.askedQuestionIds;
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('spaces variants of an objective by two questions when possible', () => {
    const rng = new Rng(3);
    const asked: string[] = [];
    for (let i = 0; i < 15; i++) asked.push(pickQuestion(PACK.questions, { asked, recent: [], locationId: 'spain' }, rng).id);
    const objectives = asked.map((id) => PACK.questions.find((q) => q.id === id)!.objectiveId);
    objectives.forEach((o, i) => {
      if (i > 0) expect(objectives[i - 1]).not.toBe(o);
      if (i > 1) expect(objectives[i - 2]).not.toBe(o);
    });
  });

  it('falls back to tracked repeats instead of failing on a small pool', () => {
    const pool = PACK.questions.slice(0, 1);
    const q = pickQuestion(pool, { asked: [pool[0]!.id], recent: [], locationId: 'spain' }, new Rng(1));
    expect(q).toBe(pool[0]);
  });

  it('keeps the accepted answer through option shuffling', () => {
    const s = (() => {
      let x = discover(step(fresh(11), { type: 'start' }));
      x = step(x, { type: 'enterEncounter' });
      return step(x, { type: 'chooseAction', action: 'attack' });
    })();
    const q = s.expedition!.battle!.question;
    const original = PACK.questions.find((o) => o.id === q.id)!;
    const label = (qq: typeof q) => qq.options.find((o) => o.id === qq.acceptedId)!.label;
    expect(label(q)).toBe(label(original));
    const next = step(s, { type: 'answer', optionId: q.acceptedId });
    expect(next.expedition!.battle!.result!.correct).toBe(true);
  });
});
