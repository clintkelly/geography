import type { Lodge } from '../content/lodges';
import { DIFFICULTIES, type Difficulty, type Pack } from '../content/types';
import { teamScaling } from './progression';

/** Lodge questions get harder up the ladder, within the parent's limits. */
const RANK_DIFFICULTY: readonly Difficulty[] = ['scout', 'scout', 'ranger', 'ranger', 'ranger', 'expert', 'expert', 'expert'];

/** A beaten Lodge can be rematched for a Silver patch, then a Gold one, each harder. */
export type LodgeTier = 'bronze' | 'silver' | 'gold';
export const LODGE_TIERS: readonly LodgeTier[] = ['bronze', 'silver', 'gold'];
/** How much stronger each tier's rangers are, counted in Lodge ranks. */
const TIER_POWER: Record<LodgeTier, number> = { bronze: 0, silver: 2, gold: 4 };
/** How far a tier raises each creature's stage, up to fully evolved. */
export const TIER_STAGE: Record<LodgeTier, number> = { bronze: 0, silver: 1, gold: 2 };

export function lodgeDifficulty(lodge: Lodge, settings: { minDifficulty: Difficulty; maxDifficulty: Difficulty }, tier: LodgeTier = 'bronze'): Difficulty {
  const base = DIFFICULTIES.indexOf(RANK_DIFFICULTY[lodge.rank - 1] ?? 'expert');
  // Silver is at least Ranger, and Gold is always Expert.
  const want = tier === 'gold' ? 2 : tier === 'silver' ? Math.max(base, 1) : base;
  const low = DIFFICULTIES.indexOf(settings.minDifficulty);
  const high = DIFFICULTIES.indexOf(settings.maxDifficulty);
  return DIFFICULTIES[Math.min(Math.max(want, low), high)] as Difficulty;
}

/** The Lodge ladder, in order. The League is not on it. */
export const lodgesOf = (pack: Pack): readonly Lodge[] => [...(pack.lodges ?? [])].filter((l) => !l.gauntlet && !l.kaiju).sort((a, b) => a.rank - b.rank);
/** Every Kaiju Alert, easiest first. */
export const kaijuOf = (pack: Pack): readonly Lodge[] => [...(pack.lodges ?? [])].filter((l) => !!l.kaiju).sort((a, b) => a.kaiju!.threat - b.kaiju!.threat);
/**
 * The kaiju on the move today: the easiest one not yet beaten, and once all are beaten, a different one each day.
 */
