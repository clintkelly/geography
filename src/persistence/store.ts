import { SCHEMA_VERSION, type SaveData } from '../engine/game';

export interface SaveStore {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
}

export class UnsupportedSaveError extends Error {}

const DB_NAME = 'atlaswild';
const STORE = 'saves';
const KEY = 'household';

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** One atomic record per household. Migrations are added here as the schema grows. */
export function indexedDbStore(factory: IDBFactory = indexedDB): SaveStore {
  const db = open(factory);
  return {
    async load() {
      const conn = await db;
      const data = await new Promise<SaveData | undefined>((resolve, reject) => {
        const req = conn.transaction(STORE).objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result as SaveData | undefined);
        req.onerror = () => reject(req.error);
      });
      if (!data) return null;
      if (data.schemaVersion !== SCHEMA_VERSION) {
        throw new UnsupportedSaveError(`Save uses schema ${data.schemaVersion}; this version of the game reads ${SCHEMA_VERSION}.`);
      }
      return data;
    },
    async save(data) {
      const conn = await db;
      await new Promise<void>((resolve, reject) => {
        const tx = conn.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(data, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}
