import { useCallback, useEffect, useRef, useState } from 'react';
import type { Species } from '../content/types';
import { canUse, enemyIntent, MAX_CHARGE, type CombatAction, type CombatState } from '../engine/combat';
import { SNACK_HEAL } from '../engine/economy';
import { activeCompanion, type Battle as BattleState, type Command, type Expedition, type SaveData } from '../engine/game';
import { artUrl, poseUrl } from './art';
import { turnFrames, type Frame, type Motion, type Pose } from './battleAnimation';
import { place, souvenir, species } from './content';
import { Key, useKeys } from './keys';
import { QuestionPanel } from './QuestionPanel';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';

const POSES: Pose[] = ['idle', 'attack', 'guard', 'special', 'hit'];

function Hp({ label, hp, max }: { label: string; hp: number; max: number }) {
  return (
    <div className="hp" role="img" aria-label={`${label}: ${hp} of ${max} HP`}>
      <div className="hp-label"><span>{label}</span><span>{hp}/{max}</span></div>
      <div className="hp-track"><div className="hp-fill" style={{ width: `${(hp / max) * 100}%` }} /></div>
    </div>
  );
}

function specialText(c: CombatState): string {
  if (c.special === 'strong') return `${c.playerAttack + 2} damage`;
  if (c.special === 'heal') return '2 damage, heal 4';
  return '2 damage, block 4';
}

/** The sprite sits inside a moving wrapper, so mirroring and motion don't fight over `transform`. */
function Actor({ creature, pose, motion, side }: { creature: Species; pose: Pose; motion?: Motion | undefined; side: 'player' | 'opponent' }) {
  const faces = side === 'player' ? 'right' : 'left';
  return (
    <div className={`actor ${side} ${motion ? `motion-${motion}` : ''}`} data-pose={pose}>
      <img src={poseUrl(creature, pose)} alt="" width={128} height={128} className={`sprite ${creature.facing === faces ? '' : 'flip'}`} />
    </div>
  );
}

