import { useRef, useState } from 'react';
import { DIFFICULTIES, type Difficulty } from '../content/types';
import { PACK } from '../content/pack';
import type { Command, SaveData } from '../engine/game';
import { exportBackup, parseBackup } from '../persistence/household';
import type { Household, SaveStore } from '../persistence/store';
import { Key, useKeys } from './keys';
import { playSound } from './sound';

const label = (d: Difficulty) => d[0]?.toUpperCase() + d.slice(1);

export function Settings({ save, household, store, dispatch, restore, onClose }: {
  save: SaveData;
  household: Household;
  store: SaveStore;
  dispatch: (c: Command) => void;
  restore: (h: Household) => void;
  onClose: () => void;
}) {
  useKeys({ escape: onClose });
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const { settings, profile } = save;
  const min = DIFFICULTIES.indexOf(settings.minDifficulty);
  const max = DIFFICULTIES.indexOf(settings.maxDifficulty);

  const download = async () => {
    const text = exportBackup(household, await store.loadLegacy(), Date.now(), { v2: await store.loadPreUpgrade(2), v3: await store.loadPreUpgrade(3) });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    link.download = `atlaswild-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Backup downloaded.');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = parseBackup(await f.text(), PACK);
      const names = Object.values(parsed.profiles).map((p) => `${p.profile.displayName} (${p.completedExpeditions} expeditions)`).join(', ');
      if (window.confirm(`Replace all current progress with this backup?\n\n${names}`)) restore(parsed);
      else setMessage('Restore canceled. Nothing changed.');
    } catch (err) {
      setMessage(`${err instanceof Error ? err.message : 'That file could not be read.'} Nothing changed.`);
    }
    if (file.current) file.current.value = '';
  };

  return (
    <div className="stack">
      <section className="panel">
        <h1>Settings for {profile.displayName}</h1>
        <label className="field">Name
          <input value={profile.displayName} maxLength={24} onChange={(e) => dispatch({ type: 'updateProfile', patch: { displayName: e.target.value } })} />
        </label>
        <label className="field">Picture
          <select value={profile.avatarId} onChange={(e) => dispatch({ type: 'updateProfile', patch: { avatarId: e.target.value } })}>
            {PACK.species.map((s) => <option key={s.id} value={s.artId}>{s.displayName}</option>)}
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>Difficulty limits (parent)</h2>
        <label className="field">Easiest allowed
          <select value={settings.minDifficulty} onChange={(e) => dispatch({ type: 'updateSettings', patch: { minDifficulty: e.target.value as Difficulty } })}>
            {DIFFICULTIES.filter((_, i) => i <= max).map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
        </label>
        <label className="field">Hardest allowed
          <select value={settings.maxDifficulty} onChange={(e) => dispatch({ type: 'updateSettings', patch: { maxDifficulty: e.target.value as Difficulty } })}>
            {DIFFICULTIES.filter((_, i) => i >= min).map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>Sound</h2>
        <label className="field"><input type="checkbox" checked={settings.muted} onChange={(e) => dispatch({ type: 'updateSettings', patch: { muted: e.target.checked } })} /> Mute</label>
        <label className="field">Volume
          <input type="range" min={0} max={1} step={0.1} value={settings.volume} onChange={(e) => dispatch({ type: 'updateSettings', patch: { volume: Number(e.target.value) } })} onPointerUp={() => playSound('correct')} />
        </label>
      </section>

      <section className="panel">
        <h2>Backup</h2>
        <p className="muted">Saves live only in this browser. A backup file covers both children and can restore them later.</p>
        <div className="row">
          <button type="button" onClick={() => void download()}>Download backup</button>
          <button type="button" onClick={() => file.current?.click()}>Restore from file</button>
          <input ref={file} type="file" accept=".json,application/json" hidden aria-label="Backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        {message && <p role="status">{message}</p>}
      </section>

      <button type="button" className="primary back" onClick={onClose}>Back to camp <Key k="Esc" /></button>
    </div>
  );
}
