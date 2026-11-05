import { useEffect, useState } from 'react';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { BADGES } from '../engine/badges';
import { cardProgress } from '../engine/cards';
import { allowedDifficulties, FOCUSES, studySubject, FREE_POINTS, isRegionComplete, knownSpecies, lowestFor, regionHasFocus, type Command, type Companion, type Focus, type Offer, type SaveData } from '../engine/game';
import { TRAIL_LENGTHS, TRAIL_STOPS, type TrailLength } from '../engine/trail';
import { artUrl, CardArt, Fx, Sprite } from './art';
import { mapFor, place, region, rewardLabel, souvenir, species } from './content';
import { Key, useKeys } from './keys';
import { Passport } from './Passport';
import { Lodges, PatchIcon } from './Lodges';
import { EggNest, StudyRanks } from './Eggs';
import { eggName } from '../engine/eggs';
import { lodgeById, lodgesOf, nextLodge, patchOf } from '../engine/lodges';
import { LEVEL_NAME, MedalIcon, Medals } from './Medals';
import { MEDAL_TRACKS, MEDAL_POINTS } from '../engine/medals';
import { playSound } from './sound';
import { Stable, Wild } from './Stable';
import { Dot, WorldMap, type Highlight } from './WorldMap';
import { shinyLook, shinyName } from './shiny';

const FOCUS_LABELS: Record<Focus, { name: string; text: string }> = {
  all: { name: 'Everything', text: 'Places, capitals, flags, nicknames, animals, history and fun facts' },
  basics: { name: 'Places and capitals', text: 'Just where it is and its capital' },
  flags: { name: 'Flags', text: 'Just flags. US states and Antarctica have none yet.' },
  animals: { name: 'Animals', text: 'Which place is home to which wild animal' },
  history: { name: 'History', text: 'Ancient peoples, famous firsts and how places got their stories' },
  math: { name: 'Math', text: 'Factors, fractions and integers. Harder trails mean typing answers.' },
  words: { name: 'Words', text: 'Vocabulary: meanings, sentences, roots, and spelling on Expert' },
};

const DESCRIPTIONS: Record<Difficulty, string> = {
  scout: 'Faraway wrong answers',
  ranger: 'Close calls, like cities in the same state',
  expert: 'Close calls, and find states on a blank map',
};
const MINUTES: Record<TrailLength, string> = { short: 'about 15 minutes', standard: 'about 25 minutes', long: 'about 35 minutes' };
const title = (d: string) => d[0]?.toUpperCase() + d.slice(1);
const RANK: Record<Difficulty, number> = { scout: 0, ranger: 1, expert: 2 };

/** A lock tag for creatures met only on harder trails. */
export function LockTag({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`lock-tag lock-${difficulty}`}>{title(difficulty)} trails{difficulty === 'ranger' ? ' or harder' : ' only'}</span>;
}

/** The big moment: the new friend turned out shiny. */
function ShinyReveal({ color }: { color: string }) {
  useEffect(() => {
    playSound('card');
    const t = setTimeout(() => playSound('levelup'), 450);
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="shiny-reveal" role="status">
      {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`burst burst-${i}`} />)}
      <strong>✦ It's SHINY! ✦</strong> <span>{color}! Every shiny has its own color. Harder trails find more of these.</span>
    </p>
  );
}

function Sighting({ offer, selected, onPick }: { offer: Offer; selected: boolean; onPick: () => void }) {
  const { reward } = offer;
  return (
    <button type="button" className="sighting" aria-pressed={selected} onClick={(e) => { onPick(); e.currentTarget.blur(); }}>
      {reward.kind === 'creature'
        ? <><Sprite id={species(reward.speciesId).artId} size={96} className="silhouette" /><strong>{species(reward.speciesId).boss ? 'Continent Boss!' : species(reward.speciesId).rare ? 'Rare creature!' : species(reward.speciesId).minDifficulty ? 'Hidden creature!' : 'Mystery creature'}</strong>{species(reward.speciesId).minDifficulty && <LockTag difficulty={lowestFor(species(reward.speciesId))} />}{species(reward.speciesId).secondType && <span className="dual-tag">Two types!</span>}<span className="muted">{species(reward.speciesId).flavor}</span></>
        : <><strong>Rival hunt</strong><span className="muted">Every creature is in your stable. Reward: {rewardLabel(reward)}</span></>}
    </button>
  );
}

