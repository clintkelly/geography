import type { Pack, Question } from '../content/types';
import { resolveTurn, startCombat, type CombatAction, type CombatState, type TurnEvents } from './combat';
import { isCorrect, pickQuestion, presentQuestion } from './questions';
import { Rng } from './rng';

export const SCHEMA_VERSION = 1;
export const BOND_BONUS_XP = 10;
const RECENT_QUESTION_LIMIT = 12;

/** Milestone 1 balance. See docs/ENGINEERING_PLAN.md: softer than the PRD's until Guard and Special exist. */
export const BALANCE = {
  playerMaxHp: 12,
  regularHp: 10,
  guardianHp: 14,
  enemyPattern: [1, 2, 2],
  regularMaxTurns: 8,
  guardianMaxTurns: 10,
} as const;

export type Reward = { kind: 'souvenir'; souvenirId: string } | { kind: 'bond'; xp: number };

export interface Offer {
  id: string;
  reward: Reward;
}

export interface Slot {
  kind: 'regular' | 'guardian';
  locationId: string;
  opponentId: string;
  status: 'pending' | 'won';
}

export interface TurnResult {
  optionId: string;
  correct: boolean;
  events: TurnEvents;
}

export interface Battle {
  id: string;
  slotIndex: number;
  combat: CombatState;
  phase: 'choose' | 'question' | 'feedback';
  /** A snapshot with options in display order, so content updates can't change a saved turn. */
  question: Question;
  action?: CombatAction;
  result?: TurnResult;
}

export interface Expedition {
  id: string;
  rngState: number;
  reward: Reward;
  targetId: string;
  candidateIds: string[];
  clueIds: string[];
  cluesShown: number;
  atlasUsed: boolean;
  guesses: string[];
  discovery: 'searching' | 'found';
  discoveryAssisted: boolean;
  slots: Slot[];
  battle: Battle | null;
  askedQuestionIds: string[];
  retreated: boolean;
  answered: number;
  correct: number;
}

export interface Attempt {
  id: string;
  context: 'discovery' | 'battle';
  itemId: string;
  itemVersion: number;
  objectiveId: string;
  submitted: string;
  correct: boolean;
  timestamp: number;
  assisted: boolean;
  expeditionId: string;
  battleId?: string;
}

export interface Summary {
  expeditionId: string;
  reward: Reward;
  answered: number;
  correct: number;
  discoveryAssisted: boolean;
}

export interface SaveData {
  schemaVersion: number;
  contentVersion: string;
  profile: { id: string; displayName: string; avatarId: string };
  companion: { instanceId: string; speciesId: string; bondXp: number };
  souvenirIds: string[];
  completedExpeditions: number;
  nextId: number;
  rngState: number;
  offer: Offer;
  expedition: Expedition | null;
  attempts: Attempt[];
  recentQuestionIds: string[];
  appliedRewardIds: string[];
  lastSummary: Summary | null;
}

export type Command =
  | { type: 'start' }
  | { type: 'revealClue' }
  | { type: 'useAtlas' }
  | { type: 'guess'; locationId: string }
  | { type: 'enterEncounter' }
  | { type: 'chooseAction'; action: CombatAction }
  | { type: 'answer'; optionId: string }
  | { type: 'continue' }
  | { type: 'claimReward' }
  | { type: 'abandon' }
  | { type: 'dismissSummary' };

export function currentSlotIndex(e: Expedition): number {
  return e.slots.findIndex((s) => s.status === 'pending');
}

export function isExpeditionComplete(e: Expedition): boolean {
  return e.discovery === 'found' && !e.battle && currentSlotIndex(e) === -1;
}

function makeOffer(save: SaveData, pack: Pack, rng: Rng, owned: readonly string[]): { offer: Offer; nextId: number } {
  const unowned = pack.souvenirs.filter((s) => !owned.includes(s.id));
  const pick = rng.shuffle(unowned)[0];
  const reward: Reward = pick ? { kind: 'souvenir', souvenirId: pick.id } : { kind: 'bond', xp: BOND_BONUS_XP };
  return { offer: { id: `offer-${save.nextId}`, reward }, nextId: save.nextId + 1 };
}

export function newSave(pack: Pack, seed: number, profileId: string): SaveData {
  const base: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: pack.version,
    profile: { id: profileId, displayName: 'Explorer', avatarId: 'explorer' },
    companion: { instanceId: `${profileId}-companion-1`, speciesId: pack.starterSpeciesId, bondXp: 0 },
    souvenirIds: [],
    completedExpeditions: 0,
    nextId: 1,
    rngState: seed,
    offer: { id: '', reward: { kind: 'bond', xp: 0 } },
    expedition: null,
    attempts: [],
    recentQuestionIds: [],
    appliedRewardIds: [],
    lastSummary: null,
  };
  return refreshOffer(base, pack);
}

