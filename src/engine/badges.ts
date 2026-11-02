import type { Pack } from '../content/types';
import type { SaveData } from './game';
import { hasCardsAtLeast } from './cards';
import { stageOf, speciesOf } from './progression';

export interface Badge {
  id: string;
  name: string;
  hint: string;
  earned: (save: SaveData, pack: Pack) => boolean;
}

const foundAll = (ids: string[]) => (s: SaveData) => ids.every((id) => s.foundPlaces.includes(id));
const regionDone = (regionId: string) => (s: SaveData, pack: Pack) => pack.places.filter((p) => p.regionId === regionId || p.regionId.startsWith(`${regionId}-`)).every((p) => s.foundPlaces.includes(p.id));

export const BADGES: readonly Badge[] = [
  { id: 'west', name: 'Western Trailblazer', hint: 'Find every state in the American West', earned: regionDone('us-west') },
  { id: 'midwest', name: 'Heartland Hero', hint: 'Find every state in the Midwest', earned: regionDone('us-midwest') },
  { id: 'south', name: 'Southern Star', hint: 'Find every state in the South', earned: regionDone('us-south') },
  { id: 'northeast', name: 'Northeast Navigator', hint: 'Find every state in the Northeast', earned: regionDone('us-northeast') },
  { id: 'europe-north', name: 'Northern Lights', hint: 'Find every country in Northern Europe', earned: regionDone('europe-north') },
  { id: 'europe-west', name: 'Western Wanderer', hint: 'Find every country in Western Europe', earned: regionDone('europe-west') },
  { id: 'europe-south', name: 'Southern Sunseeker', hint: 'Find every country in Southern Europe', earned: regionDone('europe-south') },
  { id: 'europe-east', name: 'Eastern Explorer', hint: 'Find every country in Eastern Europe', earned: regionDone('europe-east') },
  { id: 'europe', name: 'Grand Tour of Europe', hint: 'Find every country in Europe', earned: regionDone('europe') },
  { id: 'new-england', name: 'All of New England', hint: 'Find all six New England states', earned: foundAll(['connecticut', 'maine', 'massachusetts', 'new-hampshire', 'rhode-island', 'vermont']) },
  { id: 'great-lakes', name: 'Found the Great Lakes', hint: 'Find all eight states that touch the Great Lakes', earned: foundAll(['illinois', 'indiana', 'michigan', 'minnesota', 'new-york', 'ohio', 'pennsylvania', 'wisconsin']) },
  { id: 'scandinavia', name: 'Scandinavian Saga', hint: 'Find Denmark, Norway and Sweden', earned: foundAll(['denmark', 'norway', 'sweden']) },
  { id: 'baltics', name: 'Baltic Explorer', hint: 'Find Estonia, Latvia and Lithuania', earned: foundAll(['estonia', 'latvia', 'lithuania']) },
  { id: 'iberia', name: 'Iberian Adventurer', hint: 'Find Spain and Portugal', earned: foundAll(['spain', 'portugal']) },
  { id: 'first-evolution', name: 'A New Form', hint: 'Evolve a companion', earned: (s, pack) => s.companions.some((c) => stageOf(c.bondXp, speciesOf(pack, c.speciesId)) > 1) },
  { id: 'stable-5', name: 'Growing Stable', hint: 'Befriend 5 creatures', earned: (s) => s.companions.length >= 5 },
  { id: 'notes-25', name: 'Note Taker', hint: 'Read 25 Field Notes', earned: (s) => s.seenFacts.length >= 25 },
  { id: 'cards-25', name: 'Card Collector', hint: 'Earn 25 State Cards', earned: (s) => s.stateCards.length >= 25 },
  { id: 'first-gold', name: 'Going for Gold', hint: 'Raise a card to Gold', earned: (s) => hasCardsAtLeast(s.stateCards, s.learning, 'gold').length >= 1 },
  { id: 'gold-10', name: 'Gold Collection', hint: 'Raise 10 cards to Gold', earned: (s) => hasCardsAtLeast(s.stateCards, s.learning, 'gold').length >= 10 },
  { id: 'first-shiny', name: 'Shiny!', hint: 'Raise a card to Shiny on Expert', earned: (s) => hasCardsAtLeast(s.stateCards, s.learning, 'shiny').length >= 1 },
  { id: 'new-england-gold', name: 'New England in Gold', hint: 'Raise all six New England cards to Gold', earned: (s) => ['connecticut', 'maine', 'massachusetts', 'new-hampshire', 'rhode-island', 'vermont'].every((id) => hasCardsAtLeast(s.stateCards, s.learning, 'gold').includes(id)) },
  { id: 'streak-10', name: 'Unstoppable', hint: 'Get 10 answers right in a row', earned: (s) => (s.bestStreak ?? 0) >= 10 },
  { id: 'streak-20', name: 'Legendary Streak', hint: 'Get 20 answers right in a row', earned: (s) => (s.bestStreak ?? 0) >= 20 },
  { id: 'rare-find', name: 'Rare Find', hint: 'Befriend a creature in a rare encounter', earned: (s) => s.rareFound === true },
  { id: 'world', name: 'World Traveler', hint: 'Stamp every region in your Passport', earned: (s, pack) => pack.regions.every((r) => s.stampedRegions?.includes(r.id)) },
  { id: 'boss', name: 'Boss Befriender', hint: 'Befriend a Continent Boss', earned: (s, pack) => s.companions.some((c) => speciesOf(pack, c.speciesId).boss) },
  { id: 'bold', name: 'Bold Befriender', hint: 'Befriend a creature mid-fight', earned: (s) => s.tamedAny === true },
  { id: 'expert', name: 'True Expert', hint: 'Finish an Expert trail', earned: (s) => s.expertTrails >= 1 },
];

export const earnedBadges = (save: SaveData, pack: Pack) => BADGES.filter((b) => b.earned(save, pack)).map((b) => b.id);
