import type { Pack } from '../content/types';
import type { Learning } from './learning';

export type CardLevel = 'bronze' | 'silver' | 'gold' | 'shiny';
export const CARD_LEVELS: readonly CardLevel[] = ['bronze', 'silver', 'gold', 'shiny'];
export const SILVER_TOPICS = 3;
const GOLD_ANSWERS = 3;
const GOLD_DAYS = 2;
const SHINY_EXPERT_ANSWERS = 3;

/** Everything the child has answered on their own about one place. */
function successesFor(learning: Learning, placeId: string) {
  const belongs = (id: string) => id === `capital-${placeId}` || id === `location-${placeId}` || id === `nickname-${placeId}` || id.startsWith(`fact-${placeId}-`);
  const entries = Object.entries(learning).filter(([id, p]) => belongs(id) && p.successes.length > 0);
  return { topics: entries.length, all: entries.flatMap(([, p]) => p.successes) };
}

export interface CardProgress {
  level: CardLevel;
  /** What's left for the next level, in a child's words. Empty at the top. */
  next: string;
}

/** A card's level comes from what the child has shown they know, so it can't be lost or farmed in one sitting. */
export function cardProgress(learning: Learning, placeId: string): CardProgress {
  const { topics, all } = successesFor(learning, placeId);
  const days = new Set(all.map((s) => s.day)).size;
  const expert = all.filter((s) => s.difficulty === 'expert').length;
  if (topics < SILVER_TOPICS) {
    const left = SILVER_TOPICS - topics;
    return { level: 'bronze', next: `${left} more ${left === 1 ? 'topic' : 'topics'} for Silver` };
  }
  if (all.length < GOLD_ANSWERS || days < GOLD_DAYS) {
    const left = Math.max(GOLD_ANSWERS - all.length, 0);
    return { level: 'silver', next: days < GOLD_DAYS ? `Come back another day for Gold` : `${left} more right ${left === 1 ? 'answer' : 'answers'} for Gold` };
  }
  if (expert < SHINY_EXPERT_ANSWERS) {
    const left = SHINY_EXPERT_ANSWERS - expert;
    return { level: 'gold', next: `${left} more on Expert for Shiny` };
  }
  return { level: 'shiny', next: '' };
}

export const cardLevelOf = (learning: Learning, placeId: string) => cardProgress(learning, placeId).level;

export const hasCardsAtLeast = (cards: readonly string[], learning: Learning, level: CardLevel) =>
  cards.filter((id) => CARD_LEVELS.indexOf(cardLevelOf(learning, id)) >= CARD_LEVELS.indexOf(level));

/** Any place's cards, for checks over a whole region. */
export const placesIn = (pack: Pack, regionId: string) => pack.places.filter((p) => p.regionId === regionId).map((p) => p.id);
