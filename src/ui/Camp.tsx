import { PACK } from '../content/pack';
import type { Command, SaveData } from '../engine/game';
import { Sprite } from './art';
import { rewardLabel, species } from './content';
import { Key, useKeys } from './keys';

export function Camp({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const companion = species(save.companion.speciesId);
  const s = save.lastSummary;
  const { reward } = save.offer;
  useKeys({ enter: () => dispatch({ type: 'start' }) });

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
          {save.companion.bondXp > 0 && <p className="muted">Bond: {save.companion.bondXp} XP</p>}
        </div>
      </section>

      <section className="panel offer">
        <div>
          <h2>A new creature has been sighted</h2>
          <p>Find its habitat, then win three encounters. About 10 minutes.</p>
          <p className="reward-preview">Reward: <strong>{rewardLabel(reward)}</strong></p>
        </div>
        {reward.kind === 'souvenir' && <Sprite id={reward.souvenirId} size={64} />}
        <button type="button" className="primary" onClick={() => dispatch({ type: 'start' })}>Start expedition <Key k="Enter" /></button>
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
    </div>
  );
}
