import { useEffect } from 'react';
import { PACK } from '../content/pack';
import type { Lodge } from '../content/lodges';
import { activeCompanion, currentSlotIndex, knownSpecies, teamOf, type Command, type Expedition, type SaveData } from '../engine/game';
import { NewCreatureReveal } from './NewCreature';
import { leagueOf, lodgeById, lodgeOpen, lodgesOf, nextLodge, patchOf, type LodgeTier } from '../engine/lodges';
import { levelOf } from '../engine/progression';
import { artUrl, Fx, Sprite } from './art';
import { companionView, foeForm, species } from './content';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';
import { TypeBadge } from './TypeGuide';

export const lodgeOf = (e: Pick<Expedition, 'lodgeId'>) => lodgeById(PACK, e.lodgeId);

const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' } as const;

/** A Lodge patch, with a ring in its tier's color. */
export function PatchIcon({ lodge, earned, tier, size = 48 }: { lodge: Lodge; earned: boolean; tier?: LodgeTier | undefined; size?: number }) {
  return earned
    ? <img className={`patch-icon patch-${tier ?? 'bronze'}`} src={artUrl(lodge.patchArtId)} alt={`${lodge.name} ${TIER_NAME[tier ?? 'bronze']} Patch`} title={`${TIER_NAME[tier ?? 'bronze']} patch`} width={size} height={size} />
    : <span className="patch-icon patch-empty" style={{ width: size, height: size }} aria-label="No patch yet" />;
}

