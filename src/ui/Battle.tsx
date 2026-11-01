import { useCallback, useEffect, useRef, useState } from 'react';
import type { Species } from '../content/types';
import { canUse, enemyIntent, MAX_CHARGE, type CombatAction, type CombatState } from '../engine/combat';
import { SNACK_HEAL } from '../engine/economy';
import { activeCompanion, canTame, TAME_HITS, type Battle as BattleState, type Command, type Expedition, type SaveData } from '../engine/game';
import { artUrl, Fx, poseUrl } from './art';
import { isPowered, streakRate, turnFrames, type Ending, type Float, type Frame, type Motion, type Pose, type Side } from './battleAnimation';
import { companionView, place, souvenir, species } from './content';
import { Key, useKeys } from './keys';
import { QuestionPanel } from './QuestionPanel';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';

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

function specialText(c: CombatState): string {
  if (c.special === 'strong') return `${c.playerAttack + 2} damage`;
  if (c.special === 'heal') return '2 damage, heal 4';
  return '2 damage, block 4';
}

/** The sprite sits inside a moving wrapper, so mirroring and motion don't fight over `transform`. */
function Actor({ creature, artId, pose, motion, side, floats, flash, powered }: {
  creature: Species;
  artId?: string;
  pose: Pose;
  motion?: Motion | undefined;
  side: Side;
  floats: (Float & { id: number })[];
  flash: boolean;
  powered: boolean;
}) {
  const faces = side === 'player' ? 'right' : 'left';
  return (
    <div className="actor-slot">
      {floats.filter((f) => f.side === side).map((f) => <span key={f.id} className={`float float-${f.kind}${powered ? ' float-big' : ''}`}>{f.text}</span>)}
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
  const floatId = useRef(0);
  const rareFoe = !!slot?.rare;
  const finalIntro = (slot?.kind === 'guardian' || rareFoe) && battle.combat.turn === 1 && battle.phase === 'choose' && !battle.befriending;
  const [intro, setIntro] = useState(finalIntro);

  useEffect(() => {
    if (!intro) return;
    playSound(rareFoe ? 'evolve' : 'special');
    if (rareFoe) setTimeout(() => playSound('levelup'), 700);
    const t = setTimeout(() => setIntro(false), rareFoe ? 2600 : 1500);
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
        timers.push(setTimeout(() => setBurst(false), 520));
      }
      if (f.impact) {
        setImpact(f.impact);
        setFlash(true);
        timers.push(setTimeout(() => setFlash(false), 90), setTimeout(() => setImpact(null), 320));
      }
    }, f.at));
    const end = frames.at(-1)?.at ?? 0;
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
      setImpact(null);
      setFlash(false);
    };
  }, [answered]); // eslint-disable-line

  const { combat, question: q, result } = battle;
  const choose = (action: CombatAction | 'befriend' | 'tame') => dispatch({ type: 'chooseAction', action });
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'answer', optionId }), [dispatch]);
  const special = canUse(combat, 'special');
  const snackReady = e.snack && combat.playerHp < combat.playerMaxHp;
  const tameable = !!slot && canTame(save, battle, slot);
  const tameHits = battle.tameHits ?? 0;

  const keys: Record<string, () => void> = {};
  if (battle.phase === 'choose') {
    if (battle.befriending) Object.assign(keys, { b: () => choose('befriend'), enter: () => choose('befriend') });
    else {
      Object.assign(keys, { a: () => choose('attack'), enter: () => choose('attack'), g: () => choose('guard') });
      if (special) keys.s = () => choose('special');
      if (snackReady) keys.h = () => dispatch({ type: 'useSnack' });
      if (tameable) keys.b = () => choose('tame');
    }
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
  const log = events && [
    result?.critical && 'Critical! You remembered your Field Note and gained a charge.',
    events.damageDealt > 0 && `${view.name} dealt ${events.damageDealt} damage.`,
    events.healed > 0 && `${view.name} healed ${events.healed}.`,
    events.blocked > 0 && `Blocked ${events.blocked} damage.`,
    events.damageTaken > 0 && `${opponent.displayName} dealt ${events.damageTaken} damage.`,
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
      <section className={`scene streak-${(e.streak ?? 0) >= 10 ? 'high' : (e.streak ?? 0) >= 5 ? 'mid' : (e.streak ?? 0) >= 3 ? 'low' : 'none'}${impact ? ` impact-${impact}` : ''}${flash ? ' hit-stop' : ''}${lowHp ? ' low-hp' : ''}${rareFoe ? ' rare-scene' : ''}`} style={{ backgroundImage: `url(${backdrop})` }}>
        {burst && <div className="special-burst" style={{ background: `radial-gradient(circle, ${companion.special.color}dd, ${companion.special.color}00 72%)` }} />}
        {intro && (
          <div className={`vs-intro${rareFoe ? ' rare-intro' : ''}`} aria-hidden="true">
            {rareFoe && <>{[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`burst burst-${i}`} />)}<em>Rare encounter!</em></>}
            <img src={poseUrl(companion, 'idle', view.artId)} alt="" className={`sprite vs-left ${companion.facing === 'right' ? '' : 'flip'}`} />
            <strong>VS</strong>
            <img src={poseUrl(opponent, 'idle')} alt="" className={`sprite vs-right ${opponent.facing === 'left' ? '' : 'flip'}`} />
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
            <div className="charge" role="img" aria-label={`Charge: ${combat.charge} of ${MAX_CHARGE}`}>
              Charge {Array.from({ length: MAX_CHARGE }, (_, i) => <span key={i} className={i < combat.charge ? 'pip on' : 'pip'} />)}
            </div>
          </div>
          <div className="turn">Turn {combat.turn} of {combat.maxTurns}</div>
          <Hp label={rareFoe ? `Rare: ${opponent.displayName}` : opponent.displayName} hp={shownHp?.opponent ?? combat.opponentHp} max={combat.opponentMaxHp} />
        </div>
        <div className="scene-floor">
          <Actor creature={companion} artId={view.artId} side="player" pose={frame?.player ?? 'idle'} motion={frame?.playerMotion} floats={floats} flash={flash} powered={isPowered(e.streak)} />
          {battle.phase !== 'feedback' && !battle.befriending && <div className="intent">Next attack: {enemyIntent(combat)} damage</div>}
          <Actor creature={opponent} side="opponent" pose={frame?.opponent ?? 'idle'} motion={stayGone ? 'slide' : frame?.opponentMotion} floats={floats} flash={flash} powered={isPowered(e.streak)} />
        </div>
      </section>

      {battle.phase === 'choose' && (
        <section className="panel question">
          <div className="actions">
            <p className="muted">{place(slot.locationId).name} · Local questions and expedition review</p>
            {battle.befriending ? (
              <>
                <p className="learn">{opponent.displayName} is worn out. Answer a question to befriend it!</p>
                <button type="button" className="primary big" onClick={() => choose('befriend')}>Befriend <Key k="B" /></button>
              </>
            ) : (
              <>
                <div className="action-row">
                  <button type="button" className="primary big" onClick={() => choose('attack')}>Attack <Key k="A" /><small>{combat.playerAttack} damage, +1 charge</small></button>
                  <button type="button" className="big" onClick={() => choose('guard')}>Guard <Key k="G" /><small>1 damage, block 3, +1 charge</small></button>
                  <button type="button" className={`big${special ? ' special-ready' : ''}`} disabled={!special} onClick={() => choose('special')}>{companion.special.name} <Key k="S" /><small>{special ? specialText(combat) : 'Needs 2 charge'}</small></button>
                </div>
                {tameable && <button type="button" className="tame-button" onClick={() => choose('tame')}>{tameHits > 0 ? `Keep going: ${tameHits} of ${TAME_HITS}` : 'Bold Befriend'} <Key k="B" /><small>{tameHits > 0 ? 'One more right answer wins it over' : `Two right in a row on harder questions. Costs 2 charge.`}</small></button>}
                {e.snack && <button type="button" disabled={!snackReady} onClick={() => dispatch({ type: 'useSnack' })}>Trail Snack: heal {SNACK_HEAL}, free <Key k="H" /></button>}
              </>
            )}
          </div>
        </section>
      )}

      {battle.phase !== 'choose' && (
        <QuestionPanel question={q} regionId={e.regionId} result={result} onAnswer={onAnswer} onContinue={() => dispatch({ type: 'continue' })} log={log} {...(battle.action === 'tame' ? { tag: `Bold Befriend: harder question ${Math.min((battle.tameHits ?? 0) + (result?.correct ? 0 : 1), TAME_HITS)} of ${TAME_HITS}` } : {})} />
      )}
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
