import { useEffect, useState } from 'react';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { BADGES } from '../engine/badges';
import { cardProgress } from '../engine/cards';
import { allowedDifficulties, FOCUSES, studySubject, FREE_POINTS, isRegionComplete, knownSpecies, lowestFor, regionHasFocus, type Command, type Companion, type Focus, type Offer, type SaveData } from '../engine/game';
import { TRAIL_LENGTHS, TRAIL_STOPS, type TrailLength } from '../engine/trail';
import { artUrl, CardArt, Fx, Sprite } from './art';
import { companionView, mapFor, place, region, rewardLabel, souvenir, species } from './content';
import { Key, useKeys } from './keys';
import { Passport } from './Passport';
import { Lodges, PatchIcon } from './Lodges';
import { EggNest, StudyRanks } from './Eggs';
import { eggName } from '../engine/eggs';
import { kaijuAlert, kaijuOf, lodgeById, lodgesOf, nextLodge, patchOf } from '../engine/lodges';
import { LEVEL_NAME, MedalIcon, Medals } from './Medals';
import { MEDAL_TRACKS, MEDAL_POINTS } from '../engine/medals';
import { playCry, playSound } from './sound';
import { isNight, NIGHT_FROM } from '../engine/night';
import { chainBoost, dayKey, regionProgress, VISITOR_SHINY_BOOST, visitorFor } from '../engine/juice';
import { levelOf, MAX_LEVEL, STAGE_2_LEVEL, STAGE_3_LEVEL, STAGES } from '../engine/progression';
import { Confetti } from './NewCreature';
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
  science: { name: 'Science', text: 'Experiments, matter, atoms, forces and motion. Harder trails ask you to use the ideas.' },
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
      <span>{next ? <>Next Ranger Lodge: <strong>{next.name}</strong> · {next.subjectName}</> : <>You beat every Ranger Lodge! <strong>⭐ The Starfall League is open.</strong></>}</span>
    </button>
  );
}

/** How many of the creatures that live in a region (day and night, not bosses or rares) a child has found. */
const regionFound = (regionId: string, known: Set<string>) => regionProgress(PACK, known, regionId);

/** Something new to find in a region right now: a new creature, a night creature after dark, or today's visitor. */
function regionHasNew(save: SaveData, regionId: string, known: Set<string>): boolean {
  const v = save.visitorDay ? visitorFor(PACK, save.visitorDay) : undefined;
  if (v?.homes[0] === regionId) return true;
  return PACK.species.some((o) => o.homes.includes(regionId) && o.homes.length <= 5 && !known.has(o.id) && (o.fresh || (o.night && save.offersNight)));
}

/** A creature that leveled up on the trail: its new level, and how close it is to evolving. */
function LevelCard({ save, instanceId, from, to }: { save: SaveData; instanceId: string; from: number; to: number }) {
  const c = save.companions.find((o) => o.instanceId === instanceId);
  if (!c) return null;
  const v = companionView(c);
  const next = to < STAGE_2_LEVEL ? STAGE_2_LEVEL : to < STAGE_3_LEVEL && v.species.evolutions ? STAGE_3_LEVEL : undefined;
  const stats = STAGES[v.stage];
  return (
    <div className="level-card">
      <Sprite id={v.artId} size={64} shiny={v.shiny} className="hop-once" />
      <div>
        <strong>{v.name}</strong>
        <span className="level-jump">Lv {from} → <b>{to}</b> ⬆</span>
        <small>{next ? `${next - to} more ${next - to === 1 ? 'level' : 'levels'} until it evolves!` : to >= MAX_LEVEL ? 'Max level!' : 'Fully evolved!'} · {stats.maxHp} HP, {stats.attack} Attack</small>
      </div>
    </div>
  );
}

