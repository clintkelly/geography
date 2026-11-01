import { describe, expect, it } from 'vitest';
import { turnFrames } from './battleAnimation';

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
    expect(turnFrames('attack', true, hit, true).at(-1)!.at).toBeLessThanOrEqual(1100);
  });

  it('befriending plays its own moment', () => {
    expect(turnFrames('befriend', true, hit, false)[0]!.sounds).toEqual(['befriend']);
  });
});
