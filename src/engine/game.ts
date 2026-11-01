import { spaced } from '../content/geo';
import { DIFFICULTIES, type Clue, type Difficulty, type Pack, type Place, type Question, type Region } from '../content/types';
import { canUse, heal, MAX_CHARGE, resolveTurn, startCombat, type CombatAction, type CombatState, type TurnEvents } from './combat';
import { ECONOMY, PREP_ITEMS, SNACK_HEAL, STURDY_HP, type PrepItem } from './economy';
import { TRAIL_EVENTS, type TrailEvent } from './events';
import { isDue, recordAnswer, type Learning } from './learning';
import { levelOf, speciesOf, STAGES, stageOf, XP, xpFor } from './progression';
import { isCorrect, pickQuestion, presentQuestion } from './questions';
import { earnedBadges } from './badges';
import { cardLevelOf, type CardLevel } from './cards';
import { availableRare, rareChance, trailScore } from './luck';
import { streakReward } from './streak';
import { Rng } from './rng';
import { TRAIL_STOPS, walkTrail, type StopKind, type TrailLength } from './trail';

export const SCHEMA_VERSION = 5;
const RECALL_CHANCE = 0.4;
const REVIEW_CHANCE = 0.5;
const ATTEMPT_LIMIT = 500;
export const BOND_BONUS_XP = 10;
const RECENT_QUESTION_LIMIT = 24;

export const BALANCE = {
  enemyPattern: [2, 2, 4],
  regularMaxTurns: 8,
  guardianMaxTurns: 10,
} as const;

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
  rngState: number;
  reward: Reward;
  companionId: string;
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
  /** Badges earned by this trip. */
  newBadges?: string[];
  tamedIds?: string[];
}

