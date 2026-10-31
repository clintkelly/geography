import { useCallback, useEffect, useRef, useState } from 'react';
import { PACK } from '../content/pack';
import { newSave, reduce, type Command, type SaveData } from '../engine/game';
import type { SaveStore } from '../persistence/store';

export interface GameHandle {
  save: SaveData | null;
  /** Fatal load problem; the game does not start, and the stored save is left untouched. */
  loadError: string | null;
  saveFailed: boolean;
  dispatch: (cmd: Command) => void;
}

/**
 * The ref holds the latest state, so a double click reduces against the
 * already-updated save and becomes a no-op. Each change is written to disk
 * before it is rendered, so animations always show a turn that is already safe.
 */
export function useGame(store: SaveStore): GameHandle {
  const [save, setSave] = useState<SaveData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const latest = useRef<SaveData | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback(
    (next: SaveData) => {
      latest.current = next;
      queue.current = queue.current.then(async () => {
        try {
          await store.save(next);
          setSaveFailed(false);
        } catch {
          setSaveFailed(true);
        }
        setSave(next);
      });
    },
    [store],
  );

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        if (loaded) {
          latest.current = loaded;
          setSave(loaded);
        } else {
          commit(newSave(PACK, Math.floor(Math.random() * 0x7fffffff), crypto.randomUUID()));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'The save could not be read.');
      });
    return () => {
      cancelled = true;
    };
  }, [store, commit]);

  const dispatch = useCallback(
    (cmd: Command) => {
      const current = latest.current;
      if (!current) return;
      const next = reduce(current, cmd, PACK, Date.now());
      if (next !== current) commit(next);
    },
    [commit],
  );

  return { save, loadError, saveFailed, dispatch };
}