/** The next Lodge to beat, so the ladder is never far from mind. */
function LodgeTeaser({ save, onOpen }: { save: SaveData; onOpen: () => void }) {
  const beaten = save.lodgesBeaten ?? [];
  const next = nextLodge(PACK, beaten);
  return (
    <button type="button" className="lodge-teaser" onClick={onOpen}>
      <span className="patch-row">{lodgesOf(PACK).map((l) => <PatchIcon key={l.id} lodge={l} earned={beaten.includes(l.id)} size={24} />)}</span>
      <span>{next ? <>Next Ranger Lodge: <strong>{next.name}</strong> · {next.subjectName}</> : <>You beat every Ranger Lodge. Grand Ranger!</>}</span>
    </button>
  );
}

/** Creatures just added to the game that this child hasn't met, and where to find them. */
function NewInTheWild({ known, onGo }: { known: Set<string>; onGo: (regionId: string) => void }) {
  const fresh = PACK.species.filter((o) => o.fresh && !known.has(o.id));
  if (fresh.length === 0) return null;
  const homes = [...new Set(fresh.map((o) => o.homes[0]!))];
  return (
    <div className="new-wild">
      <strong>✨ New creatures in the wild!</strong>
      {homes.map((h) => {
        const here = fresh.filter((o) => o.homes[0] === h);
        const kungfu = here.some((o) => o.type === 'kungfu');
        return (
          <button key={h} type="button" className="new-wild-region" onClick={() => onGo(h)}>
            <span className="new-wild-row">{here.map((o) => <Sprite key={o.id} id={o.artId} size={40} />)}</span>
            <span>{kungfu ? <><strong>Kung Fu type</strong> in </> : ''}{region(h).label} →</span>
          </button>
        );
      })}
    </div>
  );
}

/** Who lives on Math and Words trails, so a child knows what they might meet. */
function StudyCreatures({ subject, known }: { subject: 'math' | 'words'; known: Set<string> }) {
  const scholars = PACK.species.filter((o) => o.subject === subject);
  if (scholars.length === 0) return null;
  const met = scholars.filter((o) => known.has(o.id)).length;
  return (
    <div className="study-creatures">
      <span>{subject === 'math' ? 'Math' : 'Words'} creatures live on these trails{met > 0 ? ` (${met} of ${scholars.length} befriended)` : ''}. Win them over with Bold Befriend!</span>
      {scholars.map((o) => <Sprite key={o.id} id={o.artId} size={48} className={known.has(o.id) ? 'idle-sprite' : 'silhouette'} />)}
    </div>
  );
}

/**
 * The creatures that joined on the last trip, newest first within a kind. The same kind can join twice,
 * so each one is matched to its own stable entry rather than the first of that kind.
 */
export function newcomers(save: SaveData, speciesIds: readonly string[]): Companion[] {
  const used = new Set<string>();
  return speciesIds.flatMap((id) => {
    const match = [...save.companions].reverse().find((c) => c.speciesId === id && c.bondXp === 0 && !c.freedOnce && !used.has(c.instanceId));
    if (!match) return [];
    used.add(match.instanceId);
    return [match];
  });
}

