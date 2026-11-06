import { degreesApart, spaced } from '../content/geo';
import { DIFFICULTIES, type Clue, type Difficulty, type Pack, type PathId, type Place, type Question, type Region, type Species } from '../content/types';
import { canUse, enemyStrikes, heal, MAX_CHARGE, resolveTurn, startCombat, type CombatAction, type CombatState, type TurnEvents } from './combat';
import { ECONOMY, PREP_ITEMS, SNACK_HEAL, STURDY_HP, type PrepItem } from './economy';
import { TRAIL_EVENTS, type TrailEvent } from './events';
import { isDue, recordAnswer, type Learning } from './learning';
import { companionSpecies, levelOf, MAX_TEAM, PATH_ORDER, pathOf, speciesOf, STAGES, stageOf, teamScaling, TURF_BONUS, XP, xpFor, type Raised } from './progression';
import { isAnswerFor, isCorrect, pickQuestion, presentQuestion } from './questions';
import { DEFAULT_STUDY, isStudy, studyMatches, type StudySettings, type Subject } from './study';
import { earnedBadges } from './badges';
import { cardLevelOf, type CardLevel } from './cards';
import { matchup } from './types';
import { rareChance, rarePool, trailScore } from './luck';
import { streakReward } from './streak';
import { Rng } from './rng';
import { awardMedals, MASTERY_MISSES_ALLOWED, masteryQuestions, medalKey, medalPoints, medalView, type MedalEarned, type Medals, type MedalTrack } from './medals';
import { localDay } from './learning';
import { TRAIL_STOPS, walkTrail, type StopKind, type TrailLength } from './trail';
import { BRAIN_SHIELD, LODGE_QUIZ, lodgeById, lodgeDifficulty, lodgeFoeStats, lodgeOpen, lodgePower, patchOf, TIER_STAGE, type LodgeRole, type LodgeTier } from './lodges';
import { EGG_POINTS, eggReady, feedEggs, fillMeter, hatchling, layEgg, type Egg, type EggKind, type EggMeter } from './eggs';
import type { LodgeSubject, Stage } from '../content/lodges';
import { chainBoost, extendChain, masteredRegions, VISITOR_SHINY_BOOST, visitorFor, type ShinyChain } from './juice';

export const SCHEMA_VERSION = 7;
/** What questions a trail asks. */
export type Focus = 'all' | 'basics' | 'flags' | 'animals' | 'history' | 'math' | 'words';
export const FOCUSES: readonly Focus[] = ['all', 'basics', 'flags', 'animals', 'history', 'math', 'words'];
/** Math and Words trails swap geography questions for study ones, anywhere in the world. */
export const studySubject = (focus: Focus | undefined): Subject | undefined => (focus === 'math' || focus === 'words' ? focus : undefined);
const RECALL_CHANCE = 0.4;
const REVIEW_CHANCE = 0.5;
const ATTEMPT_LIMIT = 500;
export const BOND_BONUS_XP = 10;
export const RECENT_QUESTION_LIMIT = 24;

export const BALANCE = {
  enemyPattern: [2, 2, 4],
  regularMaxTurns: 8,
  guardianMaxTurns: 10,
} as const;
/** Continent bosses are tougher guardians with a big hit every third turn. */
const BOSS = { hp: 8, turns: 4, power: 3 } as const;

/** What finishing a hunt gives: the creature itself, or honest XP once every species is owned. */
export type Reward = { kind: 'creature'; speciesId: string } | { kind: 'bond'; xp: number };

export interface Offer {
  id: string;
  regionId: string;
  reward: Reward;
}

export interface Slot {
  kind: StopKind;
  /** The rare encounter roll happens once per stop, so a reload or retry can't change it. */
  rareRolled?: boolean;
  /** A rare creature took this stop. */
  rare?: boolean;
  locationId: string;
  /** Opponent species; empty for events. */
  opponentId: string;
  eventId?: string;
  status: 'pending' | 'won';
  /** In a Lodge: who sent this creature out, how evolved it is, and whether it's the leader's or a junior ranger's. */
  trainer?: string;
  /** The ranger's portrait, when it isn't the Lodge leader's. */
  trainerArt?: string;
  /** A League battle's strength on the Lodge scale. */
  power?: number;
  /** A star creature that joins the first time this battle is won. */
  prize?: string;
  opponentStage?: Stage;
  role?: LodgeRole;
}

export interface TurnResult {
  optionId: string;
  correct: boolean;
  events: TurnEvents;
  /** Place whose State Card this answer earned. */
  cardId?: string;
  /** Field Note check answered correctly: a critical that adds a charge. */
  critical?: boolean;
  /** A card this answer raised to a new level. */
  cardUp?: { placeId: string; level: CardLevel };
  /** A right typed answer to a math or vocabulary question: an extra charge. */
  brainBlast?: boolean;
  /** This answer filled the Egg Meter and laid an egg. */
  eggLaid?: EggKind;
  /** Wild Paths points the fighting creature just earned. */
  pathPoints?: PathId[];
  /** Creatures on the team that just reached a new level. */
  levelUps?: { instanceId: string; level: number }[];
  /** A befriended creature's shiny chain: how many of this kind in a row. */
  chain?: number;
  /** The befriended creature was today's visitor. */
  visitor?: boolean;
  /** A League star creature that just joined, won from an Elite Ranger. */
  prize?: string;
}

export interface Battle {
  id: string;
  slotIndex: number;
  combat: CombatState;
  phase: 'choose' | 'question' | 'feedback';
  /** A snapshot with options in display order, so content updates can't change a saved turn. */
  question: Question;
  action?: CombatAction | 'befriend' | 'tame';
  result?: TurnResult;
  /** Right answers so far in a Bold Befriend attempt. */
  tameHits?: number;
  /** Questions put aside by Bold Befriend, so changing moves can't deal a new, easier one. */
  heldQuestions?: { regular: Question; tame?: Question };
  /** HP and charge of each team member, by instance id. The active one's live values are in `combat`. */
  bench?: Record<string, { hp: number; charge: number }>;
  /** The active creature fainted, so the next move must be a switch. */
  mustSwitch?: boolean;
  /** Counts switches, and what the last one cost, so the screen can react. */
  switches?: { count: number; damage: number };
  /** The answer was a Field Note check, so it counted as a critical. */
  critical?: boolean;
  /** The target is worn out and only befriending remains. */
  befriending?: boolean;
  befriended?: boolean;
}

export interface EventState {
  id: string;
  slotIndex: number;
  eventId: string;
  question: Question;
  result?: Omit<TurnResult, 'events' | 'critical'>;
}

export interface Expedition {
  id: string;
  regionId: string;
  difficulty: Difficulty;
  trail: TrailLength;
  /** Older trips ask everything. */
  focus?: Focus;
  /** A Ranger Lodge challenge instead of a trail: no map search, just its battles in order. */
  lodgeId?: string;
  /** Bronze the first time, then Silver and Gold rematches. Older Lodge trips are Bronze. */
  lodgeTier?: LodgeTier;
  /** A night trail: night creatures are out. */
  night?: boolean;
  /** The gate quiz this Lodge visit passed. */
  gateScore?: { right: number; of: number };
  rngState: number;
  reward: Reward;
  /** The creature fighting right now. */
  companionId: string;
  /** Everyone on this trip, lead first. Older trips have only `companionId`. */
  teamIds?: string[];
  /** XP at departure, to spot level-ups. */
  xpAtStart?: Record<string, number>;
  prepared: boolean;
  points: number;
  sturdy: boolean;
  extraCharge: boolean;
  snack: boolean;
  /** Found partway along the trail, on the second battle win. */
  souvenirId: string | null;
  foundSouvenirId: string | null;
  // The place being searched for at the current stop.
  targetId: string;
  candidateIds: string[];
  clueIds: string[];
  cluesShown: number;
  atlasUsed: boolean;
  narrowed: boolean;
  removedIds: string[];
  guesses: string[];
  discovery: 'searching' | 'found';
  discoveryAssisted: boolean;
  anyAssisted: boolean;
  freeClue: boolean;
  slots: Slot[];
  battle: Battle | null;
  event: EventState | null;
  askedQuestionIds: string[];
  retreated: boolean;
  answered: number;
  correct: number;
  /** Objectives answered wrongly on this trip. A later right answer here isn't independent evidence. */
  revealed?: string[];
  /** Creatures won by Bold Befriend on this trip. */
  tamedIds?: string[];
  /** Correct answers in a row. It pays out at milestones: breaking it costs nothing. */
  streak?: number;
}

export interface Attempt {
  id: string;
  context: 'discovery' | 'battle' | 'event';
  itemId: string;
  itemVersion: number;
  objectiveId: string;
  submitted: string;
  correct: boolean;
  timestamp: number;
  assisted: boolean;
  expeditionId: string;
  battleId?: string;
  difficulty?: Difficulty;
}

export interface Summary {
  expeditionId: string;
  reward: Reward;
  answered: number;
  correct: number;
  discoveryAssisted: boolean;
  souvenirId: string | null;
  cardsEarned: number;
  /** Summaries saved by older versions don't have these. */
  xpGained?: number;
  levelUp?: number;
  /** Each team creature that leveled up on this trail, from and to. */
  levelUps?: { instanceId: string; from: number; to: number }[];
  /** Regions where the child has now found every creature. Each lays a Rare Egg. */
  regionsMastered?: string[];
  /** Badges earned by this trip. */
  newBadges?: string[];
  /** The region stamped for the first time by this trip. */
  newStamp?: string;
  tamedIds?: string[];
  /** Medals this trip earned, and the Trail Points they banked. */
  newMedals?: MedalEarned[];
  difficulty?: Difficulty;
  /** A Lodge win, and the prize creature if this was the first one. */
  lodgeId?: string;
  prizeId?: string;
  /** The patch this Lodge win earned, if it was a new one. */
  newPatch?: LodgeTier;
  /** A study egg laid by this trip. */
  eggLaid?: EggKind;
  /** Creatures found so far, when this trip passed a multiple of ten. */
  collected?: number;
}

/** A quiz at a Lodge: a gate before the math and vocabulary Lodges, or the Mastery Test that earns Gold. */
export interface LodgeQuiz {
  lodgeId: string;
  kind: 'gate' | 'mastery';
  tier: LodgeTier;
  difficulty: Difficulty;
  questions: Question[];
  index: number;
  right: number;
  result?: { optionId: string; correct: boolean };
  outcome?: 'passed' | 'failed';
}

/** A short quiz with no battle: one question per place, at most one miss, for Platinum. */
export interface MasteryTest {
  regionId: string;
  track: MedalTrack;
  questions: Question[];
  index: number;
  misses: number;
  result?: { optionId: string; correct: boolean };
  outcome?: 'passed' | 'failed';
}

export interface Settings {
  minDifficulty: Difficulty;
  maxDifficulty: Difficulty;
  lastDifficulty: Difficulty;
  lastRegionId: string;
  lastTrail: TrailLength;
  lastFocus?: Focus;
  muted: boolean;
  /** 0 to 1. */
  volume: number;
  musicVolume: number;
  /** Regions the parent has turned off for this child. */
  disabledRegions: string[];
  /** Math and vocabulary. Missing on older saves. */
  study?: StudySettings;
}

export const DEFAULT_SETTINGS: Settings = {
  minDifficulty: 'scout',
  maxDifficulty: 'expert',
  lastDifficulty: 'scout',
  lastRegionId: 'us-west',
  lastTrail: 'standard',
  muted: false,
  volume: 0.7,
  musicVolume: 0.25,
  disabledRegions: [],
};

export interface Companion {
  instanceId: string;
  speciesId: string;
  bondXp: number;
  nickname?: string;
  /** The evolution stage last celebrated, so each evolution shows exactly once. */
  stageSeen?: number;
  /** Freed once already, so freeing it again earns nothing. */
  freedOnce?: boolean;
  /** A rare different-colored, sparkling form. Harder trails find more. */
  shiny?: boolean;
  /** Colors a child picked for a shiny, by name: one for a single color, or a main and an accent. */
  shinyColors?: string[];
  /** A branching creature's path, fixed when it evolves. */
  path?: PathId;
  /** How a branching creature has been raised so far. */
  raised?: Raised;
}

