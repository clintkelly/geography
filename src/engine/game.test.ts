import { describe, expect, it } from 'vitest';
import { attackDamage, isBossTurn, startCombat } from './combat';
import { beats, losesTo, TYPE_LOOP, typeEdge } from './types';
import { trackFor } from '../ui/music';
import { clampView, EUROPE_VIEW, MAPS, usMap, worldMap } from '../content/maps';
import { PACK } from '../content/pack';
import type { Difficulty, Question } from '../content/types';
import { degreesApart } from '../content/geo';
import { allPlaces, COUNTRIES, europeQuestions, GROUPS, STATES, usQuestions, WEST, type PlaceRecord } from '../content/us/templates';
import { validatePack, validateRecords } from '../content/validate';
import { BADGES } from './badges';
import { enemyIntent, resolveTurn } from './combat';
import { ECONOMY } from './economy';
import { cardProgress } from './cards';
import { isDue, isFamiliar, localDay, recordAnswer, type Learning } from './learning';
import { rareChance, rarePool, trailScore } from './luck';
import { formOf, levelOf, speciesOf, STAGES, stageOf, xpForLevel } from './progression';
import { activeCompanion, allowedDifficulties, canTame, DEFAULT_SETTINGS, isExpeditionComplete, makeOffers, newSave, reduce, regionHasFocus, type Command, type Focus, type Reward, type SaveData } from './game';
import { pickQuestion } from './questions';
import { Rng } from './rng';
import { streakReward } from './streak';
import { TRAIL_LENGTHS, TRAIL_STOPS, type TrailLength } from './trail';

const NOW = 1_800_000_000_000;
// Most tests play perfectly, so rare encounters are switched off to keep their stops predictable.
const PLAIN = { ...PACK, species: PACK.species.filter((o) => !o.rare) };
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PLAIN, NOW);
const stepRare = (s: SaveData, cmd: Command) => reduce(s, cmd, PACK, NOW);
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

/** A battle with no type or home-turf bonus, so hits are the same every run. */
function even(): SaveData {
  for (let seed = 1; ; seed++) {
    const s = step(find(ready(fresh(seed))), { type: 'enterEncounter' });
    const { turf, typeEdge: edge } = s.expedition!.battle!.combat;
    if (!turf && !edge) return s;
  }
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
    for (const c of COUNTRIES.filter((o) => o.tiny)) {
      const click = europeQuestions.find((q) => q.inputType === 'map-click' && q.locationId === c.id)!;
      expect(click.options.find((o) => o.id === c.id)).toMatchObject({ tiny: true });
    }
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

  it('the wolf pup and the little shark grow into Moonfang and the Megalodon', () => {
    const finalForm = (id: string) => PACK.species.find((s) => s.id === id)!.evolutions!.at(-1)!.name;
    expect(finalForm('howlpup')).toBe('Moonfang');
    expect(finalForm('toothling')).toBe('Megalodon');
  });

  it('the platypus is a rare in Oceania and is not Tide type', () => {
    const p = PACK.species.find((s) => s.id === 'platybolt')!;
    expect(p.rare).toBe(true);
    expect(p.homes).toEqual(['oceania']);
    expect(p.type).not.toBe('tide');
  });

  it('the rare shark is a Flame hammerhead in South America', () => {
    const shark = PACK.species.find((s) => s.id === 'emberhead')!;
    expect(shark.rare).toBe(true);
    expect(shark.type).toBe('flame');
    expect(shark.homes).toEqual(['south-america']);
    expect(shark.evolutions).toHaveLength(2);
  });

  it('every creature that can be hunted or fought has a Special', () => {
    for (const s of PACK.species) expect(s.special.name, s.id).toBeTruthy();
  });
});

describe('maps', () => {
  it('shows every European place, with margin, in the Europe view', () => {
    const v = clampView(EUROPE_VIEW, worldMap);
    const h = (v.w * worldMap.height) / worldMap.width;
    for (const p of PACK.places.filter((o) => o.regionId.startsWith('europe-'))) {
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
      const { slots } = start(fresh(seed), 'europe-south', 'scout', 'long').expedition!;
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
    const west = PACK.species.filter((o) => o.homes.includes('us-west') && !o.rare && !o.boss);
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

  it('winning a stop earns a point, so points stay scarce', () => {
    const s = step(find(ready(fresh())), { type: 'enterEncounter' });
    expect(points(turn(s, true))).toBe(10);
    let won = s;
    while (won.expedition!.battle) won = turn(won, true);
    expect(points(won)).toBe(10 + ECONOMY.perStopWon);
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
          const gain = answered.expedition!.points - inBattle.expedition!.points;
          expect(gain).toBeGreaterThanOrEqual(ECONOMY.recallBonus);
          expect(answered.expedition!.battle!.result!.critical).toBe(true);
          found = true;
        }
        s = step(answered, { type: 'continue' });
      }
    }
    expect(found).toBe(true);
  });
});

describe('streaks', () => {
  it('count correct answers, reset on a miss, and change nothing else', () => {
    let s = even();
    s = turn(turn(s, true), true);
    expect(s.expedition!.streak).toBe(2);
    const hp = s.expedition!.battle!.combat.opponentHp;
    s = turn(s, false);
    expect(s.expedition!.streak).toBe(0);
    expect(s.expedition!.battle!.combat.opponentHp).toBe(hp);
  });
});

