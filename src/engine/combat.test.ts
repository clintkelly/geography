import { describe, expect, it } from 'vitest';
import { canUse, enemyIntent, GUARDS, resolveTurn, startCombat, type CombatAction, type GuardStyle, type SpecialTemplate } from './combat';
import { PACK } from '../content/pack';

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

describe('creature moves', () => {
  it('every creature has its own Attack and Guard names', () => {
    const names = PACK.species.flatMap((s) => [s.moves.attack, s.moves.guard, s.special.name]);
    for (const s of PACK.species) expect(s.moves, s.id).toBeTruthy();
    expect(new Set(PACK.species.map((s) => s.moves.attack)).size).toBe(PACK.species.length);
    expect(new Set(PACK.species.map((s) => s.moves.guard)).size).toBe(PACK.species.length);
    expect(names.every((n) => n.length > 0)).toBe(true);
  });

  it('a fierce Attack hits 1 harder and gives no charge', () => {
    const { state, events } = resolveTurn(startCombat({ ...config, attackStyle: 'fierce' }), 'attack', true);
    expect(events.damageDealt).toBe(4);
    expect(state.charge).toBe(0);
  });

  it.each<[GuardStyle, number, number, number]>([
    ['steady', 1, 2, 1],
    ['spiky', 2, 2, 1],
    ['wall', 0, 2, 1],
    ['focus', 1, 2, 2],
  ])('a %s Guard deals %i and blocks the hit, with %i charge', (guardStyle, dealt, blocked, charge) => {
    const { state, events } = resolveTurn(startCombat({ ...config, guardStyle }), 'guard', true);
    expect(events.damageDealt).toBe(dealt);
    expect(events.blocked).toBe(blocked);
    expect(state.charge).toBe(charge);
  });

  it('Guard styles trade damage, block and charge', () => {
    expect(GUARDS).toEqual({
      steady: { damage: 1, block: 3, charge: 1 },
      spiky: { damage: 2, block: 2, charge: 1 },
      wall: { damage: 0, block: 5, charge: 1 },
      focus: { damage: 1, block: 2, charge: 2 },
    });
  });

  it('a missed fierce Attack takes 1 extra damage, and a missed steady one does not', () => {
    expect(resolveTurn(startCombat({ ...config, attackStyle: 'fierce' }), 'attack', false).events.damageTaken).toBe(3);
    expect(resolveTurn(startCombat(config), 'attack', false).events.damageTaken).toBe(2);
    expect(resolveTurn(startCombat({ ...config, attackStyle: 'fierce' }), 'attack', true).events.damageTaken).toBe(2);
  });

  it('a wrong Guard blocks 1, whatever the style', () => {
    const styles: GuardStyle[] = ['steady', 'spiky', 'wall', 'focus'];
    for (const guardStyle of styles) expect(resolveTurn(startCombat({ ...config, guardStyle }), 'guard', false).events.blocked).toBe(1);
  });
});
