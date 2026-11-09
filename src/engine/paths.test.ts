import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { newSave, reduce, type Command, type Companion, type SaveData } from './game';
import { companionSpecies, formOf, pathOf, xpForLevel } from './progression';

const NOW = 1_800_000_000_000;
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PACK, NOW);
const paddlet = (extra: Partial<Companion> = {}): Companion => ({ instanceId: 'p1-x', speciesId: 'paddlet', bondXp: 0, ...extra });

describe('Wild Paths', () => {
  it('each branching creature has three paths: Scholar is Light, Ranger is Kung Fu, Banner is Gale', () => {
    const lines = PACK.species.filter((s) => s.paths);
    expect(lines.map((s) => s.id).sort()).toEqual(['coatikit', 'fenneckit', 'kiwikin', 'otterkit', 'paddlet', 'quokkit']);
    for (const s of lines) expect(Object.fromEntries(s.paths!.map((p) => [p.id, p.type]))).toEqual({ scholar: 'light', ranger: 'kungfu', banner: 'gale' });
  });

  it('follows the path it was raised on most, Scholar first on a tie', () => {
    expect(pathOf({})).toBe('scholar');
    expect(pathOf({ raised: { scholar: 2, banner: 5, ranger: 1 } })).toBe('banner');
    expect(pathOf({ raised: { ranger: 3, scholar: 3 } })).toBe('scholar');
    expect(pathOf({ path: 'ranger', raised: { banner: 9 } })).toBe('ranger');
  });

  it("keeps its own type until level 5, then takes its path's type, look and Special", () => {
    const baby = companionSpecies(PACK, paddlet({ raised: { ranger: 4 } }));
    expect(baby.type).toBe('tide');
    const grown = paddlet({ bondXp: xpForLevel(5), raised: { ranger: 4 } });
    const s = companionSpecies(PACK, grown);
    expect(s.type).toBe('kungfu');
    expect(formOf(s, grown.bondXp)).toMatchObject({ name: 'Kickbill', artId: 'paddlet-ranger-2', stage: 2 });
    expect(formOf(companionSpecies(PACK, { ...grown, bondXp: xpForLevel(10) }), xpForLevel(10)).artId).toBe('paddlet-ranger-3');
  });

  it('a right flag answer raises the lead on the Banner path, and evolving fixes the path for good', () => {
    const base = newSave(PACK, 7, 'p1');
    const s: SaveData = { ...base, companions: [paddlet({ instanceId: base.activeCompanionId, raised: { banner: 3 } })] };
    const done = step(s, { type: 'ackEvolution', instanceId: base.activeCompanionId });
    expect(done.companions[0]!.path).toBeUndefined();
    const grown = { ...s, companions: [{ ...s.companions[0]!, bondXp: xpForLevel(5) }] };
    const fixed = step(grown, { type: 'ackEvolution', instanceId: base.activeCompanionId });
    expect(fixed.companions[0]).toMatchObject({ path: 'banner', stageSeen: 2 });
  });
});