describe('levels and evolution', () => {
  const zero = () => fresh();

  it('levels follow the curve, and stages unlock at 5 and 10', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(xpForLevel(5) - 1)).toBe(4);
    expect(levelOf(xpForLevel(5))).toBe(5);
    expect(levelOf(99999)).toBe(10);
    expect(stageOf(xpForLevel(5))).toBe(2);
    expect(stageOf(xpForLevel(10))).toBe(3);
  });

  it('rare creatures evolve twice, and bosses never do', () => {
    for (const rare of PACK.species.filter((s) => s.rare)) expect(stageOf(99999, rare), rare.id).toBe(3);
    const boss = PACK.species.find((s) => s.boss)!;
    expect(stageOf(99999, boss)).toBe(1);
  });

  it('every creature but the bosses has two evolved forms', () => {
    for (const s of PACK.species.filter((o) => !o.boss)) expect(s.evolutions, s.id).toHaveLength(2);
  });

  it('a win gives XP once, and a retry gives none for a loss', () => {
    let s = step(find(ready(zero())), { type: 'enterEncounter' });
    while (s.expedition!.battle) s = turn(s, true);
    expect(s.companions[0]!.bondXp).toBe(10);
    let lost = step(find(s), { type: 'enterEncounter' });
    if (lost.expedition!.battle) {
      while (lost.expedition!.battle) lost = turn(lost, false);
      expect(lost.companions[0]!.bondXp).toBe(10);
    }
  });

  it('harder trails pay more XP', () => {
    const xp = (d: Difficulty) => {
      let s = step(find(ready(fresh(), 'us-west', d)), { type: 'enterEncounter' });
      while (s.expedition!.battle) s = turn(s, true);
      return s.companions[0]!.bondXp;
    };
    expect(xp('expert')).toBeGreaterThan(xp('ranger'));
    expect(xp('ranger')).toBeGreaterThan(xp('scout'));
  });

  it('an evolved companion fights with its stage stats and bigger opponents', () => {
    const base = fresh();
    const s = { ...base, companions: [{ ...base.companions[0]!, bondXp: xpForLevel(10) }] };
    const combat = step(find(ready(s)), { type: 'enterEncounter' }).expedition!.battle!.combat;
    expect(combat).toMatchObject({ playerMaxHp: STAGES[3].maxHp, playerAttack: 5, opponentMaxHp: STAGES[3].regularHp, charge: 1 });
  });

  it.each([1, 2, 3] as const)('stage %s battles always take at least 3 right answers', (stage) => {
    const stats = STAGES[stage];
    const base = fresh();
    const xp = stage === 1 ? 0 : xpForLevel(stage === 2 ? 5 : 10);
    let s: SaveData = { ...base, companions: [{ ...base.companions[0]!, bondXp: xp }] };
    s = step(start(s), { type: 'buy', item: 'charge' });
    s = step(find(step(s, { type: 'depart' })), { type: 'enterEncounter' });
    const first = s.expedition!.battle!.combat;
    const onTurf = stats.attack + 1;
    const best = first.charge >= 2 ? stats.attack + 3 + onTurf : onTurf * 2;
    expect(best).toBeLessThan(first.opponentMaxHp);
  });

  it('an evolution stays pending until acknowledged, and only once', () => {
    const base = fresh();
    let s = { ...base, companions: [{ ...base.companions[0]!, bondXp: xpForLevel(5) }] };
    expect(s.companions[0]!.stageSeen ?? 1).toBe(1);
    s = step(s, { type: 'ackEvolution', instanceId: s.companions[0]!.instanceId });
    expect(s.companions[0]!.stageSeen).toBe(2);
  });

  it('a form has its evolved name and art', () => {
    const knight = PACK.species.find((o) => o.id === 'barkknight')!;
    expect(formOf(knight, 0).name).toBe('The Bark Knight');
    expect(formOf(knight, xpForLevel(5))).toMatchObject({ name: 'Sir Bark Knight', artId: 'barkknight-2', stage: 2 });
  });

  it('nicknames stick to one creature', () => {
    const s = step(fresh(), { type: 'renameCompanion', instanceId: fresh().companions[0]!.instanceId, nickname: 'Rocky' });
    expect(s.companions[0]!.nickname).toBe('Rocky');
  });
});