export function kaijuAlert(pack: Pack, beaten: readonly string[], day: string, reroll?: { day: string; lodgeId: string }): Lodge | undefined {
  const all = kaijuOf(pack);
  // A child who rerolled today's alert gets the kaiju they rolled until the day ends.
  if (reroll?.day === day) {
    const picked = all.find((l) => l.id === reroll.lodgeId);
    if (picked) return picked;
  }
  const next = all.find((l) => !beaten.includes(l.id));
  if (next || all.length === 0) return next;
  let h = 2166136261;
  for (const ch of `kaiju:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return all[h % all.length];
}
/** The Ranger League, open once every Lodge is beaten. */
export const leagueOf = (pack: Pack): Lodge | undefined => (pack.lodges ?? []).find((l) => !!l.gauntlet);
export const lodgeById = (pack: Pack, id: string | undefined) => (pack.lodges ?? []).find((l) => l.id === id);

/** A child's patches: Bronze for every Lodge beaten, and Silver or Gold for those won again. */
export interface LodgeProgress {
  lodgesBeaten?: readonly string[];
  lodgeTiers?: Readonly<Record<string, 'silver' | 'gold'>>;
}

export function patchOf(p: LodgeProgress, lodgeId: string): LodgeTier | undefined {
  return p.lodgeTiers?.[lodgeId] ?? ((p.lodgesBeaten ?? []).includes(lodgeId) ? 'bronze' : undefined);
}
const atLeast = (have: LodgeTier | undefined, want: LodgeTier) => !!have && LODGE_TIERS.indexOf(have) >= LODGE_TIERS.indexOf(want);

/**
 * Lodges open one at a time: the first is always open, and each win opens the next. Some need another Lodge's Gold patch.
 * Silver opens once Bronze is won, and Gold once Silver is.
 */
export function lodgeOpen(pack: Pack, beatenOrProgress: readonly string[] | LodgeProgress, lodgeId: string, tier: LodgeTier = 'bronze'): boolean {
  const p: LodgeProgress = Array.isArray(beatenOrProgress) ? { lodgesBeaten: beatenOrProgress as readonly string[] } : (beatenOrProgress as LodgeProgress);
  const lodge = lodgeById(pack, lodgeId);
  if (!lodge) return false;
  if (lodge.kaiju) return tier === 'bronze';
  if (tier !== 'bronze') return !lodge.gauntlet && atLeast(patchOf(p, lodgeId), tier === 'silver' ? 'bronze' : 'silver');
  const before = lodgesOf(pack).filter((l) => l.rank < lodge.rank);
  return before.every((l) => (p.lodgesBeaten ?? []).includes(l.id)) && (!lodge.needsGold || atLeast(patchOf(p, lodge.needsGold), 'gold'));
}

/** The next Lodge to beat, or none once the Summit is won. */
export const nextLodge = (pack: Pack, beaten: readonly string[]) => lodgesOf(pack).find((l) => !beaten.includes(l.id));

export type LodgeRole = 'junior' | 'leader' | 'ace';

/** Opponent HP by Lodge rank. Fixed, so a Lodge is as hard as its place on the ladder, whatever creatures a child brings. */
const FOE_HP: Record<LodgeRole, readonly number[]> = {
  junior: [8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20],
  leader: [11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23],
  ace: [13, 14, 15, 16, 17, 17, 17, 21, 22, 23, 24, 25],
};
/** Silver and Gold rematches fight at a higher rank. */
export const lodgePower = (rank: number, tier: LodgeTier = 'bronze') => rank + TIER_POWER[tier];

/**
 * Tuned so a lone creature at the recommended level, with most answers right, beats the junior rangers almost every time,
 * the leader usually, and the ace a bit more often than not. The ace winds up a big hit every third turn from the third Lodge on.
 * A bigger team faces tougher opponents, as on the trail.
 */
export function lodgeFoeStats(rank: number, role: LodgeRole, teamSize: number, shield = 0) {
  const i = Math.min(Math.max(rank, 1), FOE_HP.junior.length) - 1;
  const scale = teamScaling(teamSize);
  const boss = role === 'ace' && rank >= 3 ? (rank >= 8 ? 3 : 2) : 0;
  const pattern = rank <= 3 ? [1, 2, 3] : rank <= 7 ? [2, 2, 4] : rank <= 10 ? [2, 3, 4] : [3, 3, 4];
  return {
    opponentMaxHp: (FOE_HP[role][i] as number) + scale.hp,
    enemyPattern: pattern.map((d) => d + scale.damage),
    maxTurns: (role === 'junior' ? 8 : 10) + (boss ? 2 : 0) + scale.turns,
    ...(boss ? { bossPower: boss } : {}),
    // A shield takes right answers to break, so the fight gets the extra turns it needs.
    // Cracking it takes right answers instead of HP, so a shielded creature has less HP to make up for it.
    ...(shield ? { shield, opponentMaxHp: Math.max(6, (FOE_HP[role][i] as number) + scale.hp - SHIELD_HP * shield), maxTurns: (role === 'junior' ? 8 : 10) + (boss ? 2 : 0) + scale.turns + shield } : {}),
  };
}

/** Brain Shield strength on the leader's creatures in the math and vocabulary Lodges. */
export const BRAIN_SHIELD = 3;
/** HP a shielded creature gives up for each point of shield. */
const SHIELD_HP = 1;

/** Quizzes at a Lodge: a gate at the door of the math and vocabulary Lodges, and a Mastery Test for Gold. */
export const LODGE_QUIZ = {
  gate: { questions: 8, need: 6 },
  mastery: { questions: 10, need: 9 },
} as const;
