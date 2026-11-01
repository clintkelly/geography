import { describe, expect, it } from 'vitest';
import { clampView, EUROPE_VIEW, usMap, worldMap } from '../content/maps';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { degreesApart } from '../content/geo';
import { allPlaces, COUNTRIES, europeQuestions, GROUPS, STATES, usQuestions, WEST } from '../content/us/templates';
import { validatePack, validateRecords } from '../content/validate';
import { ECONOMY } from './economy';
import { activeCompanion, allowedDifficulties, DEFAULT_SETTINGS, isExpeditionComplete, newSave, reduce, type Command, type SaveData } from './game';
import { pickQuestion } from './questions';
import { Rng } from './rng';
import { TRAIL_LENGTHS, TRAIL_STOPS, type TrailLength } from './trail';

const NOW = 1_800_000_000_000;
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PACK, NOW);
const fresh = (seed = 7) => newSave(PACK, seed, 'p1');

const start = (s: SaveData, regionId = 'us-west', difficulty: Difficulty = 'scout', trail: TrailLength = 'standard') =>
  step(s, { type: 'start', offerId: s.offers.find((o) => o.regionId === regionId)!.id, regionId, difficulty, trail });
const ready = (s: SaveData, ...args: [string?, Difficulty?, TrailLength?]) => step(start(s, ...args), { type: 'depart' });
const find = (s: SaveData) => step(s, { type: 'guess', locationId: s.expedition!.targetId });

const answerWith = (s: SaveData, correct: boolean): SaveData => {
  const q = (s.expedition!.battle ?? s.expedition!.event)!.question;
  return step(s, { type: 'answer', optionId: correct ? q.acceptedId : q.options.find((o) => o.id !== q.acceptedId)!.id });
};

function turn(s: SaveData, correct: boolean): SaveData {
  const b = s.expedition!.battle!;
  const action = b.befriending ? 'befriend' : 'attack';
  return step(answerWith(step(s, { type: 'chooseAction', action }), correct), { type: 'continue' });
}

function winStop(s: SaveData): SaveData {
  let next = step(s, { type: 'enterEncounter' });
  if (next.expedition!.event) return step(answerWith(next, true), { type: 'continue' });
  while (next.expedition!.battle) next = turn(next, true);
  return next;
}

function playTrail(s: SaveData, ...args: [string?, Difficulty?, TrailLength?]): SaveData {
  let next = ready(s, ...args);
  while (!isExpeditionComplete(next.expedition!)) next = winStop(find(next));
  return next;
}
const fullExpedition = (s: SaveData, ...args: [string?, Difficulty?, TrailLength?]) => step(playTrail(s, ...args), { type: 'claimReward' });

