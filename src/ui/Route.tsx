import { useMemo } from 'react';
import { currentSlotIndex, type Command, type Expedition } from '../engine/game';
import { TRAIL_EVENTS } from '../engine/events';
import { Sprite } from './art';
import { mapFor, place, rewardLabel, species } from './content';
import { Key, useKeys } from './keys';
import { TrailBar } from './TrailBar';
import { Marker, WorldMap } from './WorldMap';

const FLIGHT = ['alaska', 'hawaii', 'iceland', 'malta'];

export function Route({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  useKeys({ enter: () => dispatch({ type: 'enterEncounter' }) });
  const index = currentSlotIndex(e);
  const slot = e.slots[index];
  // Only stops already reached are drawn, so the map doesn't give away where the trail goes.
  const reached = e.slots.slice(0, index + 1);
  const highlights = useMemo(() => Object.fromEntries(reached.map((s) => [place(s.locationId).featureId, 'route' as const])), [e.slots, index]); // eslint-disable-line
  if (!slot) return null;

  const map = mapFor(e.regionId);
  const line = reached.map((s) => map.project(place(s.locationId).lonLat).join(',')).join(' ');
  const here = place(slot.locationId);
  const previous = e.slots[index - 1];
  const flight = !!previous && (FLIGHT.includes(here.id) || FLIGHT.includes(previous.locationId));
  const opponent = slot.opponentId ? species(slot.opponentId) : null;
  const event = TRAIL_EVENTS.find((t) => t.id === slot.eventId);
  const final = slot.kind === 'guardian';

  return (
    <div className="stack">
      <TrailBar e={e} />
      <div className="discovery">
        <section className="panel clues">
          {e.retreated
            ? <><h1>Back on the trail</h1><p role="status">{opponent?.displayName} held on this time. Your route and your points are safe, so you can try again.</p></>
            : <><h1>You found it: {here.name}!</h1><p>{flight ? 'You catch a flight to follow the trail.' : final ? 'The creature is here!' : 'The trail is getting warmer.'}</p></>}
          {opponent && (
            <div className="encounter-card">
              <Sprite id={opponent.artId} size={96} />
              <div>
                <h2>{final ? 'Final showdown: ' : ''}{opponent.displayName}</h2>
                <p className="muted">{opponent.flavor}</p>
              </div>
            </div>
          )}
          {event && <div className="encounter-card"><div><h2>Something on the trail</h2><p className="muted">{event.title}</p></div></div>}
          <button type="button" className="primary" onClick={() => dispatch({ type: 'enterEncounter' })}>{e.retreated ? 'Try again' : event ? 'Take a look' : 'Begin encounter'} <Key k="Enter" /></button>
        </section>
        <section className="discovery-map">
          <WorldMap map={map} label={`Route map. Now at ${here.name}`} highlights={highlights}>
            {(scale) => (
              <>
                <polyline points={line} className="route-line" strokeWidth={2.5 * scale} strokeDasharray={`${6 * scale} ${5 * scale}`} />
                {reached.map((s, i) => (
                  <Marker key={s.locationId} at={map.project(place(s.locationId).lonLat)} scale={scale} label={s.status === 'won' ? '✓' : String(i + 1)} tone={s.status === 'won' ? 'done' : 'current'} />
                ))}
              </>
            )}
          </WorldMap>
        </section>
        <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
      </div>
    </div>
  );
}

export function ExpeditionComplete({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  useKeys({ enter: () => dispatch({ type: 'claimReward' }) });
  const { reward } = e;
  return (
    <section className="panel complete">
      <h1>Expedition complete!</h1>
      {reward.kind === 'creature' && <Sprite id={species(reward.speciesId).artId} size={192} />}
      <p className="learn">{reward.kind === 'creature' ? <><strong>{rewardLabel(reward)}</strong> wants to join your stable!</> : <>You earned <strong>{rewardLabel(reward)}</strong>.</>}</p>
      <p className="muted">{e.correct} of {e.answered} answers correct · {e.points} leftover Trail Points become bond XP</p>
      <button type="button" className="primary" onClick={() => dispatch({ type: 'claimReward' })}>{reward.kind === 'creature' ? 'Welcome it home' : 'Return to camp'} <Key k="Enter" /></button>
    </section>
  );
}
