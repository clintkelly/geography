import { describe, expect, it } from 'vitest';
import { canUse, enemyIntent, resolveTurn, startCombat, type CombatAction, type SpecialTemplate } from './combat';

const config = { playerMaxHp: 12, playerAttack: 3, special: 'strong' as SpecialTemplate, opponentMaxHp: 10, enemyPattern: [2, 2, 4], maxTurns: 8 };
const charged = (special: SpecialTemplate = 'strong') => ({ ...startCombat({ ...config, special }), charge: 2 });

describe('PRD section 6 action table', () => {
  // Turn 1 has an enemy intent of 2.
  it.each<[string, CombatAction, boolean, number, number, number]>([
    ['Attack, correct', 'attack', true, 3, 2, 1],
    ['Attack, wrong', 'attack', false, 0, 2, 0],
    ['Guard, correct', 'guard', true, 1, 0, 1],
    ['Guard, wrong', 'guard', false, 0, 1, 0],
  ])('%s', (_name, action, correct, dealt, taken, charge) => {
    const { state, events } = resolveTurn(startCombat(config), action, correct);
    expect(events.damageDealt).toBe(dealt);
    expect(events.damageTaken).toBe(taken);
    expect(state.charge).toBe(charge);
  });

  it('Guard blocks up to 3 against a bigger hit', () => {
    const { events } = resolveTurn({ ...startCombat(config), turn: 3 }, 'guard', true);
    expect(events).toMatchObject({ blocked: 3, damageTaken: 1 });
  });

  it('strong Special deals Attack + 2 and consumes charge', () => {
    const { state, events } = resolveTurn(charged(), 'special', true);
    expect(events.damageDealt).toBe(5);
    expect(state.charge).toBe(0);
  });

  it('healing Special deals 2 and heals 4, capped at maximum', () => {
    const { state, events } = resolveTurn({ ...charged('heal'), playerHp: 5 }, 'special', true);
    expect(events).toMatchObject({ damageDealt: 2, healed: 4 });
    expect(state.playerHp).toBe(7);
    expect(resolveTurn({ ...charged('heal'), playerHp: 11 }, 'special', true).events.healed).toBe(1);
  });

  it('protective Special deals 2 and blocks up to 4', () => {
    const { events } = resolveTurn({ ...charged('protect'), turn: 3 }, 'special', true);
    expect(events).toMatchObject({ damageDealt: 2, blocked: 4, damageTaken: 0 });
  });

  it('a wrong Special has no effect and keeps charge', () => {
    const { state, events } = resolveTurn(charged(), 'special', false);
    expect(events.damageDealt).toBe(0);
    expect(state.charge).toBe(2);
  });

  it('Special needs 2 charge and earns none', () => {
    expect(canUse(startCombat(config), 'special')).toBe(false);
    expect(canUse(charged(), 'special')).toBe(true);
    const s = startCombat(config);
    expect(resolveTurn(s, 'special', true).state).toBe(s);
  });

  it('charge stops at 2', () => {
    expect(resolveTurn(charged(), 'attack', true).state.charge).toBe(2);
  });

  it('blocks expire after the enemy turn', () => {
    const first = resolveTurn(startCombat(config), 'guard', true).state;
    expect(resolveTurn(first, 'attack', true).events.damageTaken).toBe(2);
  });
});

describe('turn order', () => {
  it('shows intent that matches the damage taken, repeating the pattern', () => {
    let s = startCombat({ ...config, playerMaxHp: 99, maxTurns: 99 });
    const seen: number[] = [];
    for (let i = 0; i < 6; i++) {
      seen.push(enemyIntent(s));
      expect(resolveTurn(s, 'attack', false).events.damageTaken).toBe(enemyIntent(s));
      s = resolveTurn(s, 'attack', false).state;
    }
    expect(seen).toEqual([2, 2, 4, 2, 2, 4]);
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
});

describe('balance', () => {
  const play = (hp: number, plan: [CombatAction, boolean][]) => {
    let s = startCombat({ ...config, opponentMaxHp: hp, maxTurns: 10 });
    for (const [action, correct] of plan) if (s.outcome === 'active') s = resolveTurn(s, action, correct).state;
    return s.outcome;
  };

  it('the guardian no longer needs a perfect run', () => {
    expect(play(14, [['attack', false], ['attack', true], ['attack', true], ['special', true], ['attack', true]])).toBe('victory');
  });

  it('a regular opponent takes at least 3 correct answers', () => {
    expect(play(10, [['attack', true], ['attack', true]])).toBe('active');
    expect(play(10, [['attack', true], ['attack', true], ['special', true]])).toBe('victory');
  });
});
