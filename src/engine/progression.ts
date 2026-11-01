import type { Difficulty, Pack, Species } from '../content/types';

export const MAX_LEVEL = 10;
export const STAGE_2_LEVEL = 5;
export const STAGE_3_LEVEL = 10;
export const XP = { battleWon: 10, expeditionDone: 20 } as const;
const DIFFICULTY_XP: Record<Difficulty, number> = { scout: 1, ranger: 1.25, expert: 1.5 };

export const xpFor = (base: number, difficulty: Difficulty) => Math.round(base * DIFFICULTY_XP[difficulty]);

/** Total XP needed to reach a level. Each level costs 20 more than the last. */
export const xpForLevel = (level: number) => 10 * level * (level - 1);

export function levelOf(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function stageOf(xp: number, species?: Species): 1 | 2 | 3 {
  if (species && !species.evolutions) return 1;
  const level = levelOf(xp);
  return level >= STAGE_3_LEVEL ? 3 : level >= STAGE_2_LEVEL ? 2 : 1;
}

/** Progress through the current level, as a fraction, for an XP bar. */
export function levelProgress(xp: number): number {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return 1;
  const from = xpForLevel(level);
  return (xp - from) / (xpForLevel(level + 1) - from);
}

export interface StageStats {
  maxHp: number;
  attack: number;
  regularHp: number;
  finalHp: number;
  /** Extra Special power from stage 2 on. */
  specialBonus: number;
  /** Charge at the start of each battle, from stage 3. */
  startCharge: number;
}

export const STAGES: Record<1 | 2 | 3, StageStats> = {
  1: { maxHp: 12, attack: 3, regularHp: 10, finalHp: 14, specialBonus: 0, startCharge: 0 },
  2: { maxHp: 14, attack: 4, regularHp: 12, finalHp: 16, specialBonus: 1, startCharge: 0 },
  3: { maxHp: 16, attack: 5, regularHp: 15, finalHp: 20, specialBonus: 1, startCharge: 1 },
};

/** The name and art a companion currently uses. */
export function formOf(species: Species, xp: number): { name: string; artId: string; stage: 1 | 2 | 3 } {
  const stage = stageOf(xp, species);
  const form = stage > 1 ? species.evolutions?.[stage - 2] : undefined;
  return { name: form?.name ?? species.displayName, artId: form?.artId ?? species.artId, stage };
}

export const MAX_TEAM = 5;
export const TURF_BONUS = 1;
/** A bigger team faces tougher opponents, or five health bars would make every fight safe. */
export const teamScaling = (size: number) => {
  const extra = Math.max(size - 1, 0);
  return { hp: extra * 2, turns: extra, damage: size >= 4 ? 1 : 0 };
};

export const speciesOf = (pack: Pack, id: string) => pack.species.find((s) => s.id === id) as Species;
