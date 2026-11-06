import { useEffect, useMemo } from 'react';
import { activeCompanion, currentSlotIndex, knownSpecies, type Command, type Expedition, type SaveData } from '../engine/game';
import { NewCreatureReveal } from './NewCreature';
import { TRAIL_EVENTS } from '../engine/events';
import { artUrl, Fx, Sprite } from './art';
import { companionView, mapFor, place, rewardLabel, species } from './content';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';
import { Marker, WorldMap } from './WorldMap';

const FLIGHT = ['alaska', 'hawaii', 'iceland', 'malta'];

export function Route({ e, save, dispatch }: { e: Expedition; save: SaveData; dispatch: (c: Command) => void }) {
  useKeys({ enter: () => dispatch({ type: 'enterEncounter' }) });
  const index = currentSlotIndex(e);
  const slot = e.slots[index];
  // Only stops already reached are drawn, so the map doesn't give away where the trail goes.
  const reached = e.slots.slice(0, index + 1);
  const highlights = useMemo(
    () => Object.fromEntries(reached.map((s, i) => [place(s.locationId).featureId, i === index && !e.retreated ? ('arrive' as const) : ('route' as const)])),
    [e.slots, index, e.retreated], // eslint-disable-line
  );
  // Arriving at a new place, not reloading into one that was already found.
  useEffect(() => {
    if (!e.retreated) playSound('correct');
  }, [index]); // eslint-disable-line
  if (!slot) return null;

  const map = mapFor(e.regionId);
  // Legs already walked stay dashed. The newest one draws itself, with the companion hopping along it.
  const points = reached.map((s) => map.project(place(s.locationId).lonLat));
  const line = points.slice(0, -1).map((p) => p.join(',')).join(' ');
  const from = points[points.length - 2];
  const to = points[points.length - 1] as [number, number];
  const walking = !!from && !e.retreated && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const here = place(slot.locationId);
  const previous = e.slots[index - 1];
  const flight = !!previous && (FLIGHT.includes(here.id) || FLIGHT.includes(previous.locationId));
  const opponent = slot.opponentId ? species(slot.opponentId) : null;
  const event = TRAIL_EVENTS.find((t) => t.id === slot.eventId);
  const final = slot.kind === 'guardian';

  return (
    <div className="stack">
      <TrailBar e={e} save={save} />
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
          <details className="study">
            <summary>Study {here.name} first</summary>
            <ul>{here.atlas.map((line) => <li key={line}>{line}</li>)}</ul>
          </details>
          <button type="button" className="primary" onClick={() => dispatch({ type: 'enterEncounter' })}>{e.retreated ? 'Try again' : event ? 'Take a look' : 'Begin encounter'} <Key k="Enter" /></button>
        </section>
        <section className="discovery-map">
          <WorldMap map={map} label={`Route map. Now at ${here.name}`} highlights={highlights} {...(e.retreated ? {} : { zoomTo: here.featureId, zoomDelay: 1100, onZoom: () => playSound('zoom') })}>
            {(scale) => (
              <>
                <polyline points={line} className="route-line" strokeWidth={2.5 * scale} strokeDasharray={`${6 * scale} ${5 * scale}`} />
                {from && <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} className={`route-new${walking ? ' drawing' : ''}`} pathLength={1} strokeWidth={3 * scale} />}
                {walking && from && (
                  <g>
                    <animateMotion dur="0.8s" fill="freeze" path={`M${from[0]},${from[1]} L${to[0]},${to[1]}`} />
                    <g>
                      <animateTransform attributeName="transform" type="translate" values={`0,0; 0,${-14 * scale}; 0,0`} dur="0.2s" repeatCount="4" />
                      <image href={artUrl(species(activeCompanion(save).speciesId).artId)} x={-16 * scale} y={-32 * scale} width={32 * scale} height={32 * scale} />
                    </g>
                  </g>
                )}
                {reached.filter((s) => s.status === 'won' || e.retreated).map((s, i) => (
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

export function ExpeditionComplete({ e, save, dispatch }: { e: Expedition; save: SaveData; dispatch: (c: Command) => void }) {
  useKeys({ enter: () => dispatch({ type: 'claimReward' }) });
  const { reward } = e;
  const firstOfKind = reward.kind === 'creature' && !knownSpecies(save).has(reward.speciesId);
  return (
    <section className={`panel complete${firstOfKind ? ' complete-new' : ''}`}>
      <h1>Expedition complete!</h1>
      {reward.kind === 'creature' && firstOfKind && <NewCreatureReveal speciesId={reward.speciesId} found={knownSpecies(save).size + 1} />}
      {reward.kind === 'creature' && !firstOfKind && (
        <div className="celebrate">
          {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="heart" className={`rise rise-${i}`} />)}
          <Sprite id={species(reward.speciesId).artId} size={192} className="hop-loop" />
        </div>
      )}
      <p className="learn">{reward.kind === 'creature' ? <><strong>{rewardLabel(reward)}</strong> wants to join your stable!</> : <>You earned <strong>{rewardLabel(reward)}</strong>.</>}</p>
      <p className="muted">{e.correct} of {e.answered} answers correct</p>
      {e.points > 0 && <p className="learn">Your {e.points} leftover Trail Points turn into <strong>{e.points} XP</strong> for {companionView(activeCompanion(save)).name}!</p>}
      <button type="button" className="primary" onClick={() => dispatch({ type: 'claimReward' })}>{reward.kind === 'creature' ? 'Welcome it home' : 'Return to camp'} <Key k="Enter" /></button>
    </section>
  );
}