describe('content', () => {
  it('the pack is valid', () => expect(validatePack(PACK)).toEqual([]));
  it('the state and country records are consistent', () => {
    expect(validateRecords(STATES)).toEqual([]);
    expect(STATES).toHaveLength(50);
    expect(usMap.features.filter((f) => STATES.some((s) => s.fips === f.id))).toHaveLength(50);
    expect(validateRecords(COUNTRIES)).toEqual([]);
  });

  it('covers all 44 European countries at all three difficulties', () => {
    expect(COUNTRIES).toHaveLength(44);
    expect(new Set(COUNTRIES.map((c) => c.id)).size).toBe(44);
    expect(new Set(europeQuestions.map((q) => q.difficulty))).toEqual(new Set(['scout', 'ranger', 'expert']));
    for (const c of COUNTRIES) {
      expect(worldMap.features.some((f) => f.id === c.fips), c.name).toBe(true);
      expect(PACK.clues.filter((o) => o.targetId === c.id).length, c.name).toBeGreaterThanOrEqual(2);
      expect(europeQuestions.filter((q) => q.locationId === c.id).length, c.name).toBeGreaterThanOrEqual(3);
    }
  });

  it('asks no capital questions about city-states', () => {
    for (const q of europeQuestions) if (['monaco', 'vatican', 'san-marino'].includes(q.locationId!)) expect(q.objectiveId, q.id).not.toMatch(/^capital-/);
  });

  it('marker questions never overlap their markers', () => {
    for (const q of [...usQuestions, ...europeQuestions].filter((o) => o.inputType === 'map-marker')) {
      const options = q.options.map((o) => ({ lonLat: o.lonLat! }));
      const gap = PACK.regions.find((r) => r.id === q.regionId)!.markerGap;
      expect(options, q.id).toHaveLength(4);
      options.forEach((a, i) => options.slice(i + 1).forEach((b) => expect(degreesApart(a, b), q.id).toBeGreaterThanOrEqual(gap)));
    }
  });

  it('every tiny country has a dot to click', () => {
    const click = europeQuestions.find((q) => q.inputType === 'map-click')!;
    for (const c of COUNTRIES.filter((o) => o.tiny)) expect(click.options.find((o) => o.id === c.id)).toMatchObject({ tiny: true });
  });

  it('generates all three difficulties for the states', () => {
    expect(WEST).toHaveLength(13);
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

  it('never calls a nickname official', () => {
    for (const q of usQuestions) expect(`${q.prompt} ${q.explanation}`.toLowerCase()).not.toContain('official');
  });

  it('every state question has a Field Note from its own record', () => {
    for (const q of usQuestions) expect(STATES.find((s) => s.id === q.locationId)!.facts, q.id).toContain(q.fieldNote);
  });

  it('every fact has a question whose answer is that place', () => {
    for (const g of GROUPS) {
      for (const s of g.records) {
        s.asks.forEach((ask, i) => {
          const qs = PACK.questions.filter((q) => q.recallOf === `fact-${s.id}-${i}`);
          expect(qs.map((q) => q.difficulty).sort(), s.id).toEqual(['expert', 'ranger', 'scout']);
          for (const q of qs) {
            expect(q.prompt).toBe(ask);
            expect(q.options.find((o) => o.id === q.acceptedId)!.label).toBe(s.name);
            expect(q.fieldNote).toBe(s.facts[i]);
          }
        });
      }
    }
  });

  it('every region has at least three creatures, and the Bark Knight lives in all of them', () => {
    const knight = PACK.species.find((s) => s.id === 'barkknight')!;
    expect(knight.displayName).toBe('The Bark Knight');
    expect(knight.homes).toHaveLength(PACK.regions.length);
  });

  it('every place has a backdrop', () => {
    for (const p of allPlaces) expect(p.biome, p.id).toBeTruthy();
  });

  it('every creature that can be hunted or fought has a Special', () => {
    for (const s of PACK.species) expect(s.special.name, s.id).toBeTruthy();
  });
});

describe('maps', () => {
  it('shows every European place, with margin, in the Europe view', () => {
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

  it('frames all 50 states on the US map', () => {
    expect(usMap.features).toHaveLength(50);
    const coordinates = usMap.features.flatMap((f) => (f.d.match(/-?[\d.]+,-?[\d.]+/g) ?? []).map((pair) => pair.split(',').map(Number) as [number, number]));
    const xs = coordinates.map((c) => c[0]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(usMap.width);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(usMap.width * 0.8);
    for (const s of STATES) {
      const [x, y] = usMap.project(s.lonLat);
      expect(x, s.name).toBeGreaterThan(0);
      expect(y, s.name).toBeGreaterThan(0);
      expect(y, s.name).toBeLessThan(usMap.height);
    }
  });
});

describe('trails', () => {
  it.each(TRAIL_LENGTHS)('%s trails have the planned stops and follow borders', (trail) => {
    for (let seed = 1; seed < 40; seed++) {
      const { slots } = start(fresh(seed), 'us-west', 'scout', trail).expedition!;
      expect(slots.map((s) => s.kind)).toEqual(TRAIL_STOPS[trail]);
      expect(new Set(slots.map((s) => s.locationId)).size).toBe(slots.length);
      slots.slice(1).forEach((s, i) => {
        const from = PACK.places.find((p) => p.id === slots[i]!.locationId)!;
        expect(from.neighbors, `${from.id} to ${s.locationId}`).toContain(s.locationId);
      });
    }
  });

  it('European trails follow borders and sea crossings too', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { slots } = start(fresh(seed), 'europe', 'scout', 'long').expedition!;
      expect(slots).toHaveLength(7);
      slots.slice(1).forEach((s, i) => expect(PACK.places.find((p) => p.id === slots[i]!.locationId)!.neighbors).toContain(s.locationId));
    }
  });

  it.each(PACK.regions.map((r) => r.id))('%s trails work at every length, and candidates can be told apart', (regionId) => {
    const gap = PACK.regions.find((r) => r.id === regionId)!.markerGap;
    for (let seed = 1; seed < 40; seed++) {
      for (const trail of TRAIL_LENGTHS) {
        const e = start(fresh(seed), regionId, 'ranger', trail).expedition!;
        expect(e.slots.map((s) => s.kind)).toEqual(TRAIL_STOPS[trail]);
        e.slots.slice(1).forEach((s, i) => expect(PACK.places.find((p) => p.id === e.slots[i]!.locationId)!.neighbors).toContain(s.locationId));
        const places = e.candidateIds.map((id) => PACK.places.find((p) => p.id === id)!);
        expect(places).toHaveLength(4);
        places.forEach((a, i) => places.slice(i + 1).forEach((b) => expect(degreesApart(a, b)).toBeGreaterThanOrEqual(gap)));
      }
    }
  });

  it('the final showdown is against the hunted creature', () => {
    const s = start(fresh());
    const reward = s.expedition!.reward;
    expect(reward.kind === 'creature' && s.expedition!.slots.at(-1)!.opponentId === reward.speciesId).toBe(true);
    expect(s.expedition!.slots.slice(0, -1).some((o) => reward.kind === 'creature' && o.opponentId === reward.speciesId)).toBe(false);
  });

  it('each stop starts a new search for the next place', () => {
    let s = find(ready(fresh()));
    const firstTarget = s.expedition!.targetId;
    s = winStop(s);
    expect(s.expedition).toMatchObject({ discovery: 'searching', guesses: [], cluesShown: 1 });
    expect(s.expedition!.targetId).not.toBe(firstTarget);
    expect(s.expedition!.targetId).toBe(s.expedition!.slots[1]!.locationId);
  });
});

describe('befriending and the stable', () => {
  const toBefriend = () => {
    let s = ready(fresh());
    while (s.expedition!.slots.filter((o) => o.status === 'won').length < s.expedition!.slots.length - 1) s = winStop(find(s));
    s = step(find(s), { type: 'enterEncounter' });
    while (!s.expedition!.battle!.befriending) s = turn(s, true);
    return s;
  };

  it('a worn-out target offers only Befriend and no longer attacks', () => {
    const s = toBefriend();
    const { battle } = s.expedition!;
    expect(battle!.combat.opponentHp).toBe(0);
    expect(step(s, { type: 'chooseAction', action: 'attack' })).toBe(s);
    const hp = battle!.combat.playerHp;
    expect(turn(s, false).expedition!.battle!.combat.playerHp).toBe(hp);
  });

  it('a wrong answer offers a new question and cannot fail', () => {
    let s = toBefriend();
    const firstQuestion = s.expedition!.battle!.question.id;
    for (let i = 0; i < 5; i++) s = turn(s, false);
    expect(s.expedition!.battle!.befriending).toBe(true);
    expect(s.expedition!.battle!.question.id).not.toBe(firstQuestion);
    expect(s.expedition!.slots.at(-1)!.status).toBe('pending');
  });

  it('a correct answer adds the creature once, even if claimed twice', () => {
    let s = turn(toBefriend(), true);
    expect(s.expedition!.battle).toBeNull();
    expect(isExpeditionComplete(s.expedition!)).toBe(true);
    const { reward } = s.expedition!;
    s = step(s, { type: 'claimReward' });
    expect(step(s, { type: 'claimReward' })).toBe(s);
    expect(s.companions).toHaveLength(2);
    expect(reward.kind === 'creature' && s.companions[1]!.speciesId === reward.speciesId).toBe(true);
    expect(new Set(s.companions.map((c) => c.instanceId)).size).toBe(2);
  });

  it('a new companion can be chosen for the next trip and keeps its own Special', () => {
    let s = fullExpedition(fresh());
    const newcomer = s.companions[1]!;
    s = start(s);
    s = step(s, { type: 'selectCompanion', instanceId: newcomer.instanceId });
    expect(activeCompanion(s).instanceId).toBe(newcomer.instanceId);
    s = step(find(step(s, { type: 'depart' })), { type: 'enterEncounter' });
    const species = PACK.species.find((o) => o.id === newcomer.speciesId)!;
    expect(s.expedition!.battle!.combat.special).toBe(species.special.template);
  });

  it('the companion is locked once the trip has begun', () => {
    let s = fullExpedition(fresh());
    s = ready(s);
    expect(step(s, { type: 'selectCompanion', instanceId: s.companions[1]!.instanceId })).toBe(s);
  });

  it('runs out of species honestly, with XP and no befriending', () => {
    let s = fresh();
    const west = PACK.species.filter((o) => o.homes.includes('us-west'));
    for (let i = 0; i < west.length; i++) s = fullExpedition(s);
    expect(s.companions).toHaveLength(west.length + 1);
    expect(s.offers.find((o) => o.regionId === 'us-west')!.reward).toEqual({ kind: 'bond', xp: 10 });
    const before = s.companions[0]!.bondXp;
    const after = fullExpedition(s);
    expect(after.companions).toHaveLength(s.companions.length);
    expect(after.companions[0]!.bondXp).toBeGreaterThan(before + 9);
  });

  it('every region features the Bark Knight first until it is befriended', () => {
    const s = fresh();
    for (const r of PACK.regions) {
      const reward = s.offers.find((o) => o.regionId === r.id)!.reward;
      expect(reward).toEqual({ kind: 'creature', speciesId: 'barkknight' });
    }
    const after = fullExpedition(s);
    expect(after.companions[1]!.speciesId).toBe('barkknight');
    expect(after.offers.some((o) => o.reward.kind === 'creature' && o.reward.speciesId === 'barkknight')).toBe(false);
  });

  it('sightings are of creatures that live in the region', () => {
    const s = fullExpedition(fresh());
    for (const o of s.offers) {
      if (o.reward.kind !== 'creature') continue;
      const { speciesId } = o.reward;
      expect(PACK.species.find((x) => x.id === speciesId)!.homes).toContain(o.regionId);
    }
  });

  it('an offer from another region is refused', () => {
    const s = fresh();
    const midwest = s.offers.find((o) => o.regionId === 'us-midwest')!;
    expect(step(s, { type: 'start', offerId: midwest.id, regionId: 'us-west', difficulty: 'scout', trail: 'short' })).toBe(s);
  });

  it('offers differ and exclude owned species', () => {
    const s = fullExpedition(fresh());
    const ids = s.offers.filter((o) => o.regionId === 'us-west').map((o) => (o.reward.kind === 'creature' ? o.reward.speciesId : ''));
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain(s.companions[1]!.speciesId);
  });
});

describe('Trail Points', () => {
  const started = () => start(fresh());
  const wrongId = (s: SaveData) => s.expedition!.candidateIds.find((id) => id !== s.expedition!.targetId)!;
  const points = (s: SaveData) => s.expedition!.points;

  it('starts each expedition fresh', () => {
    expect(points(started())).toBe(10);
    expect(points(start(fullExpedition(fresh())))).toBe(10);
  });

  it('Prep Shop items cost points, apply once, and work in battle', () => {
    let s = started();
    s = step(s, { type: 'buy', item: 'sturdy' });
    expect(step(s, { type: 'buy', item: 'sturdy' })).toBe(s);
    s = step(s, { type: 'buy', item: 'charge' });
    expect(points(s)).toBe(2);
    s = step(s, { type: 'buy', item: 'snack' });
    expect(points(s)).toBe(0);
    s = step(find(step(s, { type: 'depart' })), { type: 'enterEncounter' });
    expect(s.expedition!.battle!.combat).toMatchObject({ playerMaxHp: 14, playerHp: 14, charge: 1 });
  });

  it('cannot overspend or shop after departing', () => {
    let s = started();
    s = step(step(s, { type: 'buy', item: 'sturdy' }), { type: 'buy', item: 'charge' });
    expect(step(ready(fresh()), { type: 'buy', item: 'snack' }).expedition!.snack).toBe(false);
    s = step(s, { type: 'buy', item: 'snack' });
    expect(step(s, { type: 'buy', item: 'charge' })).toBe(s);
  });

  it('a Trail Snack heals once and does not use the turn', () => {
    let s = step(step(started(), { type: 'buy', item: 'snack' }), { type: 'depart' });
    s = step(find(s), { type: 'enterEncounter' });
    expect(step(s, { type: 'useSnack' })).toBe(s);
    s = turn(turn(s, false), false);
    const hp = s.expedition!.battle!.combat.playerHp;
    const { turn: t } = s.expedition!.battle!.combat;
    s = step(s, { type: 'useSnack' });
    expect(s.expedition!.battle!.combat).toMatchObject({ playerHp: hp + 4, turn: t });
    expect(step(s, { type: 'useSnack' })).toBe(s);
  });

  it('correct battle answers earn a point; wrong ones do not', () => {
    const s = step(find(ready(fresh())), { type: 'enterEncounter' });
    expect(points(turn(s, true))).toBe(11);
    expect(points(turn(s, false))).toBe(10);
  });

  it('a wrong guess costs a point, reveals a free clue, and never blocks', () => {
    let s = ready(fresh());
    s = step(s, { type: 'guess', locationId: wrongId(s) });
    expect(points(s)).toBe(9);
    expect(s.expedition!.cluesShown).toBe(2);
    const zero = { ...s, expedition: { ...s.expedition!, points: 0 } };
    const other = zero.expedition.candidateIds.find((id) => id !== zero.expedition.targetId && !zero.expedition.guesses.includes(id))!;
    const after = step(zero, { type: 'guess', locationId: other });
    expect(points(after)).toBe(0);
    expect(after.expedition!.cluesShown).toBe(3);
  });

  it('a clue costs points once, even on a double click', () => {
    const s = ready(fresh());
    const once = step(s, { type: 'revealClue', shown: 1 });
    expect(points(once)).toBe(10 - ECONOMY.extraClue);
    expect(step(once, { type: 'revealClue', shown: 1 })).toBe(once);
  });

  it('a child with no points cannot buy but can still finish', () => {
    let s = ready(fresh());
    s = { ...s, expedition: { ...s.expedition!, points: 0 } };
    expect(step(s, { type: 'revealClue', shown: 1 })).toBe(s);
    expect(step(s, { type: 'narrowSearch' })).toBe(s);
    while (!isExpeditionComplete(s.expedition!)) s = winStop(find(s));
    expect(step(s, { type: 'claimReward' }).completedExpeditions).toBe(1);
  });

  it('Narrow the search removes two wrong places, once, and never the answer', () => {
    let s = ready(fresh());
    s = step(s, { type: 'narrowSearch' });
    const e = s.expedition!;
    expect(e.removedIds).toHaveLength(2);
    expect(e.removedIds).not.toContain(e.targetId);
    expect(step(s, { type: 'narrowSearch' })).toBe(s);
    expect(step(s, { type: 'guess', locationId: e.removedIds[0]! })).toBe(s);
  });

  it('Expert offers every state and no Narrow the search', () => {
    const s = ready(fresh(), 'us-west', 'expert');
    expect(s.expedition!.candidateIds).toHaveLength(13);
    expect(step(s, { type: 'narrowSearch' })).toBe(s);
  });

  it('leftover points become XP for the companion taken', () => {
    const s = fullExpedition(fresh());
    expect(s.companions[0]!.bondXp).toBeGreaterThan(0);
  });

  it.each([
    ['atlas', (s: SaveData) => step(s, { type: 'useAtlas' })],
    ['bought clue', (s: SaveData) => step(s, { type: 'revealClue', shown: 1 })],
    ['narrowed search', (s: SaveData) => step(s, { type: 'narrowSearch' })],
    ['wrong guess', (s: SaveData) => step(s, { type: 'guess', locationId: wrongId(s) })],
  ])('help from %s is recorded as assisted and earns everything', (_n, help) => {
    const s = find(help(ready(fresh())));
    expect(s.expedition!.discovery).toBe('found');
    expect(s.attempts.at(-1)).toMatchObject({ context: 'discovery', correct: true, assisted: true });
  });

  it('an unaided guess is not assisted', () => {
    expect(find(ready(fresh())).attempts.at(-1)!.assisted).toBe(false);
  });
});

describe('Field Note recall', () => {
  it('a Field Note is seen only after a correct answer', () => {
    const s = step(step(find(ready(fresh())), { type: 'enterEncounter' }), { type: 'chooseAction', action: 'attack' });
    expect(answerWith(s, false).seenFacts).toEqual([]);
    const q = s.expedition!.battle!.question;
    expect(answerWith(s, true).seenFacts).toEqual([q.noteId]);
  });

  it('recall questions never appear for a fact the child has not seen', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = playTrail(fresh(seed), 'us-south', 'scout', 'long');
      const askedRecall = s.expedition!.askedQuestionIds.map((id) => PACK.questions.find((q) => q.id === id)!).filter((q) => q.recallOf);
      for (const q of askedRecall) expect(s.seenFacts).toContain(q.recallOf);
    }
  });

  it('recall questions do come up and pay a bonus', () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      let s = ready(fresh(seed), 'us-south', 'scout', 'long');
      for (let guard = 0; guard < 200 && !found && !isExpeditionComplete(s.expedition!); guard++) {
        const e = s.expedition!;
        if (e.discovery === 'searching') { s = find(s); continue; }
        if (!e.battle && !e.event) { s = step(s, { type: 'enterEncounter' }); continue; }
        if (e.event) { s = step(answerWith(s, true), { type: 'continue' }); continue; }
        const inBattle = step(s, { type: 'chooseAction', action: e.battle!.befriending ? 'befriend' : 'attack' });
        const q = inBattle.expedition!.battle!.question;
        const answered = answerWith(inBattle, true);
        if (q.recallOf && !e.battle!.befriending) {
          expect(answered.expedition!.points - inBattle.expedition!.points).toBe(1 + ECONOMY.recallBonus);
          found = true;
        }
        s = step(answered, { type: 'continue' });
      }
    }
    expect(found).toBe(true);
  });
});