/** The ladder: every Lodge in order, with the next one to beat highlighted, then Silver and Gold rematches. */
export function Lodges({ save, dispatch, onClose }: { save: SaveData; dispatch: (c: Command) => void; onClose: () => void }) {
  const beaten = save.lodgesBeaten ?? [];
  const next = nextLodge(PACK, beaten);
  const nextOpen = next && lodgeOpen(PACK, save, next.id);
  const best = Math.max(...save.companions.map((c) => levelOf(c.bondXp)));
  const golds = Object.values(save.lodgeTiers ?? {}).filter((t) => t === 'gold').length;
  useKeys({ g: onClose, escape: onClose, ...(next && nextOpen ? { enter: () => dispatch({ type: 'startLodge', lodgeId: next.id }) } : {}) });
  return (
    <div className="stack lodges">
      <section className="panel">
        <h1>Ranger Lodges</h1>
        <p>Each Lodge has two junior rangers and a Lodge leader with a team of creatures. Every question in a Lodge is about one subject. Beat them in order: each one is harder than the last.</p>
        <ul className="lodge-tiers-key">
          <li><span className="tier-dot tier-bronze" /> <span><strong>Bronze:</strong> beat the Lodge to earn its patch and a creature you can't find anywhere else.</span></li>
          <li><span className="tier-dot tier-silver" /> <span><strong>Silver:</strong> a rematch on Ranger or harder, with evolved creatures. Win a <strong>Rare Egg</strong>!</span></li>
          <li><span className="tier-dot tier-gold" /> <span><strong>Gold:</strong> an Expert rematch with fully evolved teams, then a <strong>Mastery Test</strong>: get 9 of 10 right to win the Lodge's <strong>legendary creature</strong> and a <strong>shiny</strong> of its prize.</span></li>
        </ul>
        <p className="muted">The Echo and Gearworks Lodges start with a quiz at the door, and their leaders' creatures have a Brain Shield that only right answers can crack. Lose a battle and you can try it again right away.</p>
        <div className="patch-sash" aria-label={`Patches: ${beaten.length} of ${lodgesOf(PACK).length}, ${golds} Gold`}>
          {lodgesOf(PACK).map((l) => <PatchIcon key={l.id} lodge={l} earned={beaten.includes(l.id)} tier={patchOf(save, l.id)} size={40} />)}
        </div>
        <button type="button" onClick={onClose}>Back to camp <Key k="G" /></button>
      </section>
      <ol className="lodge-list">
        {lodgesOf(PACK).map((l) => {
          const patch = patchOf(save, l.id);
          const won = !!patch;
          const open = lodgeOpen(PACK, save, l.id);
          const isNext = l.id === next?.id && open;
          const prize = species(l.prizeSpeciesId);
          const legend = species(l.legendaryId);
          const testReady = (save.lodgeTestReady ?? []).includes(l.id);
          const silverOpen = lodgeOpen(PACK, save, l.id, 'silver');
          const goldOpen = lodgeOpen(PACK, save, l.id, 'gold');
          const blocker = !open && l.needsGold && lodgesOf(PACK).filter((o) => o.rank < l.rank).every((o) => beaten.includes(o.id))
            ? `Locked: earn a Gold patch at the ${lodgeById(PACK, l.needsGold)?.name} first.`
            : `Locked: beat the ${lodgesOf(PACK).find((o) => o.rank === l.rank - 1)?.name} first.`;
          return (
            <li key={l.id} className={`panel lodge-card lodge-${won ? 'won' : isNext ? 'next' : 'locked'}${patch === 'gold' ? ' lodge-gold' : ''}`}>
              <div className="lodge-leader">
                <img src={artUrl(l.leader.artId)} alt="" width={96} height={96} className={`sprite${open || won ? '' : ' silhouette'}`} />
              </div>
              <div className="lodge-body">
                <h2>{l.rank}. {l.name} <TypeBadge type={l.type} />{l.gate && <span className="quiz-tag">Quiz at the door</span>}</h2>
                <p><strong>{open || won ? l.leader.name : '???'}</strong> · {l.subjectName}</p>
                <p className="muted">Best with a level {l.recommendedLevel}+ creature{best >= l.recommendedLevel ? '' : ` · your best is level ${best}`}</p>
                {open && !won && <p className="lodge-quote">"{l.leader.intro}"</p>}
                {won ? <p className="lodge-status">{TIER_NAME[patch]} patch! {patch === 'gold' ? `${legend.displayName} is yours.` : `${prize.displayName} joined your stable.`}</p> : !open && <p className="lodge-status">{blocker}</p>}
                <div className="row">
                  {open && !won && <button type="button" className={isNext ? 'primary' : ''} onClick={() => dispatch({ type: 'startLodge', lodgeId: l.id })}>Enter the Lodge{isNext && <> <Key k="Enter" /></>}</button>}
                  {won && <button type="button" onClick={() => dispatch({ type: 'startLodge', lodgeId: l.id })}>Bronze rematch</button>}
                  {silverOpen && <button type="button" className={patch === 'bronze' ? 'primary tier-button tier-silver' : 'tier-button tier-silver'} onClick={() => dispatch({ type: 'startLodge', lodgeId: l.id, tier: 'silver' })}>{patch === 'bronze' ? 'Silver challenge' : 'Silver rematch'}</button>}
                  {goldOpen && !testReady && <button type="button" className={patch === 'silver' ? 'primary tier-button tier-gold' : 'tier-button tier-gold'} onClick={() => dispatch({ type: 'startLodge', lodgeId: l.id, tier: 'gold' })}>{patch === 'gold' ? 'Gold rematch' : 'Gold challenge'}</button>}
                  {testReady && <button type="button" className="primary tier-button tier-gold" onClick={() => dispatch({ type: 'startLodgeTest', lodgeId: l.id })}>Take the Mastery Test</button>}
                </div>
              </div>
              <div className="lodge-prize">
                <PatchIcon lodge={l} earned={won} tier={patch} />
                <Sprite id={prize.artId} size={56} className={won ? '' : 'silhouette'} />
                <small>{won ? prize.displayName : 'Prize creature'}</small>
                <Sprite id={legend.artId} size={56} className={patch === 'gold' ? 'legend-glow' : 'silhouette'} />
                <small>{patch === 'gold' ? legend.displayName : 'Gold: legendary'}</small>
              </div>
            </li>
          );
        })}
      </ol>
      <LeagueCard save={save} dispatch={dispatch} />
    </div>
  );
}

