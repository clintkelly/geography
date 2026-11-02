import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreatureType, Species } from '../content/types';
import { attackCharge, attackDamage, canUse, guardOf, enemyIntent, isBossTurn, MAX_CHARGE, strongSpecialDamage, type CombatAction, type CombatState } from '../engine/combat';
import { SNACK_HEAL } from '../engine/economy';
import { activeCompanion, canTame, TAME_HITS, teamOf, type Battle as BattleState, type Command, type Expedition, type SaveData } from '../engine/game';
import { artUrl, Fx, poseUrl } from './art';
import { isPowered, streakRate, turnFrames, type Ending, type Float, type Frame, type Motion, type Pose, type Side } from './battleAnimation';
import { companionView, place, souvenir, species } from './content';
import { Key, useKeys } from './keys';
import { QuestionPanel } from './QuestionPanel';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';
import { TypeBadge, TypeGuide } from './TypeGuide';
import { TypeHit, TypeSpecial } from './TypeFx';
import { beats, losesTo, typeEdge, TYPE_INFO } from '../engine/types';

/** How long a win stays on screen after the last hit, before the trail can carry on. */
const WIN_PAUSE_MS = 1400;

const edgeWord = (edge: number) => (edge > 0 ? ' · Strong!' : edge < 0 ? ' · Weak' : '');

const POSES: Pose[] = ['idle', 'attack', 'guard', 'special', 'hit'];

function Hp({ label, hp, max }: { label: string; hp: number; max: number }) {
  const width = `${(hp / max) * 100}%`;
  return (
    <div className="hp" role="img" aria-label={`${label}: ${hp} of ${max} HP`}>
      <div className="hp-label"><span>{label}</span><span>{hp}/{max}</span></div>
      {/* The pale bar catches up late, showing the chunk of HP just lost. */}
      <div className="hp-track"><div className="hp-ghost" style={{ width }} /><div className="hp-fill" style={{ width }} /></div>
    </div>
  );
}

function guardText(c: CombatState): string {
  const g = guardOf(c);
  return [g.damage > 0 ? `${g.damage} damage` : 'no damage', `block ${g.block}`, `+${g.charge} charge`].join(', ');
}

function specialText(c: CombatState): string {
  if (c.special === 'strong') return `${strongSpecialDamage(c) + (c.specialBonus ?? 0)} damage`;
  if (c.special === 'heal') return '2 damage, heal 4';
  return '2 damage, block 4';
}

/** The sprite sits inside a moving wrapper, so mirroring and motion don't fight over `transform`. */
function Actor({ creature, artId, pose, motion, side, floats, hits, flash, powered }: {
  creature: Species;
  artId?: string;
  pose: Pose;
  motion?: Motion | undefined;
  side: Side;
  floats: (Float & { id: number })[];
  hits: { id: number; side: Side; type: CreatureType }[];
  flash: boolean;
  powered: boolean;
}) {
  const faces = side === 'player' ? 'right' : 'left';
  return (
    <div className="actor-slot">
      {floats.filter((f) => f.side === side).map((f) => <span key={f.id} className={`float float-${f.kind}${powered ? ' float-big' : ''}`}>{f.text}</span>)}
      {hits.filter((h) => h.side === side).map((h) => <TypeHit key={h.id} type={h.type} toward={side === 'player' ? 1 : -1} />)}
      {motion === 'shake' && <><Fx id="spark" className="spark" />{powered && <Fx id="spark" className="spark spark-2" />}</>}
      <div className={`actor ${side} ${motion ? `motion-${motion}` : ''}${flash && motion === 'shake' ? ' flash' : ''}`} data-pose={pose}>
        <img src={poseUrl(creature, pose, artId)} alt="" width={128} height={128} className={`sprite ${creature.facing === faces ? '' : 'flip'}`} />
      </div>
    </div>
  );
}

