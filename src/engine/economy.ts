/** Every Trail Point number lives here, so playtesting can tune them in one place. */
export const ECONOMY = {
  startingPoints: 10,
  perCorrectAnswer: 1,
  /** Extra points for answering a question about an earlier Field Note. */
  recallBonus: 2,
  wrongGuessCost: 1,
  xpPerLeftoverPoint: 2,
  extraClue: 2,
  narrowSearch: 3,
} as const;

export type PrepItem = 'sturdy' | 'charge' | 'snack';

export const PREP_ITEMS: readonly { id: PrepItem; name: string; cost: number; text: string }[] = [
  { id: 'sturdy', name: 'Sturdy Spirit', cost: 4, text: '+2 maximum HP for this expedition' },
  { id: 'charge', name: 'Extra Charge', cost: 4, text: 'Start every battle with 1 charge' },
  { id: 'snack', name: 'Trail Snack', cost: 2, text: 'Restore 4 HP once during a battle' },
];

export const SNACK_HEAL = 4;
export const STURDY_HP = 2;