function refreshOffer(save: SaveData, pack: Pack): SaveData {
  const rng = new Rng(save.rngState);
  const { offer, nextId } = makeOffer(save, pack, rng, save.souvenirIds);
  return { ...save, offer, nextId, rngState: rng.state };
}

function startExpedition(save: SaveData, pack: Pack): SaveData {
  const rng = new Rng(save.rngState);
  const id = `expedition-${save.nextId}`;
  const places = rng.shuffle(pack.places.filter((p) => pack.clues.some((c) => c.targetId === p.id)));
  const target = places[0];
  if (!target) throw new Error('No discoverable places in pack');

  const candidateIds = rng.shuffle(places.slice(0, 4).map((p) => p.id));
  const clueIds = rng.shuffle(pack.clues.filter((c) => c.targetId === target.id)).map((c) => c.id);
  const regulars = rng.shuffle(pack.regularOpponentIds);
  const guardian = rng.shuffle(pack.guardianIds)[0] as string;
  const route = [target.id, ...places.slice(1, 3).map((p) => p.id)];
  const slots: Slot[] = [
    { kind: 'regular', locationId: route[0] as string, opponentId: regulars[0] as string, status: 'pending' },
    { kind: 'regular', locationId: route[1] as string, opponentId: regulars[1] as string, status: 'pending' },
    { kind: 'guardian', locationId: route[2] as string, opponentId: guardian, status: 'pending' },
  ];

  const expedition: Expedition = {
    id,
    rngState: rng.next() * 0x7fffffff,
    reward: save.offer.reward,
    targetId: target.id,
    candidateIds,
    clueIds,
    cluesShown: 1,
    atlasUsed: false,
    guesses: [],
    discovery: 'searching',
    discoveryAssisted: false,
    slots,
    battle: null,
    askedQuestionIds: [],
    retreated: false,
    answered: 0,
    correct: 0,
  };
  return { ...save, expedition, lastSummary: null, nextId: save.nextId + 1, rngState: rng.state };
}

function dealQuestion(save: SaveData, e: Expedition, slot: Slot, pack: Pack): { e: Expedition; question: Question } {
  const rng = new Rng(e.rngState);
  const picked = pickQuestion(pack.questions, { asked: e.askedQuestionIds, recent: save.recentQuestionIds, locationId: slot.locationId }, rng);
  const question = presentQuestion(picked, rng);
  return { e: { ...e, rngState: rng.state, askedQuestionIds: [...e.askedQuestionIds, picked.id] }, question };
}

function enterEncounter(save: SaveData, pack: Pack): SaveData {
  const e = save.expedition;
  if (!e || e.discovery !== 'found' || e.battle) return save;
  const slotIndex = currentSlotIndex(e);
  const slot = e.slots[slotIndex];
  if (!slot) return save;

  const guardian = slot.kind === 'guardian';
  const combat = startCombat({
    playerMaxHp: BALANCE.playerMaxHp,
    opponentMaxHp: guardian ? BALANCE.guardianHp : BALANCE.regularHp,
    enemyPattern: BALANCE.enemyPattern,
    maxTurns: guardian ? BALANCE.guardianMaxTurns : BALANCE.regularMaxTurns,
  });
  const dealt = dealQuestion(save, e, slot, pack);
  const battle: Battle = { id: `${e.id}-battle-${save.nextId}`, slotIndex, combat, phase: 'choose', question: dealt.question };
  return { ...save, nextId: save.nextId + 1, expedition: { ...dealt.e, battle, retreated: false } };
}

function answer(save: SaveData, optionId: string, now: number): SaveData {
  const e = save.expedition;
  const b = e?.battle;
  if (!e || !b || b.phase !== 'question' || !b.action) return save;
  if (!b.question.options.some((o) => o.id === optionId)) return save;

  const correct = isCorrect(b.question, optionId);
  const { state: combat, events } = resolveTurn(b.combat, b.action, correct);
  const attempt: Attempt = {
    id: `${b.id}-turn-${b.combat.turn}`,
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
  };
  // The answer, slot win and battle state commit together in this one save.
  const slots = e.slots.map((s, i) => (i === b.slotIndex && combat.outcome === 'victory' ? { ...s, status: 'won' as const } : s));
  return {
    ...save,
    attempts: [...save.attempts, attempt],
    expedition: {
      ...e,
      slots,
      answered: e.answered + 1,
      correct: e.correct + (correct ? 1 : 0),
      battle: { ...b, combat, phase: 'feedback', result: { optionId, correct, events } },
    },
  };
}

