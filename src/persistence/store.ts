import { SCHEMA_VERSION, type SaveData } from '../engine/game';

export interface HouseholdMeta {
  schemaVersion: number;
  profileIds: string[];
  activeProfileId: string | null;
}

export interface Household {
  meta: HouseholdMeta;
  profiles: Record<string, SaveData>;
}

export interface SaveStore {
  load(): Promise<Household | null>;
  /** The untouched pre-upgrade save, if there was one. It is never deleted. */
  loadLegacy(): Promise<unknown>;
  saveProfile(save: SaveData): Promise<void>;
  saveMeta(meta: HouseholdMeta): Promise<void>;
  /** Replaces the whole household in one transaction. */
  replace(household: Household): Promise<void>;
}

export class UnsupportedSaveError extends Error {}

const DB_NAME = 'atlaswild';
const STORE = 'saves';
const LEGACY_KEY = 'household';
const META_KEY = 'meta';
const profileKey = (id: string) => `profile:${id}`;

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function assertSupported(version: number) {
  if (version !== SCHEMA_VERSION) {
    throw new UnsupportedSaveError(`Save uses schema ${version}; this version of the game reads ${SCHEMA_VERSION}.`);
  }
}

export function indexedDbStore(factory: IDBFactory = indexedDB): SaveStore {
  const db = open(factory);

  const get = async (key: string) => {
    const conn = await db;
    return new Promise<unknown>((resolve, reject) => {
      const req = conn.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const write = async (work: (store: IDBObjectStore) => void) => {
    const conn = await db;
    await new Promise<void>((resolve, reject) => {
      const tx = conn.transaction(STORE, 'readwrite');
      work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  return {
    async load() {
      const meta = (await get(META_KEY)) as HouseholdMeta | undefined;
      if (!meta) return null;
      assertSupported(meta.schemaVersion);
      const profiles: Record<string, SaveData> = {};
      for (const id of meta.profileIds) {
        const save = (await get(profileKey(id))) as SaveData | undefined;
        if (!save) throw new UnsupportedSaveError(`The save for profile ${id} is missing.`);
        assertSupported(save.schemaVersion);
        profiles[id] = save;
      }
      return { meta, profiles };
    },
    loadLegacy: () => get(LEGACY_KEY),
    saveProfile: (save) => write((s) => s.put(save, profileKey(save.profile.id))),
    saveMeta: (meta) => write((s) => s.put(meta, META_KEY)),
    async replace(household) {
      const current = (await get(META_KEY)) as HouseholdMeta | undefined;
      await write((s) => {
        for (const id of current?.profileIds ?? []) s.delete(profileKey(id));
        for (const save of Object.values(household.profiles)) s.put(save, profileKey(save.profile.id));
        s.put(household.meta, META_KEY);
      });
    },
  };
}