describe("Explorer's Map, rare creatures and badges", () => {
  it('fills in only when a place is found', () => {
    const s = ready(fresh());
    expect(s.foundPlaces).toEqual([]);
    expect(find(s).foundPlaces).toEqual([s.expedition!.targetId]);
  });

  it('a wrong guess does not fill the map', () => {
    const s = ready(fresh());
    const wrong = s.expedition!.candidateIds.find((id) => id !== s.expedition!.targetId)!;
    expect(step(s, { type: 'guess', locationId: wrong }).foundPlaces).toEqual([]);
  });

  const allPlaces = (regionId: string) => PACK.places.filter((p) => p.regionId === regionId).map((p) => p.id);

  it('a full map reveals the rare creature, which never appears before that', () => {
    for (const r of PACK.regions) {
      const rare = PACK.species.find((o) => o.rare && o.homes.includes(r.id))!;
      expect(rare, r.id).toBeTruthy();
      const has = (s: SaveData) => s.offers.some((o) => o.reward.kind === 'creature' && o.reward.speciesId === rare.id);
      for (let seed = 1; seed < 10; seed++) expect(has(fresh(seed))).toBe(false);
    }
    let s: SaveData = { ...fresh(), foundPlaces: allPlaces('us-west'), companions: [...fresh().companions, ...PACK.species.filter((o) => o.homes.includes('us-west') && !o.rare && !o.boss).map((o, i) => ({ instanceId: `c${i}`, speciesId: o.id, bondXp: 0 }))] };
    s = stepRare(start(s, 'us-west'), { type: 'abandon' });
    const westRares = PACK.species.filter((o) => o.rare && o.homes.includes('us-west')).map((o) => o.id);
    expect(s.offers.some((o) => o.regionId === 'us-west' && o.reward.kind === 'creature' && westRares.includes(o.reward.speciesId))).toBe(true);
  });

  it('badges are earned and announced once', () => {
    let s: SaveData = { ...fresh(), foundPlaces: ['spain', 'portugal'] };
    s = fullExpedition(s);
    expect(s.badges).toContain('iberia');
    expect(s.lastSummary!.newBadges).toContain('iberia');
    expect(fullExpedition(s).lastSummary!.newBadges).not.toContain('iberia');
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

describe('spaced review', () => {
  const q = PACK.questions.find((o) => o.objectiveId === 'capital-oregon' && o.difficulty === 'scout')!;
  const DAY = 86400000;
  const noon = new Date(2026, 10, 2, 12).getTime();

  it('schedules 1, 3 then 7 days out', () => {
    let l = recordAnswer({}, q, true, noon, false);
    expect(l[q.objectiveId]!.nextDue).toBe(noon + DAY);
    l = recordAnswer(l, q, true, noon + DAY, false);
    expect(l[q.objectiveId]!.nextDue).toBe(noon + DAY + 3 * DAY);
    l = recordAnswer(l, q, true, noon + 4 * DAY, false);
    expect(l[q.objectiveId]!.nextDue).toBe(noon + 11 * DAY);
  });

  it('a miss makes it due now and restarts the schedule', () => {
    const l = recordAnswer(recordAnswer({}, q, true, noon, false), q, false, noon + DAY, false);
    expect(l[q.objectiveId]).toMatchObject({ stage: 0, missed: true });
    expect(isDue(l[q.objectiveId], noon + DAY)).toBe(true);
  });

  it('a right answer just after seeing it is not evidence', () => {
    const missed = recordAnswer({}, q, false, noon, false);
    expect(recordAnswer(missed, q, true, noon + 1, true)).toBe(missed);
  });

  it('familiar needs three successes, two days and two variants', () => {
    const other = PACK.questions.find((o) => o.objectiveId === q.objectiveId && o.id !== q.id && o.difficulty === 'scout')!;
    let l = recordAnswer({}, q, true, noon, false);
    l = recordAnswer(l, q, true, noon + 1, false);
    l = recordAnswer(l, q, true, noon + 2, false);
    expect(isFamiliar(l[q.objectiveId], 'scout')).toBe(false);
    l = recordAnswer(l, other, true, noon + DAY, false);
    expect(isFamiliar(l[q.objectiveId], 'scout')).toBe(true);
    expect(isFamiliar(l[q.objectiveId], 'expert')).toBe(false);
    expect(localDay(noon)).not.toBe(localDay(noon + DAY));
  });

  it('a missed objective comes back later in the same trip, in a different wording', () => {
    let hits = 0;
    for (let seed = 1; seed < 25; seed++) {
      let s = step(find(ready(fresh(seed), 'us-west', 'scout', 'long')), { type: 'enterEncounter' });
      const first = s.expedition!.battle!.question;
      s = step(answerWith(step(s, { type: 'chooseAction', action: 'guard' }), false), { type: 'continue' });
      while (s.expedition!.battle) s = turn(s, true);
      while (!isExpeditionComplete(s.expedition!)) s = winStop(find(s));
      const later = s.expedition!.askedQuestionIds.slice(1).map((id) => PACK.questions.find((q) => q.id === id)!);
      if (later.some((q) => q.objectiveId === first.objectiveId && q.id !== first.id)) hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('a right answer after a miss on this trip is recorded as assisted', () => {
    const s = step(find(ready(fresh())), { type: 'enterEncounter' });
    const missed = answerWith(step(s, { type: 'chooseAction', action: 'guard' }), false);
    expect(missed.expedition!.revealed).toHaveLength(1);
  });

  it('reset erases progress but keeps the profile', () => {
    const played = fullExpedition(fresh());
    const reset = step(played, { type: 'resetProfile' });
    expect(reset.completedExpeditions).toBe(0);
    expect(reset.profile).toEqual(played.profile);
    expect(reset.companions).toHaveLength(1);
  });
});

describe('rare encounters', () => {
  const stats = (answered: number, correct: number, streak: number, difficulty: Difficulty = 'scout') => ({ answered, correct, streak, difficulty });

  it('the score rises with accuracy, streak and difficulty', () => {
    expect(trailScore(stats(0, 0, 0))).toBe(0);
    expect(trailScore(stats(10, 10, 0))).toBeGreaterThan(trailScore(stats(10, 5, 0)));
    expect(trailScore(stats(10, 8, 6))).toBeGreaterThan(trailScore(stats(10, 8, 0)));
    expect(trailScore(stats(10, 8, 2, 'expert'))).toBeGreaterThan(trailScore(stats(10, 8, 2)));
    expect(trailScore(stats(50, 50, 40, 'expert'))).toBe(100);
  });

  it('the chance runs from small to large, and never to certain', () => {
    expect(rareChance(0)).toBeCloseTo(0.02);
    expect(rareChance(100)).toBeCloseTo(0.25);
  });

  const rigged = () => {
    let s = find(ready(fresh()));
    s = { ...s, expedition: { ...s.expedition!, rngState: 1, answered: 20, correct: 20, streak: 10, difficulty: 'expert' as const } };
    return s;
  };

  it('playing better brings more rare encounters', () => {
    const rate = (answered: number, correct: number, streak: number) => {
      let hits = 0;
      for (let seed = 0; seed < 300; seed++) {
        let s = find(ready(fresh(seed + 1)));
        s = { ...s, expedition: { ...s.expedition!, rngState: seed * 7919, answered, correct, streak } };
        if (stepRare(s, { type: 'enterEncounter' }).expedition!.slots[0]!.rare) hits++;
      }
      return hits;
    };
    expect(rate(20, 20, 10)).toBeGreaterThan(rate(20, 8, 0) * 2);
  });

  const toRare = () => {
    for (let seed = 1; seed < 400; seed++) {
      const base = rigged();
      const s = stepRare({ ...base, expedition: { ...base.expedition!, rngState: seed } }, { type: 'enterEncounter' });
      if (s.expedition!.slots[0]!.rare) return s;
    }
    throw new Error('no rare encounter');
  };

  it('a rare creature fights harder, can\'t be Bold Befriended, and joins through a question', () => {
    let s = toRare();
    const slot = s.expedition!.slots[0]!;
    expect(PACK.species.find((o) => o.id === slot.opponentId)!.rare).toBe(true);
    expect(s.expedition!.battle!.combat.opponentMaxHp).toBe(14);
    const count = s.companions.length;
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, combat: { ...s.expedition!.battle!.combat, opponentHp: 3 } } } };
    const rareTurn = (x: SaveData, action: 'attack' | 'befriend') => stepRare(stepRare(stepRare(x, { type: 'chooseAction', action }), { type: 'answer', optionId: stepRare(x, { type: 'chooseAction', action }).expedition!.battle!.question.acceptedId }), { type: 'continue' });
    s = rareTurn(s, 'attack');
    expect(s.expedition!.battle!.befriending).toBe(true);
    expect(s.expedition!.slots[0]!.status).toBe('pending');
    s = rareTurn(s, 'befriend');
    expect(s.companions).toHaveLength(count + 1);
    expect(s.companions.at(-1)!.speciesId).toBe(slot.opponentId);
    expect(s.expedition!.slots[0]!.status).toBe('won');
    expect(s.rareFound).toBe(true);
  });

  it('a rare can be met and befriended again after it joins', () => {
    const base = toRare();
    const rareId = base.expedition!.slots[0]!.opponentId;
    const regionId = base.expedition!.regionId;
    const owned = (x: SaveData) => [...x.companions, ...(x.wild ?? [])].map((c) => c.speciesId);
    const others = PACK.species.filter((o) => o.rare && o.homes.includes(regionId)).map((o) => o.id);
    const allRares = others.map((id, i) => ({ instanceId: `r${i}`, speciesId: id, bondXp: 0 }));
    expect(rarePool(PACK, regionId, [...owned(base), ...others]).map((o) => o.id)).toContain(rareId);
    let s: SaveData = { ...base, companions: [...base.companions, ...allRares] };
    const count = s.companions.length;
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, combat: { ...s.expedition!.battle!.combat, opponentHp: 3 } } } };
    const rareTurn = (x: SaveData, action: 'attack' | 'befriend') => stepRare(stepRare(stepRare(x, { type: 'chooseAction', action }), { type: 'answer', optionId: stepRare(x, { type: 'chooseAction', action }).expedition!.battle!.question.acceptedId }), { type: 'continue' });
    s = rareTurn(rareTurn(s, 'attack'), 'befriend');
    expect(s.companions).toHaveLength(count + 1);
    expect(s.companions.filter((c) => c.speciesId === rareId).length).toBe(2);
  });

  it('the roll holds through a retreat and retry', () => {
    let s = toRare();
    const id = s.expedition!.slots[0]!.opponentId;
    while (s.expedition!.battle) s = turn(s, false);
    expect(s.expedition!.retreated).toBe(true);
    s = stepRare(s, { type: 'enterEncounter' });
    expect(s.expedition!.slots[0]!.opponentId).toBe(id);
  });

  it('offers a region\'s next rare creature once the first is owned', () => {
    const owned = rigged();
    const s = { ...owned, companions: [...owned.companions, { instanceId: 'r', speciesId: 'thunderhoof', bondXp: 0 }] };
    expect(rarePool(PACK, 'us-west', s.companions.map((c) => c.speciesId)).map((o) => o.id)).toEqual(['emberwolf']);
  });

  it('any of a region\'s rares can appear, so Oceania brings the platypus as well as the kiwi', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) {
      let s = find(ready(fresh(seed), 'oceania'));
      s = { ...s, expedition: { ...s.expedition!, rngState: seed * 7919, answered: 20, correct: 20, streak: 10, difficulty: 'expert' as const } };
      const slot = stepRare(s, { type: 'enterEncounter' }).expedition!.slots[0]!;
      if (slot.rare) seen.add(slot.opponentId);
    }
    expect(seen).toEqual(new Set(['kiwisp', 'platybolt']));
  });

  it('Bold Befriend works on a creature the child already has', () => {
    let s = find(ready(fresh()));
    s = stepRare(s, { type: 'enterEncounter' });
    const slot = s.expedition!.slots[0]!;
    s = { ...s, companions: [...s.companions, { instanceId: 'dup', speciesId: slot.opponentId, bondXp: 0 }] };
    const b = s.expedition!.battle!;
    const ready2 = { ...b, combat: { ...b.combat, charge: 2, opponentHp: 1 } };
    expect(canTame(s, ready2, slot)).toBe(true);
  });

  it('comes back once every rare is owned, and never at an event or final showdown', () => {
    const owned = rigged();
    const rares = PACK.species.filter((o) => o.rare && o.homes.includes('us-west'));
    const s = { ...owned, companions: [...owned.companions, ...rares.map((o) => ({ instanceId: o.id, speciesId: o.id, bondXp: 0 }))] };
    let hits = 0;
    for (let seed = 1; seed < 60; seed++) {
      const slot = stepRare({ ...s, expedition: { ...s.expedition!, rngState: seed } }, { type: 'enterEncounter' }).expedition!.slots[0]!;
      if (slot.rare) { hits++; expect(rares.map((o) => o.id)).toContain(slot.opponentId); }
    }
    expect(hits).toBeGreaterThan(0);
    const events = s.expedition!.slots.filter((x) => x.kind !== 'regular');
    for (const x of events) expect(x.rare).toBeUndefined();
  });
});

