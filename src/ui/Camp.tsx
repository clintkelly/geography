import { useState } from 'react';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { allowedDifficulties, type Command, type SaveData } from '../engine/game';
import { Sprite } from './art';
import { region, rewardLabel, species } from './content';
import { Key, useKeys } from './keys';

const DESCRIPTIONS: Record<Difficulty, string> = {
  scout: 'Faraway wrong answers',
  ranger: 'Close calls, like cities in the same state',
  expert: 'Close calls, and find states on a blank map',
};
const title = (d: Difficulty) => d[0]?.toUpperCase() + d.slice(1);

export function Camp({ save, dispatch, onSwitch, onSettings }: { save: SaveData; dispatch: (c: Command) => void; onSwitch: () => void; onSettings: () => void }) {
  const companion = species(save.companion.speciesId);
  const s = save.lastSummary;
  const { reward } = save.offer;
  const [regionId, setRegionId] = useState(save.settings.lastRegionId);
  const allowed = allowedDifficulties(save.settings, region(regionId));
  const [picked, setPicked] = useState<Difficulty>(save.settings.lastDifficulty);
  const difficulty = allowed.includes(picked) ? picked : (allowed[0] as Difficulty);

  const start = () => dispatch({ type: 'start', regionId, difficulty });
  const nextRegion = () => {
    const i = PACK.regions.findIndex((r) => r.id === regionId);
    setRegionId((PACK.regions[(i + 1) % PACK.regions.length] as { id: string }).id);
  };
  useKeys({
    enter: start,
    r: nextRegion,
    p: onSwitch,
    o: onSettings,
    ...Object.fromEntries(allowed.map((d, i) => [String(i + 1), () => setPicked(d)])),
  });

  return (
    <div className="stack">
      {s && (
        <section className="panel summary" aria-live="polite">
          <div className="summary-head">
            <div>
              <h2>Welcome back to camp!</h2>
              <p>You brought home: <strong>{rewardLabel(s.reward)}</strong></p>
              <p className="muted">{s.correct} of {s.answered} answers correct{s.discoveryAssisted ? ' · found the habitat with some research' : ' · found the habitat on your own'}</p>
            </div>
            {s.reward.kind === 'souvenir' && <Sprite id={s.reward.souvenirId} size={64} />}
          </div>
          <button type="button" className="link" onClick={() => dispatch({ type: 'dismissSummary' })}>Dismiss</button>
        </section>
      )}

      <section className="camp-hero panel">
        <Sprite id={companion.artId} size={128} />
        <div>
          <h1>Base Camp</h1>
          <p><strong>{companion.displayName}</strong> is ready to go. {companion.flavor}</p>
          {companion.special && <p className="muted">Special: {companion.special.name}</p>}
          {save.companion.bondXp > 0 && <p className="muted">Bond: {save.companion.bondXp} XP</p>}
        </div>
      </section>

      <section className="panel">
        <div className="offer">
          <div>
            <h2>A new creature has been sighted</h2>
            <p>Find its habitat, then win three encounters. About 10 minutes.</p>
            <p className="reward-preview">Reward: <strong>{rewardLabel(reward)}</strong></p>
          </div>
          {reward.kind === 'souvenir' && <Sprite id={reward.souvenirId} size={64} />}
        </div>
        <div className="picker" role="group" aria-label="Region">
          <span className="muted">Where <Key k="R" /></span>
          {PACK.regions.map((r) => (
            <button key={r.id} type="button" aria-pressed={r.id === regionId} onClick={(e) => { setRegionId(r.id); e.currentTarget.blur(); }}>{r.label}</button>
          ))}
        </div>
        {allowed.length > 1 && (
          <div className="picker" role="group" aria-label="Difficulty">
            <span className="muted">How hard</span>
            {allowed.map((d, i) => (
              <button key={d} type="button" aria-pressed={d === difficulty} onClick={(e) => { setPicked(d); e.currentTarget.blur(); }}><Key k={i + 1} />{title(d)}</button>
            ))}
          </div>
        )}
        {allowed.length > 1 && <p className="muted">{DESCRIPTIONS[difficulty]}</p>}
        <button type="button" className="primary" onClick={start}>Start expedition <Key k="Enter" /></button>
      </section>

      <section className="panel">
        <h2>Expedition journal</h2>
        <ul className="journal">
          {PACK.souvenirs.map((item) => {
            const owned = save.souvenirIds.includes(item.id);
            return (
              <li key={item.id} className={owned ? '' : 'unowned'}>
                <Sprite id={item.artId} size={64} />
                <strong>{owned ? item.displayName : '???'}</strong>
                {owned && <span className="muted">{item.flavor}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="row">
        <button type="button" onClick={onSwitch}>Switch explorer <Key k="P" /></button>
        <button type="button" onClick={onSettings}>Settings and backup <Key k="O" /></button>
      </div>
    </div>
  );
}