export function Battle({ e, battle, save, dispatch }: { e: Expedition; battle: BattleState; save: SaveData; dispatch: (c: Command) => void }) {
  const slot = e.slots[battle.slotIndex];
  const companion = species(activeCompanion(save).speciesId);
  const opponent = species(slot?.opponentId ?? '');
  const [frame, setFrame] = useState<Frame | null>(null);
  const answered = battle.result ? `${e.answered}` : '';
  const lastTurn = useRef(answered);

  useEffect(() => {
    for (const c of [companion, opponent]) for (const pose of POSES) new Image().src = poseUrl(c, pose);
  }, [companion, opponent]);

  useEffect(() => {
    // A reload shows the saved feedback without replaying the animation.
    if (lastTurn.current === answered) return;
    lastTurn.current = answered;
    if (!battle.result) return;
    const { outcome } = battle.combat;
    const action = battle.action ?? 'attack';
    const frames = turnFrames(action, battle.result.correct, battle.result.events, action !== 'befriend' && outcome !== 'victory');
    const timers = frames.map((f) => setTimeout(() => {
      setFrame(f);
      f.sounds?.forEach((id) => playSound(id));
    }, f.at));
    const end = frames.at(-1)?.at ?? 0;
    timers.push(setTimeout(() => {
      if (outcome === 'victory' && action !== 'befriend') playSound('win');
      if (outcome === 'retreat') playSound('retreat');
    }, end));
    timers.push(setTimeout(() => setFrame(null), end + 100));
    return () => {
      timers.forEach(clearTimeout);
      setFrame(null);
    };
  }, [answered]); // eslint-disable-line

  const { combat, question: q, result } = battle;
  const choose = (action: CombatAction | 'befriend') => dispatch({ type: 'chooseAction', action });
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'answer', optionId }), [dispatch]);
  const special = canUse(combat, 'special');
  const snackReady = e.snack && combat.playerHp < combat.playerMaxHp;

  const keys: Record<string, () => void> = {};
  if (battle.phase === 'choose') {
    if (battle.befriending) Object.assign(keys, { b: () => choose('befriend'), enter: () => choose('befriend') });
    else {
      Object.assign(keys, { a: () => choose('attack'), enter: () => choose('attack'), g: () => choose('guard') });
      if (special) keys.s = () => choose('special');
      if (snackReady) keys.h = () => dispatch({ type: 'useSnack' });
    }
  }
  useKeys(keys);

  if (!slot) return null;
  const backdrop = artUrl(`backdrop-${place(slot.locationId).biome}`);
  const events = result?.events;
  const log = events && [
    events.damageDealt > 0 && `${companion.displayName} dealt ${events.damageDealt} damage.`,
    events.healed > 0 && `${companion.displayName} healed ${events.healed}.`,
    events.blocked > 0 && `Blocked ${events.blocked} damage.`,
    events.damageTaken > 0 && `${opponent.displayName} dealt ${events.damageTaken} damage.`,
    battle.befriended && `${opponent.displayName} wants to be your friend!`,
    battle.action === 'befriend' && !result?.correct && `${opponent.displayName} is still deciding. Try another question.`,
    battle.action !== 'befriend' && combat.outcome === 'victory' && slot.status === 'pending' && `${opponent.displayName} is worn out and watching you closely.`,
    battle.action !== 'befriend' && combat.outcome === 'victory' && slot.status === 'won' && `${opponent.displayName} is impressed and steps aside!`,
    combat.outcome === 'retreat' && `${companion.displayName} retreats safely to the trail.`,
    slot.kind === 'regular' && slot.status === 'won' && e.foundSouvenirId && e.slots.filter((s) => s.kind === 'regular' && s.status === 'won').length === 2 && `You found something on the trail: ${souvenir(e.foundSouvenirId)?.displayName}!`,
  ].filter(Boolean).join(' ');

  return (
    <div className="battle">
      <TrailBar e={e} />
      <section className="scene" style={{ backgroundImage: `url(${backdrop})` }}>
        <div className="scene-hud">
          <div>
            <Hp label={companion.displayName} hp={combat.playerHp} max={combat.playerMaxHp} />
            <div className="charge" role="img" aria-label={`Charge: ${combat.charge} of ${MAX_CHARGE}`}>
              Charge {Array.from({ length: MAX_CHARGE }, (_, i) => <span key={i} className={i < combat.charge ? 'pip on' : 'pip'} />)}
            </div>
          </div>
          <div className="turn">Turn {combat.turn} of {combat.maxTurns}</div>
          <Hp label={opponent.displayName} hp={combat.opponentHp} max={combat.opponentMaxHp} />
        </div>
        <div className="scene-floor">
          <Actor creature={companion} side="player" pose={frame?.player ?? 'idle'} motion={frame?.playerMotion} />
          {battle.phase !== 'feedback' && !battle.befriending && <div className="intent">Next attack: {enemyIntent(combat)} damage</div>}
          <Actor creature={opponent} side="opponent" pose={frame?.opponent ?? 'idle'} motion={frame?.opponentMotion} />
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
                  <button type="button" className="big" disabled={!special} onClick={() => choose('special')}>{companion.special.name} <Key k="S" /><small>{special ? specialText(combat) : 'Needs 2 charge'}</small></button>
                </div>
                {e.snack && <button type="button" disabled={!snackReady} onClick={() => dispatch({ type: 'useSnack' })}>Trail Snack: heal {SNACK_HEAL}, free <Key k="H" /></button>}
              </>
            )}
          </div>
        </section>
      )}

      {battle.phase !== 'choose' && (
        <QuestionPanel question={q} regionId={e.regionId} result={result} onAnswer={onAnswer} onContinue={() => dispatch({ type: 'continue' })} log={log} />
      )}
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