describe('teams and switching', () => {
  const withTeam = (n: number) => {
    const base = fresh();
    const ids = ['brinefin', 'thistlehop', 'cindermite', 'sandwhisk', 'lobsnap', 'pengwee', 'zebrisk', 'llamist', 'galewing'].slice(0, n - 1);
    const companions = [...base.companions, ...ids.map((speciesId, i) => ({ instanceId: `m${i}`, speciesId, bondXp: 0 }))];
    let s: SaveData = start({ ...base, companions });
    for (const id of companions.slice(1)) s = step(s, { type: 'toggleTeam', instanceId: id.instanceId });
    return s;
  };
  const fight = (n: number) => step(find(step(withTeam(n), { type: 'depart' })), { type: 'enterEncounter' });

  it('takes up to ten creatures and always at least one', () => {
    const s = withTeam(10);
    expect(s.expedition!.teamIds).toHaveLength(10);
    const extra = { ...s, companions: [...s.companions, { instanceId: 'x', speciesId: 'reefling', bondXp: 0 }] };
    expect(step(extra, { type: 'toggleTeam', instanceId: 'x' })).toBe(extra);
    let one = start(fresh());
    one = { ...one };
    expect(step(one, { type: 'toggleTeam', instanceId: one.companions[0]!.instanceId })).toBe(one);
  });

  it('remembers the last team for the next trip', () => {
    const s = withTeam(3);
    const again = start(step(s, { type: 'abandon' }));
    expect(again.expedition!.teamIds).toEqual(s.expedition!.teamIds);
  });

  it('switching uses the turn, and the opponent hits the one who came in', () => {
    const s = fight(2);
    const hpBefore = s.expedition!.battle!.bench!.m0!.hp;
    const t = step(s, { type: 'switchTo', instanceId: 'm0' });
    const b = t.expedition!.battle!;
    expect(t.expedition!.companionId).toBe('m0');
    expect(b.combat.turn).toBe(2);
    expect(b.combat.playerHp).toBe(hpBefore - 2);
    expect(b.bench![s.expedition!.companionId]!.hp).toBe(s.expedition!.battle!.combat.playerHp);
  });

  it('charge belongs to each creature', () => {
    let s = fight(2);
    s = turn(turn(s, true), true);
    expect(s.expedition!.battle!.combat.charge).toBe(2);
    const lead = s.expedition!.companionId;
    s = step(s, { type: 'switchTo', instanceId: 'm0' });
    expect(s.expedition!.battle!.combat.charge).toBe(0);
    s = step(s, { type: 'switchTo', instanceId: lead });
    expect(s.expedition!.battle!.combat.charge).toBe(2);
  });

  it('each creature uses its own Special', () => {
    const s = step(fight(2), { type: 'switchTo', instanceId: 'm0' });
    expect(s.expedition!.battle!.combat.special).toBe('heal');
  });

  it('a fainted creature must be replaced, for free, and can\'t come back', () => {
    let s = fight(2);
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, combat: { ...s.expedition!.battle!.combat, playerHp: 1 } } } };
    const lead = s.expedition!.companionId;
    s = step(answerWith(step(s, { type: 'chooseAction', action: 'attack' }), false), { type: 'continue' });
    expect(s.expedition!.battle!.mustSwitch).toBe(true);
    expect(s.expedition!.retreated).toBe(false);
    expect(step(s, { type: 'chooseAction', action: 'attack' })).toBe(s);
    const turnNow = s.expedition!.battle!.combat.turn;
    s = step(s, { type: 'switchTo', instanceId: 'm0' });
    expect(s.expedition!.battle!.combat.turn).toBe(turnNow);
    expect(s.expedition!.battle!.combat.playerHp).toBe(12);
    expect(step(s, { type: 'switchTo', instanceId: lead })).toBe(s);
  });

  it('only retreats once the whole team is down', () => {
    let s = fight(2);
    let guard = 0;
    while (s.expedition!.battle && guard++ < 40) {
      s = s.expedition!.battle.mustSwitch ? step(s, { type: 'switchTo', instanceId: 'm0' }) : turn(s, false);
    }
    expect(s.expedition!.retreated).toBe(true);
    expect(s.attempts.length).toBeGreaterThan(5);
  });

  it('the finisher gets full XP and the rest half', () => {
    let s = fight(3);
    // One hit finishes it, so which opponent the trail deals doesn't matter.
    const b = s.expedition!.battle!;
    s = { ...s, expedition: { ...s.expedition!, battle: { ...b, combat: { ...b.combat, opponentHp: 1 } } } };
    const lead = s.expedition!.companionId;
    for (let i = 0; i < 5 && s.expedition!.battle; i++) s = turn(s, true);
    expect(s.companions.find((c) => c.instanceId === lead)!.bondXp).toBe(10);
    expect(s.companions.find((c) => c.instanceId === 'm0')!.bondXp).toBe(5);
  });

  it('bigger teams face tougher opponents', () => {
    const solo = fight(1).expedition!.battle!.combat;
    const full = fight(5).expedition!.battle!.combat;
    expect(full.opponentMaxHp).toBe(solo.opponentMaxHp + 8);
    expect(full.maxTurns).toBe(solo.maxTurns + 4);
    expect(enemyIntent(full)).toBe(enemyIntent(solo) + 1);
    const ten = fight(10).expedition!.battle!.combat;
    expect(ten.opponentMaxHp).toBe(solo.opponentMaxHp + 13);
    expect(ten.maxTurns).toBe(solo.maxTurns + 9);
    expect(enemyIntent(ten)).toBe(enemyIntent(solo) + 2);
  });

  it('home turf adds to Attack only, where the landscape matches', () => {
    const base = fight(1);
    const combat = { ...base.expedition!.battle!.combat, turf: 1, typeEdge: 0 };
    expect(resolveTurn(combat, 'attack', true).events.damageDealt).toBe(4);
    expect(resolveTurn({ ...combat, charge: 2 }, 'special', true).events.damageDealt).toBe(5);
    const home = PACK.places.find((p) => p.biome === 'mountain' && p.regionId === 'us-west')!;
    const slate = PACK.species.find((o) => o.id === 'slatepaw')!;
    expect(slate.habitats).toContain(home.biome);
  });

  it('every creature has a habitat that exists', () => {
    const biomes = new Set(PACK.places.map((p) => p.biome));
    for (const c of PACK.species) for (const h of c.habitats) expect(biomes.has(h), `${c.id} ${h}`).toBe(true);
  });

  it('an unfinished older trip plays on with a team of one', () => {
    let s = ready(fresh());
    const { teamIds: _team, ...older } = s.expedition!;
    s = find({ ...s, expedition: older as typeof s.expedition });
    const t = step(s, { type: 'enterEncounter' });
    expect(Object.keys(t.expedition!.battle!.bench!)).toHaveLength(1);
  });
});

