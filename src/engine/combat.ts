/**
 * Combat rules. Pure and subject-agnostic: it receives whether an answer was
 * correct and never sees what the question was about.
 */
export type CombatAction = 'attack' | 'guard' | 'special';
export type CombatOutcome = 'active' | 'victory' | 'retreat';
export type SpecialTemplate = 'strong' | 'heal' | 'protect';

export interface CombatConfig {
  playerMaxHp: number;
  playerAttack: number;
  special: SpecialTemplate;
  opponentMaxHp: number;
  enemyPattern: readonly number[];
  maxTurns: number;
}

export interface CombatState extends CombatConfig {
  playerHp: number;
  opponentHp: number;
  charge: number;
  /** 1-based turn currently being played. */
  turn: number;
  outcome: CombatOutcome;
}

export interface TurnEvents {
  damageDealt: number;
  damageTaken: number;
  blocked: number;
  healed: number;
}

export const MAX_CHARGE = 2;
export const SPECIAL_COST = 2;
const GUARD_DAMAGE = 1;
const GUARD_BLOCK = 3;
const GUARD_WRONG_BLOCK = 1;
const SPECIAL_BONUS = 2;
const SPECIAL_LIGHT_DAMAGE = 2;
const SPECIAL_HEAL = 4;
const SPECIAL_BLOCK = 4;

export function startCombat(config: CombatConfig): CombatState {
  return { ...config, playerHp: config.playerMaxHp, opponentHp: config.opponentMaxHp, charge: 0, turn: 1, outcome: 'active' };
}

/** The opponent's visible intent for the current turn. */
export function enemyIntent(state: CombatState): number {
  return state.enemyPattern[(state.turn - 1) % state.enemyPattern.length] ?? 0;
}

export function canUse(state: CombatState, action: CombatAction): boolean {
  return state.outcome === 'active' && (action !== 'special' || state.charge >= SPECIAL_COST);
}

function playerEffect(state: CombatState, action: CombatAction, correct: boolean) {
  const none = { damage: 0, block: 0, heal: 0, charge: state.charge };
  const gain = Math.min(MAX_CHARGE, state.charge + 1);
  if (action === 'guard') {
    return correct ? { ...none, damage: GUARD_DAMAGE, block: GUARD_BLOCK, charge: gain } : { ...none, block: GUARD_WRONG_BLOCK };
  }
  if (!correct) return none;
  if (action === 'attack') return { ...none, damage: state.playerAttack, charge: gain };

  const spent = state.charge - SPECIAL_COST;
  if (state.special === 'strong') return { ...none, damage: state.playerAttack + SPECIAL_BONUS, charge: spent };
  if (state.special === 'heal') return { ...none, damage: SPECIAL_LIGHT_DAMAGE, heal: SPECIAL_HEAL, charge: spent };
  return { ...none, damage: SPECIAL_LIGHT_DAMAGE, block: SPECIAL_BLOCK, charge: spent };
}

export function resolveTurn(
  state: CombatState,
  action: CombatAction,
  correct: boolean,
): { state: CombatState; events: TurnEvents } {
  if (!canUse(state, action)) return { state, events: { damageDealt: 0, damageTaken: 0, blocked: 0, healed: 0 } };

  const effect = playerEffect(state, action, correct);
  const opponentHp = Math.max(0, state.opponentHp - effect.damage);
  const healedHp = Math.min(state.playerMaxHp, state.playerHp + effect.heal);
  const healed = healedHp - state.playerHp;
  if (opponentHp === 0) {
    return {
      state: { ...state, opponentHp, playerHp: healedHp, charge: effect.charge, outcome: 'victory' },
      events: { damageDealt: effect.damage, damageTaken: 0, blocked: 0, healed },
    };
  }

  const intent = enemyIntent(state);
  const blocked = Math.min(intent, effect.block);
  const damageTaken = intent - blocked;
  const playerHp = Math.max(0, healedHp - damageTaken);
  const retreat = playerHp === 0 || state.turn >= state.maxTurns;
  return {
    state: {
      ...state,
      opponentHp,
      playerHp,
      charge: effect.charge,
      outcome: retreat ? 'retreat' : 'active',
      turn: retreat ? state.turn : state.turn + 1,
    },
    events: { damageDealt: effect.damage, damageTaken, blocked, healed },
  };
}
