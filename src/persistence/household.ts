import type { Pack } from '../content/types';
import { DEFAULT_SETTINGS, makeOffers, newSave, RECENT_QUESTION_LIMIT, SCHEMA_VERSION, type Companion, type SaveData } from '../engine/game';
import { Rng } from '../engine/rng';
import { UnsupportedSaveError, type Household, type SaveStore } from './store';

export interface Env {
  seed: number;
  makeId: () => string;
}

const PLAYERS = [
  { displayName: 'Explorer 1', avatarId: 'thistlehop' },
  { displayName: 'Explorer 2', avatarId: 'brinefin' },
];

function household(saves: SaveData[]): Household {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, profileIds: saves.map((s) => s.profile.id), activeProfileId: null },
    profiles: Object.fromEntries(saves.map((s) => [s.profile.id, s])),
  };
}

export function freshHousehold(pack: Pack, env: Env): Household {
  const seeds = new Rng(env.seed);
  return household(PLAYERS.map((p) => newSave(pack, Math.floor(seeds.next() * 0x7fffffff), env.makeId(), p.displayName, p.avatarId)));
}

type V1Save = Omit<SaveData, 'settings' | 'companions' | 'activeCompanionId' | 'offers' | 'stateCards'> & { companion: Companion };
/** Version 2 had one companion and a single souvenir offer. */
export type V2Save = Omit<SaveData, 'companions' | 'activeCompanionId' | 'offers' | 'stateCards'> & { companion: Companion };

function isV1(data: unknown): data is V1Save {
  const d = data as Partial<V1Save> | null | undefined;
  return !!d && d.schemaVersion === 1 && !!d.profile && !!d.companion && Array.isArray(d.souvenirIds);
}

/**
 * Gives each child a full copy of the v1 save, because they played it together.
 * An unfinished v1 expedition ends, since its route has no meaning in the new content.
 */
export function migrateV1(v1: unknown, pack: Pack, env: Env): Household {
  if (!isV1(v1)) throw new UnsupportedSaveError('This save is not a version the game can upgrade.');
  const seeds = new Rng(env.seed);
  return household(
    PLAYERS.map((p) => {
      const id = env.makeId();
      const blank = newSave(pack, Math.floor(seeds.next() * 0x7fffffff), id, p.displayName, p.avatarId);
      const copied = structuredClone(v1);
      return {
        ...blank,
        companions: [{ ...copied.companion, instanceId: `${id}-companion-1` }],
        activeCompanionId: `${id}-companion-1`,
        souvenirIds: copied.souvenirIds,
        completedExpeditions: copied.completedExpeditions,
        attempts: copied.attempts,
        recentQuestionIds: copied.recentQuestionIds,
        appliedRewardIds: copied.appliedRewardIds,
        nextId: copied.nextId,
        settings: DEFAULT_SETTINGS,
      };
    }),
  );
}

/** Keeps everything a child has earned. An unfinished expedition ends, as its shape has changed. */
export function migrateV2Save(old: V2Save, pack: Pack): SaveData {
  const { companion, ...rest } = structuredClone(old) as V2Save & { offer?: unknown };
  delete (rest as { offer?: unknown }).offer;
  const base = { ...rest, schemaVersion: SCHEMA_VERSION, contentVersion: pack.version, companions: [companion], activeCompanionId: companion.instanceId, stateCards: [], seenFacts: [], foundPlaces: [], learning: {}, badges: [], expertTrails: 0, expedition: null, lastSummary: null, settings: { ...DEFAULT_SETTINGS, ...rest.settings } };
  const rng = new Rng(base.rngState);
  const { offers, nextId } = makeOffers(base, pack, rng);
  return { ...base, offers, nextId, rngState: rng.state };
}