/** A saved game for one child. */
export interface SaveData {
  schemaVersion: number;
  contentVersion: string;
  profile: { id: string; displayName: string; avatarId: string };
  companions: Companion[];
  activeCompanionId: string;
  souvenirIds: string[];
  stateCards: string[];
  /** Field Notes this child has seen, which unlock questions about them. */
  seenFacts: string[];
  /** Places the child has tracked a creature to. They fill in the Explorer's Map. */
  foundPlaces: string[];
  learning: Learning;
  badges: string[];
  expertTrails: number;
  bestStreak?: number;
  /** The last team taken, offered again next trip. */
  lastTeamIds?: string[];
  /** Regions with a finished trail, shown as stamps in the Passport. */
  stampedRegions?: string[];
  tamedAny?: boolean;
  rareFound?: boolean;
  /** Mastery medals by region and track. Older saves have none. */
  medals?: Medals;
  /** Trail Points from medals and freed creatures, added to the next trail. */
  bankedPoints?: number;
  /** Creatures set free. They still count as found, and can be called back for free. */
  wild?: Companion[];
  /** Creatures whose Field Guide card this child has seen, so each pops up only on the first meeting. */
  guideSeen?: string[];
  /** How many creatures have been freed for a reward. */
  freedCount?: number;
  masteryTest?: MasteryTest | null;
  /** Ranger Lodges this child has beaten. Each child climbs the ladder on their own. */
  lodgesBeaten?: string[];
  /** Silver and Gold patches, by Lodge. */
  lodgeTiers?: Record<string, 'silver' | 'gold'>;
  /** Lodges whose Gold battles are won, waiting on their Mastery Test. */
  lodgeTestReady?: string[];
  lodgeQuiz?: LodgeQuiz | null;
  /** Study eggs warming in the nest. */
  eggs?: Egg[];
  /** How many eggs this child has hatched. */
  hatchedCount?: number;
  /** The creature that just hatched, for its reveal. */
  hatched?: { instanceId: string; kind: EggKind } | null;
  /** Points from right math and vocabulary answers, for ranks. */
  studyPoints?: { math: number; words: number };
  /** Right study answers toward the next egg. */
  eggMeter?: EggMeter;
  /** Every Starfall League win: when, and the team that did it. */
  hallOfFame?: { at: number; team: Companion[] }[];
  /** Regions where every creature that lives there has been found. */
  regionsMastered?: string[];
  /** Befriending the same kind in a row raises its shiny chance. */
  shinyChain?: ShinyChain;
  /** The day today's visitor was put in the sightings. */
  visitorDay?: string;
  /** Whether the current sightings were made at night, when night creatures are out. */
  offersNight?: boolean;
  completedExpeditions: number;
  nextId: number;
  rngState: number;
  offers: Offer[];
  expedition: Expedition | null;
  attempts: Attempt[];
  recentQuestionIds: string[];
  appliedRewardIds: string[];
  lastSummary: Summary | null;
  settings: Settings;
}

export type Command =
  | { type: 'start'; offerId: string; regionId: string; difficulty: Difficulty; trail: TrailLength; focus?: Focus }
  | { type: 'startMastery'; regionId: string; track: MedalTrack }
  | { type: 'startLodge'; lodgeId: string; tier?: LodgeTier }
  | { type: 'startLodgeTest'; lodgeId: string }
  | { type: 'lodgeQuizAnswer'; optionId: string }
  | { type: 'lodgeQuizNext' }
  | { type: 'closeLodgeQuiz' }
  | { type: 'hatchEgg'; eggId: string }
  | { type: 'dismissHatch' }
  /** The player's clock passed dusk or dawn: night creatures come and go from the sightings. */
  | { type: 'setNight'; night: boolean }
  /** A new day on the player's clock: a new visitor comes. */
  | { type: 'newDay'; day: string }
  | { type: 'masteryAnswer'; optionId: string }
  | { type: 'masteryNext' }
  | { type: 'closeMastery' }
  | { type: 'selectCompanion'; instanceId: string }
  | { type: 'toggleTeam'; instanceId: string }
  | { type: 'switchTo'; instanceId: string }
  | { type: 'buy'; item: PrepItem }
  | { type: 'depart' }
  | { type: 'revealClue'; shown: number }
  | { type: 'narrowSearch' }
  | { type: 'useAtlas' }
  | { type: 'guess'; locationId: string }
  | { type: 'enterEncounter' }
  | { type: 'chooseAction'; action: CombatAction | 'befriend' | 'tame' }
  | { type: 'changeMove' }
  | { type: 'useSnack' }
  | { type: 'answer'; optionId: string }
  | { type: 'continue' }
  | { type: 'claimReward' }
  | { type: 'abandon' }
  | { type: 'dismissSummary' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'renameCompanion'; instanceId: string; nickname: string }
  /** The child closed a creature's Field Guide card. */
  | { type: 'seeGuide'; speciesId: string }
  /** Picks a shiny's colors. An empty list goes back to its own colors. */
  | { type: 'setShinyColors'; instanceId: string; colors: string[] }
  | { type: 'freeCompanion'; instanceId: string }
  | { type: 'recallCompanion'; instanceId: string }
  | { type: 'ackEvolution'; instanceId: string }
  | { type: 'resetProfile' }
  | { type: 'updateProfile'; patch: Partial<Pick<SaveData['profile'], 'displayName' | 'avatarId'>> };

export const teamOf = (e: Expedition) => e.teamIds ?? [e.companionId];

export function currentSlotIndex(e: Expedition): number {
  return e.slots.findIndex((s) => s.status === 'pending');
}

export function isExpeditionComplete(e: Expedition): boolean {
  return e.prepared && e.discovery === 'found' && !e.battle && !e.event && currentSlotIndex(e) === -1;
}

export function activeCompanion(save: SaveData): Companion {
  return (save.companions.find((c) => c.instanceId === (save.expedition?.companionId ?? save.activeCompanionId)) ?? save.companions[0]) as Companion;
}

/** Difficulties a child may pick in a region, within the parent's limits. */
export function allowedDifficulties(settings: Settings, region: Region): Difficulty[] {
  const low = DIFFICULTIES.indexOf(settings.minDifficulty);
  const high = DIFFICULTIES.indexOf(settings.maxDifficulty);
  const allowed = region.difficulties.filter((d) => DIFFICULTIES.indexOf(d) >= low && DIFFICULTIES.indexOf(d) <= high);
  // A region without a matching tier still has to be playable.
  return allowed.length > 0 ? allowed : [region.difficulties[0] as Difficulty];
}

