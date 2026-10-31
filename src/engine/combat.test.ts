import { describe, expect, it } from 'vitest';
import { enemyIntent, resolveTurn, startCombat } from './combat';

const config = { playerMaxHp: 12, opponentMaxHp: 10, enemyPattern: [1, 2, 2], maxTurns: 8 };

describe('combat', () => {
  it('deals damage on a correct attack and the enemy still answers', () => {
    const { state, events } = resolveTurn(startCombat(config), 'attack', true);
    expect(events).toEqual({ damageDealt: 3, damageTaken: 1 });
    expect(state).toMatchObject({ opponentHp: 7, playerHp: 11, turn: 2 });
  });

  it('a wrong answer does no damage and the enemy still attacks', () => {
    const { state } = resolveTurn(startCombat(config), 'attack', false);
    expect(state).toMatchObject({ opponentHp: 10, playerHp: 11 });
  });

  it('shows intent that matches the damage taken, repeating the pattern', () => {
    let s = startCombat({ ...config, playerMaxHp: 99, maxTurns: 99 });
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      seen.push(enemyIntent(s));
      s = resolveTurn(s, 'attack', false).state;
    }
    expect(seen).toEqual([1, 2, 2, 1, 2, 2]);
  });

  it('the opponent does not attack after being defeated', () => {
    const { state, events } = resolveTurn({ ...startCombat(config), opponentHp: 3 }, 'attack', true);
    expect(state.outcome).toBe('victory');
    expect(events.damageTaken).toBe(0);
  });

  it('a win on the last allowed turn is a victory', () => {
    const s = { ...startCombat(config), turn: 8, opponentHp: 3, playerHp: 1 };
    expect(resolveTurn(s, 'attack', true).state.outcome).toBe('victory');
  });

  it('retreats at the turn limit or at zero HP, and HP never goes negative', () => {
    expect(resolveTurn({ ...startCombat(config), turn: 8 }, 'attack', false).state.outcome).toBe('retreat');
    const { state } = resolveTurn({ ...startCombat(config), playerHp: 1, turn: 2 }, 'attack', false);
    expect(state).toMatchObject({ outcome: 'retreat', playerHp: 0 });
  });

  it('ignores turns after the encounter ended', () => {
    const ended = { ...startCombat(config), outcome: 'victory' as const };
    expect(resolveTurn(ended, 'attack', true).state).toBe(ended);
  });

  it('Milestone 1 balance allows misses against the guardian', () => {
    let s = startCombat({ ...config, opponentMaxHp: 14, maxTurns: 10 });
    for (const correct of [false, false, false, true, true, true, true, true]) s = resolveTurn(s, 'attack', correct).state;
    expect(s.outcome).toBe('victory');
  });
});