describe('Wild Paths in battle', () => {
  it('a right flag answer by the fighting creature shows +1 Banner', () => {
    const base = newSave(PACK, 7, 'p1');
    let s: SaveData = { ...base, companions: [paddlet({ instanceId: base.activeCompanionId })] };
    const offer = s.offers.find((o) => o.regionId === 'europe-west')!;
    s = step(step(s, { type: 'start', offerId: offer.id, regionId: 'europe-west', difficulty: 'scout', trail: 'short', focus: 'flags' }), { type: 'depart' });
    for (let i = 0; i < 50 && !s.expedition!.battle; i++) {
      const e = s.expedition!;
      s = e.discovery === 'searching' ? step(s, { type: 'guess', locationId: e.targetId }) : e.event ? step(step(s, { type: 'answer', optionId: e.event.question.acceptedId }), { type: 'continue' }) : step(s, { type: 'enterEncounter' });
    }
    // Answer until a flag question comes up.
    let seen = false;
    for (let i = 0; i < 20 && !seen && s.expedition?.battle; i++) {
      const b = s.expedition.battle;
      if (b.phase !== 'choose') { s = step(s, { type: 'continue' }); continue; }
      const flag = b.question.topic === 'flag';
      s = step(step(s, { type: 'chooseAction', action: 'guard' }), { type: 'answer', optionId: b.question.acceptedId });
      if (flag) {
        expect(s.expedition!.battle!.result!.pathPoints).toEqual(['banner']);
        expect(s.companions[0]!.raised?.banner).toBe(1);
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });
});

describe('new creatures', () => {
  it('are sighted first in their region until befriended', async () => {
    const { makeOffers } = await import('./game');
    const { Rng } = await import('./rng');
    // A player who already has the starter creature, which is otherwise sighted first.
    const start = newSave(PACK, 7, 'p1');
    const base = { ...start, companions: [...start.companions, { instanceId: 'bk', speciesId: PACK.featuredSpeciesId!, bondXp: 0 }] };
    for (let seed = 1; seed <= 5; seed++) {
      const { offers } = makeOffers(base, PACK, new Rng(seed));
      const east = offers.filter((o) => o.regionId === 'asia-east').map((o) => (o.reward.kind === 'creature' ? o.reward.speciesId : ''));
      expect(PACK.species.find((s) => s.id === east[0])!.fresh).toBe(true);
    }
  });
});

describe('night creatures', () => {
  it('are sighted only at night, first in their region, and live on night trails', async () => {
    const { makeOffers } = await import('./game');
    const { Rng } = await import('./rng');
    const start = newSave(PACK, 7, 'p1');
    const base = { ...start, companions: [...start.companions, { instanceId: 'bk', speciesId: PACK.featuredSpeciesId!, bondXp: 0 }] };
    const night = PACK.species.filter((s) => s.night);
    expect(night.length).toBe(10);
    const sighted = (offersNight: boolean) => makeOffers({ ...base, offersNight }, PACK, new Rng(3)).offers.map((o) => (o.reward.kind === 'creature' ? o.reward.speciesId : ''));
    expect(sighted(false).some((id) => night.some((s) => s.id === id))).toBe(false);
    const atNight = makeOffers({ ...base, offersNight: true }, PACK, new Rng(3)).offers;
    for (const s of night) expect(atNight.find((o) => o.regionId === s.homes[0])!.reward, s.id).toEqual({ kind: 'creature', speciesId: s.id });
  });

  it('dusk and dawn refresh the sightings, but not in the middle of a trail', () => {
    const s = newSave(PACK, 7, 'p1');
    const dusk = step(s, { type: 'setNight', night: true });
    expect(dusk.offersNight).toBe(true);
    expect(dusk.offers).not.toEqual(s.offers);
    expect(step(dusk, { type: 'setNight', night: true })).toBe(dusk);
    const busy = { ...dusk, expedition: {} as SaveData['expedition'] };
    expect(step(busy, { type: 'setNight', night: false })).toBe(busy);
  });
});

describe('night creature duplicates', () => {
  it('an owned night creature still comes out early on a night trail, and Bold Befriend can win another', () => {
    const base = newSave(PACK, 7, 'p1');
    const owned: SaveData = { ...base, companions: [...base.companions, { instanceId: 'pm', speciesId: 'possumoon', bondXp: 0 }] };
    const dusk = step(owned, { type: 'setNight', night: true });
    const offer = dusk.offers.find((o) => o.regionId === 'us-south')!;
    const s = step(dusk, { type: 'start', offerId: offer.id, regionId: 'us-south', difficulty: 'scout', trail: 'short', focus: 'all' });
    const battles = s.expedition!.slots.filter((o) => o.kind === 'regular').map((o) => o.opponentId);
    expect(battles[0]).toBe('possumoon');
    expect(s.expedition!.night).toBe(true);
  });
});

describe('Winter Festival creatures', () => {
  it('are out only in December to January 6, sighted first in their region, and never block Region Master', async () => {
    const { makeOffers } = await import('./game');
    const { Rng } = await import('./rng');
    const { isWinter } = await import('./night');
    const { regionCreatures, visitorFor } = await import('./juice');
    expect([isWinter(new Date(2026, 11, 1).getTime()), isWinter(new Date(2027, 0, 6).getTime()), isWinter(new Date(2027, 0, 7).getTime()), isWinter(new Date(2026, 10, 30).getTime())]).toEqual([true, true, false, false]);
    const start = newSave(PACK, 7, 'p1');
    const base = { ...start, companions: [...start.companions, { instanceId: 'bk', speciesId: PACK.featuredSpeciesId!, bondXp: 0 }] };
    const winter = PACK.species.filter((s) => s.winter);
    expect(winter.length).toBe(10);
    const sighted = (offersWinter: boolean) => makeOffers({ ...base, offersWinter }, PACK, new Rng(3)).offers.map((o) => (o.reward.kind === 'creature' ? o.reward.speciesId : ''));
    expect(sighted(false).some((id) => winter.some((s) => s.id === id))).toBe(false);
    const inWinter = makeOffers({ ...base, offersWinter: true }, PACK, new Rng(3)).offers;
    for (const r of new Set(winter.flatMap((s) => s.homes))) {
      const here = inWinter.filter((o) => o.regionId === r).map((o) => (o.reward.kind === 'creature' ? o.reward.speciesId : ''));
      expect(here.some((id) => winter.some((w) => w.id === id)), r).toBe(true);
    }
    for (const r of PACK.regions) expect(regionCreatures(PACK, r.id).some((s) => s.winter), r.id).toBe(false);
    for (let d = 1; d <= 60; d++) expect(visitorFor(PACK, `2026-12-${d}`)?.winter).toBeFalsy();
  });

  it('the festival starting refreshes the sightings, but not in the middle of a trail', () => {
    const s = newSave(PACK, 7, 'p1');
    const dec = step(s, { type: 'setWinter', winter: true });
    expect(dec.offersWinter).toBe(true);
    expect(step(dec, { type: 'setWinter', winter: true })).toBe(dec);
    const busy = { ...dec, expedition: {} as SaveData['expedition'] };
    expect(step(busy, { type: 'setWinter', winter: false })).toBe(busy);
  });
});
