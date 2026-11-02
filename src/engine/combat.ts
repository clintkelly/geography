/**
 * Combat rules. Pure and subject-agnostic: it receives whether an answer was
 * correct and never sees what the question was about.
 */
export type CombatAction = 'attack' | 'guard' | 'special';
export type CombatOutcome = 'active' | 'victory' | 'retreat';
export type SpecialTemplate = 'strong' | 'heal' | 'protect';
/** Fierce hits 1 harder, gives no charge, and a missed one takes 1 extra damage. Simulated win rates match steady. */
export type AttackStyle = 'steady' | 'fierce';
/** Guards trade damage, block and charge. Simulated win rates are within a few points of each other. */
export type GuardStyle = 'steady' | 'spiky' | 'wall' | 'focus';

export interface CombatConfig {
  playerMaxHp: number;
  playerAttack: number;
  special: SpecialTemplate;
  /** Older saves have no styles, so both default to steady. */
  attackStyle?: AttackStyle;
  guardStyle?: GuardStyle;
  /** Extra Special power from evolving. */
  specialBonus?: number;
  /** Extra Attack damage on home turf. Specials don't get it, so battles still take three right answers. */
  turf?: number;
  /** Type matchup against this opponent: 1 strong, -1 weak. It changes the damage this creature deals. */
  typeEdge?: number;
  /** A boss adds this to every third attack. */
  bossPower?: number;
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
const GUARD_WRONG_BLOCK = 1;
const FIERCE_BONUS = 1;
/** Correct Guard results by style. */
export const GUARDS: Record<GuardStyle, { damage: number; block: number; charge: number }> = {
  steady: { damage: 1, block: 3, charge: 1 },
  spiky: { damage: 2, block: 2, charge: 1 },
  wall: { damage: 0, block: 5, charge: 1 },
  focus: { damage: 1, block: 2, charge: 2 },
};
const SPECIAL_BONUS = 2;
const SPECIAL_LIGHT_DAMAGE = 2;
const SPECIAL_HEAL = 4;
const SPECIAL_BLOCK = 4;


export function startCombat(config: CombatConfig): CombatState {
  return { ...config, playerHp: config.playerMaxHp, opponentHp: config.opponentMaxHp, charge: 0, turn: 1, outcome: 'active' };
}

/** The opponent's visible intent for the current turn. */
export function enemyIntent(state: CombatState): number {
  return (state.enemyPattern[(state.turn - 1) % state.enemyPattern.length] ?? 0) + (isBossTurn(state) ? state.bossPower ?? 0 : 0);
}

/** A boss winds up a big hit every third turn, so the child can Guard against it. */
export const isBossTurn = (state: CombatState) => !!state.bossPower && state.turn % 3 === 0;

/** Attack damage, which is never below 1. */
export const attackDamage = (state: CombatState) => Math.max(1, state.playerAttack + (state.attackStyle === 'fierce' ? FIERCE_BONUS : 0) + (state.turf ?? 0) + (state.typeEdge ?? 0));
export const attackCharge = (state: CombatState) => (state.attackStyle === 'fierce' ? 0 : 1);
export const guardOf = (state: CombatState) => GUARDS[state.guardStyle ?? 'steady'];
export const strongSpecialDamage = (state: CombatState) => Math.max(1, state.playerAttack + SPECIAL_BONUS + (state.typeEdge ?? 0));

/** A free action: it heals without using the turn. */
export function heal(state: CombatState, amount: number): CombatState {
  return { ...state, playerHp: Math.min(state.playerMaxHp, state.playerHp + amount) };
}

export function canUse(state: CombatState, action: CombatAction): boolean {
  return state.outcome === 'active' && (action !== 'special' || state.charge >= SPECIAL_COST);
}

function playerEffect(state: CombatState, action: CombatAction, correct: boolean) {
  const none = { damage: 0, block: 0, heal: 0, charge: state.charge };
  const gain = (n: number) => Math.min(MAX_CHARGE, state.charge + n);
  if (action === 'guard') {
    const g = guardOf(state);
    return correct ? { ...none, damage: g.damage, block: g.block, charge: gain(g.charge) } : { ...none, block: GUARD_WRONG_BLOCK };
  }
  if (!correct) return none;
  if (action === 'attack') return { ...none, damage: attackDamage(state), charge: gain(attackCharge(state)) };

  const spent = state.charge - SPECIAL_COST;
  const bonus = state.specialBonus ?? 0;
  if (state.special === 'strong') return { ...none, damage: strongSpecialDamage(state) + bonus, charge: spent };
  if (state.special === 'heal') return { ...none, damage: SPECIAL_LIGHT_DAMAGE, heal: SPECIAL_HEAL + bonus, charge: spent };
  return { ...none, damage: SPECIAL_LIGHT_DAMAGE, block: SPECIAL_BLOCK + bonus, charge: spent };
}

/** The opponent's attack with no player action, as when a creature switches in. */
export function enemyStrikes(state: CombatState): { state: CombatState; damage: number } {
  const damage = enemyIntent(state);
  const playerHp = Math.max(0, state.playerHp - damage);
  const retreat = playerHp === 0 || state.turn >= state.maxTurns;
  return { state: { ...state, playerHp, outcome: retreat ? 'retreat' : 'active', turn: retreat ? state.turn : state.turn + 1 }, damage };
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

  // A missed fierce Attack leaves the creature open, so the opponent's hit lands 1 harder.
  const intent = enemyIntent(state) + (action === 'attack' && !correct && state.attackStyle === 'fierce' ? FIERCE_BONUS : 0);
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
