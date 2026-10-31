/**
 * Combat rules. Pure and subject-agnostic: it receives whether an answer was
 * correct and never sees what the question was about.
 */
export type CombatAction = 'attack';
export type CombatOutcome = 'active' | 'victory' | 'retreat';

export interface CombatConfig {
  playerMaxHp: number;
  opponentMaxHp: number;
  enemyPattern: readonly number[];
  maxTurns: number;
}

export interface CombatState extends CombatConfig {
  playerHp: number;
  opponentHp: number;
  /** 1-based turn currently being played. */
  turn: number;
  outcome: CombatOutcome;
}

export interface TurnEvents {
  damageDealt: number;
  damageTaken: number;
}

export const ATTACK_DAMAGE = 3;

export function startCombat(config: CombatConfig): CombatState {
  return { ...config, playerHp: config.playerMaxHp, opponentHp: config.opponentMaxHp, turn: 1, outcome: 'active' };
}

/** The opponent's visible intent for the current turn. */
export function enemyIntent(state: CombatState): number {
  return state.enemyPattern[(state.turn - 1) % state.enemyPattern.length] ?? 0;
}

export function resolveTurn(
  state: CombatState,
  action: CombatAction,
  correct: boolean,
): { state: CombatState; events: TurnEvents } {
  if (state.outcome !== 'active') return { state, events: { damageDealt: 0, damageTaken: 0 } };

  const damageDealt = action === 'attack' && correct ? ATTACK_DAMAGE : 0;
  const opponentHp = Math.max(0, state.opponentHp - damageDealt);
  if (opponentHp === 0) {
    return { state: { ...state, opponentHp, outcome: 'victory' }, events: { damageDealt, damageTaken: 0 } };
  }

  const damageTaken = enemyIntent(state);
  const playerHp = Math.max(0, state.playerHp - damageTaken);
  const retreat = playerHp === 0 || state.turn >= state.maxTurns;
  return {
    state: { ...state, opponentHp, playerHp, outcome: retreat ? 'retreat' : 'active', turn: retreat ? state.turn : state.turn + 1 },
    events: { damageDealt, damageTaken },
  };
}
