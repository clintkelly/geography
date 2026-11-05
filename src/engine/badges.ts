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

/** Everyone befriended, including creatures set free, so freeing never takes a badge away. */
const everyone = (s: SaveData) => [...s.companions, ...(s.wild ?? [])];

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
  { id: 'first-evolution', name: 'A New Form', hint: 'Evolve a companion', earned: (s, pack) => everyone(s).some((c) => stageOf(c.bondXp, speciesOf(pack, c.speciesId)) > 1) },
  { id: 'stable-5', name: 'Growing Stable', hint: 'Befriend 5 creatures', earned: (s) => everyone(s).length >= 5 },
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
  { id: 'boss', name: 'Boss Befriender', hint: 'Befriend a Continent Boss', earned: (s, pack) => everyone(s).some((c) => speciesOf(pack, c.speciesId).boss) },
  { id: 'medal-gold', name: 'Gold Medalist', hint: 'Earn a Gold mastery medal', earned: (s) => Object.values(s.medals ?? {}).some((m) => m.level === 'gold' || m.level === 'platinum') },
  { id: 'medal-platinum', name: 'Platinum Master', hint: 'Pass a Mastery Test for Platinum', earned: (s) => Object.values(s.medals ?? {}).some((m) => m.level === 'platinum') },
  { id: 'bold', name: 'Bold Befriender', hint: 'Befriend a creature mid-fight', earned: (s) => s.tamedAny === true },
  { id: 'expert', name: 'True Expert', hint: 'Finish an Expert trail', earned: (s) => s.expertTrails >= 1 },
  { id: 'ranger-find', name: 'Ranger Tracker', hint: 'Befriend a creature found only on Ranger trails', earned: (s, pack) => everyone(s).some((c) => speciesOf(pack, c.speciesId).minDifficulty === 'ranger') },
  { id: 'expert-find', name: 'Expert Tracker', hint: 'Befriend a creature found only on Expert trails', earned: (s, pack) => everyone(s).some((c) => speciesOf(pack, c.speciesId).minDifficulty === 'expert') },
  { id: 'dual-type', name: 'Double Trouble', hint: 'Befriend a creature with two types', earned: (s, pack) => everyone(s).some((c) => !!speciesOf(pack, c.speciesId).secondType) },
  { id: 'shiny-creature', name: 'Sparkle Finder', hint: 'Befriend a shiny creature. Harder trails find more!', earned: (s) => everyone(s).some((c) => c.shiny) },
  { id: 'first-hatch', name: 'Egg Whisperer', hint: 'Hatch a study egg', earned: (s) => (s.hatchedCount ?? 0) >= 1 },
  { id: 'hatch-ten', name: 'Hatchery', hint: 'Hatch 10 study eggs', earned: (s) => (s.hatchedCount ?? 0) >= 10 },
  { id: 'math-adept', name: 'Math Adept', hint: 'Reach the Adept rank in Math', earned: (s) => (s.studyPoints?.math ?? 0) >= 150 },
  { id: 'words-adept', name: 'Word Adept', hint: 'Reach the Adept rank in Words', earned: (s) => (s.studyPoints?.words ?? 0) >= 150 },
  { id: 'math-wizard', name: 'Math Wizard', hint: 'Reach the Wizard rank in Math', earned: (s) => (s.studyPoints?.math ?? 0) >= 400 },
  { id: 'gold-patch', name: 'Gold Standard', hint: 'Pass a Lodge Mastery Test for a Gold patch', earned: (s) => Object.values(s.lodgeTiers ?? {}).includes('gold') },
  { id: 'legend-four', name: 'Legend Keeper', hint: 'Earn four Gold patches', earned: (s) => Object.values(s.lodgeTiers ?? {}).filter((t) => t === 'gold').length >= 4 },
  { id: 'lodge-first', name: 'First Patch', hint: 'Beat your first Ranger Lodge', earned: (s) => (s.lodgesBeaten ?? []).length >= 1 },
  { id: 'lodge-four', name: 'Halfway Up', hint: 'Beat four Ranger Lodges', earned: (s) => (s.lodgesBeaten ?? []).length >= 4 },
  { id: 'grand-ranger', name: 'Grand Ranger', hint: 'Beat the Summit Lodge', earned: (s) => (s.lodgesBeaten ?? []).includes('summit') },
  { id: 'wild-friend', name: 'Friend of the Wild', hint: 'Set 3 creatures free', earned: (s) => (s.freedCount ?? 0) >= 3 },
];

/** Badges are kept once earned. */
export const earnedBadges = (save: SaveData, pack: Pack) => BADGES.filter((b) => save.badges.includes(b.id) || b.earned(save, pack)).map((b) => b.id);
