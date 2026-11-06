import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { chainBoost, CHAIN_MAX_BOOST, dayKey, extendChain, masteredRegions, regionCreatures, visitorFor } from './juice';
import { isExpeditionComplete, knownSpecies, makeOffers, newSave, reduce, type Command, type SaveData } from './game';
import { Rng } from './rng';

const NOW = 1_800_000_000_000;
const PLAIN = { ...PACK, species: PACK.species.filter((o) => !o.rare) };
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PLAIN, NOW);

/** Plays a whole trail with every answer right. */
function playTrail(s: SaveData, regionId: string, offerIndex = 0): SaveData {
  const offer = s.offers.filter((o) => o.regionId === regionId)[offerIndex]!;
  let next = step(step(s, { type: 'start', offerId: offer.id, regionId, difficulty: 'scout', trail: 'short', focus: 'all' }), { type: 'depart' });
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
  return next;
}

describe('Region Master', () => {
  it("finding every creature that lives in a region masters it and lays a Rare Egg", () => {
    const base = newSave(PLAIN, 7, 'p1');
    const here = regionCreatures(PLAIN, 'us-south').map((o) => o.id);
    // All but one creature of the region already befriended.
    const last = PLAIN.species.find((o) => o.id === here.at(-1))!.id;
    const owned = here.filter((id) => id !== last).map((speciesId, i) => ({ instanceId: `o${i}`, speciesId, bondXp: 0 }));
    let s: SaveData = { ...base, companions: [...base.companions, ...owned] };
    expect(masteredRegions(PLAIN, knownSpecies(s))).not.toContain('us-south');
    s = { ...s, offers: [{ id: 'o-last', regionId: 'us-south', reward: { kind: 'creature', speciesId: last } }] };
    const done = step(playTrail(s, 'us-south'), { type: 'claimReward' });
    expect(done.lastSummary!.regionsMastered).toEqual(['us-south']);
    expect(done.regionsMastered).toContain('us-south');
    expect(done.eggs!.some((e) => e.kind === 'rare')).toBe(true);
  });
});

describe('shiny chain', () => {
  it('grows with each one of the same kind in a row, and a different kind starts over', () => {
    let chain = extendChain(undefined, 'possumoon');
    expect(chainBoost(chain, 'possumoon')).toBe(1.5);
    chain = extendChain(chain, 'possumoon');
    expect(chainBoost(chain, 'possumoon')).toBe(2);
    expect(chainBoost(chain, 'lunaflit')).toBe(1);
    expect(extendChain(chain, 'lunaflit')).toEqual({ speciesId: 'lunaflit', count: 1 });
    expect(chainBoost({ speciesId: 'x', count: 50 }, 'x')).toBe(CHAIN_MAX_BOOST);
  });
});

describe('daily visitor', () => {
  it('is the same all day, changes from day to day, and is a regular creature', () => {
    const today = dayKey(NOW);
    expect(visitorFor(PACK, today)).toBe(visitorFor(PACK, today));
    const week = Array.from({ length: 7 }, (_, i) => visitorFor(PACK, dayKey(NOW + i * 86_400_000))!.id);
    expect(new Set(week).size).toBeGreaterThan(3);
    for (const id of week) {
      const s = PACK.species.find((o) => o.id === id)!;
      expect(!!s.rare || !!s.boss || !!s.night, id).toBe(false);
    }
  });

  it("is sighted first in its home region, even when the child already has one, and can join again", () => {
    const day = dayKey(NOW);
    const v = visitorFor(PLAIN, day)!;
    const base = newSave(PLAIN, 7, 'p1');
    const owned: SaveData = { ...base, companions: [...base.companions, { instanceId: 'v1', speciesId: v.id, bondXp: 0 }] };
    const { offers } = makeOffers({ ...owned, visitorDay: day }, PLAIN, new Rng(3));
    expect(offers.find((o) => o.regionId === v.homes[0])!.reward).toEqual({ kind: 'creature', speciesId: v.id });
    const s = step(owned, { type: 'newDay', day });
    expect(s.visitorDay).toBe(day);
    const done = step(playTrail(s, v.homes[0]!), { type: 'claimReward' });
    expect(done.companions.filter((c) => c.speciesId === v.id)).toHaveLength(2);
    expect(done.shinyChain).toEqual({ speciesId: v.id, count: 1 });
  });
});

describe('level-up moments', () => {
  it('a trail reports each team creature that leveled up, from and to', () => {
    const base = newSave(PLAIN, 7, 'p1');
    const offer = base.offers.find((o) => o.regionId === 'us-west')!;
    const done = step(playTrail({ ...base, offers: [offer] }, 'us-west'), { type: 'claimReward' });
    expect(done.lastSummary!.levelUps?.[0]).toMatchObject({ instanceId: base.activeCompanionId, from: 1 });
    expect(done.lastSummary!.levelUps![0]!.to).toBeGreaterThan(1);
  });
});
