import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { DEFAULT_SETTINGS, newSave, reduce, SCHEMA_VERSION, type Expedition, type SaveData } from '../engine/game';
import { exportBackup, freshHousehold, migrateV1, migrateV2Save, migrateV3Save, migrateV5Save, openHousehold, parseBackup, type V2Save } from './household';
import { indexedDbStore, UnsupportedSaveError, type Household } from './store';

let n = 0;
const env = () => ({ seed: 5, makeId: () => `id-${++n}` });
const startCmd = (s: SaveData) => ({ type: 'start', offerId: s.offers.find((o) => o.regionId === 'us-west')!.id, regionId: 'us-west', difficulty: 'scout', trail: 'standard' }) as const;

const v1Save = {
  schemaVersion: 1,
  contentVersion: 'world-basics-fixture-1',
  profile: { id: 'old', displayName: 'Explorer', avatarId: 'explorer' },
  companion: { instanceId: 'old-companion-1', speciesId: 'slatepaw', bondXp: 10 },
  souvenirIds: ['compass', 'shell'],
  completedExpeditions: 2,
  nextId: 40,
  rngState: 99,
  offer: { id: 'offer-39', reward: { kind: 'souvenir', souvenirId: 'compass' } },
  expedition: { id: 'expedition-38', retreated: false },
  attempts: [{ id: 'a1', context: 'battle', itemId: 'q-capital-spain-1', itemVersion: 1, objectiveId: 'capital-spain', submitted: 'o0', correct: true, timestamp: 1, assisted: false, expeditionId: 'e' }],
  recentQuestionIds: ['q-capital-spain-1'],
  appliedRewardIds: ['expedition-1', 'expedition-20'],
  lastSummary: null,
};

async function seedLegacy(factory: IDBFactory) {
  const store = indexedDbStore(factory);
  await store.saveMeta({ schemaVersion: SCHEMA_VERSION, profileIds: [], activeProfileId: null });
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = factory.open('atlaswild', 1);
    req.onsuccess = () => resolve(req.result);
  });
  await new Promise<void>((resolve) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(v1Save, 'household');
    tx.objectStore('saves').delete('meta');
    tx.oncomplete = () => resolve();
  });
}

describe('household', () => {
  it('creates two independent profiles once, and never again', async () => {
    const store = indexedDbStore(new IDBFactory());
    const first = await openHousehold(store, PACK, env());
    expect(first.meta.profileIds.map((id) => first.profiles[id]!.profile.displayName)).toEqual(['Explorer 1', 'Explorer 2', 'Dad']);
    expect(await openHousehold(store, PACK, env())).toEqual(first);
  });

  it('saving one profile leaves the other unchanged', async () => {
    const store = indexedDbStore(new IDBFactory());
    const h = await openHousehold(store, PACK, env());
    const [a, b] = h.meta.profileIds as [string, string];
    await store.saveProfile(reduce(h.profiles[a] as SaveData, startCmd(h.profiles[a] as SaveData), PACK, 0));
    const loaded = await store.load();
    expect(loaded!.profiles[a]!.expedition).not.toBeNull();
    expect(loaded!.profiles[b]).toEqual(h.profiles[b]);
  });

  it('resumes an interrupted battle with the same question and option order', async () => {
    const factory = new IDBFactory();
    const store = indexedDbStore(factory);
    const h = await openHousehold(store, PACK, env());
    let s = h.profiles[h.meta.profileIds[0]!]!;
    s = reduce(s, startCmd(s), PACK, 0);
    s = reduce(s, { type: 'depart' }, PACK, 0);
    s = reduce(s, { type: 'guess', locationId: s.expedition!.targetId }, PACK, 0);
    s = reduce(s, { type: 'enterEncounter' }, PACK, 0);
    await store.saveProfile(s);
    const loaded = await indexedDbStore(factory).load();
    expect(loaded!.profiles[s.profile.id]).toEqual(s);
  });

  it('rejects an unsupported schema without overwriting it', async () => {
    const factory = new IDBFactory();
    const store = indexedDbStore(factory);
    await store.saveMeta({ schemaVersion: 999, profileIds: [], activeProfileId: null });
    await expect(openHousehold(store, PACK, env())).rejects.toBeInstanceOf(UnsupportedSaveError);
    await expect(store.load()).rejects.toBeInstanceOf(UnsupportedSaveError);
  });
});