/** Version 4 tracked no map, levels or learning. Found places come from past correct guesses. */
export function migrateV4Save(old: SaveData): SaveData {
  const s = structuredClone(old);
  const found = s.attempts.filter((a) => a.context === 'discovery' && a.correct).map((a) => a.submitted);
  return { ...s, schemaVersion: SCHEMA_VERSION, foundPlaces: [...new Set(found)], learning: {}, badges: [], expertTrails: 0, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
}

/** Version 3 had one set of sightings. Now each region has its own, and Field Notes are tracked. An unfinished trip carries on. */
export function migrateV3Save(old: SaveData, pack: Pack): SaveData {
  const rest = structuredClone(old);
  const rng = new Rng(rest.rngState);
  const { offers, nextId } = makeOffers(rest, pack, rng);
  return migrateV4Save({ ...rest, contentVersion: pack.version, seenFacts: [], offers, nextId, rngState: rng.state });
}

const EUROPE_REGIONS = ['europe-north', 'europe-west', 'europe-south', 'europe-east'];

/** Version 5 had one Europe region, now four. Its sightings are redrawn. A trip there can't continue, so it ends; everything earned stays. */
export function migrateV5Save(old: SaveData, pack: Pack): SaveData {
  const s = structuredClone(old);
  const rng = new Rng(s.rngState);
  const { offers, nextId } = makeOffers(s, pack, rng);
  const onDeadTrip = s.expedition?.regionId === 'europe';
  const recent = onDeadTrip ? [...s.recentQuestionIds, ...(s.expedition?.askedQuestionIds ?? [])].slice(-RECENT_QUESTION_LIMIT) : s.recentQuestionIds;
  return {
    ...s,
    schemaVersion: SCHEMA_VERSION,
    contentVersion: pack.version,
    offers,
    nextId,
    rngState: rng.state,
    recentQuestionIds: recent,
    expedition: onDeadTrip ? null : s.expedition,
    settings: {
      ...s.settings,
      lastRegionId: s.settings.lastRegionId === 'europe' ? 'europe-west' : s.settings.lastRegionId,
      disabledRegions: s.settings.disabledRegions.flatMap((id) => (id === 'europe' ? EUROPE_REGIONS : [id])),
    },
  };
}

function upgrade(h: Household, pack: Pack): Household {
  const v = h.meta.schemaVersion;
  const older = v === 2 ? (s: SaveData) => migrateV2Save(s as unknown as V2Save, pack) : v === 3 ? (s: SaveData) => migrateV3Save(s, pack) : v === 4 ? migrateV4Save : (s: SaveData) => s;
  const step = (s: SaveData) => migrateV5Save(older(s), pack);
  return { meta: { ...h.meta, schemaVersion: SCHEMA_VERSION }, profiles: Object.fromEntries(Object.entries(h.profiles).map(([id, s]) => [id, step(s)])) };
}

const TESTER = { displayName: 'Dad', avatarId: 'cragmaw' };

/** Adds the parent's test profile once, leaving the children's saves untouched. */
export function withTestProfile(h: Household, pack: Pack, env: Env): Household {
  if (h.meta.testProfileId) return h;
  const id = env.makeId();
  const save = newSave(pack, env.seed, id, TESTER.displayName, TESTER.avatarId);
  return {
    meta: { ...h.meta, profileIds: [...h.meta.profileIds, id], testProfileId: id },
    profiles: { ...h.profiles, [id]: save },
  };
}

async function loadOrCreate(store: SaveStore, pack: Pack, env: Env): Promise<Household> {
  const existing = await store.load();
  if (existing && existing.meta.schemaVersion < SCHEMA_VERSION) {
    await store.keepPreUpgrade(existing.meta.schemaVersion, existing);
    const upgraded = upgrade(existing, pack);
    await store.replace(upgraded);
    return upgraded;
  }
  if (existing) return existing;
  const legacy = await store.loadLegacy();
  const created = legacy ? migrateV1(legacy, pack, env) : freshHousehold(pack, env);
  await store.replace(created);
  return created;
}

export async function openHousehold(store: SaveStore, pack: Pack, env: Env): Promise<Household> {
  const h = await loadOrCreate(store, pack, env);
  const complete = withTestProfile(h, pack, env);
  if (complete !== h) await store.replace(complete);
  return complete;
}

const FORMAT = 'atlaswild-backup';

export function exportBackup(h: Household, legacy: unknown, now: number, preUpgrade: unknown = null): string {
  return JSON.stringify({ format: FORMAT, exportedAt: new Date(now).toISOString(), household: h, preUpgradeSave: legacy ?? null, preUpgrade }, null, 1);
}

function isSave(s: unknown): s is SaveData {
  const d = s as Partial<SaveData> | null;
  return !!d && d.schemaVersion === SCHEMA_VERSION && typeof d.profile?.id === 'string' && Array.isArray(d.companions) && d.companions.length > 0 && Array.isArray(d.souvenirIds) && !!d.settings && Array.isArray(d.offers) && Array.isArray(d.seenFacts) && Array.isArray(d.foundPlaces);
}

/** Throws without side effects if the file isn't a usable backup. */
export function parseBackup(text: string, pack: Pack): Household {
  let data: { format?: string; household?: Household };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new UnsupportedSaveError('This file is not a backup.');
  }
  let h = data?.household;
  if (data?.format !== FORMAT || !h?.meta || !h.profiles) throw new UnsupportedSaveError('This file is not an Atlaswild backup.');
  if (h.meta.schemaVersion >= 2 && h.meta.schemaVersion < SCHEMA_VERSION) {
    try {
      h = upgrade(h, pack);
    } catch {
      throw new UnsupportedSaveError('This backup is incomplete or damaged.');
    }
  }
  if (h.meta.schemaVersion !== SCHEMA_VERSION) throw new UnsupportedSaveError(`This backup uses schema ${h.meta.schemaVersion}, which this version can't read.`);
  const ids = h.meta.profileIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !isSave(h.profiles[id]) || h.profiles[id]?.profile.id !== id)) {
    throw new UnsupportedSaveError('This backup is incomplete or damaged.');
  }
  return { meta: { ...h.meta, activeProfileId: null }, profiles: h.profiles };
}
