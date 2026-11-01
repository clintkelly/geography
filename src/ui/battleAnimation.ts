import type { TurnEvents } from '../engine/combat';
import type { SoundId } from './sound';

export type Pose = 'idle' | 'attack' | 'guard' | 'special' | 'hit';
export type Motion = 'lunge' | 'shake' | 'glow';

export interface Frame {
  at: number;
  player: Pose;
  opponent: Pose;
  playerMotion?: Motion;
  opponentMotion?: Motion;
  sounds?: SoundId[];
}

const HIT_DELAY = 340;
const ENEMY_GAP = 480;
const REST = 420;

/**
 * The poses, motions and sounds for one resolved turn. Purely decorative: the
 * turn is already saved, and the outcome doesn't depend on any of this.
 */
export function turnFrames(action: string, correct: boolean, events: TurnEvents, opponentActs: boolean): Frame[] {
  const frames: Frame[] = [];
  let t = 0;

  if (action === 'befriend') {
    return correct ? [{ at: 0, player: 'idle', opponent: 'idle', opponentMotion: 'glow', sounds: ['befriend'] }] : [{ at: 0, player: 'idle', opponent: 'idle', sounds: ['not-yet'] }];
  }

  const guarding = action === 'guard';
  const answerSound: SoundId = correct ? 'correct' : 'not-yet';
  if (guarding) {
    frames.push({ at: t, player: 'guard', opponent: 'idle', playerMotion: 'glow', sounds: [answerSound, 'guard'] });
  } else if (correct) {
    const special = action === 'special';
    frames.push({ at: t, player: special ? 'special' : 'attack', opponent: 'idle', playerMotion: special ? 'glow' : 'lunge', sounds: [answerSound, special ? 'special' : 'attack'] });
  } else {
    frames.push({ at: t, player: 'idle', opponent: 'idle', sounds: [answerSound] });
  }

  const stance: Pose = guarding ? 'guard' : frames[0]?.player ?? 'idle';
  if (events.damageDealt > 0) {
    t += HIT_DELAY;
    frames.push({ at: t, player: stance, opponent: 'hit', opponentMotion: 'shake', sounds: ['hit'] });
  }

  if (opponentActs) {
    t += ENEMY_GAP;
    frames.push({ at: t, player: guarding ? 'guard' : 'idle', opponent: 'attack', opponentMotion: 'lunge' });
    t += HIT_DELAY;
    if (events.damageTaken > 0) frames.push({ at: t, player: 'hit', opponent: 'attack', playerMotion: 'shake', sounds: ['hit'] });
    else if (events.blocked > 0) frames.push({ at: t, player: 'guard', opponent: 'attack', playerMotion: 'glow', sounds: ['guard'] });
  }

  t += REST;
  frames.push({ at: t, player: 'idle', opponent: opponentActs ? 'idle' : 'hit' });
  return frames;
}
