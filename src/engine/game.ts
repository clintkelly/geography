import { spaced } from '../content/geo';
import { DIFFICULTIES, type Clue, type Difficulty, type Pack, type Place, type Question, type Region } from '../content/types';
import { canUse, heal, resolveTurn, startCombat, type CombatAction, type CombatState, type TurnEvents } from './combat';
import { ECONOMY, PREP_ITEMS, SNACK_HEAL, STURDY_HP, type PrepItem } from './economy';
import { TRAIL_EVENTS, type TrailEvent } from './events';
import { isCorrect, pickQuestion, presentQuestion } from './questions';
import { Rng } from './rng';
import { TRAIL_STOPS, walkTrail, type StopKind, type TrailLength } from './trail';

export const SCHEMA_VERSION = 4;
const RECALL_CHANCE = 0.4;
export const BOND_BONUS_XP = 10;
const RECENT_QUESTION_LIMIT = 24;

export const BALANCE = {
  playerMaxHp: 12,
  playerAttack: 3,
  regularHp: 10,
  guardianHp: 14,
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
}

export interface Battle {
  id: string;
  slotIndex: number;
  combat: CombatState;
  phase: 'choose' | 'question' | 'feedback';
  /** A snapshot with options in display order, so content updates can't change a saved turn. */
  question: Question;
  action?: CombatAction | 'befriend';
  result?: TurnResult;
  /** The target is worn out and only befriending remains. */
  befriending?: boolean;
  befriended?: boolean;
}

export interface EventState {
  id: string;
  slotIndex: number;
  eventId: string;
  question: Question;
  result?: Omit<TurnResult, 'events'>;
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
}

export const DEFAULT_SETTINGS: Settings = {
  minDifficulty: 'scout',
  maxDifficulty: 'expert',
  lastDifficulty: 'scout',
  lastRegionId: 'us-west',
  lastTrail: 'standard',
  muted: false,
  volume: 0.7,
};