export function Battle({ e, battle, save, dispatch }: { e: Expedition; battle: BattleState; save: SaveData; dispatch: (c: Command) => void }) {
  const slot = e.slots[battle.slotIndex];
  const owned = save.companions.map((c) => c.speciesId);
  const view = companionView(activeCompanion(save));
  const companion = view.species;
  const opponent = species(slot?.opponentId ?? '');
  const [frame, setFrame] = useState<Frame | null>(null);
  const answered = battle.result ? `${e.answered}` : '';
  const lastTurn = useRef(answered);
  const [shownHp, setShownHp] = useState<{ player: number; opponent: number } | null>(null);
  const [floats, setFloats] = useState<(Float & { id: number })[]>([]);
  const [impact, setImpact] = useState<'small' | 'big' | null>(null);
  const [flash, setFlash] = useState(false);
  const [stayGone, setStayGone] = useState(false);
  const [burst, setBurst] = useState(false);
  const [hits, setHits] = useState<{ id: number; side: Side; type: CreatureType }[]>([]);
  const [storm, setStorm] = useState<{ id: number; type: CreatureType } | null>(null);
  const [picking, setPicking] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [holding, setHolding] = useState(false);
  const switchCount = battle.switches?.count ?? 0;
  const lastSwitch = useRef(switchCount);
  useEffect(() => {
    if (switchCount === lastSwitch.current) return;
    lastSwitch.current = switchCount;
    setPicking(false);
    const damage = battle.switches?.damage ?? 0;
    playSound(damage > 0 ? 'hit' : 'guard');
    if (damage > 0) {
      const added: (Float & { id: number })[] = [{ side: 'player', text: `-${damage}`, kind: 'damage', id: ++floatId.current }];
      setFloats((all) => [...all, ...added]);
      setTimeout(() => setFloats((all) => all.filter((x) => !added.includes(x))), 1000);
    }
  }, [switchCount]); // eslint-disable-line
  const floatId = useRef(0);
  const rareFoe = !!slot?.rare;
  const bossFoe = !!opponent.boss;
  const finalIntro = (slot?.kind === 'guardian' || rareFoe) && battle.combat.turn === 1 && battle.phase === 'choose' && !battle.befriending;
  const [intro, setIntro] = useState(finalIntro);

  useEffect(() => {
    if (!intro) return;
    playSound(rareFoe || bossFoe ? 'evolve' : 'special');
    if (rareFoe) setTimeout(() => playSound('levelup'), 700);
    if (bossFoe) setTimeout(() => playSound('hit'), 900);
    const t = setTimeout(() => setIntro(false), rareFoe || bossFoe ? 2600 : 1500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  useEffect(() => {
    for (const pose of POSES) {
      new Image().src = poseUrl(companion, pose, view.artId);
      new Image().src = poseUrl(opponent, pose);
    }
  }, [companion, opponent, view.artId]);

  useEffect(() => {
    // A reload shows the saved feedback without replaying the animation.
    if (lastTurn.current === answered) return;
    lastTurn.current = answered;
    if (!battle.result) return;
    const { outcome } = battle.combat;
    const action = battle.action ?? 'attack';
    const { events: ev, correct } = battle.result;
    const ending: Ending = outcome !== 'victory' || action === 'befriend' || action === 'tame' ? 'none' : slot?.status === 'won' ? 'defeated' : 'wornOut';
    const powered = isPowered(e.streak);
    const won = !!battle.befriended || ending === 'defeated';
    if (won) setHolding(true);
    const frames = turnFrames(action, correct, ev, action !== 'befriend' && outcome !== 'victory', ending, powered, !!battle.result.critical);
    // The saved turn is already final. These replay it one hit at a time.
    let hp = { player: battle.combat.playerHp + ev.damageTaken - ev.healed, opponent: battle.combat.opponentHp + ev.damageDealt };
    setShownHp(hp);
    const timers: ReturnType<typeof setTimeout>[] = frames.map((f) => setTimeout(() => {
      setFrame(f);
      f.sounds?.forEach((id) => playSound(id, false, id === 'correct' ? streakRate(e.streak) : 1));
      if (f.hp) {
        hp = { ...hp, [f.hp.side]: hp[f.hp.side] + f.hp.delta };
        setShownHp(hp);
      }
      if (f.floats) {
        const added = f.floats.map((x) => ({ ...x, id: ++floatId.current }));
        setFloats((all) => [...all, ...added]);
        timers.push(setTimeout(() => setFloats((all) => all.filter((x) => !added.includes(x))), 1000));
      }
      if (f.burst) {
        setBurst(true);
        setStorm({ id: ++floatId.current, type: companion.type });
        timers.push(setTimeout(() => setBurst(false), 520), setTimeout(() => setStorm(null), 1200));
      }
      if (f.typeFx) {
        const added = { id: ++floatId.current, side: f.typeFx, type: f.typeFx === 'opponent' ? companion.type : opponent.type };
        setHits((all) => [...all, added]);
        timers.push(setTimeout(() => setHits((all) => all.filter((x) => x !== added)), 1000));
      }
      if (f.impact) {
        setImpact(f.impact);
        setFlash(true);
        timers.push(setTimeout(() => setFlash(false), 90), setTimeout(() => setImpact(null), 320));
      }
    }, f.at));
    const hitEdge = battle.combat.typeEdge ?? 0;
    const landed = ev.damageDealt > 0 && (action === 'attack' || action === 'special') && hitEdge !== 0;
    if (landed) {
      const hit = frames.find((f) => f.hp?.side === 'opponent');
      if (hit) {
        hit.floats = [...(hit.floats ?? []), hitEdge > 0 ? { side: 'opponent', text: 'Strong hit!', kind: 'strong' } : { side: 'opponent', text: 'Not very strong', kind: 'weak' }];
        if (hitEdge > 0) hit.impact = 'big';
      }
    }
    const end = frames.at(-1)?.at ?? 0;
    if (won) {
      timers.push(setTimeout(() => setCelebrating(!battle.befriended), end));
      timers.push(setTimeout(() => setHolding(false), end + WIN_PAUSE_MS));
    }
    timers.push(setTimeout(() => {
      if (outcome === 'victory' && action !== 'befriend' && action !== 'tame') playSound('win');
      if (battle.befriended && action === 'tame') playSound('befriend');
      if (outcome === 'retreat') playSound('retreat');
    }, end));
    timers.push(setTimeout(() => {
      setShownHp(null);
      // A beaten opponent stays gone until the child moves on.
      if (ending === 'defeated') setStayGone(true);
      else setFrame(null);
    }, end + 100));
    return () => {
      timers.forEach(clearTimeout);
      setFrame(null);
      setShownHp(null);
      setFloats([]);
      setBurst(false);
      setHits([]);
      setStorm(null);
      setImpact(null);
      setFlash(false);
      setCelebrating(false);
      setHolding(false);
    };
  }, [answered]); // eslint-disable-line

  const { combat, question: q, result } = battle;
  const edge = combat.typeEdge ?? 0;
  const bossTurn = isBossTurn(combat) && combat.outcome === 'active' && battle.phase !== 'feedback' && !battle.befriending;
  const choose = (action: CombatAction | 'befriend' | 'tame') => dispatch({ type: 'chooseAction', action });
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'answer', optionId }), [dispatch]);
  const special = canUse(combat, 'special');
  const snackReady = e.snack && combat.playerHp < combat.playerMaxHp;
  const tameable = !!slot && canTame(save, battle, slot);
  const tameHits = battle.tameHits ?? 0;

  const members = teamOf(e).map((id) => save.companions.find((c) => c.instanceId === id)).filter((c) => !!c);
  const memberHp = (id: string) => (id === e.companionId ? combat.playerHp : battle.bench?.[id]?.hp ?? 0);
  const canSwitch = !battle.befriending && (battle.tameHits ?? 0) === 0 && members.some((c) => c.instanceId !== e.companionId && memberHp(c.instanceId) > 0);
  const chooser = !!battle.mustSwitch || picking;
  const helper = members.map((c) => companionView(c)).find((v) => typeEdge(v.species.type, opponent.type) > 0 && v.species.id !== companion.id)?.name;
  const swapTo = (instanceId: string) => {
    setPicking(false);
    dispatch({ type: 'switchTo', instanceId });
  };

  const changeMove = () => dispatch({ type: 'changeMove' });
  const moveName = battle.action === 'tame' ? 'Bold Befriend' : battle.action === 'special' ? companion.special.name : battle.action === 'guard' ? companion.moves.guard : companion.moves.attack;

  const keys: Record<string, () => void> = {};
  if (battle.phase === 'choose' && chooser) {
    members.forEach((c, i) => { if (c.instanceId !== e.companionId && memberHp(c.instanceId) > 0) keys[String(i + 1)] = () => swapTo(c.instanceId); });
    if (!battle.mustSwitch) Object.assign(keys, { w: () => setPicking(false), escape: () => setPicking(false) });
  } else if (battle.phase === 'choose') {
    if (canSwitch) keys.w = () => setPicking(true);
    if (battle.befriending) Object.assign(keys, { b: () => choose('befriend'), enter: () => choose('befriend') });
    else {
      Object.assign(keys, { a: () => choose('attack'), enter: () => choose('attack'), g: () => choose('guard') });
      if (special) keys.s = () => choose('special');
      if (snackReady) keys.h = () => dispatch({ type: 'useSnack' });
      if (tameable) keys.b = () => choose('tame');
    }
  } else if (battle.phase === 'question' && !battle.befriending) {
    Object.assign(keys, { c: changeMove, escape: changeMove });
  }
  useKeys(keys);

  const hpNow = shownHp?.player ?? combat.playerHp;
  const lowHp = hpNow > 0 && hpNow / combat.playerMaxHp <= 0.3 && combat.outcome === 'active';
  const wasLow = useRef(lowHp);
  useEffect(() => {
    if (lowHp && !wasLow.current) playSound('heartbeat');
    wasLow.current = lowHp;
  }, [lowHp]);

  if (!slot) return null;
  const backdrop = artUrl(`backdrop-${place(slot.locationId).biome}`);
  const events = result?.events;
  const playedTurn = combat.outcome === 'active' ? combat.turn - 1 : combat.turn;
  const opponentMove = opponent.boss && playedTurn % 3 === 0 ? opponent.boss.move : opponent.moves.attack;
  const log = events && [
    result?.critical && 'Critical! You remembered your Field Note and gained a charge.',
    events.damageDealt > 0 && `${view.name} dealt ${events.damageDealt} damage.`,
    events.healed > 0 && `${view.name} healed ${events.healed}.`,
    events.blocked > 0 && `Blocked ${events.blocked} damage.`,
    events.damageTaken > 0 && `${opponent.displayName} used ${opponentMove} for ${events.damageTaken} damage.`,
    battle.befriended && `${opponent.displayName} wants to be your friend!`,
    battle.action === 'befriend' && !result?.correct && `${opponent.displayName} is still deciding. Try another question.`,
    battle.action === 'tame' && !result?.correct && `${opponent.displayName} backed away. The attempt is over.`,
    battle.action === 'tame' && result?.correct && !battle.befriended && `${opponent.displayName} is listening. One more right answer!`,
    battle.action !== 'befriend' && combat.outcome === 'victory' && slot.status === 'pending' && `${opponent.displayName} is worn out and watching you closely.`,
    battle.action !== 'befriend' && battle.action !== 'tame' && combat.outcome === 'victory' && slot.status === 'won' && `${opponent.displayName} is impressed and steps aside!`,
    combat.outcome === 'retreat' && `${view.name} retreats safely to the trail.`,
    slot.kind === 'regular' && slot.status === 'won' && e.foundSouvenirId && e.slots.filter((s) => s.kind === 'regular' && s.status === 'won').length === 2 && `You found something on the trail: ${souvenir(e.foundSouvenirId)?.displayName}!`,
  ].filter(Boolean).join(' ');

  return (
    <div className="battle">
      <TrailBar e={e} owned={owned} />
      <section className={`scene streak-${(e.streak ?? 0) >= 10 ? 'high' : (e.streak ?? 0) >= 5 ? 'mid' : (e.streak ?? 0) >= 3 ? 'low' : 'none'}${impact ? ` impact-${impact}` : ''}${flash ? ' hit-stop' : ''}${lowHp ? ' low-hp' : ''}${rareFoe ? ' rare-scene' : ''}${bossTurn ? ' boss-turn' : ''}`} style={{ backgroundImage: `url(${backdrop})` }}>
        {storm && <TypeSpecial key={storm.id} type={storm.type} />}
        {burst && <div className="special-burst" style={{ background: `radial-gradient(circle, ${companion.special.color}dd, ${companion.special.color}00 72%)` }} />}
        {intro && (
          <div className={`vs-intro${rareFoe || bossFoe ? ' rare-intro' : ''}`} aria-hidden="true">
            {bossFoe && <em>Continent Boss!</em>}
            {rareFoe && <>{[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`burst burst-${i}`} />)}<em>Rare encounter!</em></>}
            <img src={poseUrl(companion, 'idle', view.artId)} alt="" className={`sprite vs-left ${companion.facing === 'right' ? '' : 'flip'}`} />
            <strong>VS</strong>
            <img src={poseUrl(opponent, 'idle')} alt="" className={`sprite vs-right ${opponent.facing === 'left' ? '' : 'flip'}`} />
          </div>
        )}
        {celebrating && (
          <div className="victory-banner">
            {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`rise rise-${i}`} />)}
            <strong>Victory!</strong>
          </div>
        )}
        {battle.befriended && (
          <div className="friend-banner">
            {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="heart" className={`rise rise-${i}`} />)}
            <strong>New friend!</strong>
          </div>
        )}
        <div className="scene-hud">
          <div>
            <Hp label={view.name} hp={shownHp?.player ?? combat.playerHp} max={combat.playerMaxHp} />
            <div className="scene-types"><TypeBadge type={companion.type} /></div>
            {(combat.turf ?? 0) > 0 && <div className="turf-tag">Home turf! +{combat.turf} Attack</div>}
            <div className="charge" role="img" aria-label={`Charge: ${combat.charge} of ${MAX_CHARGE}`}>
              Charge {Array.from({ length: MAX_CHARGE }, (_, i) => <span key={i} className={i < combat.charge ? 'pip on' : 'pip'} />)}
            </div>
          </div>
          <div className="turn">Turn {combat.turn} of {combat.maxTurns}</div>
          <div>
            <Hp label={bossFoe ? `Boss: ${opponent.displayName}` : rareFoe ? `Rare: ${opponent.displayName}` : opponent.displayName} hp={shownHp?.opponent ?? combat.opponentHp} max={combat.opponentMaxHp} />
            <div className="scene-types"><TypeBadge type={opponent.type} /></div>
          </div>
        </div>
        <div className="scene-floor">
          <Actor key={e.companionId} creature={companion} artId={view.artId} side="player" pose={frame?.player ?? 'idle'} motion={frame?.playerMotion} floats={floats} hits={hits} flash={flash} powered={isPowered(e.streak)} />
          {battle.phase !== 'feedback' && !battle.befriending && <div className="intent">{bossTurn ? 'BIG attack' : 'Next attack'}: {enemyIntent(combat)} damage</div>}
          <Actor creature={opponent} side="opponent" pose={frame?.opponent ?? 'idle'} motion={stayGone ? 'slide' : frame?.opponentMotion} floats={floats} hits={hits} flash={flash} powered={isPowered(e.streak)} />
        </div>
      </section>

      {members.length > 1 && (
        <div className="team-row" aria-label="Your team">
          {members.map((c) => {
            const v = companionView(c);
            const hp = memberHp(c.instanceId);
            return (
              <span key={c.instanceId} className={`team-chip${c.instanceId === e.companionId ? ' active' : ''}${hp === 0 ? ' fainted' : ''}`}>
                <img src={artUrl(v.artId)} alt="" width={32} height={32} className="sprite" />
                {v.name} <TypeBadge type={v.species.type} /> <small>{hp} HP · {c.instanceId === e.companionId ? combat.charge : battle.bench?.[c.instanceId]?.charge ?? 0} charge{edgeWord(typeEdge(v.species.type, opponent.type))}</small>
              </span>
            );
          })}
        </div>
      )}

      {battle.phase === 'choose' && chooser && (
        <section className="panel question">
          <div className="actions">
            <p className="learn">{battle.mustSwitch ? `${view.name} needs a rest. Who's next?` : 'Switch to who? It uses your turn, and the opponent will hit them.'}</p>
            <div className="action-row">
              {members.map((c, i) => {
                const v = companionView(c);
                const hp = memberHp(c.instanceId);
                const usable = c.instanceId !== e.companionId && hp > 0;
                return <button key={c.instanceId} type="button" className="big" disabled={!usable} onClick={() => swapTo(c.instanceId)}>{v.name} <Key k={i + 1} /><small><TypeBadge type={v.species.type} />{edgeWord(typeEdge(v.species.type, opponent.type))} · {hp} HP, {c.instanceId === e.companionId ? combat.charge : battle.bench?.[c.instanceId]?.charge ?? 0} charge</small></button>;
              })}
            </div>
            {!battle.mustSwitch && <button type="button" onClick={() => setPicking(false)}>Never mind <Key k="W" /></button>}
          </div>
        </section>
      )}

      {battle.phase === 'choose' && !chooser && (
        <section className="panel question">
          <div className="actions">
            <p className="muted">{place(slot.locationId).name} · {bossFoe ? 'Questions from the whole continent' : 'Local questions and expedition review'}</p>
            {bossTurn && <p className="boss-warning">{opponent.boss?.move}! {opponent.boss?.warning}</p>}
            {edge > 0 && <p className="matchup matchup-strong">Strong matchup! {TYPE_INFO[companion.type].name} beats {TYPE_INFO[opponent.type].name}: you hit 1 harder. {TYPE_INFO[companion.type].why}</p>}
            {edge < 0 && <p className="matchup matchup-weak">Weak matchup. {TYPE_INFO[opponent.type].name} beats {TYPE_INFO[companion.type].name}: you hit 1 softer.{helper ? ` Try switching to ${helper}!` : ` A ${TYPE_INFO[losesTo(opponent.type)].name} creature would be strong here.`}</p>}
            {edge === 0 && <p className="muted">{companion.type === opponent.type ? `Even matchup: both are ${TYPE_INFO[companion.type].name}, which beats ${TYPE_INFO[beats(companion.type)].name}.` : `Even matchup. ${TYPE_INFO[companion.type].name} beats ${TYPE_INFO[beats(companion.type)].name}, and ${TYPE_INFO[opponent.type].name} beats ${TYPE_INFO[beats(opponent.type)].name}.`}</p>}
            {battle.befriending ? (
              <>
                <p className="learn">{opponent.displayName} is worn out. Answer a question to befriend it!</p>
                <button type="button" className="primary big" onClick={() => choose('befriend')}>Befriend <Key k="B" /></button>
              </>
            ) : (
              <>
                <div className="action-row">
                  <button type="button" className="primary big" onClick={() => choose('attack')}>{companion.moves.attack} <Key k="A" /><small>Attack: {attackDamage(combat)} damage, {attackCharge(combat) ? '+1 charge' : 'no charge. A miss takes 1 extra'}</small></button>
                  <button type="button" className="big" onClick={() => choose('guard')}>{companion.moves.guard} <Key k="G" /><small>Guard: {guardText(combat)}</small></button>
                  <button type="button" className={`big${special ? ' special-ready' : ''}`} disabled={!special} onClick={() => choose('special')}>{companion.special.name} <Key k="S" /><small>{special ? specialText(combat) : 'Needs 2 charge'}</small></button>
                </div>
                {canSwitch && <button type="button" onClick={() => setPicking(true)}>Switch creature <Key k="W" /></button>}
                <TypeGuide />
                {tameable && <button type="button" className="tame-button" onClick={() => choose('tame')}>{tameHits > 0 ? `Keep going: ${tameHits} of ${TAME_HITS}` : 'Bold Befriend'} <Key k="B" /><small>{tameHits > 0 ? 'One more right answer wins it over' : `Two right in a row on harder questions. Costs 2 charge.`}</small></button>}
                {e.snack && <button type="button" disabled={!snackReady} onClick={() => dispatch({ type: 'useSnack' })}>Trail Snack: heal {SNACK_HEAL}, free <Key k="H" /></button>}
              </>
            )}
          </div>
        </section>
      )}

      {battle.phase !== 'choose' && (
        <QuestionPanel question={q} regionId={q.regionId} result={result} onAnswer={onAnswer} onContinue={() => dispatch({ type: 'continue' })} hold={holding} log={log} move={battle.befriending ? undefined : { name: moveName, onChange: changeMove }} {...(battle.action === 'tame' ? { tag: `Bold Befriend: harder question ${Math.min((battle.tameHits ?? 0) + (result?.correct ? 0 : 1), TAME_HITS)} of ${TAME_HITS}` } : {})} />
      )}
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