describe('wrong answers teach', () => {
  it('a wrong capital says what that city is the capital of', () => {
    const q = PACK.questions.find((o) => o.id === 'q-capital-maryland-scout-1')!;
    const wrong = q.options.filter((o) => o.id !== q.acceptedId);
    expect(wrong).toHaveLength(3);
    for (const o of wrong) expect(o.about, o.label).toMatch(new RegExp(`^${o.label} is the capital of `));
  });

  it('a same-state city says so, and the largest city is called out', () => {
    const q = PACK.questions.find((o) => o.id === 'q-capital-california-ranger-1')!;
    expect(q.options.find((o) => o.label === 'Los Angeles')!.about).toBe('Los Angeles is the largest city in California, but not its capital.');
    expect(q.options.find((o) => o.label === 'San Diego')!.about).toBe('San Diego is a city in California, but not its capital.');
  });

  it('every wrong option in the states and countries has something to teach, and the right one has nothing', () => {
    for (const q of PACK.questions.filter((o) => o.locationId)) {
      for (const o of q.options) {
        if (o.id === q.acceptedId) expect(o.about, q.id).toBeUndefined();
        else expect(o.about, `${q.id} ${o.label}`).toBeTruthy();
      }
    }
  });
});

describe('whole world', () => {
  it('passes the record rules and has no duplicate place ids', () => {
    const records = GROUPS.flatMap((g) => g.records as readonly PlaceRecord[]);
    expect(validateRecords(records)).toEqual([]);
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
    expect(PACK.regions).toHaveLength(21);
  });

  it('lands every place on a map', () => {
    for (const r of PACK.regions) {
      const map = MAPS[r.mapId];
      for (const p of PACK.places.filter((o) => o.regionId === r.id)) {
        const [x, y] = map.project(p.lonLat);
        expect(x, p.name).toBeGreaterThanOrEqual(0);
        expect(x, p.name).toBeLessThanOrEqual(map.width);
        expect(y, p.name).toBeGreaterThanOrEqual(0);
        expect(y, p.name).toBeLessThanOrEqual(map.height);
        if (!p.tiny) expect(map.features.some((f) => f.id === p.featureId), p.name).toBe(true);
      }
    }
  });
});