/** The Starfall League: open once every Lodge is beaten. Each Elite Ranger guards a star creature. */
function LeagueCard({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const league = leagueOf(PACK);
  if (!league?.gauntlet) return null;
  const open = lodgeOpen(PACK, save, league.id);
  const won = (save.lodgesBeaten ?? []).includes(league.id);
  const known = new Set([...save.companions, ...(save.wild ?? [])].map((c) => c.speciesId));
  const stars = [...league.gauntlet.map((r) => r.prizeSpeciesId), league.prizeSpeciesId];
  const fame = save.hallOfFame ?? [];
  const left = lodgesOf(PACK).filter((l) => !(save.lodgesBeaten ?? []).includes(l.id)).length;
  return (
    <section className={`panel league-card${open ? ' league-open' : ''}`}>
      <div className="league-head">
        <img src={artUrl(league.leader.artId)} alt="" width={96} height={96} className={`sprite${open ? '' : ' silhouette'}`} />
        <div>
          <h2>⭐ {league.name}</h2>
          <p>Four Elite Rangers and the Champion, one after another. Each Elite Ranger guards a <strong>star creature</strong>: beat their last creature to win it. Beat the Champion to join the <strong>Hall of Fame</strong>.</p>
          <p className="muted">Best with a team of level {league.recommendedLevel}+ creatures.{won ? ` Hall of Fame entries: ${fame.length}.` : ''}</p>
          {open
            ? <button type="button" className="primary" onClick={() => dispatch({ type: 'startLodge', lodgeId: league.id })}>{won ? 'Challenge the League again' : 'Enter the League'}</button>
            : <p className="lodge-status">Locked: beat {left === 1 ? 'the last Lodge' : `all ${lodgesOf(PACK).length} Lodges (${left} to go)`} to open the League.</p>}
        </div>
      </div>
      <div className="league-rangers">
        {league.gauntlet.map((r) => <span key={r.name} className="league-ranger"><img src={artUrl(r.artId)} alt="" width={56} height={56} className={`sprite${open ? '' : ' silhouette'}`} /><small>{open ? r.name.replace('Elite Ranger ', '') : '???'}</small><TypeBadge type={r.type} /></span>)}
      </div>
      <div className="league-stars">
        {stars.map((id) => <span key={id} className="league-star"><Sprite id={species(id).artId} size={56} className={known.has(id) ? 'legend-glow' : 'silhouette'} /><small>{known.has(id) ? species(id).displayName : '???'}</small></span>)}
      </div>
      {fame.length > 0 && (
        <div className="fame-row">
          <small>Last Hall of Fame team:</small>
          {fame.at(-1)!.team.map((c) => { const v = companionView(c); return <Sprite key={c.instanceId} id={v.artId} size={48} shiny={v.shiny} />; })}
        </div>
      )}
    </section>
  );
}

/** Between battles: who is next, and the leader waiting at the end. */
export function LodgeHall({ e, save, dispatch }: { e: Expedition; save: SaveData; dispatch: (c: Command) => void }) {
  const lodge = lodgeOf(e) as Lodge;
  useKeys({ enter: () => dispatch({ type: 'enterEncounter' }) });
  const index = currentSlotIndex(e);
  const slot = e.slots[index];
  useEffect(() => {
    if (!e.retreated) playSound('correct');
  }, [index]); // eslint-disable-line
  if (!slot) return null;
  const foe = species(slot.opponentId);
  const form = foeForm(foe, slot.opponentStage);
  const leaderUp = slot.role !== 'junior';
  const firstOfLeader = leaderUp && e.slots[index - 1]?.role === 'junior';
  const left = e.slots.filter((s, i) => i >= index && s.role !== 'junior' && s.trainer === slot.trainer).length;
  // In the League, each Elite Ranger steps up in turn, then the Champion.
  const portrait = slot.trainerArt ?? lodge.leader.artId;
  const ranger = lodge.gauntlet?.find((r) => r.name === slot.trainer);
  const newTrainer = leaderUp && e.slots[index - 1]?.trainer !== slot.trainer;
  const known = new Set([...save.companions, ...(save.wild ?? [])].map((c) => c.speciesId));
  const star = slot.prize && !known.has(slot.prize) ? species(slot.prize) : undefined;
  if (lodge.kaiju) {
    const k = lodge.kaiju;
    const phase = index + 1;
    const PHASES = [`${lodge.leader.name} is wading toward ${k.city}!`, `${lodge.leader.name} is angry now! Hold the line!`, `Final stand! ${lodge.leader.name} is almost at the city!`];
    return (
      <div className="stack">
        <TrailBar e={e} save={save} />
        <section className="panel lodge-hall kaiju-hall">
          <div className="kaiju-stripes" aria-hidden="true" />
          <h1>⚠ Defend {k.city}! ⚠</h1>
          {e.retreated
            ? <p role="status">{lodge.leader.name} pushed your team back! Rest up and try again: the city is still standing.</p>
            : <p className="kaiju-phase">Phase {phase} of {e.slots.length}: {PHASES[Math.min(index, PHASES.length - 1)]}</p>}
          <div className="kaiju-phases" aria-label="Battle phases">{e.slots.map((s, i) => <span key={i} className={s.status === 'won' ? 'done' : i === index ? 'now' : ''}>{s.status === 'won' ? '✔' : i + 1}</span>)}</div>
          <div className="encounter-card">
            <Sprite id={lodge.leader.artId} size={160} className="kaiju-giant" />
            <div>
              {index === 0 && !e.retreated && <p className="lodge-quote">{lodge.leader.intro}</p>}
              <p>Answer questions about places near {k.city} to power up your team. {slot.role === 'ace' ? 'Watch for its BIG attack every third turn, and Guard against it!' : 'Switch creatures with W if one gets tired.'}</p>
              <p className="muted">{foe.flavor}</p>
            </div>
          </div>
          <button type="button" className="primary" onClick={() => dispatch({ type: 'enterEncounter' })}>{e.retreated ? 'Try again' : 'Battle!'} <Key k="Enter" /></button>
        </section>
        <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Retreat to camp</button>
      </div>
    );
  }
  if (lodge.gauntlet) {
    return (
      <div className="stack">
        <TrailBar e={e} save={save} />
        <section className="panel lodge-hall league-hall">
          <h1>⭐ {lodge.name}</h1>
          {e.retreated
            ? <p role="status">{form.name} held on this time. Rest up and try again: you keep your place in the League.</p>
            : index === 0
              ? <p>Four Elite Rangers, then the Champion. Questions about <strong>everything</strong>. Lose a battle and you can try it again.</p>
              : newTrainer ? <p>{slot.trainer} steps up!</p> : <p>{slot.trainer} has {left} {left === 1 ? 'creature' : 'creatures'} left.</p>}
          <ol className="lodge-path league-path" aria-label="League battles">
            {e.slots.map((s, i) => (
              <li key={i} className={s.status === 'won' ? 'done' : i === index ? 'now' : ''}>
                <img src={artUrl(foeForm(species(s.opponentId), s.opponentStage).artId)} alt="" width={40} height={40} className={`sprite${s.status === 'won' || i === index ? '' : ' silhouette'}`} />
                <small>{s.trainer?.replace(/^(Elite Ranger|Champion) /, '')}</small>
              </li>
            ))}
          </ol>
          <div className="encounter-card">
            <img src={artUrl(portrait)} alt="" width={96} height={96} className="sprite" />
            <Sprite id={form.artId} size={96} />
            <div>
              <h2>{slot.trainer} sends out {form.name}!</h2>
              {newTrainer && !e.retreated && <p className="lodge-quote">"{ranger?.intro ?? lodge.leader.intro}"</p>}
              {star && <p className="star-prize">⭐ Beat it to win <strong>{star.displayName}</strong>, a star creature!</p>}
              {slot.role === 'ace' && <p className="boss-warning">This is {slot.trainer}'s ace. Watch for its BIG attack every third turn, and Guard against it!</p>}
              <p className="muted">{foe.flavor}</p>
            </div>
          </div>
          <button type="button" className="primary" onClick={() => dispatch({ type: 'enterEncounter' })}>{e.retreated ? 'Try again' : 'Battle!'} <Key k="Enter" /></button>
        </section>
        <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave the League</button>
      </div>
    );
  }
  return (
    <div className="stack">
      <TrailBar e={e} save={save} />
      <section className="panel lodge-hall">
        <h1>{lodge.name}{e.lodgeTier && e.lodgeTier !== 'bronze' ? <span className={`tier-label tier-${e.lodgeTier}`}>{TIER_NAME[e.lodgeTier]}</span> : null}</h1>
        {e.retreated
          ? <p role="status">{form.name} held on this time. Rest up and try again: you keep your place in the Lodge.</p>
          : index === 0
            ? <p>Welcome, explorer! Every question here is about <strong>{lodge.subjectName.toLowerCase()}</strong>. Beat the junior rangers to reach {lodge.leader.name}.</p>
            : leaderUp
              ? <p>{firstOfLeader ? `You beat the junior rangers! ${lodge.leader.name} is ready for you.` : `${lodge.leader.name} has ${left} ${left === 1 ? 'creature' : 'creatures'} left.`}</p>
              : <p>One junior ranger down. Keep going!</p>}
        <ol className="lodge-path" aria-label="Lodge battles">
          {e.slots.map((s, i) => (
            <li key={i} className={s.status === 'won' ? 'done' : i === index ? 'now' : ''}>
              <img src={artUrl(foeForm(species(s.opponentId), s.opponentStage).artId)} alt="" width={40} height={40} className={`sprite${s.status === 'won' || i === index ? '' : ' silhouette'}`} />
              <small>{s.role === 'junior' ? s.trainer?.replace('Junior Ranger ', '') : s.role === 'ace' ? 'Ace' : 'Leader'}</small>
            </li>
          ))}
        </ol>
        <div className="encounter-card">
          {leaderUp && <img src={artUrl(lodge.leader.artId)} alt="" width={96} height={96} className="sprite" />}
          <Sprite id={form.artId} size={96} />
          <div>
            <h2>{slot.trainer} sends out {form.name}!</h2>
            {leaderUp && firstOfLeader && !e.retreated && <p className="lodge-quote">"{lodge.leader.intro}"</p>}
            {lodge.shield && leaderUp && <p className="shield-note">🛡️ Brain Shield! Each right answer cracks it instead of doing damage, and it can't hit you back that turn. Three cracks break it.</p>}
            {slot.role === 'ace' && <p className="boss-warning">This is {lodge.leader.name}'s ace. {lodge.rank >= 3 ? 'Watch for its BIG attack every third turn, and Guard against it!' : 'It is the toughest one yet!'}</p>}
            <p className="muted">{foe.flavor}</p>
          </div>
        </div>
        <button type="button" className="primary" onClick={() => dispatch({ type: 'enterEncounter' })}>{e.retreated ? 'Try again' : 'Battle!'} <Key k="Enter" /></button>
      </section>
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave the Lodge</button>
    </div>
  );
}

/** The leader is beaten: the patch, and the first time, the prize creature. */
export function LodgeComplete({ e, save, dispatch }: { e: Expedition; save: SaveData; dispatch: (c: Command) => void }) {
  const lodge = lodgeOf(e) as Lodge;
  useKeys({ enter: () => dispatch({ type: 'claimReward' }) });
  useEffect(() => {
    playSound('evolve');
    const t = setTimeout(() => playSound('levelup'), 700);
    return () => clearTimeout(t);
  }, []);
  const tier = e.lodgeTier ?? 'bronze';
  const had = patchOf(save, lodge.id);
  const first = !(save.lodgesBeaten ?? []).includes(lodge.id);
  const newSilver = tier === 'silver' && had === 'bronze';
  const goldTest = tier === 'gold' && had !== 'gold';
  const prize = species(lodge.prizeSpeciesId);
  const lead = companionView(activeCompanion(save)).name;
  const team = teamOf(e).length;
  if (lodge.kaiju) {
    return (
      <section className="panel complete lodge-complete kaiju-complete">
        <h1>You saved {lodge.kaiju.city}!</h1>
        <p className="lodge-quote">{lodge.leader.win}</p>
        {first
          ? <><NewCreatureReveal speciesId={prize.id} found={knownSpecies(save).size + 1} /><p className="learn">A baby <strong>{prize.displayName}</strong> was left behind, and it wants to come with you! Raise it and it will grow into a giant kaiju.</p></>
          : <div className="celebrate">{[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`rise rise-${i}`} />)}<Sprite id={lodge.leader.artId} size={160} /></div>}
        <p className="muted">{e.correct} of {e.answered} answers correct</p>
        <button type="button" className="primary" onClick={() => dispatch({ type: 'claimReward' })}>{first ? 'Welcome it home' : 'Return to camp'} <Key k="Enter" /></button>
      </section>
    );
  }
  if (lodge.gauntlet) {
    const fame = save.companions.filter((c) => teamOf(e).includes(c.instanceId));
    return (
      <section className="panel complete lodge-complete league-complete">
        <h1>⭐ You are the Starfall Champion! ⭐</h1>
        <div className="lodge-win">
          <img src={artUrl(lodge.leader.artId)} alt="" width={128} height={128} className="sprite" />
          <p className="lodge-quote">"{lodge.leader.win}"</p>
        </div>
        <div className="celebrate">
          {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`rise rise-${i}`} />)}
          {first && <Sprite id={prize.artId} size={160} className="hop-loop legend-glow" />}
        </div>
        {first && <p className="learn"><strong>{prize.displayName}</strong>, the Champion's own star creature, wants to join you!</p>}
        <h2>Hall of Fame</h2>
        <div className="fame-row">{fame.map((c) => { const v = companionView(c); return <span key={c.instanceId} className="fame-member"><Sprite id={v.artId} size={72} shiny={v.shiny} /><small>{v.name} · Lv {levelOf(c.bondXp)}</small></span>; })}</div>
        <p className="muted">{e.correct} of {e.answered} answers correct</p>
        <button type="button" className="primary" onClick={() => dispatch({ type: 'claimReward' })}>{first ? 'Welcome it home' : 'Return to camp'} <Key k="Enter" /></button>
      </section>
    );
  }
  return (
    <section className="panel complete lodge-complete">
      <h1>You beat {lodge.name}{tier !== 'bronze' ? ` on ${TIER_NAME[tier]}` : ''}!</h1>
      <div className="lodge-win">
        <img src={artUrl(lodge.leader.artId)} alt="" width={128} height={128} className="sprite" />
        <p className="lodge-quote">"{goldTest ? 'Impressive! But Gold takes more than battles. Show me what you know.' : lodge.leader.win}"</p>
      </div>
      <div className="celebrate">
        {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`rise rise-${i}`} />)}
        {(first || newSilver) && <PatchIcon lodge={lodge} earned tier={tier} size={96} />}
        {first && <Sprite id={prize.artId} size={160} className="hop-loop" />}
        {newSilver && <img src={artUrl('egg-rare')} alt="Rare Egg" width={96} height={96} className="sprite egg-wobble" />}
      </div>
      {first && <p className="learn">You earned the <strong>{lodge.name.replace(' Lodge', '')} Patch</strong>, and <strong>{prize.displayName}</strong> wants to join you! You can't find it anywhere else.</p>}
      {newSilver && <p className="learn">The <strong>Silver patch</strong> is yours, and a <strong>Rare Egg</strong> for your nest! Answer math, vocabulary or science questions to hatch it.</p>}
      {goldTest && <p className="learn">Now the <strong>Mastery Test</strong>: get 9 of 10 right for the <strong>Gold patch</strong>, the legendary <strong>{species(lodge.legendaryId).displayName}</strong> and a shiny {prize.displayName}.</p>}
      {!first && !newSilver && !goldTest && <p className="learn">You already have this patch. Great practice!</p>}
      <p className="muted">{e.correct} of {e.answered} answers correct</p>
      <p className="learn">{e.points > 0 ? `Your ${e.points} leftover Trail Points turn into ${e.points} XP, plus ` : 'You get '}a big Lodge bonus for {lead}{team > 1 ? ' and the rest of your team' : ''}.</p>
      <button type="button" className="primary" onClick={() => dispatch({ type: 'claimReward' })}>{goldTest ? 'Start the Mastery Test' : first ? 'Welcome it home' : 'Return to camp'} <Key k="Enter" /></button>
    </section>
  );
}
