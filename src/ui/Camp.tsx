import { useState } from 'react';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { BADGES } from '../engine/badges';
import { cardProgress } from '../engine/cards';
import { allowedDifficulties, isRegionComplete, type Command, type Offer, type SaveData } from '../engine/game';
import { TRAIL_LENGTHS, TRAIL_STOPS, type TrailLength } from '../engine/trail';
import { CardArt, Fx, Sprite } from './art';
import { mapFor, place, region, rewardLabel, souvenir, species } from './content';
import { Key, useKeys } from './keys';
import { Stable } from './Stable';
import { WorldMap, type Highlight } from './WorldMap';

const DESCRIPTIONS: Record<Difficulty, string> = {
  scout: 'Faraway wrong answers',
  ranger: 'Close calls, like cities in the same state',
  expert: 'Close calls, and find states on a blank map',
};
const MINUTES: Record<TrailLength, string> = { short: 'about 15 minutes', standard: 'about 25 minutes', long: 'about 35 minutes' };
const title = (d: string) => d[0]?.toUpperCase() + d.slice(1);

function Sighting({ offer, selected, onPick }: { offer: Offer; selected: boolean; onPick: () => void }) {
  const { reward } = offer;
  return (
    <button type="button" className="sighting" aria-pressed={selected} onClick={(e) => { onPick(); e.currentTarget.blur(); }}>
      {reward.kind === 'creature'
        ? <><Sprite id={species(reward.speciesId).artId} size={96} className="silhouette" /><strong>{species(reward.speciesId).rare ? 'Rare creature!' : 'Mystery creature'}</strong><span className="muted">{species(reward.speciesId).flavor}</span></>
        : <><strong>Rival hunt</strong><span className="muted">Every creature is in your stable. Reward: {rewardLabel(reward)}</span></>}
    </button>
  );
}