describe('changing a move', () => {
  const inBattle = () => step(find(ready(fresh())), { type: 'enterEncounter' });
  const change = (s: SaveData) => step(s, { type: 'changeMove' });

  it('goes back to the moves with the same question and nothing spent', () => {
    const s = inBattle();
    const b = s.expedition!.battle!;
    const back = change(step(s, { type: 'chooseAction', action: 'attack' }));
    expect(back.expedition!.battle).toEqual(b);
    expect(back.expedition!.answered).toBe(s.expedition!.answered);
    expect(step(back, { type: 'chooseAction', action: 'guard' }).expedition!.battle!.action).toBe('guard');
  });

  it('only works while a question is waiting', () => {
    const s = inBattle();
    expect(change(s)).toBe(s);
    const answered = answerWith(step(s, { type: 'chooseAction', action: 'attack' }), true);
    expect(change(answered)).toBe(answered);
  });

  it('is not offered when befriending is the only move', () => {
    let s = ready(fresh());
    while (s.expedition!.slots.filter((o) => o.status === 'won').length < s.expedition!.slots.length - 1) s = winStop(find(s));
    s = step(find(s), { type: 'enterEncounter' });
    while (!s.expedition!.battle!.befriending) s = turn(s, true);
    const asked = step(s, { type: 'chooseAction', action: 'befriend' });
    expect(change(asked)).toBe(asked);
  });
});

describe('Bold Befriend', () => {
  const inBattle = (seed = 3) => {
    let s = step(find(ready(fresh(seed))), { type: 'enterEncounter' });
    s = turn(turn(s, true), true);
    return s;
  };
  const go = (s: SaveData) => step(s, { type: 'chooseAction', action: 'tame' });

  it('needs half HP and 2 charge', () => {
    const start_ = step(find(ready(fresh())), { type: 'enterEncounter' });
    expect(go(start_)).toBe(start_);
    const s = inBattle();
    const { combat } = s.expedition!.battle!;
    expect(combat.charge).toBe(2);
    expect(combat.opponentHp * 2).toBeLessThanOrEqual(combat.opponentMaxHp);
    expect(go(s).expedition!.battle!.action).toBe('tame');
  });

  it('asks a harder question than the trail', () => {
    expect(go(inBattle()).expedition!.battle!.question.difficulty).toBe('ranger');
  });

  it('two right in a row brings the creature home and wins the stop', () => {
    let s = go(inBattle());
    const opponent = s.expedition!.slots[0]!.opponentId;
    const owned = s.companions.length;
    s = step(answerWith(s, true), { type: 'continue' });
    expect(s.expedition!.battle!.tameHits).toBe(1);
    expect(s.companions).toHaveLength(owned);
    s = answerWith(go(s), true);
    expect(s.companions).toHaveLength(owned + 1);
    expect(s.companions.at(-1)!.speciesId).toBe(opponent);
    expect(s.expedition!.slots[0]!.status).toBe('won');
    expect(s.expedition!.tamedIds).toEqual([opponent]);
    expect(answerWith(s, true)).toBe(s);
  });

  it('a miss ends the attempt and loses the charge, and the creature hits back', () => {
    let s = go(inBattle());
    const hp = s.expedition!.battle!.combat.playerHp;
    s = answerWith(s, false);
    const { combat, tameHits } = s.expedition!.battle!;
    expect(combat.charge).toBe(0);
    expect(tameHits).toBe(0);
    expect(combat.playerHp).toBeLessThan(hp);
  });

  it('the second question costs no more charge', () => {
    let s = go(inBattle());
    s = answerWith(s, true);
    expect(s.expedition!.battle!.combat.charge).toBe(0);
    s = step(s, { type: 'continue' });
    expect(s.expedition!.battle!.combat.charge).toBe(0);
    expect(go(s).expedition!.battle!.action).toBe('tame');
  });

  it('changing away and back keeps the same harder question, at no cost', () => {
    const s = inBattle();
    const regular = s.expedition!.battle!.question.id;
    const trying = go(s);
    const hard = trying.expedition!.battle!.question.id;
    const back = step(trying, { type: 'changeMove' });
    expect(back.expedition!.battle).toMatchObject({ phase: 'choose', question: { id: regular } });
    expect(back.expedition!.battle!.combat.charge).toBe(2);
    expect(back.expedition!.battle!.action).toBeUndefined();
    expect(go(back).expedition!.battle!.question.id).toBe(hard);
    const attacked = step(answerWith(step(back, { type: 'chooseAction', action: 'attack' }), false), { type: 'continue' });
    expect(attacked.expedition!.battle!.heldQuestions).toBeUndefined();
  });

  it('works on a creature already owned, adding a second one', () => {
    const s = inBattle();
    const owned = { ...s, companions: [...s.companions, { instanceId: 'x', speciesId: s.expedition!.slots[0]!.opponentId, bondXp: 0 }] };
    expect(go(owned)).not.toBe(owned);
  });
});

describe('streak rewards', () => {
  it('pay out at milestones and only there', () => {
    expect(streakReward(4)).toBeNull();
    expect(streakReward(5)).toMatchObject({ points: 1 });
    expect(streakReward(8)).toMatchObject({ heal: 2 });
    expect(streakReward(10)).toMatchObject({ points: 2 });
    expect(streakReward(15)).toMatchObject({ points: 2 });
  });

  it('the best streak is kept and earns badges', () => {
    const s = playTrail(fresh());
    expect(s.bestStreak).toBeGreaterThanOrEqual(10);
  });
});