/** A giant monster is heading for a real city: defend it! Plus the Kaiju Lab: every kaiju, beaten or not. */
function KaijuBanner({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const beaten = save.lodgesBeaten ?? [];
  const alert = kaijuAlert(PACK, beaten, save.visitorDay ?? dayKey(Date.now()));
  if (!alert?.kaiju || save.completedExpeditions < 2) return null;
  const k = alert.kaiju;
  const giant = species(alert.prizeSpeciesId);
  const place = PACK.places.find((p) => p.id === k.placeId);
  const best = Math.max(...save.companions.map((c) => levelOf(c.bondXp)));
  const again = beaten.includes(alert.id);
  return (
    <section className="kaiju-banner">
      <div className="kaiju-stripes" aria-hidden="true" />
      <div className="kaiju-body">
        <Sprite id={alert.leader.artId} size={112} className="kaiju-giant" />
        <div>
          <p className="kaiju-alert-title">⚠ KAIJU ALERT ⚠</p>
          <h2>{giant.displayName} is heading for {k.city}{place ? `, ${place.name}` : ''}!</h2>
          <p>{alert.leader.intro}</p>
          <p className="muted">Threat {'★'.repeat(k.threat)}{'☆'.repeat(6 - k.threat)} · three battles with your whole team · questions about {region(place?.regionId ?? '').label} · best with level {alert.recommendedLevel}+{best < alert.recommendedLevel ? ` (your best is ${best})` : ''}</p>
          <button type="button" className="primary kaiju-go" onClick={() => { playSound('evolve'); dispatch({ type: 'startLodge', lodgeId: alert.id }); }}>{again ? `Defend ${k.city} again!` : `Defend ${k.city}!`}</button>
        </div>
      </div>
      <div className="kaiju-lab" aria-label="Kaiju Lab">
        <small>Kaiju Lab:</small>
        {kaijuOf(PACK).map((l) => {
          const won = beaten.includes(l.id);
          return <span key={l.id} className="kaiju-lab-slot" title={won ? `${species(l.prizeSpeciesId).displayName}: you saved ${l.kaiju!.city}` : `???: threat ${l.kaiju!.threat}`}><Sprite id={l.prizeSpeciesId} size={36} className={won ? '' : 'silhouette'} /></span>;
        })}
      </div>
    </section>
  );
}

/** Today's visitor and the shiny chain: two reasons to play today. */
function DailyStrip({ save, known, onGo }: { save: SaveData; known: Set<string>; onGo: (regionId: string) => void }) {
  const v = save.visitorDay ? visitorFor(PACK, save.visitorDay) : undefined;
  const chain = save.shinyChain && save.shinyChain.count >= 1 ? save.shinyChain : undefined;
  if (!v && !chain) return null;
  return (
    <div className="daily-strip">
      {v && (
        <button type="button" className="visitor" onClick={() => onGo(v.homes[0]!)}>
          <Sprite id={v.artId} size={48} className="idle-sprite" />
          <span><strong>🎁 Today's visitor: {v.displayName}</strong><small>in {region(v.homes[0]!).label} · {VISITOR_SHINY_BOOST}× shiny chance today{known.has(v.id) ? ' · befriend another!' : ''}</small></span>
        </button>
      )}
      {chain && (
        <span className="chain-chip" title="Befriend the same kind again to keep the chain going">
          <Sprite id={species(chain.speciesId).artId} size={36} />
          <span><strong>🔗 Shiny chain ×{chain.count}</strong><small>Next {species(chain.speciesId).displayName}: {chainBoost(chain, chain.speciesId)}× shiny chance</small></span>
        </span>
      )}
    </div>
  );
}

/** Creatures just added to the game that this child hasn't met, and where to find them. */
function NewInTheWild({ known, onGo }: { known: Set<string>; onGo: (regionId: string) => void }) {
  const fresh = PACK.species.filter((o) => o.fresh && !o.night && !known.has(o.id));
  if (fresh.length === 0) return null;
  // The regions with the most new creatures first, so the strip stays short.
  const all = [...new Set(fresh.map((o) => o.homes[0]!))].sort((x, y) => fresh.filter((o) => o.homes[0] === y).length - fresh.filter((o) => o.homes[0] === x).length);
  const homes = all.slice(0, 6);
  return (
    <div className="new-wild">
      <strong>✨ {fresh.length} new creatures in the wild!</strong>
      {homes.map((h) => {
        const here = fresh.filter((o) => o.homes[0] === h);
        const kungfu = here.some((o) => o.type === 'kungfu');
        return (
          <button key={h} type="button" className="new-wild-region" onClick={() => onGo(h)}>
            <span className="new-wild-row">{here.slice(0, 4).map((o) => <Sprite key={o.id} id={o.artId} size={40} />)}{here.length > 4 && <small>+{here.length - 4}</small>}</span>
            <span>{kungfu ? <><strong>Kung Fu type</strong> in </> : ''}{region(h).label} →</span>
          </button>
        );
      })}
      {all.length > homes.length && <small className="muted">…and in {all.length - homes.length} more regions</small>}
    </div>
  );
}

/** Night creatures: out now, or a hint of when they come out. */
function NightCreatures({ night, known, onGo }: { night: boolean; known: Set<string>; onGo: (regionId: string) => void }) {
  const all = PACK.species.filter((o) => o.night);
  if (all.length === 0) return null;
  const unmet = all.filter((o) => !known.has(o.id));
  return (
    <div className={`night-strip${night ? ' is-night' : ''}`}>
      <strong>{night ? '🌙 Night has fallen! Night creatures are out.' : `🌙 Night creatures come out after ${NIGHT_FROM - 12} PM.`}</strong>
      <span className="muted">{all.length - unmet.length} of {all.length} found</span>
      {night
        ? <span className="night-row">{unmet.map((o) => <button key={o.id} type="button" className="night-pick" aria-label={`Go find the night creature in ${region(o.homes[0]!).label}`} onClick={() => onGo(o.homes[0]!)}><Sprite id={o.artId} size={36} className="silhouette" /><small>{region(o.homes[0]!).label}</small></button>)}</span>
        : <span className="night-row">{all.map((o) => <Sprite key={o.id} id={o.artId} size={32} className={known.has(o.id) ? '' : 'silhouette'} />)}</span>}
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
  // Night creatures come and go with the player's clock.
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const night = isNight(now);
      if (night !== !!save.offersNight) dispatch({ type: 'setNight', night });
      const day = dayKey(now);
      if (day !== save.visitorDay) dispatch({ type: 'newDay', day });
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [save.offersNight, save.visitorDay, dispatch]);
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
              {(s.regionsMastered ?? []).map((r) => (
                <div key={r} className="region-master">
                  <Confetti count={24} />
                  <span className="region-master-trophy" aria-hidden="true">🏆</span>
                  <span><strong>Region Master: {region(r).label}!</strong> You found every creature that lives there. A <strong>Rare Egg</strong> is in your nest!</span>
                </div>
              ))}
              {s.levelUps?.length
                ? <div className="level-cards">{s.levelUps.map((u) => <LevelCard key={u.instanceId} save={save} instanceId={u.instanceId} from={u.from} to={u.to} />)}</div>
                : s.levelUp && <p className="level-up">Level up! Your companion reached level {s.levelUp}.</p>}
              {s.newStamp && <div className="stamp-slam"><img src={artUrl(`stamp-${s.newStamp}`)} alt="" width={96} height={96} /><span>New Passport stamp: <strong>{region(s.newStamp).label}</strong></span></div>}
              {(s.newMedals ?? []).map((m) => <p key={`${m.regionId}-${m.track}-${m.level}`} className="medal-new"><MedalIcon level={m.level} />New {LEVEL_NAME[m.level]} medal: <strong>{MEDAL_TRACKS.find((t) => t.id === m.track)?.label} of {region(m.regionId).label}</strong> <small>+{MEDAL_POINTS[m.level]} Trail Points next trail</small></p>)}
              {s.lodgeId && lodgeById(PACK, s.lodgeId)?.kaiju && <div className="stamp-slam"><PatchIcon lodge={lodgeById(PACK, s.lodgeId)!} earned size={64} /><span>You saved <strong>{lodgeById(PACK, s.lodgeId)!.kaiju!.city}</strong> from {species(lodgeById(PACK, s.lodgeId)!.prizeSpeciesId).displayName}!{s.prizeId && <> A baby <strong>{species(s.prizeId).displayName}</strong> joined you!</>}</span></div>}
              {s.lodgeId && lodgeById(PACK, s.lodgeId) && !lodgeById(PACK, s.lodgeId)!.kaiju && <div className="stamp-slam"><PatchIcon lodge={lodgeById(PACK, s.lodgeId)!} earned tier={s.newPatch ?? patchOf(save, s.lodgeId)} size={64} /><span>{s.newPatch ? <>New {s.newPatch === 'bronze' ? '' : `${s.newPatch === 'gold' ? 'Gold' : 'Silver'} `}patch: <strong>{lodgeById(PACK, s.lodgeId)!.name.replace(' Lodge', '')} Patch</strong>{s.newPatch === 'gold' && <> · the legendary <strong>{species(lodgeById(PACK, s.lodgeId)!.legendaryId).displayName}</strong> joined you!</>}</> : <>You beat <strong>{lodgeById(PACK, s.lodgeId)!.name}</strong> again!</>}</span></div>}
              {s.eggLaid && <div className="stamp-slam"><img src={artUrl(`egg-${s.eggLaid}`)} alt="" width={64} height={64} className="sprite egg-wobble" /><span>You got a <strong>{eggName[s.eggLaid]}</strong>! Answer {s.eggLaid === 'words' ? 'vocabulary' : s.eggLaid === 'math' ? 'math' : s.eggLaid === 'science' ? 'science' : 'math, vocabulary or science'} questions to hatch it.</span></div>}
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
        <KaijuBanner save={save} dispatch={dispatch} />
        <NewInTheWild known={known} onGo={(id) => { setRegionId(id); playSound('zoom'); }} />
        <DailyStrip save={save} known={known} onGo={(id) => { setRegionId(id); playSound('zoom'); }} />
        <NightCreatures night={!!save.offersNight} known={known} onGo={(id) => { setRegionId(id); playSound('zoom'); }} />
        <h2>New sightings</h2>
        <p>Track a creature across the map, then befriend it. <Key k="T" /> switches sighting.</p>
        <div className="sightings">
          {sightings.map((o) => <Sighting key={o.id} offer={o} selected={o.id === offer.id} onPick={() => { if (o.reward.kind === 'creature' && species(o.reward.speciesId).minDifficulty) playSound('locked'); else if (o.reward.kind === 'creature') playCry(o.reward.speciesId); setOfferId(o.id); }} />)}
        </div>
        <div className="picker" role="group" aria-label="Region">
          <span className="muted">Where <Key k="R" /></span>
          {[...new Set(regions.map((r) => r.continent))].map((continent) => (
            <div key={continent} className="continent-row">
              <span className="continent-name">{continent}</span>
              {regions.filter((r) => r.continent === continent).map((r) => (
                <button key={r.id} type="button" aria-pressed={r.id === regionId} aria-label={r.label} title={`${regionFound(r.id, known).found} of ${regionFound(r.id, known).total} creatures found here`} onClick={(e) => { setRegionId(r.id); e.currentTarget.blur(); }}>{r.label}{regionHasNew(save, r.id, known) && <span className="region-sparkle" aria-hidden="true">✨</span>} <small className={`region-count${regionFound(r.id, known).found === regionFound(r.id, known).total ? ' region-done' : ''}`}>{regionFound(r.id, known).found === regionFound(r.id, known).total ? '★' : `${regionFound(r.id, known).found}/${regionFound(r.id, known).total}`}</small></button>
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