export function Camp({ save, dispatch, onSwitch, onSettings }: { save: SaveData; dispatch: (c: Command) => void; onSwitch: () => void; onSettings: () => void }) {
  const s = save.lastSummary;
  // Only the newest of that kind is the one that just joined; an older shiny copy doesn't count.
  const newest = s?.reward.kind === 'creature' ? save.companions.filter((c) => s.reward.kind === 'creature' && c.speciesId === s.reward.speciesId).at(-1) : undefined;
  const shinyJoined = !!newest?.shiny && newest.bondXp === 0;
  const regions = PACK.regions.filter((r) => !save.settings.disabledRegions.includes(r.id));
  const [chosenRegion, setRegionId] = useState(save.settings.lastRegionId);
  const regionId = regions.some((r) => r.id === chosenRegion) ? chosenRegion : (regions[0] as { id: string }).id;
  const [trail, setTrail] = useState<TrailLength>(save.settings.lastTrail);
  const [offerId, setOfferId] = useState<string>();
  const sightings = save.offers.filter((o) => o.regionId === regionId);
  const offer = sightings.find((o) => o.id === offerId) ?? (sightings[0] as Offer);
  const allowed = allowedDifficulties(save.settings, region(regionId));
  const [picked, setPicked] = useState<Difficulty>(save.settings.lastDifficulty);
  const floor: Difficulty = offer.reward.kind === 'creature' ? lowestFor(species(offer.reward.speciesId)) : 'scout';
  const choice = allowed.includes(picked) ? picked : (allowed[0] as Difficulty);
  const difficulty: Difficulty = RANK[choice] >= RANK[floor] ? choice : floor;
  const known = knownSpecies(save);
  const hidden = PACK.species.filter((o) => o.minDifficulty && o.homes.includes(regionId) && !known.has(o.id));
  const regionCards = PACK.cards.filter((c) => place(c.placeId).regionId === regionId);
  const earnedCards = regionCards.filter((c) => save.stateCards.includes(c.placeId));
  const places = PACK.places.filter((p) => p.regionId === regionId);
  const found = places.filter((p) => save.foundPlaces.includes(p.id));
  const rare = PACK.species.find((o) => o.rare && o.homes.includes(regionId));
  const rareOwned = !!rare && known.has(rare.id);
  const mapLevel = (id: string): Highlight => {
    if (!save.stateCards.includes(id)) return 'found';
    const { level } = cardProgress(save.learning, id);
    return level === 'bronze' ? 'found' : level === 'silver' ? 'silver' : level === 'gold' ? 'gold' : 'shiny';
  };
  const mapHighlights = Object.fromEntries(found.map((p): [string, Highlight] => [p.featureId, mapLevel(p.id)]));

  const [focusPick, setFocusPick] = useState<Focus>(save.settings.lastFocus ?? 'all');
  const focuses = FOCUSES.filter((f) => regionHasFocus(PACK, regionId, f, save.settings.study));
  const focus = focuses.includes(focusPick) ? focusPick : 'all';
  const [showPassport, setShowPassport] = useState(false);
  const [showMedals, setShowMedals] = useState(false);
  const [showLodges, setShowLodges] = useState(false);
  const start = () => dispatch({ type: 'start', offerId: offer.id, regionId, difficulty, trail, focus });
  const cycle = <T,>(list: readonly T[], now: T) => list[(list.indexOf(now) + 1) % list.length] as T;
  useKeys(showPassport || showMedals || showLodges ? {} : {
    enter: start,
    r: () => setRegionId(cycle(regions.map((r) => r.id), regionId)),
    l: () => setTrail(cycle(TRAIL_LENGTHS, trail)),
    t: () => setOfferId(cycle(sightings.map((o) => o.id), offer.id)),
    f: () => setFocusPick(cycle(focuses, focus)),
    v: () => setShowPassport(true),
    m: () => setShowMedals(true),
    g: () => setShowLodges(true),
    p: onSwitch,
    o: onSettings,
    ...Object.fromEntries(allowed.filter((d) => RANK[d] >= RANK[floor]).map((d) => [String(allowed.indexOf(d) + 1), () => setPicked(d)])),
  });

  if (showPassport) return <Passport save={save} onClose={() => setShowPassport(false)} />;
  if (showLodges) return <Lodges save={save} dispatch={dispatch} onClose={() => setShowLodges(false)} />;
  if (showMedals) return <Medals save={save} dispatch={dispatch} onClose={() => setShowMedals(false)} />;

  return (
    <div className="stack">
      {s && (
        <section className="panel summary" aria-live="polite">
          <div className="summary-head">
            <div>
              <h2>Welcome back to camp!</h2>
              {s.levelUp && <p className="level-up">Level up! Your companion reached level {s.levelUp}.</p>}
              {s.newStamp && <div className="stamp-slam"><img src={artUrl(`stamp-${s.newStamp}`)} alt="" width={96} height={96} /><span>New Passport stamp: <strong>{region(s.newStamp).label}</strong></span></div>}
              {(s.newMedals ?? []).map((m) => <p key={`${m.regionId}-${m.track}-${m.level}`} className="medal-new"><MedalIcon level={m.level} />New {LEVEL_NAME[m.level]} medal: <strong>{MEDAL_TRACKS.find((t) => t.id === m.track)?.label} of {region(m.regionId).label}</strong> <small>+{MEDAL_POINTS[m.level]} Trail Points next trail</small></p>)}
              {s.lodgeId && lodgeById(PACK, s.lodgeId) && <div className="stamp-slam"><PatchIcon lodge={lodgeById(PACK, s.lodgeId)!} earned tier={s.newPatch ?? patchOf(save, s.lodgeId)} size={64} /><span>{s.newPatch ? <>New {s.newPatch === 'bronze' ? '' : `${s.newPatch === 'gold' ? 'Gold' : 'Silver'} `}patch: <strong>{lodgeById(PACK, s.lodgeId)!.name.replace(' Lodge', '')} Patch</strong>{s.newPatch === 'gold' && <> · the legendary <strong>{species(lodgeById(PACK, s.lodgeId)!.legendaryId).displayName}</strong> joined you!</>}</> : <>You beat <strong>{lodgeById(PACK, s.lodgeId)!.name}</strong> again!</>}</span></div>}
              {s.eggLaid && <div className="stamp-slam"><img src={artUrl(`egg-${s.eggLaid}`)} alt="" width={64} height={64} className="sprite egg-wobble" /><span>You got a <strong>{eggName[s.eggLaid]}</strong>! Answer {s.eggLaid === 'words' ? 'vocabulary' : s.eggLaid === 'math' ? 'math' : 'math or vocabulary'} questions to hatch it.</span></div>}
              {s.collected && <p className="collect-milestone"><Fx id="badge" /> <strong>{s.collected} creatures found!</strong> Keep collecting!</p>}
              {(s.newBadges ?? []).map((id) => <p key={id} className="badge-new"><Fx id="badge" />New badge: <strong>{BADGES.find((b) => b.id === id)?.name}</strong></p>)}
              <p>{s.reward.kind === 'creature' ? <><strong>{rewardLabel(s.reward)}</strong> joined your stable!</> : <>You earned <strong>{rewardLabel(s.reward)}</strong>.</>}</p>
              {shinyJoined && newest && <ShinyReveal color={shinyName(shinyLook(newest.instanceId))} />}
              {s.tamedIds?.map((id, i) => <p key={`${id}-${i}`}><strong>{species(id).displayName}</strong> joined you mid-fight!</p>)}
              {newcomers(save, [...(s.reward.kind === 'creature' ? [s.reward.speciesId] : []), ...(s.tamedIds ?? [])]).map((joined) => (
                save.companions.length > 1 ? <button key={`home-${joined.instanceId}`} type="button" className="link" onClick={() => { playSound('free'); dispatch({ type: 'freeCompanion', instanceId: joined.instanceId }); }}>Not for me: send {species(joined.speciesId).displayName} home (+{FREE_POINTS} Trail Points, call it back any time)</button> : null
              ))}
              {s.correct >= Math.max(1, s.answered * 0.8) && s.difficulty !== 'expert' && <p className="nudge">Great tracking! {s.difficulty === 'ranger' ? 'Expert' : 'Ranger'} trails hide creatures you can't meet here. Try {s.difficulty === 'ranger' ? 'Expert' : 'Ranger'} next time!</p>}
              {s.souvenirId && <p>Found on the trail: <strong>{souvenir(s.souvenirId)?.displayName}</strong></p>}
              <p className="muted">{s.correct} of {s.answered} answers correct{s.xpGained ? ` · ${s.xpGained} bonus XP` : ''}{s.discoveryAssisted ? ' · used some research along the way' : ' · found every place on your own'}</p>
            </div>
            {s.reward.kind === 'creature' && <Sprite id={species(s.reward.speciesId).artId} size={96} shiny={shinyJoined && newest ? shinyLook(newest.instanceId) : undefined} />}
          </div>
          <button type="button" className="link" onClick={() => dispatch({ type: 'dismissSummary' })}>Dismiss</button>
        </section>
      )}

      <section className="panel">
        <div className="row spread"><span><h1>Base Camp</h1><span className="collected">Creatures found: <strong>{known.size}</strong> of {PACK.species.length}</span><StudyRanks save={save} /></span><span className="row"><button type="button" onClick={() => setShowLodges(true)}>Ranger Lodges <Key k="G" /></button><button type="button" onClick={() => setShowMedals(true)}>Medals <Key k="M" /></button><button type="button" onClick={() => setShowPassport(true)}>Passport <Key k="V" /></button></span></div>
        <LodgeTeaser save={save} onOpen={() => setShowLodges(true)} />
        <NewInTheWild known={known} onGo={(id) => { setRegionId(id); playSound('zoom'); }} />
        <h2>New sightings</h2>
        <p>Track a creature across the map, then befriend it. <Key k="T" /> switches sighting.</p>
        <div className="sightings">
          {sightings.map((o) => <Sighting key={o.id} offer={o} selected={o.id === offer.id} onPick={() => { if (o.reward.kind === 'creature' && species(o.reward.speciesId).minDifficulty) playSound('locked'); setOfferId(o.id); }} />)}
        </div>
        <div className="picker" role="group" aria-label="Region">
          <span className="muted">Where <Key k="R" /></span>
          {[...new Set(regions.map((r) => r.continent))].map((continent) => (
            <div key={continent} className="continent-row">
              <span className="continent-name">{continent}</span>
              {regions.filter((r) => r.continent === continent).map((r) => (
                <button key={r.id} type="button" aria-pressed={r.id === regionId} onClick={(e) => { setRegionId(r.id); e.currentTarget.blur(); }}>{r.label}</button>
              ))}
            </div>
          ))}
        </div>
        <div className="picker" role="group" aria-label="Question focus">
          <span className="muted">Ask about <Key k="F" /></span>
          {FOCUSES.map((f) => (
            <button key={f} type="button" disabled={!focuses.includes(f)} aria-pressed={f === focus} onClick={(e) => { setFocusPick(f); e.currentTarget.blur(); }}>{FOCUS_LABELS[f].name}</button>
          ))}
          <span className="muted">{FOCUS_LABELS[focus].text}</span>
        </div>
        <p className="study-pitch">✦ <strong>Math</strong> and <strong>Words</strong> trails: <strong>double shiny chance</strong>, an easier map search, and every <strong>8 right answers lays an egg</strong> that hatches special creatures, like new platypuses and coatis!</p>
        {studySubject(focus) && <StudyCreatures subject={studySubject(focus) as 'math' | 'words'} known={known} />}
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
              <button key={d} type="button" disabled={RANK[d] < RANK[floor]} title={RANK[d] < RANK[floor] ? `This creature only shows up on ${title(floor)} trails` : undefined} aria-pressed={d === difficulty} onClick={(e) => { setPicked(d); e.currentTarget.blur(); }}><Key k={i + 1} />{title(d)}</button>
            ))}
            <span className="muted">{DESCRIPTIONS[difficulty]}{difficulty !== 'scout' ? ` · +${difficulty === 'expert' ? 4 : 2} Trail Points to start` : ''}</span>
          </div>
        )}
        {floor !== 'scout' && <p className="muted">This creature hides from easier trails, so this trip is {title(floor)} or harder.</p>}
        {hidden.length > 0 && (
          <div className="hidden-hint">
            {hidden.map((o) => <Sprite key={o.id} id={o.artId} size={48} className="silhouette" />)}
            <span>{hidden.length === 1 ? '1 creature' : `${hidden.length} creatures`} in {region(regionId).label} only show up on harder trails: {[...new Set(hidden.map((o) => title(lowestFor(o))))].join(' and ')}.</span>
          </div>
        )}
        <button type="button" className="primary" onClick={start}>Start expedition <Key k="Enter" /></button>
        {(save.bankedPoints ?? 0) > 0 && <p className="muted">Medal bonus: +{save.bankedPoints} Trail Points on this trail.</p>}
      </section>

      <EggNest save={save} dispatch={dispatch} />

      <section className="panel">
        <h2>Your stable</h2>
        <Stable companions={save.companions} activeId={save.activeCompanionId} dispatch={dispatch} />
      </section>
      <Wild wild={save.wild ?? []} dispatch={dispatch} />

      <section className="panel">
        <h2>Explorer's Map: {found.length} of {places.length} in {region(regionId).label}</h2>
        <div className="explorer-map"><WorldMap key={regionId} map={mapFor(regionId)} label={`Map of ${region(regionId).label} with ${found.length} of ${places.length} places found`} highlights={mapHighlights} interactive={false}>
          {(scale) => places.filter((p) => p.tiny).map((p) => <Dot key={p.id} id={p.id} at={mapFor(regionId).project(p.lonLat)} scale={scale} tone={found.includes(p) ? 'correct' : 'default'} />)}
        </WorldMap></div>
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
        <h2>{regionId.startsWith('us-') ? 'State' : regionId === 'antarctica' ? 'Landmark' : 'Country'} Cards: {earnedCards.length} of {regionCards.length}</h2>
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