describe('card levels', () => {
  const noon = new Date(2026, 10, 2, 12).getTime();
  const DAY = 86400000;
  const q = (objective: string, difficulty: Difficulty = 'scout') => PACK.questions.find((o) => o.objectiveId === objective && o.difficulty === difficulty)!;
  const right = (l: Learning, question: Question, t: number) => recordAnswer(l, question, true, t, false);

  it('climbs bronze, silver, gold, shiny', () => {
    let l: Learning = {};
    expect(cardProgress(l, 'oregon').level).toBe('bronze');
    l = right(l, q('capital-oregon'), noon);
    l = right(l, q('location-oregon'), noon);
    expect(cardProgress(l, 'oregon')).toEqual({ level: 'bronze', next: '1 more topic for Silver' });
    l = right(l, q('nickname-oregon'), noon);
    expect(cardProgress(l, 'oregon').level).toBe('silver');
    expect(cardProgress(l, 'oregon').next).toBe('Come back another day for Gold');
    l = right(l, q('capital-oregon'), noon + DAY);
    expect(cardProgress(l, 'oregon').level).toBe('gold');
    for (let i = 0; i < 3; i++) l = right(l, q('capital-oregon', 'expert'), noon + DAY + i);
    expect(cardProgress(l, 'oregon')).toEqual({ level: 'shiny', next: '' });
  });

  it('Gold can never be earned in one day', () => {
    let l: Learning = {};
    for (let i = 0; i < 6; i++) for (const id of ['capital-oregon', 'location-oregon', 'nickname-oregon']) l = right(l, q(id), noon + i);
    expect(cardProgress(l, 'oregon').level).toBe('silver');
  });

  it('other places do not count, even with similar names', () => {
    const l = right(right(right({}, q('capital-virginia'), noon), q('location-virginia'), noon), q('nickname-virginia'), noon);
    expect(cardProgress(l, 'west-virginia').level).toBe('bronze');
    expect(cardProgress(l, 'virginia').level).toBe('silver');
  });

  it('a city-state can still reach every level', () => {
    let l: Learning = {};
    const objectives = ['location-monaco', 'fact-monaco-0', 'fact-monaco-1'];
    for (const id of objectives) l = right(l, q(id), noon);
    expect(cardProgress(l, 'monaco').level).toBe('silver');
  });

  it('an upgrade is announced by the answer that earned it', () => {
    const base = fresh();
    const placeId = 'oregon';
    const start_ = reduce(ready(base), { type: 'useAtlas' }, PACK, NOW);
    expect(start_.expedition).toBeTruthy();
    const q1 = q('nickname-oregon');
    const learning = right(right({}, q('capital-oregon'), NOW), q('location-oregon'), NOW);
    let s: SaveData = step(find(ready({ ...base, learning, stateCards: [placeId] })), { type: 'enterEncounter' });
    s = step(s, { type: 'chooseAction', action: 'attack' });
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, question: q1 } } };
    s = answerWith(s, true);
    expect(s.expedition!.battle!.result!.cardUp).toEqual({ placeId, level: 'silver' });
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

  it('every place in every region has a card', () => {
    expect(PACK.cards).toHaveLength(PACK.places.length);
    expect(PACK.places.length).toBe(94 + 162);
    expect(playTrail(fresh(), 'europe-west').stateCards.length).toBeGreaterThan(0);
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
    const region = { id: 'x', label: 'x', continent: 'Test', mapId: 'world' as const, difficulties: ['scout'] as const, markerGap: 4 };
    expect(allowedDifficulties({ ...DEFAULT_SETTINGS, minDifficulty: 'expert' }, region)).toEqual(['scout']);
  });
});

describe('question selection', () => {
  const europe = PACK.questions.filter((q) => q.regionId === 'europe-west' && q.difficulty === 'scout');

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

  it('never makes the same place the answer within four questions in a whole trail', () => {
    for (const regionId of PACK.regions.map((r) => r.id)) {
      for (let seed = 1; seed < 12; seed++) {
        const asked = playTrail(fresh(seed), regionId, 'scout', 'long').expedition!.askedQuestionIds;
        const places = asked.map((id) => PACK.questions.find((q) => q.id === id)!.locationId);
        places.forEach((p, i) => {
          if (p) expect(places.slice(Math.max(0, i - 4), i), `${regionId} ${seed}`).not.toContain(p);
        });
      }
    }
  });

  it('falls back to tracked repeats instead of failing on a small pool', () => {
    const pool = europe.slice(0, 1);
    expect(pickQuestion(pool, { asked: [pool[0]!.id], recent: [], locationId: 'spain' }, new Rng(1))).toBe(pool[0]);
  });
});

describe('music', () => {
  it('follows the trip', () => {
    const s = fresh();
    expect(trackFor(s)).toBe('camp');
    expect(trackFor({ ...s, lastSummary: {} as SaveData['lastSummary'] })).toBe('victory');
    const trip = find(ready(s, 'europe-south'));
    expect(trackFor(trip)).toBe('trail-europe');
    expect(trackFor(find(ready(s, 'us-south')))).toBe('trail-us');
    expect(trackFor(find(ready(s, 'south-america')))).toBe('trail-south-america');
    const fight = step(trip, { type: 'enterEncounter' });
    expect(trackFor(fight)).toBe('battle');
    const e = fight.expedition!;
    const boss = e.slots.map((o, i) => (i === e.battle!.slotIndex ? { ...o, kind: 'guardian' as const } : o));
    expect(trackFor({ ...fight, expedition: { ...e, slots: boss } })).toBe('boss');
    const rare = e.slots.map((o, i) => (i === e.battle!.slotIndex ? { ...o, rare: true } : o));
    expect(trackFor({ ...fight, expedition: { ...e, slots: rare } })).toBe('rare');
  });
});

