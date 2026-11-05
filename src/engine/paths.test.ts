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
    expect(lines.map((s) => s.id).sort()).toEqual(['coatikit', 'kiwikin', 'paddlet']);
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
      expect(PACK.species.find((s) => s.id === east[0])!.type).toBe('kungfu');
    }
  });
});
