export interface StreakReward {
  label: string;
  points: number;
  heal: number;
}

/** Streak milestones. Reaching one pays out; breaking a streak never costs anything. */
export function streakReward(streak: number): StreakReward | null {
  if (streak === 3) return { label: 'Hot Streak!', points: 0, heal: 0 };
  if (streak === 5) return { label: 'On Fire! +1 point', points: 1, heal: 0 };
  if (streak === 8) return { label: 'Blazing! +2 HP', points: 0, heal: 2 };
  if (streak === 10) return { label: 'Unstoppable! +2 points', points: 2, heal: 0 };
  if (streak >= 15 && streak % 5 === 0) return { label: `Legendary ${streak}! +2 points`, points: 2, heal: 0 };
  return null;
}