export interface Companion {
  instanceId: string;
  speciesId: string;
  bondXp: number;
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
  | { type: 'chooseAction'; action: CombatAction | 'befriend' }
  | { type: 'useSnack' }
  | { type: 'answer'; optionId: string }
  | { type: 'continue' }
  | { type: 'claimReward' }
  | { type: 'abandon' }
  | { type: 'dismissSummary' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
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

/** Two sightings per region of creatures that live there. The featured creature comes first until it is befriended. */
export function makeOffers(save: Pick<SaveData, 'nextId' | 'companions'>, pack: Pack, rng: Rng): { offers: Offer[]; nextId: number } {
  const owned = new Set(save.companions.map((c) => c.speciesId));
  let nextId = save.nextId;
  const offers = pack.regions.flatMap((region) => {
    const unowned = rng.shuffle(pack.species.filter((s) => s.homes.includes(region.id) && !owned.has(s.id)).map((s) => s.id));
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
  const locals = pack.species.filter((s) => s.homes.includes(cmd.regionId) && s.id !== pack.featuredSpeciesId).map((s) => s.id);
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

function dealQuestion(save: SaveData, e: Expedition, slot: Slot, pack: Pack): { e: Expedition; question: Question } {
  const rng = new Rng(e.rngState);
  const context = { asked: e.askedQuestionIds, recent: save.recentQuestionIds, locationId: slot.locationId };
  const pool = questionPool(pack, e);
  const seen = new Set(save.seenFacts);
  const recall = pool.filter((q) => q.recallOf && seen.has(q.recallOf) && !e.askedQuestionIds.includes(q.id));
  const wantRecall = rng.next() < RECALL_CHANCE;
  // A question about a Field Note only appears once the child has had the chance to read it.
  const picked = wantRecall && recall.length > 0 ? pickQuestion(recall, context, rng) : pickQuestion(pool.filter((q) => !q.recallOf), context, rng);
  const question = presentQuestion(picked, rng);
  return { e: { ...e, rngState: rng.state, askedQuestionIds: [...e.askedQuestionIds, picked.id] }, question };
}

function enterEncounter(save: SaveData, pack: Pack): SaveData {
  const e = save.expedition;
  if (!e || !e.prepared || e.discovery !== 'found' || e.battle || e.event) return save;
  const slotIndex = currentSlotIndex(e);
  const slot = e.slots[slotIndex];
  if (!slot) return save;

  if (slot.kind === 'event') {
    const dealt = dealQuestion(save, e, slot, pack);
    const event: EventState = { id: `${e.id}-event-${save.nextId}`, slotIndex, eventId: slot.eventId as string, question: dealt.question };
    return { ...save, nextId: save.nextId + 1, expedition: { ...dealt.e, event, retreated: false } };
  }

  const guardian = slot.kind === 'guardian';
  const companion = activeCompanion(save);
  const started = startCombat({
    playerMaxHp: BALANCE.playerMaxHp + (e.sturdy ? STURDY_HP : 0),
    playerAttack: BALANCE.playerAttack,
    special: pack.species.find((s) => s.id === companion.speciesId)?.special.template ?? 'strong',
    opponentMaxHp: guardian ? BALANCE.guardianHp : BALANCE.regularHp,
    enemyPattern: BALANCE.enemyPattern,
    maxTurns: guardian ? BALANCE.guardianMaxTurns : BALANCE.regularMaxTurns,
  });
  const combat = e.extraCharge ? { ...started, charge: 1 } : started;
  const dealt = dealQuestion(save, e, slot, pack);
  const battle: Battle = { id: `${e.id}-battle-${save.nextId}`, slotIndex, combat, phase: 'choose', question: dealt.question };
  return { ...save, nextId: save.nextId + 1, expedition: { ...dealt.e, battle, retreated: false } };
}

/** Records a Field Note as seen once it has been shown after a correct answer. */
function noteFacts(save: SaveData, q: Question, correct: boolean): string[] {
  return correct && q.noteId && !save.seenFacts.includes(q.noteId) ? [...save.seenFacts, q.noteId] : save.seenFacts;
}

function pointsFor(q: Question, correct: boolean): number {
  return correct && q.recallOf ? ECONOMY.recallBonus : 0;
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
  const { state: combat, events } = befriending
    ? { state: b.combat, events: { damageDealt: 0, damageTaken: 0, blocked: 0, healed: 0 } }
    : resolveTurn(b.combat, b.action as CombatAction, correct);
  const attempt: Attempt = {
    id: `${b.id}-answer-${e.answered + 1}`,
    context: 'battle',
    itemId: b.question.id,
    itemVersion: b.question.version,
    objectiveId: b.question.objectiveId,
    submitted: optionId,
    correct,
    timestamp: now,
    assisted: false,
    expeditionId: e.id,
    battleId: b.id,
    difficulty: e.difficulty,
  };

  const slot = e.slots[b.slotIndex] as Slot;
  const huntWon = befriending ? correct : combat.outcome === 'victory' && (slot.kind !== 'guardian' || e.reward.kind !== 'creature');
  // The answer, stop win, points, card and any find all commit together in this one save.
  const slots = e.slots.map((s, i) => (i === b.slotIndex && huntWon ? { ...s, status: 'won' as const } : s));
  const midTrailFind = huntWon && slot.kind === 'regular' && battlesWon(e) === 1 && e.souvenirId && !e.foundSouvenirId;
  const cardId = earnCard(save, pack, b.question, correct);
  const result: TurnResult = cardId ? { optionId, correct, events, cardId } : { optionId, correct, events };
  return {
    ...save,
    attempts: [...save.attempts, attempt],
    stateCards: cardId ? [...save.stateCards, cardId] : save.stateCards,
    seenFacts: noteFacts(save, b.question, correct),
    souvenirIds: midTrailFind && e.souvenirId ? [...save.souvenirIds, e.souvenirId] : save.souvenirIds,
    expedition: {
      ...e,
      slots,
      foundSouvenirId: midTrailFind ? e.souvenirId : e.foundSouvenirId,
      points: e.points + (correct && !befriending ? ECONOMY.perCorrectAnswer : 0) + pointsFor(b.question, correct),
      answered: e.answered + 1,
      correct: e.correct + (correct ? 1 : 0),
      battle: { ...b, combat, phase: 'feedback', result, ...(befriending && correct ? { befriended: true } : {}) },
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
  return {
    ...save,
    attempts: [...save.attempts, attempt],
    stateCards: cardId ? [...save.stateCards, cardId] : save.stateCards,
    seenFacts: noteFacts(save, ev.question, correct),
    expedition: {
      ...e,
      points: e.points + (correct ? def.points : 0) + pointsFor(ev.question, correct),
      snack: e.snack || (correct && !!def.snack),
      freeClue: correct && !!def.freeClue,
      answered: e.answered + 1,
      correct: e.correct + (correct ? 1 : 0),
      slots: e.slots.map((s, i) => (i === ev.slotIndex ? { ...s, status: 'won' as const } : s)),
      event: { ...ev, result: cardId ? { optionId, correct, cardId } : { optionId, correct } },
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

function continueBattle(save: SaveData, pack: Pack): SaveData {
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

  const dealt = dealQuestion(save, e, slot, pack);
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
    attempts: [...save.attempts, attempt],
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
  const companions = save.companions.map((c) => (c.instanceId === e.companionId ? { ...c, bondXp: c.bondXp + leftoverXp + bonus } : c));
  if (!applied && reward.kind === 'creature' && !owned) {
    companions.push({ instanceId: `${save.profile.id}-companion-${save.nextId}`, speciesId: reward.speciesId, bondXp: 0 });
  }

  return refreshOffers(
    {
      ...save,
      companions,
      nextId: save.nextId + 1,
      completedExpeditions: save.completedExpeditions + (applied ? 0 : 1),
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
      return enterEncounter(save, pack);
    case 'chooseAction': {
      const b = e?.battle;
      if (!e || !b || b.phase !== 'choose') return save;
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
      return continueBattle(save, pack);
    case 'claimReward':
      return claimReward(save, pack);
    case 'abandon':
      if (!e || isExpeditionComplete(e)) return save;
      return refreshOffers({ ...save, expedition: null, recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT) }, pack);
    case 'dismissSummary':
      return save.lastSummary ? { ...save, lastSummary: null } : save;
    case 'updateSettings':
      return { ...save, settings: { ...save.settings, ...cmd.patch } };
    case 'updateProfile':
      return { ...save, profile: { ...save.profile, ...cmd.patch } };
  }
}