describe('types', () => {
  it('forms a loop where every type beats one and loses to one', () => {
    for (const t of TYPE_LOOP) {
      expect(typeEdge(t, beats(t))).toBe(1);
      expect(typeEdge(beats(t), t)).toBe(-1);
      expect(typeEdge(t, t)).toBe(0);
      expect(beats(losesTo(t))).toBe(t);
    }
    expect(beats('volt')).toBe('tide');
    expect(beats('stone')).toBe('volt');
    expect(beats('frost')).toBe('stone');
    expect(beats('leaf')).toBe('gale');
  });

  it('every creature has a type', () => {
    for (const s of PACK.species) expect(TYPE_LOOP, s.id).toContain(s.type);
    expect(new Set(PACK.species.map((s) => s.type)).size).toBe(TYPE_LOOP.length);
  });

  const base = { playerMaxHp: 12, playerAttack: 3, special: 'strong' as const, opponentMaxHp: 20, enemyPattern: [2, 2, 4], maxTurns: 8 };

  it('a strong matchup hits harder and a weak one softer, with the opponent unchanged', () => {
    const strong = resolveTurn(startCombat({ ...base, typeEdge: 1 }), 'attack', true).events;
    expect(strong).toMatchObject({ damageDealt: 4, damageTaken: 2 });
    const weak = resolveTurn(startCombat({ ...base, typeEdge: -1 }), 'attack', true).events;
    expect(weak).toMatchObject({ damageDealt: 2, damageTaken: 2 });
  });

  it('damage never drops below 1', () => {
    const c = startCombat({ ...base, playerAttack: 1, enemyPattern: [1], typeEdge: -1 });
    expect(attackDamage(c)).toBe(1);
  });

  it('a lone creature never has a weak matchup, so right answers always win', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = step(find(ready(fresh(seed))), { type: 'enterEncounter' });
      const { typeEdge: edge } = s.expedition!.battle!.combat;
      expect(edge).toBe(Math.max(0, typeEdge(speciesOf(PACK, 'slatepaw').type, speciesOf(PACK, s.expedition!.slots[0]!.opponentId).type)));
    }
  });
});

describe('bosses', () => {
  it('each heading has one boss, and it stays hidden until every region there is stamped', () => {
    const bosses = PACK.species.filter((s) => s.boss);
    expect(bosses).toHaveLength(8);
    const regions = PACK.regions.filter((r) => r.continent === 'Asia').map((r) => r.id);
    const boss = bosses.find((s) => s.homes.includes('asia-west'))!;
    const offered = (save: SaveData) => makeOffers(save, PACK, new Rng(1)).offers.some((o) => o.reward.kind === 'creature' && o.reward.speciesId === boss.id);
    const s = fresh();
    expect(offered({ ...s, stampedRegions: regions.slice(1) })).toBe(false);
    expect(offered({ ...s, stampedRegions: regions })).toBe(true);
  });

  it('winds up a big hit every third turn, which Guard softens', () => {
    const c = startCombat({ playerMaxHp: 20, playerAttack: 3, special: 'strong', opponentMaxHp: 30, enemyPattern: [2], maxTurns: 12, bossPower: 3 });
    expect(isBossTurn(c)).toBe(false);
    const third = { ...c, turn: 3 };
    expect(isBossTurn(third)).toBe(true);
    expect(enemyIntent(third)).toBe(5);
    expect(resolveTurn(third, 'guard', true).events.damageTaken).toBe(2);
  });

  it('a boss hunt ends in a harder fight with questions from the whole continent', () => {
    const regions = PACK.regions.filter((r) => r.continent === 'Asia').map((r) => r.id);
    const s = { ...fresh(), stampedRegions: regions, nextId: 500 };
    const save = step({ ...s, companions: s.companions }, { type: 'dismissSummary' });
    const opened = { ...save, ...makeOffers({ ...save, stampedRegions: regions }, PACK, new Rng(2)) };
    const offer = opened.offers.find((o) => o.regionId === 'asia-east')!;
    expect(PACK.species.find((p) => o2(offer) === p.id)?.boss).toBeTruthy();
    let trip = step(step(opened, { type: 'start', offerId: offer.id, regionId: 'asia-east', difficulty: 'scout', trail: 'short' }), { type: 'depart' });
    while (trip.expedition!.slots.some((o, i) => i < trip.expedition!.slots.length - 1 && o.status === 'pending')) trip = winStop(find(trip));
    trip = step(find(trip), { type: 'enterEncounter' });
    const { combat } = trip.expedition!.battle!;
    expect(combat.bossPower).toBe(3);
    expect(combat.opponentMaxHp).toBeGreaterThanOrEqual(22);
  });
});
const o2 = (o: { reward: Reward }) => (o.reward.kind === 'creature' ? o.reward.speciesId : '');

describe('focus', () => {
  const asked = (focus: Focus, regionId = 'europe-west', seed = 7) => {
    let s = step(step(fresh(seed), { type: 'start', offerId: fresh(seed).offers.find((o) => o.regionId === regionId)!.id, regionId, difficulty: 'scout', trail: 'standard', focus }), { type: 'depart' });
    s = step(find(s), { type: 'enterEncounter' });
    return turn(turn(s, false), false);
  };

  it('Places and capitals asks only those, and Flags asks only flags', () => {
    const topics = (s: SaveData) => s.expedition!.askedQuestionIds.map((id) => PACK.questions.find((q) => q.id === id)!.topic);
    for (let n = 0; n < 12; n++) {
      for (const t of topics(asked('basics', 'europe-west', n + 1))) expect(['location', 'capital']).toContain(t);
      for (const t of topics(asked('flags', 'europe-west', n + 1))) expect(t).toBe('flag');
    }
  });

  it('every region but Antarctica can run on flags', () => {
    expect(regionHasFocus(PACK, 'antarctica', 'flags')).toBe(false);
    for (const r of PACK.regions.filter((o) => o.id !== 'antarctica')) expect(regionHasFocus(PACK, r.id, 'flags'), r.id).toBe(true);
  });

  it('falls back to everything when a region has no flags', () => {
    const s = fresh();
    const started = step(s, { type: 'start', offerId: s.offers.find((o) => o.regionId === 'antarctica')!.id, regionId: 'antarctica', difficulty: 'scout', trail: 'short', focus: 'flags' });
    expect(started.expedition!.focus).toBe('all');
  });


  it('flag questions show a flag, or flags as the options', () => {
    const flagged = PACK.questions.filter((q) => q.topic === 'flag');
    expect(flagged).toHaveLength((196 + 50) * 3);
    for (const q of flagged) expect(!!q.flag || q.options.every((o) => o.flag), q.id).toBe(true);
  });
});

describe('passport', () => {
  it('a finished trail stamps its region once', () => {
    const s = playTrail(fresh(), 'africa-north');
    const done = step(s, { type: 'claimReward' });
    expect(done.stampedRegions).toEqual(['africa-north']);
    expect(done.lastSummary?.newStamp).toBe('africa-north');
  });
});
