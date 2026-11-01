import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { allowedDifficulties, DEFAULT_SETTINGS, reduce, newSave, isExpeditionComplete, type Command, type SaveData } from './game';
import { STATES, usQuestions } from '../content/us/templates';
import { validatePack, validateStates } from '../content/validate';
import { EUROPE_VIEW, usMap, worldMap, clampView } from '../content/maps';
import { pickQuestion } from './questions';
import { Rng } from './rng';

const NOW = 1_800_000_000_000;
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PACK, NOW);
const START: Command = { type: 'start', regionId: 'europe', difficulty: 'scout' };
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
  let next = discover(step(s, START));
  for (let i = 0; i < 3; i++) next = winBattle(next);
  return step(next, { type: 'claimReward' });
}

describe('content', () => {
  it('the pack is valid', () => expect(validatePack(PACK)).toEqual([]));
  it('the state records are consistent', () => expect(validateStates(STATES)).toEqual([]));

  it('generates 13 Western states at all three difficulties', () => {
    expect(STATES).toHaveLength(13);
    expect(new Set(usQuestions.map((q) => q.difficulty))).toEqual(new Set(['scout', 'ranger', 'expert']));
  });

  it('Ranger and Expert capital questions offer only cities in the named state', () => {
    for (const s of STATES) {
      const own = new Set([s.capital, ...s.sameStateCities]);
      const qs = usQuestions.filter((q) => q.locationId === s.id && q.difficulty !== 'scout' && q.id.includes('capital') && q.inputType === 'choice' && !q.prompt.startsWith('In which'));
      expect(qs.length, s.id).toBeGreaterThan(0);
      for (const q of qs) expect(q.options.every((o) => own.has(o.label)), q.id).toBe(true);
    }
  });

  it('California on Ranger matches the example from the owner', () => {
    const q = usQuestions.find((o) => o.id === 'q-capital-california-ranger-1')!;
    expect(q.options.map((o) => o.label).sort()).toEqual(['Los Angeles', 'Sacramento', 'San Diego', 'San Francisco']);
  });

  it('never calls a nickname official, and never offers a second nickname of the answer', () => {
    for (const q of usQuestions) expect(`${q.prompt} ${q.explanation}`.toLowerCase()).not.toContain('official');
    for (const s of STATES) expect(usQuestions.filter((q) => q.objectiveId === `nickname-${s.id}`).length).toBeGreaterThan(0);
  });

  it('every state has a map shape, and its marker lands inside it', () => {
    for (const s of STATES) {
      const shape = usMap.features.find((f) => f.id === s.fips);
      expect(shape?.d, s.name).toBeTruthy();
      expect(usMap.project(s.lonLat), s.name).not.toEqual([0, 0]);
    }
    expect(usMap.features).toHaveLength(50);
  });

  it('frames all 50 states on the US map', () => {
    const coordinates = usMap.features.flatMap((f) => (f.d.match(/-?[\d.]+,-?[\d.]+/g) ?? []).map((pair) => pair.split(',').map(Number) as [number, number]));
    const xs = coordinates.map((c) => c[0]);
    const ys = coordinates.map((c) => c[1]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(usMap.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(usMap.height);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(usMap.width * 0.8);
    for (const s of STATES) {
      const [x, y] = usMap.project(s.lonLat);
      expect(x, s.name).toBeGreaterThan(0);
      expect(x, s.name).toBeLessThan(usMap.width);
      expect(y, s.name).toBeGreaterThan(0);
      expect(y, s.name).toBeLessThan(usMap.height);
    }
  });
});

describe('map', () => {
  it('shows every playable place, with margin, in the Europe view', () => {
    const v = clampView(EUROPE_VIEW, worldMap);
    const h = (v.w * worldMap.height) / worldMap.width;
    for (const p of PACK.places.filter((o) => o.regionId === 'europe')) {
      const [x, y] = worldMap.project(p.lonLat);
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
    s = discover(step(s, START));
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
    let s = discover(step(fresh(), START));
    s = step(s, { type: 'enterEncounter' });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('idempotency', () => {
  const inQuestion = () => {
    let s = discover(step(fresh(), START));
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
    let s = discover(step(fresh(), START));
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
  const started = () => step(fresh(), START);
  const wrongId = (s: SaveData) => s.expedition!.candidateIds.find((id) => id !== s.expedition!.targetId)!;

  it('always includes the target among four distinct candidates', () => {
    for (let seed = 1; seed < 40; seed++) {
      const e = step(fresh(seed), START).expedition!;
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
    let s = discover(step(fresh(), START));
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
    s = step(step(s, START), { type: 'abandon' });
    expect(s.expedition).toBeNull();
    expect(s.souvenirIds).toEqual(owned);
    expect(s.completedExpeditions).toBe(1);
  });
});

describe('difficulty', () => {
  const west = (difficulty: 'scout' | 'ranger' | 'expert', seed = 3) => {
    let s = step(fresh(seed), { type: 'start', regionId: 'us-west', difficulty });
    s = discover(s);
    return step(s, { type: 'enterEncounter' });
  };

  it.each(['scout', 'ranger', 'expert'] as const)('%s trails ask %s questions', (difficulty) => {
    const s = west(difficulty);
    expect(s.expedition!.difficulty).toBe(difficulty);
    expect(s.expedition!.battle!.question.difficulty).toBe(difficulty);
  });

  it('records the difficulty on each answer', () => {
    const s = playTurn(west('ranger'), true);
    expect(s.attempts.at(-1)).toMatchObject({ context: 'battle', difficulty: 'ranger' });
  });

  it('a map-click answer is accepted by state id', () => {
    let s = west('expert');
    while (s.expedition!.battle!.question.inputType !== 'map-click') s = playTurn(s, true);
    s = step(s, { type: 'chooseAction', action: 'attack' });
    const q = s.expedition!.battle!.question;
    expect(step(s, { type: 'answer', optionId: q.acceptedId }).expedition!.battle!.result!.correct).toBe(true);
  });

  it('parent limits restrict what a trail can use', () => {
    const region = PACK.regions.find((r) => r.id === 'us-west')!;
    const settings = { ...DEFAULT_SETTINGS, minDifficulty: 'ranger' as const, maxDifficulty: 'ranger' as const };
    expect(allowedDifficulties(settings, region)).toEqual(['ranger']);
    let s = fresh();
    s = step(s, { type: 'updateSettings', patch: settings });
    s = step(s, { type: 'start', regionId: 'us-west', difficulty: 'expert' });
    expect(s.expedition!.difficulty).toBe('ranger');
  });

  it('a region with one tier stays playable under any limits', () => {
    const region = PACK.regions.find((r) => r.id === 'europe')!;
    expect(allowedDifficulties({ ...DEFAULT_SETTINGS, minDifficulty: 'expert' }, region)).toEqual(['scout']);
  });

  it('harder trails offer nearby candidates', () => {
    const e = step(fresh(9), { type: 'start', regionId: 'us-west', difficulty: 'ranger' }).expedition!;
    const target = PACK.places.find((p) => p.id === e.targetId)!;
    const others = PACK.places.filter((p) => p.regionId === 'us-west' && p.id !== target.id);
    const dist = (id: string) => { const p = PACK.places.find((o) => o.id === id)!; return Math.hypot(p.lonLat[0] - target.lonLat[0], p.lonLat[1] - target.lonLat[1]); };
    const nearest = others.map((p) => dist(p.id)).sort((a, b) => a - b).slice(0, 3);
    const chosen = e.candidateIds.filter((id) => id !== target.id).map(dist).sort((a, b) => a - b);
    expect(chosen).toEqual(nearest);
  });
});

describe('combat in the game', () => {
  it('Special is refused until charged', () => {
    let s = discover(step(fresh(), START));
    s = step(s, { type: 'enterEncounter' });
    expect(step(s, { type: 'chooseAction', action: 'special' })).toBe(s);
    s = playTurn(s, true);
    s = playTurn(s, true);
    expect(step(s, { type: 'chooseAction', action: 'special' }).expedition!.battle!.action).toBe('special');
  });
});

describe('question selection', () => {
  const europe = PACK.questions.filter((q) => q.regionId === 'europe');
  it('never repeats within an expedition while the pool allows', () => {
    let s = discover(step(fresh(), START));
    for (let i = 0; i < 3; i++) s = winBattle(s);
    const asked = s.expedition!.askedQuestionIds;
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('spaces variants of an objective by two questions when possible', () => {
    const rng = new Rng(3);
    const asked: string[] = [];
    for (let i = 0; i < 15; i++) asked.push(pickQuestion(europe, { asked, recent: [], locationId: 'spain' }, rng).id);
    const objectives = asked.map((id) => PACK.questions.find((q) => q.id === id)!.objectiveId);
    objectives.forEach((o, i) => {
      if (i > 0) expect(objectives[i - 1]).not.toBe(o);
      if (i > 1) expect(objectives[i - 2]).not.toBe(o);
    });
  });

  it('falls back to tracked repeats instead of failing on a small pool', () => {
    const pool = europe.slice(0, 1);
    const q = pickQuestion(pool, { asked: [pool[0]!.id], recent: [], locationId: 'spain' }, new Rng(1));
    expect(q).toBe(pool[0]);
  });

  it('keeps the accepted answer through option shuffling', () => {
    const s = (() => {
      let x = discover(step(fresh(11), START));
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
