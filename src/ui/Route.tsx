import { useMemo } from 'react';
import { currentSlotIndex, type Command, type Expedition } from '../engine/game';
import { Sprite } from './art';
import { place, rewardLabel, species } from './content';
import { Marker, project, WorldMap } from './WorldMap';

export function Route({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  const index = currentSlotIndex(e);
  const slot = e.slots[index];
  const highlights = useMemo(() => Object.fromEntries(e.slots.map((s) => [place(s.locationId).isoNumeric, 'route' as const])), [e.slots]);
  if (!slot) return null;
  const opponent = species(slot.opponentId);
  const stops = e.slots.map((s) => place(s.locationId));
  const line = stops.map((p) => project(p.lonLat).join(',')).join(' ');

  return (
    <div className="discovery">
      <section className="panel clues">
        {e.retreated
          ? <><h1>Back on the trail</h1><p role="status">{opponent.displayName} held on this time. Your route and your reward are safe, so you can try again.</p></>
          : index === 0
            ? <><h1>You found it: {place(e.targetId).name}!</h1><p>The trail starts here and leads onward.</p></>
            : <><h1>Encounter {index} complete</h1><p>On to the next stop.</p></>}
        <div className="encounter-card">
          <Sprite id={opponent.artId} size={96} />
          <div>
            <h2>{slot.kind === 'guardian' ? 'Guardian: ' : ''}{opponent.displayName}</h2>
            <p className="muted">Stop {index + 1} of 3 · {place(slot.locationId).name}</p>
            <p className="muted">{opponent.flavor}</p>
          </div>
        </div>
        <p className="reward-preview">Expedition reward: <strong>{rewardLabel(e.reward)}</strong></p>
        <button type="button" className="primary" onClick={() => dispatch({ type: 'enterEncounter' })}>{e.retreated ? 'Try again' : 'Begin encounter'}</button>
      </section>
      <section className="discovery-map">
        <WorldMap label={`Route map. Next stop: ${place(slot.locationId).name}`} highlights={highlights}>
          {(scale) => (
            <>
              <polyline points={line} className="route-line" strokeWidth={2.5 * scale} strokeDasharray={`${6 * scale} ${5 * scale}`} />
              {e.slots.map((s, i) => (
                <Marker key={s.locationId} lonLat={place(s.locationId).lonLat} scale={scale} label={s.status === 'won' ? '✓' : String(i + 1)} tone={s.status === 'won' ? 'done' : i === index ? 'current' : 'default'} />
              ))}
            </>
          )}
        </WorldMap>
      </section>
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}

export function ExpeditionComplete({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  return (
    <section className="panel complete">
      <h1>Expedition complete!</h1>
      {e.reward.kind === 'souvenir' && <Sprite id={e.reward.souvenirId} size={128} />}
      <p>You earned: <strong>{rewardLabel(e.reward)}</strong></p>
      <p className="muted">{e.correct} of {e.answered} answers correct</p>
      <button type="button" className="primary" onClick={() => dispatch({ type: 'claimReward' })}>Claim reward and return to camp</button>
    </section>
  );
}
