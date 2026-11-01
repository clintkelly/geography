import type { Pack } from '../content/types';
import { DEFAULT_SETTINGS, newSave, SCHEMA_VERSION, type SaveData } from '../engine/game';
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

type V1Save = Omit<SaveData, 'settings'>;

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
        companion: { ...copied.companion, instanceId: `${id}-companion-1` },
        souvenirIds: copied.souvenirIds,
        completedExpeditions: copied.completedExpeditions,
        attempts: copied.attempts,
        recentQuestionIds: copied.recentQuestionIds,
        appliedRewardIds: copied.appliedRewardIds,
        nextId: copied.nextId,
        settings: DEFAULT_SETTINGS,
      };
    }).map((save) => {
      // The offer was rolled before souvenirs were copied, so it may repeat one already owned.
      const unowned = pack.souvenirs.filter((s) => !save.souvenirIds.includes(s.id));
      const rng = new Rng(save.rngState);
      const pick = rng.shuffle(unowned)[0];
      return { ...save, rngState: rng.state, offer: { id: `offer-${save.nextId}`, reward: pick ? { kind: 'souvenir' as const, souvenirId: pick.id } : { kind: 'bond' as const, xp: 10 } }, nextId: save.nextId + 1 };
    }),
  );
}

export async function openHousehold(store: SaveStore, pack: Pack, env: Env): Promise<Household> {
  const existing = await store.load();
  if (existing) return existing;
  const legacy = await store.loadLegacy();
  const created = legacy ? migrateV1(legacy, pack, env) : freshHousehold(pack, env);
  await store.replace(created);
  return created;
}

const FORMAT = 'atlaswild-backup';

export function exportBackup(h: Household, legacy: unknown, now: number): string {
  return JSON.stringify({ format: FORMAT, exportedAt: new Date(now).toISOString(), household: h, preUpgradeSave: legacy ?? null }, null, 1);
}

function isSave(s: unknown): s is SaveData {
  const d = s as Partial<SaveData> | null;
  return !!d && d.schemaVersion === SCHEMA_VERSION && typeof d.profile?.id === 'string' && !!d.companion && Array.isArray(d.souvenirIds) && !!d.settings && !!d.offer;
}

/** Throws without side effects if the file isn't a usable backup. */
export function parseBackup(text: string): Household {
  let data: { format?: string; household?: Household };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new UnsupportedSaveError('This file is not a backup.');
  }
  const h = data?.household;
  if (data?.format !== FORMAT || !h?.meta || !h.profiles) throw new UnsupportedSaveError('This file is not an Atlaswild backup.');
  if (h.meta.schemaVersion !== SCHEMA_VERSION) throw new UnsupportedSaveError(`This backup uses schema ${h.meta.schemaVersion}, which this version can't read.`);
  const ids = h.meta.profileIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !isSave(h.profiles[id]) || h.profiles[id]?.profile.id !== id)) {
    throw new UnsupportedSaveError('This backup is incomplete or damaged.');
  }
  return { meta: { ...h.meta, activeProfileId: null }, profiles: h.profiles };
}
