import { describe, expect, it } from 'vitest';
import { isPowered, streakRate, turnFrames } from './battleAnimation';

const hit = { damageDealt: 3, damageTaken: 2, blocked: 0, healed: 0 };

describe('turn animations', () => {
  it('a correct attack lunges, then the opponent is hit, then it strikes back', () => {
    const frames = turnFrames('attack', true, hit, true);
    expect(frames[0]).toMatchObject({ player: 'attack', playerMotion: 'lunge' });
    expect(frames[0]!.sounds).toEqual(['correct', 'attack']);
    expect(frames[1]).toMatchObject({ opponent: 'hit', opponentMotion: 'shake' });
    expect(frames.some((f) => f.player === 'hit')).toBe(true);
    expect(frames.at(-1)).toMatchObject({ player: 'idle', opponent: 'idle' });
  });

  it('a wrong attack shows no attack pose', () => {
    const frames = turnFrames('attack', false, { ...hit, damageDealt: 0 }, true);
    expect(frames.some((f) => f.player === 'attack')).toBe(false);
    expect(frames[0]!.sounds).toEqual(['not-yet']);
  });

  it('Guard holds its pose and a full block plays the guard sound, not a hit', () => {
    const frames = turnFrames('guard', true, { damageDealt: 1, damageTaken: 0, blocked: 2, healed: 0 }, true);
    expect(frames[0]).toMatchObject({ player: 'guard' });
    expect(frames.some((f) => f.player === 'hit')).toBe(false);
    expect(frames.at(-2)!.sounds).toEqual(['guard']);
  });

  it('Special has its own pose and sound', () => {
    const frames = turnFrames('special', true, { ...hit, damageDealt: 5 }, false);
    expect(frames[0]).toMatchObject({ player: 'special' });
    expect(frames[0]!.sounds).toContain('special');
  });

  it('a defeated opponent does not strike back', () => {
    expect(turnFrames('attack', true, { ...hit, damageTaken: 0 }, false).some((f) => f.opponent === 'attack')).toBe(false);
  });

  it('stays brief', () => {
    expect(turnFrames('attack', true, hit, true).at(-1)!.at).toBeLessThanOrEqual(1800);
  });

  it('shows each hit as a number and a shake, and tracks HP as it lands', () => {
    const frames = turnFrames('attack', true, hit, true);
    expect(frames[1]).toMatchObject({ floats: [{ side: 'opponent', text: '-3', kind: 'damage' }], impact: 'small', hp: { side: 'opponent', delta: -3 } });
    const taken = frames.find((f) => f.hp?.side === 'player')!;
    expect(taken).toMatchObject({ floats: [{ text: '-2' }], hp: { delta: -2 } });
  });

  it('labels a block', () => {
    const frames = turnFrames('guard', true, { damageDealt: 1, damageTaken: 1, blocked: 3, healed: 0 }, true);
    expect(frames.flatMap((f) => f.floats ?? []).map((f) => f.text)).toEqual(['-1', 'Blocked 3', '-1']);
  });

  it('shows healing', () => {
    const frames = turnFrames('special', true, { damageDealt: 2, damageTaken: 0, blocked: 0, healed: 4 }, false);
    expect(frames[0]).toMatchObject({ floats: [{ side: 'player', text: '+4', kind: 'heal' }], hp: { delta: 4 } });
  });

  it('a defeated opponent slides away while the companion hops', () => {
    expect(turnFrames('attack', true, { ...hit, damageTaken: 0 }, false, 'defeated').at(-1)).toMatchObject({ playerMotion: 'hop', opponentMotion: 'slide' });
    expect(turnFrames('attack', true, { ...hit, damageTaken: 0 }, false, 'wornOut').at(-1)!.opponentMotion).toBeUndefined();
  });

  it('a streak makes hits bigger, without changing what happens', () => {
    expect(isPowered(2)).toBe(false);
    expect(isPowered(3)).toBe(true);
    expect(turnFrames('attack', true, hit, true, 'none', true)[1]).toMatchObject({ impact: 'big', floats: [{ text: '-3' }] });
  });

  it('the chime climbs with the streak, up to a limit', () => {
    expect(streakRate(1)).toBe(1);
    expect(streakRate(5)).toBeGreaterThan(streakRate(2));
    expect(streakRate(50)).toBe(streakRate(9));
  });

  it('a Field Note check lands as a critical', () => {
    const frame = turnFrames('attack', true, hit, true, 'none', false, true)[1]!;
    expect(frame).toMatchObject({ impact: 'big', sounds: ['crit'] });
    expect(frame.floats!.map((f) => f.text)).toContain('Critical!');
  });

  it('a Special bursts across the scene', () => {
    expect(turnFrames('special', true, hit, true)[0]).toMatchObject({ burst: true });
    expect(turnFrames('attack', true, hit, true)[0]!.burst).toBeUndefined();
  });

  it('a Bold Befriend attempt shows no attack', () => {
    const frames = turnFrames('tame', true, { damageDealt: 0, damageTaken: 2, blocked: 0, healed: 0 }, true);
    expect(frames.some((f) => f.player === 'attack')).toBe(false);
    expect(frames[0]).toMatchObject({ opponentMotion: 'glow' });
  });

  it('befriending plays its own moment', () => {
    expect(turnFrames('befriend', true, hit, false)[0]!.sounds).toEqual(['befriend']);
  });
});