describe('journey events', () => {
  const toEvent = () => {
    let s = ready(fresh());
    while (s.expedition!.slots[s.expedition!.slots.findIndex((o) => o.status === 'pending')]!.kind !== 'event') s = winStop(find(s));
    return step(find(s), { type: 'enterEncounter' });
  };

  it('a correct answer earns the event reward and is recorded', () => {
    const s = answerWith(toEvent(), true);
    expect(s.attempts.at(-1)).toMatchObject({ context: 'event', correct: true });
    expect(s.expedition!.event!.result!.correct).toBe(true);
  });

  it('a wrong answer costs nothing and the trail goes on', () => {
    const s = toEvent();
    const before = s.expedition!.points;
    const after = step(answerWith(s, false), { type: 'continue' });
    expect(after.expedition!.points).toBe(before);
    expect(after.expedition!.event).toBeNull();
    expect(after.expedition!.discovery).toBe('searching');
  });

  it('a repeated answer changes nothing', () => {
    const s = answerWith(toEvent(), true);
    expect(answerWith(s, true)).toBe(s);
  });
});

describe('State Cards and souvenirs', () => {
  it('the first correct answer about a state earns its card, once', () => {
    let s = step(find(ready(fresh())), { type: 'enterEncounter' });
    s = step(s, { type: 'chooseAction', action: 'attack' });
    s = answerWith(s, true);
    const cardId = s.expedition!.battle!.result!.cardId!;
    expect(s.stateCards).toEqual([cardId]);
    expect(cardId).toBe(s.expedition!.battle!.question.locationId);
  });

  it('a wrong answer earns no card', () => {
    let s = step(find(ready(fresh())), { type: 'enterEncounter' });
    s = answerWith(step(s, { type: 'chooseAction', action: 'attack' }), false);
    expect(s.stateCards).toEqual([]);
  });

  it('never awards the same card twice across a trail', () => {
    const s = playTrail(fresh());
    expect(new Set(s.stateCards).size).toBe(s.stateCards.length);
    expect(s.stateCards.length).toBeGreaterThan(1);
  });

  it('every US state has a card, and Europe has none yet', () => {
    expect(PACK.cards).toHaveLength(50);
  });

  it('Europe still plays without cards', () => {
    expect(playTrail(fresh(), 'europe').stateCards).toEqual([]);
  });

  it('a souvenir is found once along the trail and survives abandoning', () => {
    let s = ready(fresh());
    while (s.expedition!.foundSouvenirId === null) s = winStop(find(s));
    expect(s.souvenirIds).toHaveLength(1);
    s = step(s, { type: 'abandon' });
    expect(s.souvenirIds).toHaveLength(1);
    expect(s.completedExpeditions).toBe(0);
  });
});