const RANK: Record<Difficulty, number> = { scout: 0, ranger: 1, expert: 2 };
/** A locked creature is met only on trails at its difficulty or harder. */
export const metOn = (s: Pick<Species, 'minDifficulty'>, difficulty: Difficulty) => RANK[difficulty] >= RANK[s.minDifficulty ?? 'scout'];
/** The easiest difficulty a creature can be met on. */
export const lowestFor = (s: Pick<Species, 'minDifficulty'>): Difficulty => s.minDifficulty ?? 'scout';
/** Harder trails start with more Trail Points. */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = { scout: 0, ranger: 2, expert: 4 };
/** The chance a newly befriended creature is shiny, by the trail's difficulty. */
export const SHINY_CHANCE: Record<Difficulty, number> = { scout: 0.03, ranger: 0.08, expert: 0.2 };
/** A fixed roll from the creature's id, so a reload never changes the result. */
/** Math and Words trails double the shiny chance. */
export const STUDY_SHINY_BOOST = 2;
export function rollShiny(instanceId: string, difficulty: Difficulty, boost = 1): boolean {
  let h = 2166136261;
  for (const ch of `shiny:${instanceId}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h / 2 ** 32 < SHINY_CHANCE[difficulty] * boost;
}
const joining = (instanceId: string, speciesId: string, difficulty: Difficulty, boost = 1): Companion => ({ instanceId, speciesId, bondXp: 0, ...(rollShiny(instanceId, difficulty, boost) ? { shiny: true } : {}) });
const trailBoost = (e: Pick<Expedition, 'focus'>) => (studySubject(e.focus) ? STUDY_SHINY_BOOST : 1);
/** Today's visitor, if the sightings have been made today and this is it. */
const isVisitorToday = (save: Pick<SaveData, 'visitorDay'>, pack: Pack, speciesId: string) => !!save.visitorDay && visitorFor(pack, save.visitorDay)?.id === speciesId;

/** A right math or vocabulary answer warms an egg, fills the Egg Meter and earns rank points. */
function studied(save: SaveData, q: Question, correct: boolean, difficulty: Difficulty): { patch: Partial<SaveData>; laid?: EggKind } {
  const subject = correct ? (q.topic === 'math' ? 'math' : q.topic === 'word' ? 'words' : undefined) : undefined;
  if (!subject) return { patch: {} };
  const points = save.studyPoints ?? { math: 0, words: 0 };
  const warmed = feedEggs(save.eggs, q, correct, difficulty) ?? [];
  const filled = fillMeter(save.eggMeter, warmed, subject, `egg-${save.nextId}-${save.attempts.length}`);
  return {
    patch: { eggs: filled.eggs, eggMeter: filled.meter, studyPoints: { ...points, [subject]: points[subject] + EGG_POINTS[q.difficulty ?? difficulty] } },
    ...(filled.laid ? { laid: filled.laid } : {}),
  };
}

/**
 * Study objectives a child keeps missing: at least 3 of the last 5 tries, with under 60% right.
 * Their questions drop one difficulty until the child is getting them again.
 */
export function strugglingObjectives(attempts: readonly Attempt[]): Set<string> {
  const recent = new Map<string, boolean[]>();
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i] as Attempt;
    if (!/^(math|word)-/.test(a.objectiveId) || a.context === 'discovery') continue;
    const list = recent.get(a.objectiveId) ?? [];
    if (list.length < 5) recent.set(a.objectiveId, [...list, a.correct]);
  }
  return new Set([...recent].filter(([, r]) => r.length >= 3 && r.filter(Boolean).length / r.length < 0.6).map(([id]) => id));
}

/** Swaps a struggling objective's questions for the same skill one difficulty easier, where there are any. */
export function easeStudy(pool: readonly Question[], pack: Pack, attempts: readonly Attempt[]): Question[] {
  const hard = strugglingObjectives(attempts);
  if (hard.size === 0) return [...pool];
  return pool.flatMap((q) => {
    if (!hard.has(q.objectiveId) || !q.difficulty || q.difficulty === 'scout') return [q];
    const easier = DIFFICULTIES[DIFFICULTIES.indexOf(q.difficulty) - 1];
    const swap = pack.questions.filter((o) => o.objectiveId === q.objectiveId && o.difficulty === easier);
    return swap.length > 0 ? [swap[Math.abs(q.id.length * 7 + q.prompt.length) % swap.length] as Question] : [q];
  });
}

/** Expert trails search a blank map. Math and Words trails keep the search short, so the study is the challenge. */
export const blankMapSearch = (e: Pick<Expedition, 'difficulty' | 'focus'>) => e.difficulty === 'expert' && !studySubject(e.focus);

/** Creatures found, counting those set free. */
const collectedCount = (save: Pick<SaveData, 'companions' | 'wild'>) => knownSpecies(save).size;
/** A milestone to celebrate when the collection passes a multiple of ten. */
function milestone(before: SaveData, after: SaveData): { collected?: number } {
  const a = collectedCount(before);
  const b = collectedCount(after);
  return Math.floor(b / 10) > Math.floor(a / 10) ? { collected: b } : {};
}

/** Trail Points banked for the first time a creature is set free. */
export const FREE_POINTS = 3;
/** Every species this child has befriended, including those set free. */
export const knownSpecies = (save: Pick<SaveData, 'companions' | 'wild'>): Set<string> => new Set([...save.companions, ...(save.wild ?? [])].map((c) => c.speciesId));

const inFocus = (focus: Focus | undefined) => (q: Question) => {
  if (isStudy(q)) return false;
  if (focus === 'basics') return q.topic === 'location' || q.topic === 'capital';
  if (focus === 'flags') return q.topic === 'flag';
  if (focus === 'animals') return q.topic === 'animal';
  if (focus === 'history') return q.topic === 'history';
  return true;
};

const unitIds = (pack: Pack) => (pack.wordUnits ?? []).map((u) => u.id);

/** The study questions this child can get for one subject, at a difficulty if there are any there. */
export function studyPool(pack: Pack, subject: Subject, difficulty: Difficulty, study: StudySettings | undefined): Question[] {
  const all = pack.questions.filter(studyMatches(subject, study, unitIds(pack)));
  const tier = all.filter((q) => q.difficulty === difficulty);
  return tier.length > 0 ? tier : all;
}

/** A region has this focus if it has any questions for it. Antarctica has no flag questions. Math and Words work everywhere. */
export const regionHasFocus = (pack: Pack, regionId: string, focus: Focus, study?: StudySettings) => {
  const subject = studySubject(focus);
  if (subject) return studyPool(pack, subject, 'scout', study).length > 0;
  return pack.questions.some((q) => q.regionId === regionId && inFocus(focus)(q));
};

const LODGE_TOPICS: Record<Exclude<LodgeSubject, 'all' | 'math' | 'words'>, Question['topic']> = { animal: 'animal', flag: 'flag', location: 'location', capital: 'capital', history: 'history' };
const SUMMIT_SUBJECTS: readonly Exclude<LodgeSubject, 'all'>[] = ['animal', 'flag', 'location', 'capital', 'history', 'math', 'words'];

/** A Lodge asks about one subject from anywhere the parent has turned on, at the Lodge's difficulty. */
export function lodgePool(pack: Pack, subject: Exclude<LodgeSubject, 'all'>, difficulty: Difficulty, settings: Pick<Settings, 'disabledRegions' | 'study'>): Question[] {
  if (subject === 'math' || subject === 'words') return studyPool(pack, subject, difficulty, settings.study);
  const topic = LODGE_TOPICS[subject];
  const all = pack.questions.filter((q) => q.topic === topic && !q.recallOf && !settings.disabledRegions.includes(q.regionId));
  const tier = all.filter((q) => q.difficulty === difficulty);
  return tier.length > 0 ? tier : all;
}

function lodgeQuestions(pack: Pack, e: Expedition, settings: Settings, rng: Rng): Question[] {
  const lodge = lodgeById(pack, e.lodgeId);
  const subjects = lodge?.subject && lodge.subject !== 'all' ? [lodge.subject] : rng.shuffle(SUMMIT_SUBJECTS);
  for (const subject of subjects) {
    const pool = lodgePool(pack, subject, e.difficulty, settings);
    if (pool.length > 0) return pool;
  }
  // Nothing turned on for this subject: any geography still works.
  return pack.questions.filter((q) => !isStudy(q) && !q.recallOf && q.difficulty === e.difficulty);
}

function questionPool(pack: Pack, e: Pick<Expedition, 'regionId' | 'difficulty' | 'focus'>, wide = false, study?: StudySettings): Question[] {
  const subject = studySubject(e.focus);
  if (subject) return studyPool(pack, subject, e.difficulty, study);
  const continent = pack.regions.find((r) => r.id === e.regionId)?.continent;
  const regions = wide ? pack.regions.filter((r) => r.continent === continent).map((r) => r.id) : [e.regionId];
  const matches = inFocus(e.focus);
  const region = pack.questions.filter((q) => regions.includes(q.regionId) && matches(q));
  const tier = region.filter((q) => q.difficulty === e.difficulty);
  return tier.length > 0 ? tier : region;
}

/** Boss hunts open up once a child has finished a trail in every region of the continent. */
export function bossUnlocked(save: Pick<SaveData, 'stampedRegions'>, pack: Pack, regionId: string): boolean {
  const continent = pack.regions.find((r) => r.id === regionId)?.continent;
  return pack.regions.filter((r) => r.continent === continent).every((r) => save.stampedRegions?.includes(r.id));
}

const isBossSlot = (slot: Slot, pack: Pack) => slot.kind === 'guardian' && !!pack.species.find((s) => s.id === slot.opponentId)?.boss;

function nearestFirst(places: readonly Place[], target: Place): Place[] {
  return [...places].sort((a, b) => degreesApart(a, target) - degreesApart(b, target));
}

/** Every place in a region has been found: its map is full. */
export function isRegionComplete(found: readonly string[], pack: Pack, regionId: string): boolean {
  return pack.places.filter((p) => p.regionId === regionId).every((p) => found.includes(p.id));
}

/** Two sightings per region of creatures that live there. The featured creature comes first until it is befriended. */
export function makeOffers(save: Pick<SaveData, 'nextId' | 'companions'> & Partial<Pick<SaveData, 'foundPlaces' | 'stampedRegions' | 'wild' | 'offersNight' | 'visitorDay'>>, pack: Pack, rng: Rng): { offers: Offer[]; nextId: number } {
  // Today's visitor is sighted first in its home region, even when the child already has one.
  const visitor = save.visitorDay ? visitorFor(pack, save.visitorDay) : undefined;
  const owned = knownSpecies(save);
  let nextId = save.nextId;
  const offers = pack.regions.flatMap((region) => {
    const mapDone = !!save.foundPlaces && isRegionComplete(save.foundPlaces, pack, region.id);
    const bossReady = bossUnlocked(save, pack, region.id);
    const unowned = rng.shuffle(pack.species.filter((s) => s.homes.includes(region.id) && !owned.has(s.id) && (!s.rare || mapDone) && (!s.boss || bossReady) && (!s.night || !!save.offersNight)).map((s) => s.id));
    const isBoss = (id: string) => !!pack.species.find((s) => s.id === id)?.boss;
    const locked = (id: string) => !!pack.species.find((s) => s.id === id)?.minDifficulty;
    const isFresh = (id: string) => !!pack.species.find((s) => s.id === id)?.fresh;
    const rest = unowned.filter((id) => id !== pack.featuredSpeciesId && !isBoss(id));
    // At night, the creatures that only come out after dark are sighted first.
    const isNightOnly = (id: string) => !!pack.species.find((s) => s.id === id)?.night;
    // Brand-new creatures are sighted first, so a child meets them instead of missing them among the regulars.
    const ordered = [...unowned.filter(isBoss), ...unowned.filter((id) => id === pack.featuredSpeciesId), ...rest.filter(isNightOnly), ...rest.filter((id) => isFresh(id) && !isNightOnly(id)), ...rest.filter((id) => !isFresh(id) && !isNightOnly(id))];
    // One sighting is for any trail; the other shows a locked creature when there is one, as a hint of what harder trails hold.
    const open = ordered.filter((id) => !locked(id));
    const picks = [...open.slice(0, 1), ...ordered.filter(locked).slice(0, 1)];
    const visiting = visitor && visitor.homes[0] === region.id ? [visitor.id] : [];
    const chosen = [...visiting, ...[...picks, ...ordered.filter((id) => !picks.includes(id))].filter((id) => !visiting.includes(id))].slice(0, 2);
    const rewards: Reward[] = chosen.map((speciesId) => ({ kind: 'creature', speciesId }));
    if (rewards.length === 0) rewards.push({ kind: 'bond', xp: BOND_BONUS_XP });
    return rewards.map((reward): Offer => ({ id: `offer-${nextId++}`, regionId: region.id, reward }));
  });
  return { offers, nextId };
}

function refreshOffers(save: SaveData, pack: Pack): SaveData {
  const rng = new Rng(save.rngState);
  const { offers, nextId } = makeOffers(save, pack, rng);
  return { ...save, offers, nextId, rngState: rng.state };
}

export function newSave(pack: Pack, seed: number, profileId: string, displayName = 'Explorer', avatarId = 'slatepaw'): SaveData {
  const instanceId = `${profileId}-companion-1`;
  return refreshOffers(
    {
      schemaVersion: SCHEMA_VERSION,
      contentVersion: pack.version,
      profile: { id: profileId, displayName, avatarId },
      companions: [{ instanceId, speciesId: pack.starterSpeciesId, bondXp: 0 }],
      activeCompanionId: instanceId,
      souvenirIds: [],
      stateCards: [],
      seenFacts: [],
      foundPlaces: [],
      learning: {},
      badges: [],
      expertTrails: 0,
      completedExpeditions: 0,
      nextId: 1,
      rngState: seed,
      offers: [],
      expedition: null,
      attempts: [],
      recentQuestionIds: [],
      appliedRewardIds: [],
      lastSummary: null,
      settings: DEFAULT_SETTINGS,
    },
    pack,
  );
}

function setupSearch(e: Expedition, pack: Pack, rng: Rng, targetId: string): Expedition {
  const inRegion = pack.places.filter((p) => p.regionId === e.regionId);
  const gap = pack.regions.find((r) => r.id === e.regionId)?.markerGap ?? 4;
  const target = inRegion.find((p) => p.id === targetId) as Place;
  const others = inRegion.filter((p) => p.id !== targetId);
  let candidates: Place[];
  if (blankMapSearch(e)) candidates = inRegion;
  else {
    // Harder trails offer neighboring places, which are easier to confuse.
    const pool = e.difficulty === 'scout' || studySubject(e.focus) ? rng.shuffle(others) : nearestFirst(others, target);
    candidates = [target, ...spaced(pool, target, 3, gap)];
  }
  const free = e.freeClue ? 1 : 0;
  return {
    ...e,
    targetId,
    candidateIds: rng.shuffle(candidates.map((p) => p.id)),
    clueIds: rng.shuffle(pack.clues.filter((c) => c.targetId === targetId)).map((c: Clue) => c.id),
    cluesShown: 1 + free,
    freeClue: false,
    atlasUsed: false,
    narrowed: false,
    removedIds: [],
    guesses: [],
    discovery: 'searching',
    discoveryAssisted: false,
  };
}

function startExpedition(save: SaveData, pack: Pack, cmd: Extract<Command, { type: 'start' }>): SaveData {
  const region = pack.regions.find((r) => r.id === cmd.regionId);
  const offer = save.offers.find((o) => o.id === cmd.offerId);
  if (!region || !offer || offer.regionId !== cmd.regionId) return save;
  const focus: Focus = cmd.focus && regionHasFocus(pack, cmd.regionId, cmd.focus, save.settings.study) ? cmd.focus : 'all';
  const allowed = allowedDifficulties(save.settings, region);
  const asked = allowed.includes(cmd.difficulty) ? cmd.difficulty : (allowed[0] as Difficulty);
  // A locked creature's trail is always at least its difficulty.
  const { reward: sighting } = offer;
  const sought = sighting.kind === 'creature' ? pack.species.find((s) => s.id === sighting.speciesId) : undefined;
  const floor = sought ? lowestFor(sought) : 'scout';
  const difficulty: Difficulty = RANK[asked] >= RANK[floor] ? asked : floor;

  const rng = new Rng(save.rngState);
  const id = `expedition-${save.nextId}`;
  const places = pack.places.filter((p) => p.regionId === cmd.regionId && pack.clues.some((c) => c.targetId === p.id));
  if (places.length === 0) throw new Error(`No discoverable places in ${cmd.regionId}`);

  const kinds = TRAIL_STOPS[cmd.trail];
  const route = walkTrail(places, kinds.length, rng);
  // A small region shortens the trail from the middle, keeping the final showdown.
  const stops = kinds.length > route.length ? [...kinds.slice(0, route.length - 1), 'guardian' as const] : kinds;
  // Math and Words trails are home to the study creatures instead of the region's own.
  const subject = studySubject(focus);
  const scholars = subject ? pack.species.filter((s) => s.subject === subject && metOn(s, difficulty)).map((s) => s.id) : [];
  const regionals = pack.species.filter((s) => s.homes.includes(cmd.regionId) && s.id !== pack.featuredSpeciesId && !s.rare && !s.boss && !s.subject && (!s.night || !!save.offersNight) && metOn(s, difficulty)).map((s) => s.id);
  const locals = scholars.length > 0 ? scholars : regionals;
  const target = offer.reward.kind === 'creature' ? offer.reward.speciesId : (rng.shuffle(locals)[0] as string);
  // A brand-new creature the child hasn't met is the first one they battle.
  const known = knownSpecies(save);
  const shuffled = rng.shuffle(locals.filter((id) => id !== target));
  const isNewHere = (id: string) => { const s = pack.species.find((o) => o.id === id); return !!(s?.fresh || s?.night) && !known.has(id); };
  // On a night trail, the region's night creatures always come out early, even ones already befriended,
  // so a child can win another with Bold Befriend (another shot at a shiny).
  const nightHere = (id: string) => !!save.offersNight && !!pack.species.find((o) => o.id === id)?.night;
  const opponents = [...shuffled.filter(nightHere), ...shuffled.filter((id) => isNewHere(id) && !nightHere(id)), ...shuffled.filter((id) => !isNewHere(id) && !nightHere(id))];
  const events = rng.shuffle(TRAIL_EVENTS);
  let battles = 0;
  let eventCount = 0;
  const slots: Slot[] = stops.map((kind, i) => {
    const locationId = (route[i] as Place).id;
    if (kind === 'event') return { kind, locationId, opponentId: '', eventId: (events[eventCount++] as TrailEvent).id, status: 'pending' };
    if (kind === 'guardian') return { kind, locationId, opponentId: target, status: 'pending' };
    return { kind, locationId, opponentId: opponents[battles++ % opponents.length] as string, status: 'pending' };
  });

  const owned = save.companions.map((c) => c.instanceId);
  const remembered = (save.lastTeamIds ?? []).filter((id) => owned.includes(id));
  const team = remembered.length > 0 ? remembered : [save.activeCompanionId];
  const blank: Expedition = {
    id,
    regionId: cmd.regionId,
    focus,
    difficulty,
    trail: cmd.trail,
    rngState: 0,
    reward: offer.reward,
    companionId: team[0] as string,
    teamIds: team,
    prepared: false,
    points: ECONOMY.startingPoints + DIFFICULTY_POINTS[difficulty] + (save.bankedPoints ?? 0),
    sturdy: false,
    extraCharge: false,
    snack: false,
    souvenirId: rng.shuffle(pack.souvenirs.filter((s) => !save.souvenirIds.includes(s.id)))[0]?.id ?? null,
    foundSouvenirId: null,
    targetId: '',
    candidateIds: [],
    clueIds: [],
    cluesShown: 1,
    atlasUsed: false,
    narrowed: false,
    removedIds: [],
    guesses: [],
    discovery: 'searching',
    discoveryAssisted: false,
    anyAssisted: false,
    freeClue: false,
    slots,
    battle: null,
    event: null,
    askedQuestionIds: [],
    retreated: false,
    answered: 0,
    correct: 0,
    ...(save.offersNight ? { night: true } : {}),
  };
  const expedition = setupSearch(blank, pack, rng, (slots[0] as Slot).locationId);
  return {
    ...save,
    expedition: { ...expedition, rngState: Math.floor(rng.next() * 0x7fffffff) },
    lastSummary: null,
    bankedPoints: 0,
    nextId: save.nextId + 1,
    rngState: rng.state,
    settings: { ...save.settings, lastDifficulty: difficulty, lastRegionId: cmd.regionId, lastTrail: cmd.trail, lastFocus: cmd.focus ?? 'all' },
  };
}

function buy(e: Expedition, item: PrepItem): Expedition {
  const def = PREP_ITEMS.find((i) => i.id === item);
  if (e.prepared || !def || e.points < def.cost) return e;
  const field = item === 'sturdy' ? 'sturdy' : item === 'charge' ? 'extraCharge' : 'snack';
  if (e[field]) return e;
  return { ...e, [field]: true, points: e.points - def.cost };
}

function dealQuestion(save: SaveData, e: Expedition, slot: Slot, pack: Pack, now: number): { e: Expedition; question: Question } {
  const rng = new Rng(e.rngState);
  const context = { asked: e.askedQuestionIds, recent: save.recentQuestionIds, locationId: slot.locationId };
  // A boss tests everything learned on its continent.
  const regular = e.lodgeId ? lodgeQuestions(pack, e, save.settings, rng) : questionPool(pack, e, isBossSlot(slot, pack), save.settings.study);
  // On an ordinary trail, a parent can mix in some math or vocabulary. A Lodge sticks to its subject.
  const study = save.settings.study ?? DEFAULT_STUDY;
  const mixable = studySubject(e.focus) || e.lodgeId ? [] : (['math', 'words'] as const).filter((sub) => study[sub]).map((sub) => studyPool(pack, sub, e.difficulty, study)).filter((p) => p.length > 0);
  const mixIn = mixable.length > 0 && rng.next() < study.mix;
  // A math or vocabulary skill the child keeps missing comes one difficulty easier for a while.
  const pool = easeStudy(mixIn ? (mixable[Math.floor(rng.next() * mixable.length)] as Question[]) : regular, pack, save.attempts);
  const seen = new Set(save.seenFacts);
  const fresh = (q: Question) => !e.askedQuestionIds.includes(q.id);
  const recall = pool.filter((q) => q.recallOf && seen.has(q.recallOf) && fresh(q));
  const wantRecall = rng.next() < RECALL_CHANCE;
  const dueNow = pool.filter((q) => !q.recallOf && fresh(q) && isDue(save.learning[q.objectiveId], now));
  const wantReview = rng.next() < REVIEW_CHANCE;
  // A question about a Field Note only appears once the child has had the chance to read it.
  const source = wantRecall && recall.length > 0 ? recall : wantReview && dueNow.length > 0 ? dueNow : pool.filter((q) => !q.recallOf);
  // pickQuestion can only space places within its pool, so the whole pool backs up a narrow one.
  const placed = new Set(e.askedQuestionIds.slice(-4).map((id) => pack.questions.find((q) => q.id === id)?.locationId).filter(Boolean));
  const clear = (list: Question[]) => list.filter((q) => !q.locationId || !placed.has(q.locationId));
  const plain = pool.filter((q) => !q.recallOf);
  const options = [clear(source), clear(plain), plain].find((list) => list.length > 0) ?? plain;
  const picked = pickQuestion(options, context, rng);
  const question = presentQuestion(picked, rng);
  return { e: { ...e, rngState: rng.state, askedQuestionIds: [...e.askedQuestionIds, picked.id] }, question };
}

/** One creature's battle numbers on this stop, including the home-turf bonus. */
function memberStats(save: SaveData, e: Expedition, instanceId: string, slot: Slot, pack: Pack) {
  const companion = save.companions.find((c) => c.instanceId === instanceId) as Companion;
  const species = companionSpecies(pack, companion);
  const stage = stageOf(companion.bondXp, species);
  const stats = STAGES[stage];
  const biome = pack.places.find((p) => p.id === slot.locationId)?.biome ?? '';
  return {
    stage,
    charge: Math.min(MAX_CHARGE, stats.startCharge + (e.extraCharge ? 1 : 0)),
    config: {
      playerMaxHp: stats.maxHp + (e.sturdy ? STURDY_HP : 0),
      playerAttack: stats.attack,
      special: species.special.template,
      attackStyle: species.moves.attackStyle,
      guardStyle: species.moves.guardStyle,
      specialBonus: stats.specialBonus,
      turf: species.habitats.includes(biome) ? TURF_BONUS : 0,
      // A lone creature can't switch, so a weak matchup never costs it the fight.
      typeEdge: Math.max(matchup(species, speciesOf(pack, slot.opponentId)).edge, teamOf(e).length > 1 ? -1 : 0),
    },
  };
}

/** A knocked-out creature hands over to the team unless nobody is left. Companions never die. */
function afterFaint(combat: CombatState, b: Battle, activeId: string): { combat: CombatState; mustSwitch: boolean } {
  const others = Object.entries(b.bench ?? {}).some(([id, m]) => id !== activeId && m.hp > 0);
  if (combat.outcome === 'retreat' && combat.playerHp === 0 && others && combat.turn < combat.maxTurns) {
    return { combat: { ...combat, outcome: 'active', turn: combat.turn + 1 }, mustSwitch: true };
  }
  return { combat, mustSwitch: false };
}

function switchTo(save: SaveData, e: Expedition, b: Battle, instanceId: string, pack: Pack): SaveData {
  const incoming = b.bench?.[instanceId];
  const slot = e.slots[b.slotIndex] as Slot;
  // A creature that fainted must be replaced, even in the middle of a Bold Befriend; the attempt carries on with the next one.
  const midBefriend = b.befriending || (b.tameHits ?? 0) > 0;
  if (!incoming || incoming.hp === 0 || b.phase !== 'choose' || instanceId === e.companionId || (midBefriend && !b.mustSwitch)) return save;
  const m = memberStats(save, e, instanceId, slot, pack);
  const bench = { ...b.bench, [e.companionId]: { hp: b.combat.playerHp, charge: b.combat.charge } };
  const swapped: CombatState = { ...b.combat, ...m.config, playerHp: incoming.hp, charge: incoming.charge };
  const count = (b.switches?.count ?? 0) + 1;
  if (b.mustSwitch) {
    const { mustSwitch: _done, ...rest } = b;
    return { ...save, expedition: { ...e, companionId: instanceId, battle: { ...rest, bench, combat: swapped, switches: { count, damage: 0 } } } };
  }
  // A planned switch uses the turn, and the opponent hits whoever came in.
  const hit = enemyStrikes(swapped);
  const after = afterFaint(hit.state, { ...b, bench }, instanceId);
  if (after.combat.outcome === 'retreat') return { ...save, expedition: { ...e, companionId: instanceId, battle: null, retreated: true } };
  return { ...save, expedition: { ...e, companionId: instanceId, battle: { ...b, bench, combat: after.combat, mustSwitch: after.mustSwitch, switches: { count, damage: hit.damage } } } };
}

/** Better play makes the next battle more likely to be a rare creature. */
function rollRare(save: SaveData, e: Expedition, slotIndex: number, pack: Pack): Expedition {
  const slot = e.slots[slotIndex];
  if (!slot || slot.kind !== 'regular' || slot.rareRolled || e.lodgeId) return e;
  const rng = new Rng(e.rngState);
  const pool = rarePool(pack, e.regionId, [...knownSpecies(save)]);
  const hit = pool.length > 0 && rng.next() < rareChance(trailScore(e));
  // Any of the region's rares can show up, not always the first one listed.
  const rare = hit ? pool[Math.floor(rng.next() * pool.length)] : undefined;
  const rolled: Slot = hit && rare ? { ...slot, rareRolled: true, rare: true, opponentId: rare.id } : { ...slot, rareRolled: true };
  return { ...e, rngState: rng.state, slots: e.slots.map((s, i) => (i === slotIndex ? rolled : s)) };
}

function enterEncounter(save: SaveData, pack: Pack, now: number): SaveData {
  const before = save.expedition;
  if (!before || !before.prepared || before.discovery !== 'found' || before.battle || before.event) return save;
  const slotIndex = currentSlotIndex(before);
  if (!before.slots[slotIndex]) return save;
  const e = rollRare(save, before, slotIndex, pack);
  const slot = e.slots[slotIndex] as Slot;

  if (slot.kind === 'event') {
    const dealt = dealQuestion(save, e, slot, pack, now);
    const event: EventState = { id: `${e.id}-event-${save.nextId}`, slotIndex, eventId: slot.eventId as string, question: dealt.question };
    return { ...save, nextId: save.nextId + 1, expedition: { ...dealt.e, event, retreated: false } };
  }

  const guardian = slot.kind === 'guardian';
  const boss = isBossSlot(slot, pack);
  const team = teamOf(e);
  const leadId = team[0] as string;
  const lead = memberStats(save, e, leadId, slot, pack);
  const scale = teamScaling(team.length);
  const stage = STAGES[lead.stage];
  const lodgeStats = lodgeBattleStats(pack, e, slot, team.length);
  const started = startCombat(lodgeStats
    ? { ...lead.config, ...lodgeStats }
    : {
        ...lead.config,
        opponentMaxHp: (guardian ? stage.finalHp : stage.regularHp + (slot.rare ? RARE_EXTRA_HP : 0)) + scale.hp + (boss ? BOSS.hp : 0),
        enemyPattern: BALANCE.enemyPattern.map((d) => d + scale.damage),
        maxTurns: (guardian ? BALANCE.guardianMaxTurns : BALANCE.regularMaxTurns) + scale.turns + (boss ? BOSS.turns : 0),
        ...(boss ? { bossPower: BOSS.power } : {}),
      });
  const combat = { ...started, charge: lead.charge };
  const bench = Object.fromEntries(team.map((id) => {
    const m = memberStats(save, e, id, slot, pack);
    return [id, { hp: m.config.playerMaxHp, charge: m.charge }];
  }));
  const dealt = dealQuestion(save, e, slot, pack, now);
  const battle: Battle = { id: `${e.id}-battle-${save.nextId}`, slotIndex, combat, phase: 'choose', question: dealt.question, bench };
  return { ...save, nextId: save.nextId + 1, expedition: { ...dealt.e, companionId: leadId, battle, retreated: false } };
}

/** Records a Field Note as seen once it has been shown after a correct answer. */
function noteFacts(save: SaveData, q: Question, correct: boolean): string[] {
  return correct && q.noteId && !save.seenFacts.includes(q.noteId) ? [...save.seenFacts, q.noteId] : save.seenFacts;
}

/** A right answer after this trip already showed it doesn't prove anything, so it's marked assisted. */
function learn(save: SaveData, e: Expedition, q: Question, correct: boolean, now: number): Learning {
  return recordAnswer(save.learning, q, correct, now, (e.revealed ?? []).includes(q.objectiveId));
}

function revealedAfter(e: Expedition, q: Question, correct: boolean): string[] {
  const revealed = e.revealed ?? [];
  return correct || revealed.includes(q.objectiveId) ? revealed : [...revealed, q.objectiveId];
}

function pointsFor(q: Question, correct: boolean): number {
  return correct && q.recallOf ? ECONOMY.recallBonus : 0;
}

const RARE_EXTRA_HP = 4;
const TAME_COST = 2;
export const TAME_HITS = 2;

/** Bold Befriend: a creature at half HP or less, for 2 charge, even one the child already has. Once started, it can continue at no cost. */
export function canTame(save: SaveData, b: Battle, slot: Slot): boolean {
  // Lodge creatures belong to their rangers.
  if (save.expedition?.lodgeId) return false;
  if (slot.kind !== 'regular' || slot.rare || b.befriending || b.mustSwitch || b.combat.outcome !== 'active') return false;
  if ((b.tameHits ?? 0) > 0) return true;
  return b.combat.charge >= TAME_COST && b.combat.opponentHp * 2 <= b.combat.opponentMaxHp;
}

/** A Bold Befriend question is one level harder than the trail, and never one the child just saw. */
function startTame(save: SaveData, e: Expedition, b: Battle, pack: Pack): SaveData {
  const slot = e.slots[b.slotIndex] as Slot;
  if (!canTame(save, b, slot)) return save;
  const regular = b.heldQuestions?.regular ?? b.question;
  const held = b.heldQuestions?.tame;
  if (held) return { ...save, expedition: { ...e, battle: { ...b, phase: 'question', action: 'tame', question: held, heldQuestions: { regular } } } };
  const harder = DIFFICULTIES[Math.min(DIFFICULTIES.indexOf(e.difficulty) + 1, DIFFICULTIES.length - 1)] as Difficulty;
  const pool = questionPool(pack, { regionId: e.regionId, difficulty: harder, ...(e.focus ? { focus: e.focus } : {}) }, false, save.settings.study).filter((q) => !q.recallOf);
  const rng = new Rng(e.rngState);
  const picked = pickQuestion(pool, { asked: e.askedQuestionIds, recent: save.recentQuestionIds, locationId: slot.locationId }, rng);
  const question = presentQuestion(picked, rng);
  return { ...save, expedition: { ...e, rngState: rng.state, askedQuestionIds: [...e.askedQuestionIds, picked.id], battle: { ...b, phase: 'question', action: 'tame', question, heldQuestions: { regular } } } };
}

/** Back to the move buttons before answering. The question stays dealt, so this can't swap a hard one. */
function changeMove(save: SaveData, e: Expedition, b: Battle): SaveData {
  if (b.phase !== 'question' || b.befriending) return save;
  const { action, ...rest } = b;
  if (action !== 'tame') return { ...save, expedition: { ...e, battle: { ...rest, phase: 'choose' } } };
  const regular = b.heldQuestions?.regular ?? b.question;
  return { ...save, expedition: { ...e, battle: { ...rest, phase: 'choose', question: regular, heldQuestions: { regular, tame: b.question } } } };
}

/** A card this answer raised a level, if any. A new card is announced separately. */
function cardRaised(save: SaveData, learning: Learning, q: Question): TurnResult['cardUp'] {
  const placeId = q.locationId;
  if (!placeId || !save.stateCards.includes(placeId)) return undefined;
  const before = cardLevelOf(save.learning, placeId);
  const after = cardLevelOf(learning, placeId);
  return before === after ? undefined : { placeId, level: after };
}

function battlesWon(e: Expedition): number {
  return e.slots.filter((s) => s.kind === 'regular' && s.status === 'won').length;
}

/** Earns a State Card on the first correct answer about a place that has one. */
function earnCard(save: SaveData, pack: Pack, q: Question, correct: boolean): string | undefined {
  if (!correct || !q.locationId || save.stateCards.includes(q.locationId)) return undefined;
  return pack.cards.some((c) => c.placeId === q.locationId) ? q.locationId : undefined;
}

function answer(save: SaveData, pack: Pack, optionId: string, now: number): SaveData {
  const e = save.expedition;
  if (e?.event && !e.event.result) return answerEvent(save, pack, optionId, now);
  const b = e?.battle;
  if (!e || !b || b.phase !== 'question' || !b.action) return save;
  if (!isAnswerFor(b.question, optionId)) return save;

  const correct = isCorrect(b.question, optionId);
  const befriending = b.action === 'befriend';
  const taming = b.action === 'tame';
  const tameHits = taming && correct ? (b.tameHits ?? 0) + 1 : 0;
  const tamed = taming && tameHits >= TAME_HITS;
  const quiet = { damageDealt: 0, damageTaken: 0, blocked: 0, healed: 0 };
  // Starting an attempt spends the charge. The creature keeps attacking until it's won over.
  const paid = taming && !b.tameHits ? { ...b.combat, charge: b.combat.charge - TAME_COST } : b.combat;
  const resolved = befriending
    ? { state: b.combat, events: quiet }
    : tamed
      ? { state: { ...paid, outcome: 'victory' as const }, events: quiet }
      : taming
        ? resolveTurn(paid, 'attack', false)
        : resolveTurn(b.combat, b.action as CombatAction, correct);
  // A right answer on a Field Note check is a critical: it adds a charge.
  const critical = correct && !befriending && !!b.question.recallOf;
  // Typing a math or vocabulary answer, rather than picking one, is worth an extra charge.
  const brainBlast = correct && !befriending && !taming && b.question.inputType === 'typed' && isStudy(b.question);
  const bonus = (critical ? 1 : 0) + (brainBlast ? 1 : 0);
  const charged = bonus > 0 && resolved.state.outcome === 'active' ? { ...resolved.state, charge: Math.min(MAX_CHARGE, resolved.state.charge + bonus) } : resolved.state;
  const streak = correct ? (e.streak ?? 0) + 1 : 0;
  const milestone = streakReward(streak);
  const roomToHeal = charged.outcome === 'active' ? Math.min(milestone?.heal ?? 0, charged.playerMaxHp - charged.playerHp) : 0;
  const healed = roomToHeal > 0 ? { ...charged, playerHp: charged.playerHp + roomToHeal } : charged;
  const { combat, mustSwitch } = afterFaint(healed, b, e.companionId);
  const benched = { ...b.bench, [e.companionId]: { hp: combat.playerHp, charge: combat.charge } };
  const events = roomToHeal > 0 ? { ...resolved.events, healed: resolved.events.healed + roomToHeal } : resolved.events;
  const attempt: Attempt = {
    id: `${b.id}-answer-${e.answered + 1}`,
    context: 'battle',
    itemId: b.question.id,
    itemVersion: b.question.version,
    objectiveId: b.question.objectiveId,
    submitted: optionId,
    correct,
    timestamp: now,
    assisted: (e.revealed ?? []).includes(b.question.objectiveId),
    expeditionId: e.id,
    battleId: b.id,
    difficulty: e.difficulty,
  };

  const slot = e.slots[b.slotIndex] as Slot;
  const huntWon = befriending ? correct : combat.outcome === 'victory' && !slot.rare && (slot.kind !== 'guardian' || e.reward.kind !== 'creature');
  const joined = tamed || (befriending && correct && !!slot.rare);
  // The answer, stop win, points, card and any find all commit together in this one save.
  const slots = e.slots.map((s, i) => (i === b.slotIndex && huntWon ? { ...s, status: 'won' as const } : s));
  const midTrailFind = huntWon && slot.kind === 'regular' && battlesWon(e) === 1 && e.souvenirId && !e.foundSouvenirId;
  const cardId = earnCard(save, pack, b.question, correct);
  const learning = learn(save, e, b.question, correct, now);
  const cardUp = cardRaised(save, learning, b.question);
  const study = studied(save, b.question, correct, e.difficulty);
  // Winning a stop earns XP once, because a stop can only be won once.
  // The finisher earns full XP and the rest of the team half, so everyone grows.
  const winXp = xpFor(XP.battleWon, e.difficulty);
  const paidXp = huntWon && slot.kind !== 'event'
    ? save.companions.map((c) => {
        if (c.instanceId === e.companionId) return { ...c, bondXp: c.bondXp + winXp };
        return teamOf(e).includes(c.instanceId) ? { ...c, bondXp: c.bondXp + Math.floor(winXp / 2) } : c;
      })
    : save.companions;
  // A branching creature remembers how it was raised: what its lead answered right, and the harder battles it won.
  const raise: PathId | undefined = !correct || befriending ? undefined : isStudy(b.question) ? 'scholar' : b.question.topic === 'flag' ? 'banner' : undefined;
  const raisedXp = paidXp.map((c) => {
    if (!speciesOf(pack, c.speciesId).paths || c.path) return c;
    const lead = c.instanceId === e.companionId;
    const bumps: PathId[] = [...(lead && raise ? [raise] : []), ...(huntWon && e.difficulty !== 'scout' && teamOf(e).includes(c.instanceId) ? ['ranger' as const] : [])];
    if (bumps.length === 0) return c;
    const raised: Raised = { ...c.raised };
    for (const p of bumps) raised[p] = (raised[p] ?? 0) + 1;
    return { ...c, raised };
  });
  const fighterBefore = paidXp.find((c) => c.instanceId === e.companionId);
  const fighterAfter = raisedXp.find((c) => c.instanceId === e.companionId);
  const pathPoints = PATH_ORDER.filter((p) => (fighterAfter?.raised?.[p] ?? 0) > (fighterBefore?.raised?.[p] ?? 0));
  // Beating an Elite Ranger's last creature the first time wins their star creature.
  const starPrize = huntWon && slot.prize && !knownSpecies(save).has(slot.prize) ? slot.prize : undefined;
  const visiting = isVisitorToday(save, pack, slot.opponentId);
  const boost = trailBoost(e) * chainBoost(save.shinyChain, slot.opponentId) * (visiting ? VISITOR_SHINY_BOOST : 1);
  const withJoined = joined ? [...raisedXp, joining(`${save.profile.id}-companion-${save.nextId}`, slot.opponentId, e.difficulty, boost)] : raisedXp;
  const shinyChain = joined ? extendChain(save.shinyChain, slot.opponentId) : save.shinyChain;
  // A level reached mid-trail gets its own moment in battle.
  const levelUps = paidXp.filter((c) => teamOf(e).includes(c.instanceId) && levelOf(c.bondXp) > levelOf(save.companions.find((o) => o.instanceId === c.instanceId)?.bondXp ?? c.bondXp)).map((c) => ({ instanceId: c.instanceId, level: levelOf(c.bondXp) }));
  const result: TurnResult = { ...(starPrize ? { prize: starPrize } : {}), ...(levelUps.length ? { levelUps } : {}), ...(joined && shinyChain ? { chain: shinyChain.count } : {}), ...(joined && visiting ? { visitor: true } : {}), optionId, correct, events, ...(cardId ? { cardId } : {}), ...(critical ? { critical } : {}), ...(cardUp ? { cardUp } : {}), ...(brainBlast ? { brainBlast } : {}), ...(study.laid ? { eggLaid: study.laid } : {}), ...(pathPoints.length > 0 ? { pathPoints } : {}) };
  const companions = starPrize ? [...withJoined, joining(`${save.profile.id}-companion-${save.nextId + (joined ? 1 : 0)}`, starPrize, e.difficulty)] : withJoined;
  return {
    ...save,
    ...study.patch,
    attempts: [...save.attempts, attempt].slice(-ATTEMPT_LIMIT),
    companions,
    nextId: save.nextId + (joined ? 1 : 0) + (starPrize ? 1 : 0),
    ...(shinyChain ? { shinyChain } : {}),
    ...(joined && slot.rare ? { rareFound: true } : {}),
    bestStreak: Math.max(save.bestStreak ?? 0, streak),
    tamedAny: save.tamedAny || tamed,
    learning,
    stateCards: cardId ? [...save.stateCards, cardId] : save.stateCards,
    seenFacts: noteFacts(save, b.question, correct),
    souvenirIds: midTrailFind && e.souvenirId ? [...save.souvenirIds, e.souvenirId] : save.souvenirIds,
    expedition: {
      ...e,
      slots,
      foundSouvenirId: midTrailFind ? e.souvenirId : e.foundSouvenirId,
      points: e.points + (huntWon ? ECONOMY.perStopWon : 0) + pointsFor(b.question, correct) + (milestone?.points ?? 0),
      revealed: revealedAfter(e, b.question, correct),
      ...(joined ? { tamedIds: [...(e.tamedIds ?? []), slot.opponentId] } : {}),
      answered: e.answered + 1,
      correct: e.correct + (correct ? 1 : 0),
      streak,
      battle: { ...b, combat, bench: benched, phase: 'feedback', result, tameHits, ...(mustSwitch ? { mustSwitch } : {}), ...((befriending && correct) || tamed ? { befriended: true } : {}) },
    },
  };
}

function answerEvent(save: SaveData, pack: Pack, optionId: string, now: number): SaveData {
  const e = save.expedition as Expedition;
  const ev = e.event as EventState;
  if (!isAnswerFor(ev.question, optionId)) return save;
  const correct = isCorrect(ev.question, optionId);
  const def = TRAIL_EVENTS.find((t) => t.id === ev.eventId) as TrailEvent;
  const attempt: Attempt = {
    id: `${ev.id}-answer`,
    context: 'event',
    itemId: ev.question.id,
    itemVersion: ev.question.version,
    objectiveId: ev.question.objectiveId,
    submitted: optionId,
    correct,
    timestamp: now,
    assisted: false,
    expeditionId: e.id,
    difficulty: e.difficulty,
  };
  const cardId = earnCard(save, pack, ev.question, correct);
  const learning = learn(save, e, ev.question, correct, now);
  const cardUp = cardRaised(save, learning, ev.question);
  const streak = correct ? (e.streak ?? 0) + 1 : 0;
  return {
    ...save,
    ...studied(save, ev.question, correct, e.difficulty).patch,
    attempts: [...save.attempts, attempt].slice(-ATTEMPT_LIMIT),
    bestStreak: Math.max(save.bestStreak ?? 0, streak),
    learning,
    stateCards: cardId ? [...save.stateCards, cardId] : save.stateCards,
    seenFacts: noteFacts(save, ev.question, correct),
    expedition: {
      ...e,
      points: e.points + (correct ? def.points : 0) + pointsFor(ev.question, correct) + (streakReward(streak)?.points ?? 0),
      revealed: revealedAfter(e, ev.question, correct),
      snack: e.snack || (correct && !!def.snack),
      freeClue: correct && !!def.freeClue,
      answered: e.answered + 1,
      correct: e.correct + (correct ? 1 : 0),
      streak,
      slots: e.slots.map((s, i) => (i === ev.slotIndex ? { ...s, status: 'won' as const } : s)),
      event: { ...ev, result: { optionId, correct, ...(cardId ? { cardId } : {}), ...(cardUp ? { cardUp } : {}) } },
    },
  };
}

/** After a stop is won, the search for the next place begins. */
function nextStop(e: Expedition, pack: Pack): Expedition {
  const next = e.slots[currentSlotIndex(e)];
  // A Lodge has no map to search: the next ranger is waiting.
  if (!next || e.lodgeId) return e;
  const rng = new Rng(e.rngState);
  return { ...setupSearch(e, pack, rng, next.locationId), rngState: rng.state };
}

function continueBattle(save: SaveData, pack: Pack, now: number): SaveData {
  const e = save.expedition;
  if (e?.event?.result) return { ...save, expedition: nextStop({ ...e, event: null }, pack) };
  const b = e?.battle;
  if (!e || !b || b.phase !== 'feedback') return save;
  const slot = e.slots[b.slotIndex] as Slot;

  const ended = b.befriended || (b.combat.outcome !== 'active' && !(b.combat.outcome === 'victory' && slot.status === 'pending'));
  if (ended) {
    const done: Expedition = { ...e, battle: null, retreated: b.combat.outcome === 'retreat' };
    return { ...save, expedition: b.combat.outcome === 'retreat' ? done : nextStop(done, pack) };
  }

  const dealt = dealQuestion(save, e, slot, pack, now);
  const { result: _result, action: _action, heldQuestions: _held, ...rest } = b;
  const befriending = b.combat.outcome === 'victory' ? { befriending: true } : {};
  return { ...save, expedition: { ...dealt.e, battle: { ...rest, ...befriending, phase: 'choose', question: dealt.question } } };
}

function guess(save: SaveData, pack: Pack, locationId: string, now: number): SaveData {
  const e = save.expedition;
  if (!e || !e.prepared || e.discovery !== 'searching' || !e.candidateIds.includes(locationId)) return save;
  if (e.guesses.includes(locationId) || e.removedIds.includes(locationId)) return save;

  const correct = locationId === e.targetId;
  const assisted = e.atlasUsed || e.cluesShown > 1 || e.narrowed || e.guesses.length > 0;
  const clue = pack.clues.find((c) => c.id === e.clueIds[0]);
  const attempt: Attempt = {
    id: `${e.id}-${e.targetId}-guess-${e.guesses.length + 1}`,
    context: 'discovery',
    itemId: clue?.id ?? e.targetId,
    itemVersion: clue?.version ?? 1,
    objectiveId: clue?.objectiveId ?? '',
    submitted: locationId,
    correct,
    timestamp: now,
    assisted,
    expeditionId: e.id,
    difficulty: e.difficulty,
  };
  return {
    ...save,
    attempts: [...save.attempts, attempt].slice(-ATTEMPT_LIMIT),
    foundPlaces: correct && !save.foundPlaces.includes(locationId) ? [...save.foundPlaces, locationId] : save.foundPlaces,
    expedition: {
      ...e,
      guesses: [...e.guesses, locationId],
      discovery: correct ? 'found' : 'searching',
      discoveryAssisted: assisted,
      anyAssisted: e.anyAssisted || (correct && assisted),
      points: correct ? e.points : Math.max(0, e.points - ECONOMY.wrongGuessCost),
      // A wrong guess brings the next clue into view, free, as the correction.
      cluesShown: correct ? e.cluesShown : Math.min(e.clueIds.length, e.cluesShown + 1),
    },
  };
}

function narrowSearch(e: Expedition): Expedition {
  if (blankMapSearch(e) || e.narrowed || e.discovery !== 'searching' || e.points < ECONOMY.narrowSearch) return e;
  const wrong = e.candidateIds.filter((id) => id !== e.targetId && !e.guesses.includes(id));
  return { ...e, narrowed: true, removedIds: wrong.slice(0, 2), points: e.points - ECONOMY.narrowSearch };
}

function claimReward(save: SaveData, pack: Pack, now: number): SaveData {
  const e = save.expedition;
  if (!e || !isExpeditionComplete(e)) return save;
  if (e.lodgeId) return claimLodge(save, pack, e, now);

  const { reward } = e;
  const applied = save.appliedRewardIds.includes(e.id);
  // Today's visitor can join again even when the child already has one.
  const visiting = reward.kind === 'creature' && isVisitorToday(save, pack, reward.speciesId);
  const owned = reward.kind === 'creature' && knownSpecies(save).has(reward.speciesId) && !visiting;
  const leftoverXp = applied ? 0 : e.points * ECONOMY.xpPerLeftoverPoint;
  const bonus = !applied && reward.kind === 'bond' ? reward.xp : 0;
  const finishXp = applied ? 0 : xpFor(XP.expeditionDone, e.difficulty);
  const team = teamOf(e);
  const companions = save.companions.map((c) => {
    if (c.instanceId === e.companionId) return { ...c, bondXp: c.bondXp + leftoverXp + bonus + finishXp };
    return team.includes(c.instanceId) ? { ...c, bondXp: c.bondXp + Math.floor(finishXp / 2) } : c;
  });
  const gained = companions.filter((c) => team.includes(c.instanceId) && levelOf(c.bondXp) > levelOf(e.xpAtStart?.[c.instanceId] ?? c.bondXp));
  const levelAfter = Math.max(0, ...gained.map((c) => levelOf(c.bondXp)));
  const joins = !applied && reward.kind === 'creature' && !owned;
  if (joins) {
    const boost = trailBoost(e) * chainBoost(save.shinyChain, reward.speciesId) * (visiting ? VISITOR_SHINY_BOOST : 1);
    companions.push(joining(`${save.profile.id}-companion-${save.nextId}`, reward.speciesId, e.difficulty, boost));
  }
  const shinyChain = joins ? extendChain(save.shinyChain, reward.speciesId) : save.shinyChain;
  // Finding every creature that lives in a region: Region Master, and a Rare Egg for each one.
  const had = save.regionsMastered ?? masteredRegions(pack, knownSpecies(save));
  const nowMastered = masteredRegions(pack, knownSpecies({ companions, wild: save.wild }));
  const newlyMastered = applied ? [] : nowMastered.filter((r) => !had.includes(r));
  const levelUps = gained.map((c) => ({ instanceId: c.instanceId, from: levelOf(e.xpAtStart?.[c.instanceId] ?? c.bondXp), to: levelOf(c.bondXp) }));
  // A Math or Words trail lays an egg of its subject, or a rare one for an Expert trail with nearly every answer right.
  const subject = studySubject(e.focus);
  const eggKind: EggKind | undefined = !applied && subject ? (e.difficulty === 'expert' && e.answered > 0 && e.correct / e.answered >= 0.9 ? 'rare' : subject) : undefined;
  const trailNest = eggKind ? layEgg(save.eggs ?? [], eggKind, `egg-${save.nextId}`) : save.eggs;
  const laid = !!eggKind && (trailNest?.length ?? 0) > (save.eggs?.length ?? 0);
  const nest = newlyMastered.reduce((n, r) => layEgg(n ?? [], 'rare', `egg-master-${r}-${save.nextId}`), trailNest);

  const stamped = save.stampedRegions ?? [];
  const newStamp = !applied && !stamped.includes(e.regionId) ? e.regionId : undefined;
  const won = applied ? { medals: save.medals ?? {}, earned: [] } : awardMedals(save.medals ?? {}, save.learning, pack, now);
  const claimed: SaveData = { ...save, ...(nest ? { eggs: nest } : {}), regionsMastered: [...new Set([...had, ...nowMastered])], ...(shinyChain ? { shinyChain } : {}), medals: won.medals, bankedPoints: (save.bankedPoints ?? 0) + medalPoints(won.earned), stampedRegions: newStamp ? [...stamped, newStamp] : stamped, companions, completedExpeditions: save.completedExpeditions + (applied ? 0 : 1), expertTrails: save.expertTrails + (!applied && e.difficulty === 'expert' ? 1 : 0) };
  const badges = earnedBadges(claimed, pack);
  const newBadges = badges.filter((id) => !save.badges.includes(id));

  return refreshOffers(
    {
      ...claimed,
      badges,
      nextId: save.nextId + 1,
      appliedRewardIds: applied ? save.appliedRewardIds : [...save.appliedRewardIds, e.id],
      expedition: null,
      recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT),
      lastSummary: {
        expeditionId: e.id,
        difficulty: e.difficulty,
        ...(newStamp ? { newStamp } : {}),
        reward,
        answered: e.answered,
        correct: e.correct,
        discoveryAssisted: e.anyAssisted,
        souvenirId: e.foundSouvenirId,
        cardsEarned: save.stateCards.length,
        xpGained: leftoverXp + bonus + finishXp,
        ...(levelAfter > 0 ? { levelUp: levelAfter } : {}),
        ...(levelUps.length ? { levelUps } : {}),
        ...(newlyMastered.length ? { regionsMastered: newlyMastered } : {}),
        newBadges,
        ...(e.tamedIds ? { tamedIds: e.tamedIds } : {}),
        ...(won.earned.length ? { newMedals: won.earned } : {}),
        ...(laid && eggKind ? { eggLaid: eggKind } : {}),
        ...milestone(save, claimed),
      },
    },
    pack,
  );
}

/** The Lodge's battles, in order: its junior rangers, then the leader's team. Math and vocabulary Lodges start with a gate quiz. */
function startLodge(save: SaveData, pack: Pack, lodgeId: string, tier: LodgeTier, now: number, gatePassed = false): SaveData {
  const lodge = lodgeById(pack, lodgeId);
  if (!lodge || save.expedition || save.masteryTest || (save.lodgeQuiz && !gatePassed) || !lodgeOpen(pack, save, lodgeId, tier)) return save;
  const difficulty = lodgeDifficulty(lodge, save.settings, tier);
  if (lodge.gate && !gatePassed) return startLodgeQuiz(save, pack, lodge.id, 'gate', tier, difficulty, now);
  const rng = new Rng(save.rngState);
  // Any place with the Lodge's landscape gives the battle its backdrop and home-turf bonus.
  const open = pack.places.filter((p) => !save.settings.disabledRegions.includes(p.regionId));
  const scenic = open.filter((p) => p.biome === lodge.biome);
  const at = (rng.shuffle(scenic.length > 0 ? scenic : open)[0] ?? pack.places[0]) as Place;
  // Rematches bring more evolved creatures.
  const grown = (stage: number) => Math.min(3, stage + TIER_STAGE[tier]) as 1 | 2 | 3;
  const juniors: Slot[] = lodge.juniors.map((j) => ({ kind: 'regular', locationId: at.id, opponentId: j.speciesId, opponentStage: grown(j.stage), trainer: j.name, role: 'junior', status: 'pending' }));
  // The League: each Elite Ranger's team in turn, then the Champion.
  const elites: Slot[] = (lodge.gauntlet ?? []).flatMap((r) => r.team.map((f, i): Slot => {
    const last = i === r.team.length - 1;
    return { kind: 'guardian', locationId: at.id, opponentId: f.speciesId, opponentStage: f.stage, trainer: r.name, trainerArt: r.artId, power: r.power, role: last ? 'ace' : 'leader', status: 'pending', ...(last ? { prize: r.prizeSpeciesId } : {}) };
  }));
  const championPower = lodge.gauntlet ? Math.max(...lodge.gauntlet.map((r) => r.power)) + 1 : undefined;
  const leader: Slot[] = [...elites, ...lodge.team.map((f, i): Slot => ({ kind: 'guardian', locationId: at.id, opponentId: f.speciesId, opponentStage: grown(f.stage), trainer: lodge.leader.name, ...(championPower ? { power: championPower, trainerArt: lodge.leader.artId } : {}), role: i === lodge.team.length - 1 ? 'ace' : 'leader', status: 'pending' }))];
  const owned = save.companions.map((c) => c.instanceId);
  const remembered = (save.lastTeamIds ?? []).filter((id) => owned.includes(id));
  const team = remembered.length > 0 ? remembered : [save.activeCompanionId];
  const expedition: Expedition = {
    id: `lodge-${lodge.id}-${save.nextId}`,
    lodgeId: lodge.id,
    lodgeTier: tier,
    ...(gatePassed && save.lodgeQuiz ? { gateScore: { right: save.lodgeQuiz.right, of: save.lodgeQuiz.questions.length } } : {}),
    regionId: at.regionId,
    difficulty,
    trail: 'standard',
    rngState: Math.floor(rng.next() * 0x7fffffff),
    reward: { kind: 'bond', xp: 0 },
    companionId: team[0] as string,
    teamIds: team,
    prepared: false,
    // Medal points stay banked for the next trail.
    points: ECONOMY.startingPoints + DIFFICULTY_POINTS[difficulty],
    sturdy: false,
    extraCharge: false,
    snack: false,
    souvenirId: null,
    foundSouvenirId: null,
    targetId: at.id,
    candidateIds: [at.id],
    clueIds: [],
    cluesShown: 1,
    atlasUsed: false,
    narrowed: false,
    removedIds: [],
    guesses: [],
    discovery: 'found',
    discoveryAssisted: false,
    anyAssisted: false,
    freeClue: false,
    slots: [...juniors, ...leader],
    battle: null,
    event: null,
    askedQuestionIds: [],
    retreated: false,
    answered: 0,
    correct: 0,
  };
  return { ...save, lodgeQuiz: null, expedition, lastSummary: null, nextId: save.nextId + 1, rngState: rng.state };
}

/** The strength of a Lodge battle: the Lodge's rank, raised for Silver and Gold, and a Brain Shield on the leader's creatures where the Lodge has one. */
export function lodgeBattleStats(pack: Pack, e: Expedition, slot: Slot, teamSize: number) {
  const lodge = lodgeById(pack, e.lodgeId);
  if (!lodge) return undefined;
  const role = slot.role ?? (slot.kind === 'guardian' ? 'leader' : 'junior');
  return lodgeFoeStats(slot.power ?? lodgePower(lodge.rank, e.lodgeTier), role, teamSize, lodge.shield && role !== 'junior' ? BRAIN_SHIELD : 0);
}

/** XP like a trail, and a new patch. Bronze brings the Lodge's prize creature, Silver a rare egg, and Gold battles lead to the Mastery Test. */
function claimLodge(save: SaveData, pack: Pack, e: Expedition, now: number): SaveData {
  const lodge = lodgeById(pack, e.lodgeId);
  if (!lodge) return { ...save, expedition: null };
  const tier = e.lodgeTier ?? 'bronze';
  const applied = save.appliedRewardIds.includes(e.id);
  const had = patchOf(save, lodge.id);
  const rank = (t: LodgeTier | undefined) => (t ? ['bronze', 'silver', 'gold'].indexOf(t) : -1);
  // Gold is earned by the Mastery Test, not the battles.
  const beaten = save.lodgesBeaten ?? [];
  const firstWin = !applied && !beaten.includes(lodge.id);
  const newPatch: LodgeTier | undefined = firstWin && tier === 'bronze' ? 'bronze' : !applied && tier === 'silver' && rank(tier) > rank(had) ? tier : undefined;
  const leftoverXp = applied ? 0 : e.points * ECONOMY.xpPerLeftoverPoint;
  const finishXp = applied ? 0 : xpFor(XP.expeditionDone, e.difficulty) * (tier === 'bronze' ? 2 : 3);
  const team = teamOf(e);
  const companions = save.companions.map((c) => {
    if (c.instanceId === e.companionId) return { ...c, bondXp: c.bondXp + leftoverXp + finishXp };
    return team.includes(c.instanceId) ? { ...c, bondXp: c.bondXp + Math.floor(finishXp / 2) } : c;
  });
  const gained = companions.filter((c) => team.includes(c.instanceId) && levelOf(c.bondXp) > levelOf(e.xpAtStart?.[c.instanceId] ?? c.bondXp));
  const levelAfter = Math.max(0, ...gained.map((c) => levelOf(c.bondXp)));
  const prize = firstWin && !knownSpecies(save).has(lodge.prizeSpeciesId);
  if (prize) companions.push(joining(`${save.profile.id}-companion-${save.nextId}`, lodge.prizeSpeciesId, e.difficulty));
  // The math and vocabulary Lodges always lay an egg of their subject. A new Silver patch lays a rare one.
  const eggKind: EggKind | undefined = applied ? undefined : newPatch === 'silver' ? 'rare' : lodge.subject === 'math' ? 'math' : lodge.subject === 'words' ? 'words' : undefined;
  const nest = eggKind ? layEgg(save.eggs ?? [], eggKind, `egg-${save.nextId}`) : save.eggs;
  const laid = !!eggKind && (nest?.length ?? 0) > (save.eggs?.length ?? 0);
  const testReady = !applied && tier === 'gold' && had !== 'gold';
  const won = applied ? { medals: save.medals ?? {}, earned: [] } : awardMedals(save.medals ?? {}, save.learning, pack, now);
  const claimed: SaveData = {
    ...save,
    companions,
    ...(nest ? { eggs: nest } : {}),
    medals: won.medals,
    bankedPoints: (save.bankedPoints ?? 0) + medalPoints(won.earned),
    lodgesBeaten: firstWin ? [...beaten, lodge.id] : beaten,
    ...(lodge.gauntlet && !applied ? { hallOfFame: [...(save.hallOfFame ?? []), { at: now, team: companions.filter((c) => team.includes(c.instanceId)) }] } : {}),
    ...(newPatch === 'silver' ? { lodgeTiers: { ...save.lodgeTiers, [lodge.id]: 'silver' as const } } : {}),
    ...(testReady ? { lodgeTestReady: [...new Set([...(save.lodgeTestReady ?? []), lodge.id])] } : {}),
  };
  const badges = earnedBadges(claimed, pack);
  const done = refreshOffers(
    {
      ...claimed,
      badges,
      nextId: save.nextId + 1,
      appliedRewardIds: applied ? save.appliedRewardIds : [...save.appliedRewardIds, e.id],
      expedition: null,
      recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT),
      lastSummary: {
        expeditionId: e.id,
        difficulty: e.difficulty,
        lodgeId: lodge.id,
        ...(prize ? { prizeId: lodge.prizeSpeciesId } : {}),
        ...(newPatch ? { newPatch } : {}),
        reward: prize ? { kind: 'creature', speciesId: lodge.prizeSpeciesId } : { kind: 'bond', xp: leftoverXp + finishXp },
        answered: e.answered,
        correct: e.correct,
        discoveryAssisted: false,
        souvenirId: null,
        cardsEarned: save.stateCards.length,
        xpGained: leftoverXp + finishXp,
        ...(levelAfter > 0 ? { levelUp: levelAfter } : {}),
        newBadges: badges.filter((id) => !save.badges.includes(id)),
        ...(won.earned.length ? { newMedals: won.earned } : {}),
        ...(laid && eggKind ? { eggLaid: eggKind } : {}),
        ...milestone(save, claimed),
      },
    },
    pack,
  );
  // Gold battles won: straight on to the Mastery Test.
  return testReady ? startLodgeQuiz(done, pack, lodge.id, 'mastery', 'gold', 'expert', now) : done;
}

/** Questions for a Lodge quiz, on the Lodge's subject, all different. */
function startLodgeQuiz(save: SaveData, pack: Pack, lodgeId: string, kind: LodgeQuiz['kind'], tier: LodgeTier, wanted: Difficulty, now: number): SaveData {
  const lodge = lodgeById(pack, lodgeId);
  if (!lodge || save.expedition || save.masteryTest) return save;
  const difficulty = lodgeDifficulty(lodge, save.settings, kind === 'mastery' ? 'gold' : tier) ?? wanted;
  const rng = new Rng(save.rngState);
  const size = LODGE_QUIZ[kind].questions;
  const fake = { lodgeId, difficulty } as Expedition;
  const picked: Question[] = [];
  const recent = new Set(save.recentQuestionIds);
  for (let i = 0; picked.length < size && i < size * 6; i++) {
    // The gate eases skills the child is missing. The Mastery Test asks at full strength.
    const dealt = lodgeQuestions(pack, fake, save.settings, rng);
    const pool = (kind === 'gate' ? easeStudy(dealt, pack, save.attempts) : dealt).filter((q) => !picked.some((p) => p.id === q.id));
    if (pool.length === 0) break;
    const fresh = pool.filter((q) => !recent.has(q.id));
    const from = fresh.length > 0 ? fresh : pool;
    // Questions that are due for review come first, so the test checks what needs checking.
    const due = from.filter((q) => isDue(save.learning[q.objectiveId], now));
    const list = due.length > 0 && rng.next() < 0.5 ? due : from;
    picked.push(list[Math.floor(rng.next() * list.length)] as Question);
  }
  if (picked.length === 0) return save;
  const questions = picked.map((q) => presentQuestion(q, rng));
  return { ...save, rngState: rng.state, lastSummary: kind === 'gate' ? null : save.lastSummary, lodgeQuiz: { lodgeId, kind, tier, difficulty, questions, index: 0, right: 0 } };
}

/** How many a quiz needs right, out of how many. Gate 6 of 8. Mastery 9 of 10, so 90%. */
export const quizNeed = (q: Pick<LodgeQuiz, 'kind' | 'questions'>) => Math.min(q.questions.length, Math.ceil((LODGE_QUIZ[q.kind].need / LODGE_QUIZ[q.kind].questions) * q.questions.length));

function lodgeQuizAnswer(save: SaveData, optionId: string, now: number): SaveData {
  const t = save.lodgeQuiz;
  const q = t?.questions[t.index];
  if (!t || !q || t.result || t.outcome || !isAnswerFor(q, optionId)) return save;
  const correct = isCorrect(q, optionId);
  return {
    ...save,
    ...studied(save, q, correct, t.difficulty).patch,
    learning: recordAnswer(save.learning, q, correct, now, false),
    seenFacts: noteFacts(save, q, correct),
    recentQuestionIds: [...save.recentQuestionIds, q.id].slice(-RECENT_QUESTION_LIMIT),
    lodgeQuiz: { ...t, right: t.right + (correct ? 1 : 0), result: { optionId, correct } },
  };
}

/** Next question, or the result: passed once enough are right, failed once too many are missed. */
function lodgeQuizNext(save: SaveData, pack: Pack, now: number): SaveData {
  const t = save.lodgeQuiz;
  if (!t || !t.result || t.outcome) return save;
  const need = quizNeed(t);
  const asked = t.index + 1;
  const missed = asked - t.right;
  const outcome = t.right >= need && asked === t.questions.length ? 'passed' : missed > t.questions.length - need ? 'failed' : undefined;
  if (!outcome) {
    const { result: _done, ...rest } = t;
    return { ...save, lodgeQuiz: { ...rest, index: asked } };
  }
  if (outcome === 'failed') return { ...save, lodgeQuiz: { ...t, outcome } };
  if (t.kind === 'gate') return startLodge({ ...save, lodgeQuiz: { ...t, outcome } }, pack, t.lodgeId, t.tier, now, true);
  return passMastery(save, pack, t);
}

/** Gold: the patch, the Lodge's legendary, and a shiny of its prize creature. */
function passMastery(save: SaveData, pack: Pack, t: LodgeQuiz): SaveData {
  const lodge = lodgeById(pack, t.lodgeId);
  if (!lodge) return { ...save, lodgeQuiz: null };
  const id = (n: number) => `${save.profile.id}-companion-${save.nextId + n}`;
  const joined: Companion[] = [
    { instanceId: id(0), speciesId: lodge.legendaryId, bondXp: 0 },
    { instanceId: id(1), speciesId: lodge.prizeSpeciesId, bondXp: 0, shiny: true },
  ];
  const passed: SaveData = {
    ...save,
    companions: [...save.companions, ...joined],
    nextId: save.nextId + 2,
    lodgeTiers: { ...save.lodgeTiers, [lodge.id]: 'gold' },
    lodgeTestReady: (save.lodgeTestReady ?? []).filter((x) => x !== lodge.id),
    lodgeQuiz: { ...t, outcome: 'passed' },
  };
  const badges = earnedBadges(passed, pack);
  return {
    ...passed,
    badges,
    lastSummary: {
      expeditionId: `gold-${lodge.id}-${save.nextId}`,
      lodgeId: lodge.id,
      newPatch: 'gold',
      reward: { kind: 'creature', speciesId: lodge.legendaryId },
      answered: t.questions.length,
      correct: t.right,
      discoveryAssisted: false,
      souvenirId: null,
      cardsEarned: save.stateCards.length,
      newBadges: badges.filter((b) => !save.badges.includes(b)),
      ...milestone(save, passed),
    },
  };
}

/** Hatches a full egg at camp. */
function hatchEgg(save: SaveData, pack: Pack, eggId: string): SaveData {
  const egg = (save.eggs ?? []).find((x) => x.id === eggId);
  if (!egg || !eggReady(egg) || save.expedition || save.lodgeQuiz || save.masteryTest) return save;
  const rng = new Rng(save.rngState);
  const born = hatchling(pack, egg.kind, knownSpecies(save), rng);
  const instanceId = `${save.profile.id}-companion-${save.nextId}`;
  const hatched: SaveData = {
    ...save,
    rngState: rng.state,
    nextId: save.nextId + 1,
    eggs: (save.eggs ?? []).filter((x) => x !== egg),
    companions: [...save.companions, { instanceId, speciesId: born.speciesId, bondXp: 0, ...(born.shiny ? { shiny: true } : {}) }],
    hatched: { instanceId, kind: egg.kind },
    hatchedCount: (save.hatchedCount ?? 0) + 1,
  };
  return { ...hatched, badges: earnedBadges(hatched, pack) };
}

function startMastery(save: SaveData, pack: Pack, regionId: string, track: MedalTrack, now: number): SaveData {
  if (save.expedition || save.masteryTest) return save;
  if (!medalView(save.medals ?? {}, save.learning, pack, regionId, track, now).testReady) return save;
  const rng = new Rng(save.rngState);
  const questions = rng.shuffle(masteryQuestions(pack, regionId, track)).map((q) => presentQuestion(q, rng));
  if (questions.length === 0) return save;
  return { ...save, rngState: rng.state, lastSummary: null, masteryTest: { regionId, track, questions, index: 0, misses: 0 } };
}

function masteryAnswer(save: SaveData, optionId: string, now: number): SaveData {
  const t = save.masteryTest;
  const q = t?.questions[t.index];
  if (!t || !q || t.result || t.outcome) return save;
  const correct = isCorrect(q, optionId);
  return {
    ...save,
    learning: recordAnswer(save.learning, q, correct, now, false),
    masteryTest: { ...t, misses: t.misses + (correct ? 0 : 1), result: { optionId, correct } },
  };
}

/** A failed test is remembered by day, so the next try waits until tomorrow. */
function failMastery(save: SaveData, t: MasteryTest, now: number): SaveData {
  const key = medalKey(t.regionId, t.track);
  const medal = save.medals?.[key];
  const medals = medal ? { ...save.medals, [key]: { ...medal, failedDay: localDay(now) } } : save.medals ?? {};
  return { ...save, medals, masteryTest: { ...t, outcome: 'failed' } };
}

function masteryNext(save: SaveData, pack: Pack, now: number): SaveData {
  const t = save.masteryTest;
  if (!t || !t.result || t.outcome) return save;
  if (t.misses > MASTERY_MISSES_ALLOWED) return failMastery(save, t, now);
  if (t.index + 1 < t.questions.length) {
    const { result: _done, ...rest } = t;
    return { ...save, masteryTest: { ...rest, index: t.index + 1 } };
  }
  const medals = { ...save.medals, [medalKey(t.regionId, t.track)]: { level: 'platinum' as const, at: now } };
  const passed: SaveData = { ...save, medals, bankedPoints: (save.bankedPoints ?? 0) + medalPoints([{ regionId: t.regionId, track: t.track, level: 'platinum' }]), masteryTest: { ...t, outcome: 'passed' } };
  return { ...passed, badges: earnedBadges(passed, pack) };
}

/** Leaving mid-test uses up today's try, so quitting after a miss can't be used to start over. */
function closeMastery(save: SaveData, now: number): SaveData {
  const t = save.masteryTest;
  if (!t) return save;
  const ended = t.outcome ? save : failMastery(save, t, now);
  return { ...ended, masteryTest: null };
}

/** Sets a creature free. It keeps its level in the wild and can be called back any time. The first time pays Trail Points. */
function freeCompanion(save: SaveData, pack: Pack, instanceId: string): SaveData {
  const c = save.companions.find((o) => o.instanceId === instanceId);
  if (!c || save.expedition || save.companions.length <= 1) return save;
  const companions = save.companions.filter((o) => o !== c);
  const pays = !c.freedOnce;
  const freed: SaveData = {
    ...save,
    companions,
    wild: [...(save.wild ?? []), { ...c, freedOnce: true }],
    activeCompanionId: save.activeCompanionId === instanceId ? (companions[0] as Companion).instanceId : save.activeCompanionId,
    ...(save.lastTeamIds ? { lastTeamIds: save.lastTeamIds.filter((id) => id !== instanceId) } : {}),
    bankedPoints: (save.bankedPoints ?? 0) + (pays ? FREE_POINTS : 0),
    freedCount: (save.freedCount ?? 0) + (pays ? 1 : 0),
  };
  return { ...freed, badges: earnedBadges(freed, pack) };
}

/** The single state transition. Pure: an invalid or repeated command returns the same object, and callers skip the save. */
export function reduce(save: SaveData, cmd: Command, pack: Pack, now: number): SaveData {
  const e = save.expedition;
  const withExpedition = (next: Expedition): SaveData => (next === e ? save : { ...save, expedition: next });
  switch (cmd.type) {
    case 'start':
      return e || save.masteryTest || save.lodgeQuiz ? save : startExpedition(save, pack, cmd);
    case 'newDay':
      return e || save.visitorDay === cmd.day ? save : refreshOffers({ ...save, visitorDay: cmd.day }, pack);
    case 'setNight':
      return e || !!save.offersNight === cmd.night ? save : refreshOffers({ ...save, offersNight: cmd.night }, pack);
    case 'startLodge':
      return startLodge(save, pack, cmd.lodgeId, cmd.tier ?? 'bronze', now);
    case 'startLodgeTest':
      return (save.lodgeTestReady ?? []).includes(cmd.lodgeId) && !save.lodgeQuiz ? startLodgeQuiz(save, pack, cmd.lodgeId, 'mastery', 'gold', 'expert', now) : save;
    case 'lodgeQuizAnswer':
      return lodgeQuizAnswer(save, cmd.optionId, now);
    case 'lodgeQuizNext':
      return lodgeQuizNext(save, pack, now);
    case 'closeLodgeQuiz':
      return save.lodgeQuiz ? { ...save, lodgeQuiz: null } : save;
    case 'hatchEgg':
      return hatchEgg(save, pack, cmd.eggId);
    case 'dismissHatch':
      return save.hatched ? { ...save, hatched: null } : save;
    case 'startMastery':
      return startMastery(save, pack, cmd.regionId, cmd.track, now);
    case 'masteryAnswer':
      return masteryAnswer(save, cmd.optionId, now);
    case 'masteryNext':
      return masteryNext(save, pack, now);
    case 'closeMastery':
      return closeMastery(save, now);
    case 'selectCompanion':
      if (e?.prepared || !save.companions.some((c) => c.instanceId === cmd.instanceId) || save.activeCompanionId === cmd.instanceId) return save;
      return { ...save, activeCompanionId: cmd.instanceId, lastTeamIds: [cmd.instanceId], expedition: e ? { ...e, companionId: cmd.instanceId, teamIds: [cmd.instanceId] } : null };
    case 'toggleTeam': {
      if (!e || e.prepared || !save.companions.some((c) => c.instanceId === cmd.instanceId)) return save;
      const current = teamOf(e);
      const onTeam = current.includes(cmd.instanceId);
      if (onTeam ? current.length === 1 : current.length >= MAX_TEAM) return save;
      const teamIds = onTeam ? current.filter((id) => id !== cmd.instanceId) : [...current, cmd.instanceId];
      return { ...save, activeCompanionId: teamIds[0] as string, lastTeamIds: teamIds, expedition: { ...e, teamIds, companionId: teamIds[0] as string } };
    }
    case 'switchTo':
      return e?.battle ? switchTo(save, e, e.battle, cmd.instanceId, pack) : save;
    case 'buy':
      return e ? withExpedition(buy(e, cmd.item)) : save;
    case 'depart':
      return !e || e.prepared ? save : withExpedition({ ...e, prepared: true, xpAtStart: Object.fromEntries(save.companions.map((c) => [c.instanceId, c.bondXp])) });
    case 'revealClue':
      // `shown` makes a double click a no-op rather than a second purchase.
      if (!e || e.discovery !== 'searching' || cmd.shown !== e.cluesShown || e.cluesShown >= e.clueIds.length || e.points < ECONOMY.extraClue) return save;
      return withExpedition({ ...e, cluesShown: e.cluesShown + 1, points: e.points - ECONOMY.extraClue });
    case 'narrowSearch':
      return e ? withExpedition(narrowSearch(e)) : save;
    case 'useAtlas':
      if (!e || e.discovery !== 'searching' || e.atlasUsed) return save;
      return withExpedition({ ...e, atlasUsed: true });
    case 'guess':
      return guess(save, pack, cmd.locationId, now);
    case 'enterEncounter':
      return enterEncounter(save, pack, now);
    case 'chooseAction': {
      const b = e?.battle;
      if (!e || !b || b.phase !== 'choose') return save;
      if (b.mustSwitch) return save;
      if (cmd.action === 'tame') return startTame(save, e, b, pack);
      const allowed = b.befriending ? cmd.action === 'befriend' : cmd.action !== 'befriend' && canUse(b.combat, cmd.action);
      return allowed ? withExpedition({ ...e, battle: { ...b, phase: 'question', action: cmd.action } }) : save;
    }
    case 'changeMove':
      return e?.battle ? changeMove(save, e, e.battle) : save;
    case 'useSnack': {
      const b = e?.battle;
      if (!e || !b || !e.snack || b.phase !== 'choose' || b.befriending || b.mustSwitch || b.combat.playerHp >= b.combat.playerMaxHp) return save;
      return withExpedition({ ...e, snack: false, battle: { ...b, combat: heal(b.combat, SNACK_HEAL) } });
    }
    case 'answer':
      return answer(save, pack, cmd.optionId, now);
    case 'continue':
      return continueBattle(save, pack, now);
    case 'claimReward':
      return claimReward(save, pack, now);
    case 'abandon':
      if (!e || isExpeditionComplete(e)) return save;
      {
        const won = awardMedals(save.medals ?? {}, save.learning, pack, now);
        return refreshOffers({ ...save, medals: won.medals, bankedPoints: (save.bankedPoints ?? 0) + medalPoints(won.earned), expedition: null, recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT) }, pack);
      }
    case 'dismissSummary':
      return save.lastSummary ? { ...save, lastSummary: null } : save;
    case 'updateSettings':
      return { ...save, settings: { ...save.settings, ...cmd.patch } };
    case 'freeCompanion':
      return freeCompanion(save, pack, cmd.instanceId);
    case 'recallCompanion': {
      const c = (save.wild ?? []).find((o) => o.instanceId === cmd.instanceId);
      if (!c || e) return save;
      return { ...save, wild: (save.wild ?? []).filter((o) => o !== c), companions: [...save.companions, c] };
    }
    case 'seeGuide':
      return (save.guideSeen ?? []).includes(cmd.speciesId) ? save : { ...save, guideSeen: [...(save.guideSeen ?? []), cmd.speciesId] };
    case 'renameCompanion':
      return { ...save, companions: save.companions.map((c) => (c.instanceId === cmd.instanceId ? { ...c, nickname: cmd.nickname.slice(0, 20) } : c)) };
    case 'setShinyColors': {
      const colors = cmd.colors.filter((x) => /^[a-z]{1,12}$/.test(x)).slice(0, 2);
      return {
        ...save,
        companions: save.companions.map((c) => {
          if (c.instanceId !== cmd.instanceId || !c.shiny) return c;
          const { shinyColors: _, ...rest } = c;
          return colors.length ? { ...rest, shinyColors: colors } : rest;
        }),
      };
    }
    case 'ackEvolution': {
      const c = save.companions.find((o) => o.instanceId === cmd.instanceId);
      if (!c) return save;
      const sp = speciesOf(pack, c.speciesId);
      const stage = stageOf(c.bondXp, sp);
      // A branching creature's path is set for good once it has evolved.
      const settled = sp.paths && stage >= 2 && !c.path ? { path: pathOf(c) } : {};
      return { ...save, companions: save.companions.map((o) => (o === c ? { ...o, ...settled, stageSeen: stage } : o)) };
    }
    case 'resetProfile':
      return { ...newSave(pack, Math.floor(new Rng(save.rngState).next() * 0x7fffffff), save.profile.id, save.profile.displayName, save.profile.avatarId), settings: save.settings };
    case 'updateProfile':
      return { ...save, profile: { ...save.profile, ...cmd.patch } };
  }
}