describe('v1 migration', () => {
  const migrated = () => migrateV1(v1Save, PACK, env());
  const saves = () => Object.values(migrated().profiles);

  it('gives both children a full copy of the save', () => {
    const [a, b] = saves() as [SaveData, SaveData];
    expect([a.profile.displayName, b.profile.displayName]).toEqual(['Explorer 1', 'Explorer 2']);
    for (const s of [a, b]) {
      expect(s.souvenirIds).toEqual(['compass', 'shell']);
      expect(s.completedExpeditions).toBe(2);
      expect(s.companions[0]!.bondXp).toBe(10);
      expect(s.attempts).toHaveLength(1);
      expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it('keeps the copies independent', () => {
    const [a, b] = saves() as [SaveData, SaveData];
    expect(a.profile.id).not.toBe(b.profile.id);
    expect(a.companions[0]!.instanceId).not.toBe(b.companions[0]!.instanceId);
    expect(a.souvenirIds).not.toBe(b.souvenirIds);
    expect(a.rngState).not.toBe(b.rngState);
  });

  it('ends an unfinished expedition', () => {
    for (const s of saves()) expect(s.expedition).toBeNull();
  });

  it('runs on first open and keeps the original save', async () => {
    const factory = new IDBFactory();
    await seedLegacy(factory);
    const store = indexedDbStore(factory);
    const h = await openHousehold(store, PACK, env());
    expect(h.meta.profileIds).toHaveLength(3);
    expect(await store.loadLegacy()).toEqual(v1Save);
    expect(await openHousehold(indexedDbStore(factory), PACK, env())).toEqual(h);
  });

  it('refuses something that is not a v1 save', () => {
    expect(() => migrateV1({ schemaVersion: 7 }, PACK, env())).toThrow(UnsupportedSaveError);
  });
});

describe('v3 migration', () => {
  const v3 = (id: string) => {
    const { seenFacts: _seen, foundPlaces: _found, learning: _learning, badges: _badges, expertTrails: _expert, ...rest } = newSave(PACK, 4, id);
    return { ...rest, schemaVersion: 3, completedExpeditions: 7, stateCards: ['oregon'], offers: [{ id: 'old', reward: { kind: 'creature', speciesId: 'cragmaw' } }] } as unknown as SaveData;
  };

  it('keeps progress and gives every region its sightings', () => {
    const s = migrateV3Save(v3('a'), PACK);
    expect(s).toMatchObject({ schemaVersion: SCHEMA_VERSION, completedExpeditions: 7, stateCards: ['oregon'], seenFacts: [] });
    expect(new Set(s.offers.map((o) => o.regionId)).size).toBe(PACK.regions.length);
  });

  it('fills the map from places already found', () => {
    const attempts = [{ context: 'discovery', correct: true, submitted: 'oregon' }, { context: 'discovery', correct: false, submitted: 'idaho' }, { context: 'battle', correct: true, submitted: 'o0' }];
    expect(migrateV3Save({ ...v3('a'), attempts } as unknown as SaveData, PACK).foundPlaces).toEqual(['oregon']);
  });

  it('keeps a summary from an older version', () => {
    const lastSummary = { expeditionId: 'e', reward: { kind: 'bond', xp: 10 }, answered: 1, correct: 1, discoveryAssisted: false, souvenirId: null, cardsEarned: 0 };
    expect(migrateV3Save({ ...v3('a'), lastSummary } as unknown as SaveData, PACK).lastSummary).toEqual(lastSummary);
  });

  it('keeps an unfinished trip', () => {
    const trip = reduce(newSave(PACK, 4, 'a'), startCmd(newSave(PACK, 4, 'a')), PACK, 0).expedition;
    expect(migrateV3Save({ ...v3('a'), expedition: trip }, PACK).expedition).toEqual(trip);
  });

  it('upgrades on open and keeps a copy of the old saves', async () => {
    const store = indexedDbStore(new IDBFactory());
    const old = { meta: { schemaVersion: 3, profileIds: ['a'], activeProfileId: 'a', testProfileId: 'a' }, profiles: { a: v3('a') } } as unknown as Household;
    await store.replace(old);
    const h = await openHousehold(store, PACK, env());
    expect(h.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(await store.loadPreUpgrade(3)).toEqual(old);
  });

  it('restores a backup made on version 3', () => {
    const text = JSON.stringify({ format: 'atlaswild-backup', household: { meta: { schemaVersion: 3, profileIds: ['a'], activeProfileId: null }, profiles: { a: v3('a') } } });
    expect(parseBackup(text, PACK).profiles.a!.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('test profile', () => {
  it('joins an existing household once, with its own blank save, and leaves the children alone', async () => {
    const store = indexedDbStore(new IDBFactory());
    const kids = freshHousehold(PACK, env());
    await store.replace(kids);
    const h = await openHousehold(store, PACK, env());
    expect(h.meta.profileIds).toHaveLength(3);
    for (const id of kids.meta.profileIds) expect(h.profiles[id]).toEqual(kids.profiles[id]);
    const dad = h.profiles[h.meta.testProfileId!]!;
    expect(dad.profile.displayName).toBe('Dad');
    expect(dad.completedExpeditions).toBe(0);
    expect(await openHousehold(store, PACK, env())).toEqual(h);
  });

  it('a renamed test profile is not recreated', async () => {
    const store = indexedDbStore(new IDBFactory());
    const h = await openHousehold(store, PACK, env());
    const id = h.meta.testProfileId!;
    await store.saveProfile(reduce(h.profiles[id]!, { type: 'updateProfile', patch: { displayName: 'Papa' } }, PACK, 0));
    expect((await openHousehold(store, PACK, env())).meta.profileIds).toHaveLength(3);
  });

  it('does not receive a copy of the old saves', async () => {
    const factory = new IDBFactory();
    await seedLegacy(factory);
    const h = await openHousehold(indexedDbStore(factory), PACK, env());
    expect(h.profiles[h.meta.testProfileId!]!.souvenirIds).toEqual([]);
  });
});

describe('backup', () => {
  const h = freshHousehold(PACK, env());

  it('round-trips progress, including the pre-upgrade save', () => {
    const text = exportBackup(h, v1Save, 0);
    expect(parseBackup(text, PACK)).toEqual(h);
    expect(JSON.parse(text).preUpgradeSave).toEqual(v1Save);
  });

  it.each([
    ['not JSON', 'hello'],
    ['another file', '{"format":"other"}'],
    ['a future version', JSON.stringify({ format: 'atlaswild-backup', household: { meta: { schemaVersion: 99, profileIds: [] }, profiles: {} } })],
    ['a missing profile', JSON.stringify({ format: 'atlaswild-backup', household: { meta: { schemaVersion: SCHEMA_VERSION, profileIds: ['x'] }, profiles: {} } })],
  ])('rejects %s', (_name, text) => {
    expect(() => parseBackup(text, PACK)).toThrow(UnsupportedSaveError);
  });

  it('a rejected restore leaves the saves alone; a good one replaces them all', async () => {
    const store = indexedDbStore(new IDBFactory());
    const original = await openHousehold(store, PACK, env());
    const replacement = freshHousehold(PACK, env());
    await store.replace(parseBackup(exportBackup(replacement, null, 0), PACK));
    expect(Object.keys((await store.load())!.profiles).sort()).toEqual(Object.keys(replacement.profiles).sort());
    expect(Object.keys((await store.load())!.profiles)).not.toContain(original.meta.profileIds[0]);
  });
});

const v2Save = (id: string): V2Save => ({
  ...structuredClone(newSave(PACK, 3, id)),
  schemaVersion: 2,
  companion: { instanceId: `${id}-companion-1`, speciesId: 'slatepaw', bondXp: 30 },
  souvenirIds: ['compass'],
  completedExpeditions: 4,
  settings: { ...DEFAULT_SETTINGS, muted: true, maxDifficulty: 'ranger' },
} as unknown as V2Save);

describe('v2 migration', () => {
  const v2Household = () => ({ meta: { schemaVersion: 2, profileIds: ['a', 'b'], activeProfileId: 'a' }, profiles: { a: v2Save('a'), b: v2Save('b') } }) as unknown as Household;

  it('keeps what each child earned and their settings', () => {
    const s = migrateV2Save(v2Save('a'), PACK);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.companions).toEqual([{ instanceId: 'a-companion-1', speciesId: 'slatepaw', bondXp: 30 }]);
    expect(s.activeCompanionId).toBe('a-companion-1');
    expect(s.souvenirIds).toEqual(['compass']);
    expect(s.completedExpeditions).toBe(4);
    expect(s.settings).toMatchObject({ muted: true, maxDifficulty: 'ranger', lastTrail: 'standard' });
    expect(s.offers.length).toBeGreaterThan(0);
  });

  it('upgrades on open and keeps a copy of the old saves', async () => {
    const store = indexedDbStore(new IDBFactory());
    const old = v2Household();
    await store.replace(old);
    const h = await openHousehold(store, PACK, env());
    expect(h.meta).toMatchObject({ schemaVersion: SCHEMA_VERSION, activeProfileId: 'a' });
    expect(h.profiles.a!.companions).toHaveLength(1);
    expect(await store.loadPreUpgrade(2)).toEqual(old);
    expect(await openHousehold(store, PACK, env())).toEqual(h);
  });

  it('restores a backup made on version 2', () => {
    const text = JSON.stringify({ format: 'atlaswild-backup', household: v2Household() });
    expect(parseBackup(text, PACK).profiles.b!.companions[0]!.bondXp).toBe(30);
  });
});

it('a new save starts from default settings', () => {
  expect(newSave(PACK, 1, 'p').settings.volume).toBeGreaterThan(0);
});

describe('splitting Europe', () => {
  const pack = PACK;
  const old = (): SaveData => {
    const s = newSave(pack, 5, 'a');
    return { ...s, schemaVersion: 5, offers: [{ id: 'old', regionId: 'europe', reward: { kind: 'bond', xp: 1 } }], stateCards: ['france'], settings: { ...s.settings, lastRegionId: 'europe', disabledRegions: ['europe', 'us-west'] } };
  };

  it('moves settings and sightings to the four new regions and keeps what was earned', () => {
    const s = migrateV5Save(old(), pack);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.settings.lastRegionId).toBe('europe-west');
    expect(s.settings.disabledRegions).toEqual(['europe-north', 'europe-west', 'europe-south', 'europe-east', 'us-west']);
    expect(s.offers.every((o) => pack.regions.some((r) => r.id === o.regionId))).toBe(true);
    expect(s.stateCards).toEqual(['france']);
  });

  it('ends a trip in the old region, and leaves any other trip running', () => {
    const trip = (regionId: string) => ({ ...old(), expedition: { regionId, askedQuestionIds: ['q1'] } as Expedition });
    const ended = migrateV5Save(trip('europe'), pack);
    expect(ended.expedition).toBeNull();
    expect(ended.recentQuestionIds).toContain('q1');
    expect(migrateV5Save(trip('us-west'), pack).expedition?.regionId).toBe('us-west');
  });
});
