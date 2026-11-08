import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { BADGES } from './badges';
import { ECONOMY } from './economy';
import { DIFFICULTY_POINTS, FREE_POINTS, knownSpecies, makeOffers, metOn, newSave, reduce, rollShiny, SHINY_CHANCE, type Command, type SaveData } from './game';
import { Rng } from './rng';
import { matchup } from './types';

const NOW = 1_800_000_000_000;
// Without the "just added" flag, so brand-new creatures don't crowd every battle on a new save.
const PLAIN = { ...PACK, species: PACK.species.filter((o) => !o.rare).map((o) => ({ ...o, fresh: undefined })) };
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PLAIN, NOW);
const fresh = (seed = 7) => newSave(PLAIN, seed, 'p1');
const offerIn = (s: SaveData, regionId: string, locked?: boolean) => s.offers.find((o) => o.regionId === regionId && o.reward.kind === 'creature' && (locked === undefined || !!PACK.species.find((x) => x.id === (o.reward as { speciesId: string }).speciesId)?.minDifficulty === locked));
const start = (s: SaveData, regionId: string, difficulty: Difficulty, locked?: boolean) =>
  step(s, { type: 'start', offerId: offerIn(s, regionId, locked)!.id, regionId, difficulty, trail: 'long' });

describe('creatures locked to harder trails', () => {
  const locked = PACK.species.filter((s) => s.minDifficulty);

  it('every region has a Ranger creature, and there are Expert ones too', () => {
    for (const r of PACK.regions) expect(locked.some((s) => s.minDifficulty === 'ranger' && s.homes.includes(r.id)), r.id).toBe(true);
    expect(locked.filter((s) => s.minDifficulty === 'expert').length).toBeGreaterThanOrEqual(10);
    expect(metOn({ minDifficulty: 'ranger' }, 'scout')).toBe(false);
    expect(metOn({ minDifficulty: 'ranger' }, 'expert')).toBe(true);
    expect(metOn({ minDifficulty: 'expert' }, 'ranger')).toBe(false);
  });

  it('never appear on a Scout trail, but can on harder ones', () => {
    let seen = false;
    for (let seed = 1; seed < 40; seed++) {
      const scout = start(fresh(seed), 'africa-east', 'scout', false);
      for (const slot of scout.expedition!.slots.filter((x) => x.kind === 'regular')) expect(PACK.species.find((x) => x.id === slot.opponentId)?.minDifficulty, slot.opponentId).toBeUndefined();
      const expert = start(fresh(seed), 'africa-east', 'expert', false);
      if (expert.expedition!.slots.some((x) => x.kind === 'regular' && PACK.species.find((o) => o.id === x.opponentId)?.minDifficulty)) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('camp shows one locked sighting per region as a hint, next to one any trail can take', () => {
    const s = fresh();
    for (const r of PACK.regions) {
      const here = s.offers.filter((o) => o.regionId === r.id).map(({ reward }) => (reward.kind === 'creature' ? PACK.species.find((x) => x.id === reward.speciesId)! : null));
      expect(here.filter((x) => x?.minDifficulty).length, r.id).toBe(1);
      expect(here.filter((x) => x && !x.minDifficulty).length, r.id).toBe(1);
    }
  });

  it('a locked sighting raises the trail to its difficulty', () => {
    const s = start(fresh(), 'us-west', 'scout', true);
    const target = (s.expedition!.reward as { speciesId: string }).speciesId;
    expect(s.expedition!.difficulty).toBe(PACK.species.find((x) => x.id === target)!.minDifficulty);
  });

  it('harder trails start with more Trail Points', () => {
    const points = (d: Difficulty) => start(fresh(), 'us-west', d, false).expedition!.points;
    expect(points('scout')).toBe(ECONOMY.startingPoints);
    expect(points('ranger')).toBe(ECONOMY.startingPoints + DIFFICULTY_POINTS.ranger);
    expect(points('expert')).toBe(ECONOMY.startingPoints + DIFFICULTY_POINTS.expert);
  });
});

describe('setting creatures free', () => {
  const stable = (): SaveData => {
    const s = fresh();
    return { ...s, companions: [...s.companions, { instanceId: 'a', speciesId: 'brinefin', bondXp: 40 }, { instanceId: 'b', speciesId: 'cindermite', bondXp: 0 }], lastTeamIds: ['a', 'b'], activeCompanionId: 'a' };
  };

  it('moves it to the wild, banks Trail Points once, and the next trail gets them', () => {
    const freed = step(stable(), { type: 'freeCompanion', instanceId: 'a' });
    expect(freed.companions.map((c) => c.instanceId)).not.toContain('a');
    expect(freed.wild?.map((c) => c.instanceId)).toEqual(['a']);
    expect(freed.wild?.[0]?.bondXp).toBe(40);
    expect(freed.bankedPoints).toBe(FREE_POINTS);
    expect(freed.activeCompanionId).not.toBe('a');
    expect(freed.lastTeamIds).toEqual(['b']);
    const back = step(freed, { type: 'recallCompanion', instanceId: 'a' });
    expect(back.companions.at(-1)).toMatchObject({ instanceId: 'a', bondXp: 40 });
    expect(back.wild).toEqual([]);
    const again = step(back, { type: 'freeCompanion', instanceId: 'a' });
    expect(again.bankedPoints).toBe(FREE_POINTS);
    expect(again.freedCount).toBe(1);
  });

  it('keeps at least one creature, and never frees mid-trip', () => {
    const one = fresh();
    expect(step(one, { type: 'freeCompanion', instanceId: one.companions[0]!.instanceId })).toBe(one);
    const s = stable();
    const going = start(s, 'us-west', 'scout', false);
    expect(step(going, { type: 'freeCompanion', instanceId: 'b' })).toBe(going);
  });

  it('a freed creature still counts as found: no new sighting of it, and badges stay', () => {
    const s = { ...stable(), badges: ['stable-5'] };
    const freed = step(s, { type: 'freeCompanion', instanceId: 'b' });
    expect(knownSpecies(freed).has('cindermite')).toBe(true);
    const { offers } = makeOffers(freed, PLAIN, new Rng(3));
    expect(offers.some((o) => o.reward.kind === 'creature' && o.reward.speciesId === 'cindermite')).toBe(false);
    expect(freed.badges).toContain('stable-5');
  });

  it('three freed creatures earn Friend of the Wild', () => {
    expect(BADGES.some((b) => b.id === 'wild-friend')).toBe(true);
    let s: SaveData = { ...stable(), companions: [...stable().companions, { instanceId: 'c', speciesId: 'lobsnap', bondXp: 0 }] };
    for (const id of ['a', 'b', 'c']) s = step(s, { type: 'freeCompanion', instanceId: id });
    expect(s.badges).toContain('wild-friend');
  });
});

describe('shiny creatures', () => {
  it('harder trails find more, and the roll never changes on reload', () => {
    const count = (d: Difficulty) => Array.from({ length: 2000 }, (_, i) => rollShiny(`kid-companion-${i}`, d)).filter(Boolean).length;
    expect(count('scout')).toBeLessThan(count('ranger'));
    expect(count('ranger')).toBeLessThan(count('expert'));
    expect(count('expert') / 2000).toBeCloseTo(SHINY_CHANCE.expert, 1);
    expect(rollShiny('kid-companion-5', 'expert')).toBe(rollShiny('kid-companion-5', 'expert'));
  });

  it('a creature that joins can be shiny, and earns Sparkle Finder', () => {
    expect(BADGES.find((b) => b.id === 'shiny-creature')!.earned({ ...fresh(), companions: [{ instanceId: 'x', speciesId: 'brinefin', bondXp: 0, shiny: true }] }, PACK)).toBe(true);
  });
});

describe('dual types', () => {
  const t = (type: string, secondType?: string) => ({ type, ...(secondType ? { secondType } : {}) }) as Parameters<typeof matchup>[0];

  it('attack with whichever type works best', () => {
    // Gale beats Frost; Volt beats Tide.
    expect(matchup(t('gale', 'volt'), t('tide')).edge).toBe(1);
    expect(matchup(t('gale', 'volt'), t('tide')).mine).toBe('volt');
    expect(matchup(t('gale', 'volt'), t('frost')).mine).toBe('gale');
  });

  it("both of a defender's types count, so strong and weak cancel out", () => {
    // Tide beats Flame, and Volt beats Tide.
    expect(matchup(t('tide'), t('flame', 'volt')).edge).toBe(0);
    expect(matchup(t('tide'), t('flame', 'stone')).edge).toBe(1);
    expect(matchup(t('tide'), t('flame', 'stone')).theirs).toBe('flame');
  });

  it('Expert creatures have two types, and there is a falcon', () => {
    for (const s of PACK.species.filter((x) => x.minDifficulty === 'expert')) expect(s.secondType, s.id).toBeTruthy();
    const falcon = PACK.species.find((s) => s.id === 'strikewing')!;
    expect(falcon.secondType).toBeTruthy();
    expect(falcon.minDifficulty).toBeUndefined();
  });
});
