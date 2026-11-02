import type { TurnEvents } from '../engine/combat';
import type { SoundId } from './sound';

export type Pose = 'idle' | 'attack' | 'guard' | 'special' | 'hit';
export type Motion = 'lunge' | 'shake' | 'glow' | 'hop' | 'slide';
export type Side = 'player' | 'opponent';
/** How a turn finishes: the opponent stays, leaves, or is worn out and can be befriended. */
export type Ending = 'none' | 'defeated' | 'wornOut';

export interface Float {
  side: Side;
  text: string;
  kind: 'damage' | 'heal' | 'block' | 'crit' | 'strong' | 'weak';
}

export interface Frame {
  at: number;
  player: Pose;
  opponent: Pose;
  playerMotion?: Motion;
  opponentMotion?: Motion;
  sounds?: SoundId[];
  floats?: Float[];
  /** A hit that lands: a brief freeze, a white flash, and a shake. */
  impact?: 'small' | 'big';
  /** A Special's colored burst fills the scene. */
  burst?: boolean;
  /** Type particles burst where a hit lands. The type is the attacker's. */
  typeFx?: Side;
  /** HP change shown at this moment. */
  hp?: { side: Side; delta: number };
}

const HIT_DELAY = 340;
const HIT_STOP = 80;
const ENEMY_GAP = 480;
const REST = 420;
/** Purely visual: from this streak on, hits look and feel bigger. */
const POWER_STREAK = 3;

export const isPowered = (streak: number | undefined) => (streak ?? 0) >= POWER_STREAK;
/** The correct-answer chime climbs with the streak. */
export const streakRate = (streak: number | undefined) => 1 + 0.06 * Math.min(Math.max((streak ?? 1) - 1, 0), 8);

/**
 * The poses, motions and sounds for one resolved turn. Purely decorative: the
 * turn is already saved, and the outcome doesn't depend on any of this.
 */
export function turnFrames(action: string, correct: boolean, events: TurnEvents, opponentActs: boolean, ending: Ending = 'none', powered = false, critical = false): Frame[] {
  const frames: Frame[] = [];
  let t = 0;

  if (action === 'befriend') {
    return correct ? [{ at: 0, player: 'idle', opponent: 'idle', opponentMotion: 'hop', sounds: ['befriend'] }] : [{ at: 0, player: 'idle', opponent: 'idle', sounds: ['not-yet'] }];
  }

  const taming = action === 'tame';
  const guarding = action === 'guard';
  const answerSound: SoundId = correct ? 'correct' : 'not-yet';
  const healFloat: Frame = events.healed > 0 ? { at: 0, player: 'idle', opponent: 'idle', floats: [{ side: 'player', text: `+${events.healed}`, kind: 'heal' }], hp: { side: 'player', delta: events.healed } } : ({} as Frame);
  const { floats: healFloats, hp: healHp } = healFloat;
  if (taming) {
    frames.push({ at: t, player: 'idle', opponent: 'idle', ...(correct ? { opponentMotion: 'glow' as const } : {}), sounds: [answerSound] });
  } else if (guarding) {
    frames.push({ at: t, player: 'guard', opponent: 'idle', playerMotion: 'glow', sounds: [answerSound, 'guard'] });
  } else if (correct) {
    const special = action === 'special';
    frames.push({
      at: t,
      player: special ? 'special' : 'attack',
      opponent: 'idle',
      playerMotion: special ? 'glow' : 'lunge',
      sounds: [answerSound, special ? 'special' : 'attack'],
      ...(special ? { burst: true } : {}),
      ...(healFloats ? { floats: healFloats } : {}),
      ...(healHp ? { hp: healHp } : {}),
    });
  } else {
    frames.push({ at: t, player: 'idle', opponent: 'idle', sounds: [answerSound] });
  }

  const stance: Pose = guarding ? 'guard' : frames[0]?.player ?? 'idle';
  if (events.damageDealt > 0) {
    t += HIT_DELAY;
    frames.push({
      at: t,
      player: stance,
      opponent: 'hit',
      opponentMotion: 'shake',
      sounds: [critical ? 'crit' : 'hit'],
      floats: [{ side: 'opponent', text: `-${events.damageDealt}`, kind: 'damage' }, ...(critical ? [{ side: 'opponent' as const, text: 'Critical!', kind: 'crit' as const }] : [])],
      impact: powered || critical ? 'big' : 'small',
      typeFx: 'opponent',
      hp: { side: 'opponent', delta: -events.damageDealt },
    });
    t += HIT_STOP;
  }

  if (opponentActs) {
    t += ENEMY_GAP;
    frames.push({ at: t, player: guarding ? 'guard' : 'idle', opponent: 'attack', opponentMotion: 'lunge' });
    t += HIT_DELAY;
    const floats: Float[] = [];
    if (events.blocked > 0) floats.push({ side: 'player', text: `Blocked ${events.blocked}`, kind: 'block' });
    if (events.damageTaken > 0) {
      floats.push({ side: 'player', text: `-${events.damageTaken}`, kind: 'damage' });
      frames.push({ at: t, player: 'hit', opponent: 'attack', playerMotion: 'shake', sounds: ['hit'], floats, impact: 'small', typeFx: 'player', hp: { side: 'player', delta: -events.damageTaken } });
      t += HIT_STOP;
    } else if (events.blocked > 0) {
      frames.push({ at: t, player: 'guard', opponent: 'attack', playerMotion: 'glow', sounds: ['guard'], floats });
    }
  }

  t += REST;
  if (ending === 'defeated') frames.push({ at: t, player: 'idle', opponent: 'hit', playerMotion: 'hop', opponentMotion: 'slide' });
  else frames.push({ at: t, player: 'idle', opponent: opponentActs ? 'idle' : 'hit' });
  return frames;
}