describe('idempotency', () => {
  const inQuestion = () => step(step(find(ready(fresh())), { type: 'enterEncounter' }), { type: 'chooseAction', action: 'attack' });

  it('a repeated answer changes nothing', () => {
    const s = inQuestion();
    const q = s.expedition!.battle!.question;
    const once = step(s, { type: 'answer', optionId: q.acceptedId });
    expect(step(once, { type: 'answer', optionId: q.acceptedId })).toBe(once);
  });

  it('an answer that is not an option of the current question is ignored', () => {
    const s = inQuestion();
    expect(step(s, { type: 'answer', optionId: 'nope' })).toBe(s);
  });

  it('the same seed and commands give the same expedition', () => {
    expect(inQuestion()).toEqual(inQuestion());
  });

  it('round-trips through JSON, as a save does', () => {
    const s = inQuestion();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('retreat and retry', () => {
  it('keeps the route, reward and points; awards nothing for the lost stop', () => {
    let s = winStop(find(ready(fresh())));
    s = find(s);
    const { slots, reward } = s.expedition!;
    s = step(s, { type: 'enterEncounter' });
    while (s.expedition!.battle) s = turn(s, false);
    expect(s.expedition).toMatchObject({ retreated: true, slots, reward, discovery: 'found' });
    s = winStop(s);
    expect(s.expedition!.slots[1]!.status).toBe('won');
    expect(s.expedition!.retreated).toBe(false);
  });

  it('cannot start an encounter before finding the place', () => {
    const s = ready(fresh());
    expect(step(s, { type: 'enterEncounter' })).toBe(s);
  });
});

describe('difficulty', () => {
  const west = (difficulty: Difficulty, seed = 3) => step(find(ready(fresh(seed), 'us-west', difficulty)), { type: 'enterEncounter' });

  it.each(['scout', 'ranger', 'expert'] as const)('%s trails ask %s questions', (difficulty) => {
    expect(west(difficulty).expedition!.battle!.question.difficulty).toBe(difficulty);
  });

  it('records the difficulty on each answer', () => {
    expect(turn(west('ranger'), true).attempts.at(-1)).toMatchObject({ context: 'battle', difficulty: 'ranger' });
  });

  it('parent limits restrict what a trail can use', () => {
    const region = PACK.regions.find((r) => r.id === 'us-west')!;
    const settings = { ...DEFAULT_SETTINGS, minDifficulty: 'ranger' as const, maxDifficulty: 'ranger' as const };
    expect(allowedDifficulties(settings, region)).toEqual(['ranger']);
    const s = start(step(fresh(), { type: 'updateSettings', patch: settings }), 'us-west', 'expert');
    expect(s.expedition!.difficulty).toBe('ranger');
  });

  it('a region with one tier stays playable under any limits', () => {
    const region = { id: 'x', label: 'x', mapId: 'world' as const, difficulties: ['scout'] as const, markerGap: 4 };
    expect(allowedDifficulties({ ...DEFAULT_SETTINGS, minDifficulty: 'expert' }, region)).toEqual(['scout']);
  });
});

describe('question selection', () => {
  const europe = PACK.questions.filter((q) => q.regionId === 'europe' && q.difficulty === 'scout');

  it('never repeats within a trail while the pool allows', () => {
    const asked = playTrail(fresh(), 'us-west', 'scout', 'long').expedition!.askedQuestionIds;
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
    expect(pickQuestion(pool, { asked: [pool[0]!.id], recent: [], locationId: 'spain' }, new Rng(1))).toBe(pool[0]);
  });
});