function continueBattle(save: SaveData, pack: Pack): SaveData {
  const e = save.expedition;
  const b = e?.battle;
  if (!e || !b || b.phase !== 'feedback') return save;
  if (b.combat.outcome !== 'active') {
    return { ...save, expedition: { ...e, battle: null, retreated: b.combat.outcome === 'retreat' } };
  }
  const slot = e.slots[b.slotIndex] as Slot;
  const dealt = dealQuestion(save, e, slot, pack);
  const { result: _result, action: _action, ...rest } = b;
  return { ...save, expedition: { ...dealt.e, battle: { ...rest, phase: 'choose', question: dealt.question } } };
}

function guess(save: SaveData, pack: Pack, locationId: string, now: number): SaveData {
  const e = save.expedition;
  if (!e || e.discovery !== 'searching' || !e.candidateIds.includes(locationId)) return save;
  if (e.guesses.includes(locationId)) return save;

  const correct = locationId === e.targetId;
  const assisted = e.atlasUsed || e.cluesShown > 1 || e.guesses.length > 0;
  const clue = pack.clues.find((c) => c.id === e.clueIds[0]);
  const attempt: Attempt = {
    id: `${e.id}-guess-${e.guesses.length + 1}`,
    context: 'discovery',
    itemId: clue?.id ?? e.targetId,
    itemVersion: clue?.version ?? 1,
    objectiveId: clue?.objectiveId ?? '',
    submitted: locationId,
    correct,
    timestamp: now,
    assisted,
    expeditionId: e.id,
  };
  return {
    ...save,
    attempts: [...save.attempts, attempt],
    expedition: {
      ...e,
      guesses: [...e.guesses, locationId],
      discovery: correct ? 'found' : 'searching',
      discoveryAssisted: assisted,
      // A wrong guess brings the second clue into view as the correction.
      cluesShown: correct ? e.cluesShown : Math.min(e.clueIds.length, e.cluesShown + 1),
    },
  };
}

function claimReward(save: SaveData, pack: Pack): SaveData {
  const e = save.expedition;
  if (!e || !isExpeditionComplete(e)) return save;

  const applied = save.appliedRewardIds.includes(e.id);
  const { reward } = e;
  const souvenirIds =
    !applied && reward.kind === 'souvenir' && !save.souvenirIds.includes(reward.souvenirId)
      ? [...save.souvenirIds, reward.souvenirId]
      : save.souvenirIds;
  const bondXp = save.companion.bondXp + (!applied && reward.kind === 'bond' ? reward.xp : 0);

  return refreshOffer(
    {
      ...save,
      souvenirIds,
      companion: { ...save.companion, bondXp },
      completedExpeditions: save.completedExpeditions + (applied ? 0 : 1),
      appliedRewardIds: applied ? save.appliedRewardIds : [...save.appliedRewardIds, e.id],
      expedition: null,
      recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT),
      lastSummary: { expeditionId: e.id, reward, answered: e.answered, correct: e.correct, discoveryAssisted: e.discoveryAssisted },
    },
    pack,
  );
}

/** The single state transition. Pure: an invalid or repeated command returns the same object, and callers skip the save. */
export function reduce(save: SaveData, cmd: Command, pack: Pack, now: number): SaveData {
  const e = save.expedition;
  switch (cmd.type) {
    case 'start':
      return e ? save : startExpedition(save, pack);
    case 'revealClue':
      if (!e || e.discovery !== 'searching' || e.cluesShown >= e.clueIds.length) return save;
      return { ...save, expedition: { ...e, cluesShown: e.cluesShown + 1 } };
    case 'useAtlas':
      if (!e || e.discovery !== 'searching' || e.atlasUsed) return save;
      return { ...save, expedition: { ...e, atlasUsed: true } };
    case 'guess':
      return guess(save, pack, cmd.locationId, now);
    case 'enterEncounter':
      return enterEncounter(save, pack);
    case 'chooseAction':
      if (!e?.battle || e.battle.phase !== 'choose') return save;
      return { ...save, expedition: { ...e, battle: { ...e.battle, phase: 'question', action: cmd.action } } };
    case 'answer':
      return answer(save, cmd.optionId, now);
    case 'continue':
      return continueBattle(save, pack);
    case 'claimReward':
      return claimReward(save, pack);
    case 'abandon':
      if (!e || isExpeditionComplete(e)) return save;
      return refreshOffer({ ...save, expedition: null, recentQuestionIds: [...save.recentQuestionIds, ...e.askedQuestionIds].slice(-RECENT_QUESTION_LIMIT) }, pack);
    case 'dismissSummary':
      return save.lastSummary ? { ...save, lastSummary: null } : save;
  }
}
