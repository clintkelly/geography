import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { newSave, reduce } from '../engine/game';
import { indexedDbStore, UnsupportedSaveError } from './store';

describe('IndexedDB store', () => {
  it('resumes an interrupted battle with the same question and option order', async () => {
    const factory = new IDBFactory();
    let s = reduce(newSave(PACK, 5, 'p1'), { type: 'start' }, PACK, 0);
    s = reduce(s, { type: 'guess', locationId: s.expedition!.targetId }, PACK, 0);
    s = reduce(s, { type: 'enterEncounter' }, PACK, 0);
    await indexedDbStore(factory).save(s);

    const loaded = await indexedDbStore(factory).load();
    expect(loaded).toEqual(s);
    expect(loaded!.expedition!.battle!.question.options).toEqual(s.expedition!.battle!.question.options);
  });

  it('starts empty and rejects an unsupported schema without overwriting it', async () => {
    const factory = new IDBFactory();
    const store = indexedDbStore(factory);
    expect(await store.load()).toBeNull();
    await store.save({ ...newSave(PACK, 5, 'p1'), schemaVersion: 999 });
    await expect(store.load()).rejects.toBeInstanceOf(UnsupportedSaveError);
  });
});
