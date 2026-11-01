import { useCallback, useEffect, useRef, useState } from 'react';
import { PACK } from '../content/pack';
import { reduce, type Command, type SaveData } from '../engine/game';
import { openHousehold } from '../persistence/household';
import type { Household, SaveStore } from '../persistence/store';

export interface GameHandle {
  household: Household | null;
  save: SaveData | null;
  /** Fatal load problem; the game does not start, and stored data is left untouched. */
  loadError: string | null;
  saveFailed: boolean;
  dispatch: (cmd: Command) => void;
  setActiveProfile: (id: string | null) => void;
  restore: (household: Household) => void;
}

/**
 * The ref holds the latest state, so a double click reduces against the
 * already-updated save and becomes a no-op. Each change is written to disk
 * before it is rendered, so animations always show a turn that is already safe.
 */
export function useGame(store: SaveStore): GameHandle {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const latest = useRef<Household | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: Household, write: () => Promise<void>) => {
    latest.current = next;
    queue.current = queue.current.then(async () => {
      try {
        await write();
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
      setHousehold(next);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    openHousehold(store, PACK, { seed: Math.floor(Math.random() * 0x7fffffff), makeId: () => crypto.randomUUID() })
      .then((opened) => {
        if (cancelled) return;
        latest.current = opened;
        setHousehold(opened);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'The save could not be read.');
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const dispatch = useCallback(
    (cmd: Command) => {
      const current = latest.current;
      const id = current?.meta.activeProfileId;
      const save = id ? current?.profiles[id] : undefined;
      if (!current || !id || !save) return;
      const nextSave = reduce(save, cmd, PACK, Date.now());
      if (nextSave === save) return;
      commit({ ...current, profiles: { ...current.profiles, [id]: nextSave } }, () => store.saveProfile(nextSave));
    },
    [commit, store],
  );

  const setActiveProfile = useCallback(
    (id: string | null) => {
      const current = latest.current;
      if (!current || current.meta.activeProfileId === id) return;
      const meta = { ...current.meta, activeProfileId: id };
      commit({ ...current, meta }, () => store.saveMeta(meta));
    },
    [commit, store],
  );

  const restore = useCallback((next: Household) => commit(next, () => store.replace(next)), [commit, store]);

  const id = household?.meta.activeProfileId;
  return { household, save: id ? (household?.profiles[id] ?? null) : null, loadError, saveFailed, dispatch, setActiveProfile, restore };
}