export interface Settings {
  minDifficulty: Difficulty;
  maxDifficulty: Difficulty;
  lastDifficulty: Difficulty;
  lastRegionId: string;
  lastTrail: TrailLength;
  muted: boolean;
  /** 0 to 1. */
  volume: number;
  musicVolume: number;
  /** Regions the parent has turned off for this child. */
  disabledRegions: string[];
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
  tamedAny?: boolean;
  rareFound?: boolean;
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
  | { type: 'start'; offerId: string; regionId: string; difficulty: Difficulty; trail: TrailLength }
  | { type: 'selectCompanion'; instanceId: string }
  | { type: 'buy'; item: PrepItem }
  | { type: 'depart' }
  | { type: 'revealClue'; shown: number }
  | { type: 'narrowSearch' }
  | { type: 'useAtlas' }
  | { type: 'guess'; locationId: string }
  | { type: 'enterEncounter' }
  | { type: 'chooseAction'; action: CombatAction | 'befriend' | 'tame' }
  | { type: 'useSnack' }
  | { type: 'answer'; optionId: string }
  | { type: 'continue' }
  | { type: 'claimReward' }
  | { type: 'abandon' }
  | { type: 'dismissSummary' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'renameCompanion'; instanceId: string; nickname: string }
  | { type: 'ackEvolution'; instanceId: string }
  | { type: 'resetProfile' }
  | { type: 'updateProfile'; patch: Partial<Pick<SaveData['profile'], 'displayName' | 'avatarId'>> };

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

function questionPool(pack: Pack, e: Pick<Expedition, 'regionId' | 'difficulty'>): Question[] {
  const region = pack.questions.filter((q) => q.regionId === e.regionId);
  const tier = region.filter((q) => q.difficulty === e.difficulty);
  return tier.length > 0 ? tier : region;
}

function nearestFirst(places: readonly Place[], target: Place): Place[] {
  const d = (p: Place) => Math.hypot(p.lonLat[0] - target.lonLat[0], p.lonLat[1] - target.lonLat[1]);
  return [...places].sort((a, b) => d(a) - d(b));
}

/** Every place in a region has been found: its map is full. */
export function isRegionComplete(found: readonly string[], pack: Pack, regionId: string): boolean {
  return pack.places.filter((p) => p.regionId === regionId).every((p) => found.includes(p.id));
}

/** Two sightings per region of creatures that live there. The featured creature comes first until it is befriended. */
export function makeOffers(save: Pick<SaveData, 'nextId' | 'companions'> & Partial<Pick<SaveData, 'foundPlaces'>>, pack: Pack, rng: Rng): { offers: Offer[]; nextId: number } {
  const owned = new Set(save.companions.map((c) => c.speciesId));
  let nextId = save.nextId;
  const offers = pack.regions.flatMap((region) => {
    const mapDone = !!save.foundPlaces && isRegionComplete(save.foundPlaces, pack, region.id);
    const unowned = rng.shuffle(pack.species.filter((s) => s.homes.includes(region.id) && !owned.has(s.id) && (!s.rare || mapDone)).map((s) => s.id));
    const ordered = [...unowned.filter((id) => id === pack.featuredSpeciesId), ...unowned.filter((id) => id !== pack.featuredSpeciesId)];
    const rewards: Reward[] = ordered.slice(0, 2).map((speciesId) => ({ kind: 'creature', speciesId }));
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
  if (e.difficulty === 'expert') candidates = inRegion;
  else {
    // Harder trails offer neighboring places, which are easier to confuse.
    const pool = e.difficulty === 'scout' ? rng.shuffle(others) : nearestFirst(others, target);
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
  const allowed = allowedDifficulties(save.settings, region);
  const difficulty = allowed.includes(cmd.difficulty) ? cmd.difficulty : (allowed[0] as Difficulty);

  const rng = new Rng(save.rngState);
  const id = `expedition-${save.nextId}`;
  const places = pack.places.filter((p) => p.regionId === cmd.regionId && pack.clues.some((c) => c.targetId === p.id));
  if (places.length === 0) throw new Error(`No discoverable places in ${cmd.regionId}`);

  const kinds = TRAIL_STOPS[cmd.trail];
  const route = walkTrail(places, kinds.length, rng);
  // A small region shortens the trail from the middle, keeping the final showdown.
  const stops = kinds.length > route.length ? [...kinds.slice(0, route.length - 1), 'guardian' as const] : kinds;
  const locals = pack.species.filter((s) => s.homes.includes(cmd.regionId) && s.id !== pack.featuredSpeciesId && !s.rare).map((s) => s.id);
  const target = offer.reward.kind === 'creature' ? offer.reward.speciesId : (rng.shuffle(locals)[0] as string);
  const opponents = rng.shuffle(locals.filter((id) => id !== target));
  const events = rng.shuffle(TRAIL_EVENTS);
  let battles = 0;
  let eventCount = 0;
  const slots: Slot[] = stops.map((kind, i) => {
    const locationId = (route[i] as Place).id;
    if (kind === 'event') return { kind, locationId, opponentId: '', eventId: (events[eventCount++] as TrailEvent).id, status: 'pending' };
    if (kind === 'guardian') return { kind, locationId, opponentId: target, status: 'pending' };
    return { kind, locationId, opponentId: opponents[battles++ % opponents.length] as string, status: 'pending' };
  });

  const blank: Expedition = {
    id,
    regionId: cmd.regionId,
    difficulty,
    trail: cmd.trail,
    rngState: 0,
    reward: offer.reward,
    companionId: save.activeCompanionId,
    prepared: false,
    points: ECONOMY.startingPoints,
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
  };
  const expedition = setupSearch(blank, pack, rng, (slots[0] as Slot).locationId);
  return {
    ...save,
    expedition: { ...expedition, rngState: Math.floor(rng.next() * 0x7fffffff) },
    lastSummary: null,
    nextId: save.nextId + 1,
    rngState: rng.state,
    settings: { ...save.settings, lastDifficulty: difficulty, lastRegionId: cmd.regionId, lastTrail: cmd.trail },
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
  const pool = questionPool(pack, e);
  const seen = new Set(save.seenFacts);
  const fresh = (q: Question) => !e.askedQuestionIds.includes(q.id);
  const recall = pool.filter((q) => q.recallOf && seen.has(q.recallOf) && fresh(q));
  const wantRecall = rng.next() < RECALL_CHANCE;
  const dueNow = pool.filter((q) => !q.recallOf && fresh(q) && isDue(save.learning[q.objectiveId], now));
  const wantReview = rng.next() < REVIEW_CHANCE;
  // A question about a Field Note only appears once the child has had the chance to read it.
  const source = wantRecall && recall.length > 0 ? recall : wantReview && dueNow.length > 0 ? dueNow : pool.filter((q) => !q.recallOf);
  const picked = pickQuestion(source, context, rng);
  const question = presentQuestion(picked, rng);
  return { e: { ...e, rngState: rng.state, askedQuestionIds: [...e.askedQuestionIds, picked.id] }, question };
}

/** Better play makes the next battle more likely to be a rare creature. */
function rollRare(save: SaveData, e: Expedition, slotIndex: number, pack: Pack): Expedition {
  const slot = e.slots[slotIndex];
  if (!slot || slot.kind !== 'regular' || slot.rareRolled) return e;
  const rng = new Rng(e.rngState);
  const rare = availableRare(pack, e.regionId, save.companions.map((c) => c.speciesId));
  const hit = !!rare && rng.next() < rareChance(trailScore(e));
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
  const companion = activeCompanion(save);
  const species = speciesOf(pack, companion.speciesId);
  const stats = STAGES[stageOf(companion.bondXp, species)];
  const started = startCombat({
    playerMaxHp: stats.maxHp + (e.sturdy ? STURDY_HP : 0),
    playerAttack: stats.attack,
    special: species.special.template,
    specialBonus: stats.specialBonus,
    opponentMaxHp: guardian ? stats.finalHp : stats.regularHp + (slot.rare ? RARE_EXTRA_HP : 0),
    enemyPattern: BALANCE.enemyPattern,
    maxTurns: guardian ? BALANCE.guardianMaxTurns : BALANCE.regularMaxTurns,
  });
  const combat = { ...started, charge: Math.min(MAX_CHARGE, stats.startCharge + (e.extraCharge ? 1 : 0)) };
  const dealt = dealQuestion(save, e, slot, pack, now);
  const battle: Battle = { id: `${e.id}-battle-${save.nextId}`, slotIndex, combat, phase: 'choose', question: dealt.question };
  return { ...save, nextId: save.nextId + 1, expedition: { ...dealt.e, battle, retreated: false } };
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

/** Bold Befriend: an unowned creature at half HP or less, for 2 charge. Once started, it can continue at no cost. */
export function canTame(save: SaveData, b: Battle, slot: Slot): boolean {
  if (slot.kind !== 'regular' || slot.rare || b.befriending || b.combat.outcome !== 'active') return false;
  if (save.companions.some((c) => c.speciesId === slot.opponentId)) return false;
  if ((b.tameHits ?? 0) > 0) return true;
  return b.combat.charge >= TAME_COST && b.combat.opponentHp * 2 <= b.combat.opponentMaxHp;
}

/** A Bold Befriend question is one level harder than the trail, and never one the child just saw. */
function startTame(save: SaveData, e: Expedition, b: Battle, pack: Pack): SaveData {
  const slot = e.slots[b.slotIndex] as Slot;
  if (!canTame(save, b, slot)) return save;
  const harder = DIFFICULTIES[Math.min(DIFFICULTIES.indexOf(e.difficulty) + 1, DIFFICULTIES.length - 1)] as Difficulty;
  const pool = questionPool(pack, { regionId: e.regionId, difficulty: harder }).filter((q) => !q.recallOf);
  const rng = new Rng(e.rngState);
  const picked = pickQuestion(pool, { asked: e.askedQuestionIds, recent: save.recentQuestionIds, locationId: slot.locationId }, rng);
  const question = presentQuestion(picked, rng);
  return { ...save, expedition: { ...e, rngState: rng.state, askedQuestionIds: [...e.askedQuestionIds, picked.id], battle: { ...b, phase: 'question', action: 'tame', question } } };
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
  if (!b.question.options.some((o) => o.id === optionId)) return save;

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
  const charged = critical && resolved.state.outcome === 'active' ? { ...resolved.state, charge: Math.min(MAX_CHARGE, resolved.state.charge + 1) } : resolved.state;
  const streak = correct ? (e.streak ?? 0) + 1 : 0;
  const milestone = streakReward(streak);
  const roomToHeal = charged.outcome === 'active' ? Math.min(milestone?.heal ?? 0, charged.playerMaxHp - charged.playerHp) : 0;
  const combat = roomToHeal > 0 ? { ...charged, playerHp: charged.playerHp + roomToHeal } : charged;
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
  const result: TurnResult = { optionId, correct, events, ...(cardId ? { cardId } : {}), ...(critical ? { critical } : {}), ...(cardUp ? { cardUp } : {}) };
  // Winning a stop earns XP once, because a stop can only be won once.
  const paidXp = huntWon && slot.kind !== 'event'
    ? save.companions.map((c) => (c.instanceId === e.companionId ? { ...c, bondXp: c.bondXp + xpFor(XP.battleWon, e.difficulty) } : c))
    : save.companions;
  const companions = joined ? [...paidXp, { instanceId: `${save.profile.id}-companion-${save.nextId}`, speciesId: slot.opponentId, bondXp: 0 }] : paidXp;
  return {
    ...save,
    attempts: [...save.attempts, attempt].slice(-ATTEMPT_LIMIT),
    companions,
    nextId: save.nextId + (joined ? 1 : 0),
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
      battle: { ...b, combat, phase: 'feedback', result, tameHits, ...((befriending && correct) || tamed ? { befriended: true } : {}) },
    },
  };
}

function answerEvent(save: SaveData, pack: Pack, optionId: string, now: number): SaveData {
  const e = save.expedition as Expedition;
  const ev = e.event as EventState;
  if (!ev.question.options.some((o) => o.id === optionId)) return save;
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
  if (!next) return e;
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
  const { result: _result, action: _action, ...rest } = b;
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
  if (e.difficulty === 'expert' || e.narrowed || e.discovery !== 'searching' || e.points < ECONOMY.narrowSearch) return e;
  const wrong = e.candidateIds.filter((id) => id !== e.targetId && !e.guesses.includes(id));
  return { ...e, narrowed: true, removedIds: wrong.slice(0, 2), points: e.points - ECONOMY.narrowSearch };
}

function claimReward(save: SaveData, pack: Pack): SaveData {
  const e = save.expedition;
  if (!e || !isExpeditionComplete(e)) return save;

  const { reward } = e;
  const applied = save.appliedRewardIds.includes(e.id);
  const owned = save.companions.some((c) => reward.kind === 'creature' && c.speciesId === reward.speciesId);
  const leftoverXp = applied ? 0 : e.points * ECONOMY.xpPerLeftoverPoint;
  const bonus = !applied && reward.kind === 'bond' ? reward.xp : 0;
  const finishXp = applied ? 0 : xpFor(XP.expeditionDone, e.difficulty);
  const taken = save.companions.find((c) => c.instanceId === e.companionId);
  const levelBefore = levelOf(Math.max(0, (taken?.bondXp ?? 0) - e.slots.filter((s) => s.kind !== 'event').length * xpFor(XP.battleWon, e.difficulty)));
  const companions = save.companions.map((c) => (c.instanceId === e.companionId ? { ...c, bondXp: c.bondXp + leftoverXp + bonus + finishXp } : c));
  const levelAfter = levelOf(companions.find((c) => c.instanceId === e.companionId)?.bondXp ?? 0);
  if (!applied && reward.kind === 'creature' && !owned) {
    companions.push({ instanceId: `${save.profile.id}-companion-${save.nextId}`, speciesId: reward.speciesId, bondXp: 0 });
  }

  const claimed: SaveData = { ...save, companions, completedExpeditions: save.completedExpeditions + (applied ? 0 : 1), expertTrails: save.expertTrails + (!applied && e.difficulty === 'expert' ? 1 : 0) };
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
        reward,
        answered: e.answered,
        correct: e.correct,
        discoveryAssisted: e.anyAssisted,
        souvenirId: e.foundSouvenirId,
        cardsEarned: save.stateCards.length,
        xpGained: leftoverXp + bonus + finishXp,
        ...(levelAfter > levelBefore ? { levelUp: levelAfter } : {}),
        newBadges,
        ...(e.tamedIds ? { tamedIds: e.tamedIds } : {}),
      },
    },
    pack,
  );
}

/** The single state transition. Pure: an invalid or repeated command returns the same object, and callers skip the save. */
export function reduce(save: SaveData, cmd: Command, pack: Pack, now: number): SaveData {
  const e = save.expedition;
  const withExpedition = (next: Expedition): SaveData => (next === e ? save : { ...save, expedition: next });
  switch (cmd.type) {
    case 'start':
      return e ? save : startExpedition(save, pack, cmd);
    case 'selectCompanion':
      if (e?.prepared || !save.companions.some((c) => c.instanceId === cmd.instanceId) || save.activeCompanionId === cmd.instanceId) return save;
      return { ...save, activeCompanionId: cmd.instanceId, expedition: e ? { ...e, companionId: cmd.instanceId } : null };
    case 'buy':
      return e ? withExpedition(buy(e, cmd.item)) : save;
    case 'depart':
      return !e || e.prepared ? save : withExpedition({ ...e, prepared: true });
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
      if (cmd.action === 'tame') return startTame(save, e, b, pack);
      const allowed = b.befriending ? cmd.action === 'befriend' : cmd.action !== 'befriend' && canUse(b.combat, cmd.action);
      return allowed ? withExpedition({ ...e, battle: { ...b, phase: 'question', action: cmd.action } }) : save;
    }
    case 'useSnack': {
      const b = e?.battle;
      if (!e || !b || !e.snack || b.phase !== 'choose' || b.befriending || b.combat.playerHp >= b.combat.playerMaxHp) return save;
      return withExpedition({ ...e, snack: false, battle: { ...b, combat: heal(b.combat, SNACK_HEAL) } });
    }
    case 'answer':
      return answer(save, pack, cmd.optionId, now);
    case 'continue':
      return continueBattle(save, pack, now);
    case 'claimReward':
      return claimReward(save, pack);
    case 'abandon':
      if (!e || isExpeditionComplete(e)) return save;
      return refreshOffers({ ...save, expedition: null, recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT) }, pack);
    case 'dismissSummary':
      return save.lastSummary ? { ...save, lastSummary: null } : save;
    case 'updateSettings':
      return { ...save, settings: { ...save.settings, ...cmd.patch } };
    case 'renameCompanion':
      return { ...save, companions: save.companions.map((c) => (c.instanceId === cmd.instanceId ? { ...c, nickname: cmd.nickname.slice(0, 20) } : c)) };
    case 'ackEvolution': {
      const c = save.companions.find((o) => o.instanceId === cmd.instanceId);
      if (!c) return save;
      const stage = stageOf(c.bondXp, speciesOf(pack, c.speciesId));
      return { ...save, companions: save.companions.map((o) => (o === c ? { ...o, stageSeen: stage } : o)) };
    }
    case 'resetProfile':
      return { ...newSave(pack, Math.floor(new Rng(save.rngState).next() * 0x7fffffff), save.profile.id, save.profile.displayName, save.profile.avatarId), settings: save.settings };
    case 'updateProfile':
      return { ...save, profile: { ...save.profile, ...cmd.patch } };
  }
}