export function Camp({ save, dispatch, onSwitch, onSettings }: { save: SaveData; dispatch: (c: Command) => void; onSwitch: () => void; onSettings: () => void }) {
  const s = save.lastSummary;
  const regions = PACK.regions.filter((r) => !save.settings.disabledRegions.includes(r.id));
  const [chosenRegion, setRegionId] = useState(save.settings.lastRegionId);
  const regionId = regions.some((r) => r.id === chosenRegion) ? chosenRegion : (regions[0] as { id: string }).id;
  const [trail, setTrail] = useState<TrailLength>(save.settings.lastTrail);
  const [offerId, setOfferId] = useState<string>();
  const sightings = save.offers.filter((o) => o.regionId === regionId);
  const offer = sightings.find((o) => o.id === offerId) ?? (sightings[0] as Offer);
  const allowed = allowedDifficulties(save.settings, region(regionId));
  const [picked, setPicked] = useState<Difficulty>(save.settings.lastDifficulty);
  const difficulty = allowed.includes(picked) ? picked : (allowed[0] as Difficulty);
  const regionCards = PACK.cards.filter((c) => place(c.placeId).regionId === regionId);
  const earnedCards = regionCards.filter((c) => save.stateCards.includes(c.placeId));
  const places = PACK.places.filter((p) => p.regionId === regionId);
  const found = places.filter((p) => save.foundPlaces.includes(p.id));
  const rare = PACK.species.find((o) => o.rare && o.homes.includes(regionId));
  const rareOwned = save.companions.some((c) => c.speciesId === rare?.id);
  const mapLevel = (id: string): Highlight => {
    if (!save.stateCards.includes(id)) return 'found';
    const { level } = cardProgress(save.learning, id);
    return level === 'bronze' ? 'found' : level === 'silver' ? 'silver' : level === 'gold' ? 'gold' : 'shiny';
  };
  const mapHighlights = Object.fromEntries(found.map((p): [string, Highlight] => [p.featureId, mapLevel(p.id)]));

  const start = () => dispatch({ type: 'start', offerId: offer.id, regionId, difficulty, trail });
  const cycle = <T,>(list: readonly T[], now: T) => list[(list.indexOf(now) + 1) % list.length] as T;
  useKeys({
    enter: start,
    r: () => setRegionId(cycle(regions.map((r) => r.id), regionId)),
    l: () => setTrail(cycle(TRAIL_LENGTHS, trail)),
    t: () => setOfferId(cycle(sightings.map((o) => o.id), offer.id)),
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
              {s.levelUp && <p className="level-up">Level up! Your companion reached level {s.levelUp}.</p>}
              {(s.newBadges ?? []).map((id) => <p key={id} className="badge-new"><Fx id="badge" />New badge: <strong>{BADGES.find((b) => b.id === id)?.name}</strong></p>)}
              <p>{s.reward.kind === 'creature' ? <><strong>{rewardLabel(s.reward)}</strong> joined your stable!</> : <>You earned <strong>{rewardLabel(s.reward)}</strong>.</>}</p>
              {s.tamedIds?.map((id) => <p key={id}><strong>{species(id).displayName}</strong> joined you mid-fight!</p>)}
              {s.souvenirId && <p>Found on the trail: <strong>{souvenir(s.souvenirId)?.displayName}</strong></p>}
              <p className="muted">{s.correct} of {s.answered} answers correct{s.xpGained ? ` · ${s.xpGained} bonus XP` : ''}{s.discoveryAssisted ? ' · used some research along the way' : ' · found every place on your own'}</p>
            </div>
            {s.reward.kind === 'creature' && <Sprite id={species(s.reward.speciesId).artId} size={96} />}
          </div>
          <button type="button" className="link" onClick={() => dispatch({ type: 'dismissSummary' })}>Dismiss</button>
        </section>
      )}

      <section className="panel">
        <h1>Base Camp</h1>
        <h2>New sightings</h2>
        <p>Track a creature across the map, then befriend it. <Key k="T" /> switches sighting.</p>
        <div className="sightings">
          {sightings.map((o) => <Sighting key={o.id} offer={o} selected={o.id === offer.id} onPick={() => setOfferId(o.id)} />)}
        </div>
        <div className="picker" role="group" aria-label="Region">
          <span className="muted">Where <Key k="R" /></span>
          {regions.map((r) => (
            <button key={r.id} type="button" aria-pressed={r.id === regionId} onClick={(e) => { setRegionId(r.id); e.currentTarget.blur(); }}>{r.label}</button>
          ))}
        </div>
        <div className="picker" role="group" aria-label="Trail length">
          <span className="muted">How far <Key k="L" /></span>
          {TRAIL_LENGTHS.map((t) => (
            <button key={t} type="button" aria-pressed={t === trail} onClick={(e) => { setTrail(t); e.currentTarget.blur(); }}>{title(t)}</button>
          ))}
          <span className="muted">{TRAIL_STOPS[trail].length} stops, {MINUTES[trail]}</span>
        </div>
        {allowed.length > 1 && (
          <div className="picker" role="group" aria-label="Difficulty">
            <span className="muted">How hard</span>
            {allowed.map((d, i) => (
              <button key={d} type="button" aria-pressed={d === difficulty} onClick={(e) => { setPicked(d); e.currentTarget.blur(); }}><Key k={i + 1} />{title(d)}</button>
            ))}
            <span className="muted">{DESCRIPTIONS[difficulty]}</span>
          </div>
        )}
        <button type="button" className="primary" onClick={start}>Start expedition <Key k="Enter" /></button>
      </section>

      <section className="panel">
        <h2>Your stable</h2>
        <Stable companions={save.companions} activeId={save.activeCompanionId} dispatch={dispatch} />
      </section>

      <section className="panel">
        <h2>Explorer's Map: {found.length} of {places.length} in {region(regionId).label}</h2>
        <div className="explorer-map"><WorldMap map={mapFor(regionId)} label={`Map of ${region(regionId).label} with ${found.length} of ${places.length} places found`} highlights={mapHighlights} interactive={false} /></div>
        <p className="muted">{rareOwned ? `You filled this map and befriended ${rare?.displayName}!` : isRegionComplete(save.foundPlaces, PACK, regionId) ? 'Map complete! A rare creature has been sighted here.' : 'Fill the whole map to reveal a rare creature.'}</p>
      </section>

      <section className="panel">
        <h2>Badges: {save.badges.length} of {BADGES.length}</h2>
        <ul className="badges">
          {BADGES.map((b) => {
            const has = save.badges.includes(b.id);
            return <li key={b.id} className={has ? '' : 'unowned'}><Fx id="badge" /><strong>{b.name}</strong><span className="muted">{b.hint}</span></li>;
          })}
        </ul>
      </section>

      <section className="panel">
        <h2>{regionId === 'europe' ? 'Country' : 'State'} Cards: {earnedCards.length} of {regionCards.length}</h2>
        <ul className="album">
          {regionCards.map((c) => {
            const has = save.stateCards.includes(c.placeId);
            const progress = cardProgress(save.learning, c.placeId);
            return (
              <li key={c.placeId} className={has ? `state-card card-${progress.level}` : 'state-card unowned'}>
                <CardArt id={c.artId} width={128} />
                {has
                  ? <details><summary><strong>{c.name}</strong> <span className={`level-tag level-${progress.level}`}>{title(progress.level)}</span></summary>{progress.next && <p className="muted">{progress.next}</p>}<p>{c.subtitle}</p>{c.capital && <p>Capital: {c.capital}</p>}<ul>{c.facts.map((f) => <li key={f}>{f}</li>)}</ul></details>
                  : <strong>???</strong>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <h2>Souvenirs</h2>
        <ul className="journal">
          {PACK.souvenirs.map((item) => {
            const has = save.souvenirIds.includes(item.id);
            return (
              <li key={item.id} className={has ? '' : 'unowned'}>
                <Sprite id={item.artId} size={64} />
                <strong>{has ? item.displayName : '???'}</strong>
                {has && <span className="muted">{item.flavor}</span>}
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
