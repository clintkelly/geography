import type { Pack } from '../content/types';
import type { SaveData } from './game';
import { stageOf, speciesOf } from './progression';

export interface Badge {
  id: string;
  name: string;
  hint: string;
  earned: (save: SaveData, pack: Pack) => boolean;
}

const foundAll = (ids: string[]) => (s: SaveData) => ids.every((id) => s.foundPlaces.includes(id));
const regionDone = (regionId: string) => (s: SaveData, pack: Pack) => pack.places.filter((p) => p.regionId === regionId).every((p) => s.foundPlaces.includes(p.id));

export const BADGES: readonly Badge[] = [
  { id: 'west', name: 'Western Trailblazer', hint: 'Find every state in the American West', earned: regionDone('us-west') },
  { id: 'midwest', name: 'Heartland Hero', hint: 'Find every state in the Midwest', earned: regionDone('us-midwest') },
  { id: 'south', name: 'Southern Star', hint: 'Find every state in the South', earned: regionDone('us-south') },
  { id: 'northeast', name: 'Northeast Navigator', hint: 'Find every state in the Northeast', earned: regionDone('us-northeast') },
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
  { id: 'expert', name: 'True Expert', hint: 'Finish an Expert trail', earned: (s) => s.expertTrails >= 1 },
];

export const earnedBadges = (save: SaveData, pack: Pack) => BADGES.filter((b) => b.earned(save, pack)).map((b) => b.id);
