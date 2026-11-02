import type { Difficulty, Pack, Question } from '../content/types';
import { localDay, type Learning } from './learning';

export type MedalTrack = 'places' | 'capitals' | 'flags';
export type MedalLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export const MEDAL_LEVELS: readonly MedalLevel[] = ['bronze', 'silver', 'gold', 'platinum'];
export const MEDAL_TRACKS: readonly { id: MedalTrack; objective: string; label: string }[] = [
  { id: 'places', objective: 'location', label: 'Places' },
  { id: 'capitals', objective: 'capital', label: 'Capitals' },
  { id: 'flags', objective: 'flag', label: 'Flags' },
];
/** Trail Points banked for the next trail when a medal is earned. */
export const MEDAL_POINTS: Record<MedalLevel, number> = { bronze: 1, silver: 2, gold: 3, platinum: 5 };
export const PLATINUM_WAIT_DAYS = 7;
export const MASTERY_MISSES_ALLOWED = 1;
const DAY = 24 * 60 * 60 * 1000;
const GOLD_DAYS = 2;
const RANK: Record<Difficulty, number> = { scout: 0, ranger: 1, expert: 2 };

export interface Medal {
  level: MedalLevel;
  /** When this level was earned. Platinum's wait counts from Gold. */
  at: number;
  /** The local day of the last failed Mastery Test, so a retry waits until tomorrow. */
  failedDay?: string;
}

export type Medals = Record<string, Medal>;

export const medalKey = (regionId: string, track: MedalTrack) => `${regionId}:${track}`;
const objectiveOf = (track: MedalTrack) => MEDAL_TRACKS.find((t) => t.id === track)?.objective ?? track;
const rankOf = (level: MedalLevel | undefined) => (level ? MEDAL_LEVELS.indexOf(level) : -1);

const placeCache = new WeakMap<Pack, Map<string, string[]>>();

/** The places a track covers in a region: every place with a question for it. Antarctica has no flags or capitals. */
export function trackPlaces(pack: Pack, regionId: string, track: MedalTrack): string[] {
  let byKey = placeCache.get(pack);
  if (!byKey) placeCache.set(pack, (byKey = new Map()));
  const key = medalKey(regionId, track);
  const cached = byKey.get(key);
  if (cached) return cached;
  const objective = objectiveOf(track);
  const ids = pack.places.filter((p) => p.regionId === regionId && pack.questions.some((q) => q.objectiveId === `${objective}-${p.id}`)).map((p) => p.id);
  byKey.set(key, ids);
  return ids;
}

export const regionTracks = (pack: Pack, regionId: string) => MEDAL_TRACKS.filter((t) => trackPlaces(pack, regionId, t.id).length > 0);

interface Standing {
  /** Places right at least once, on Ranger or harder, and on Expert on two different days. */
  counts: Record<'bronze' | 'silver' | 'gold', number>;
  total: number;
}

function standing(learning: Learning, pack: Pack, regionId: string, track: MedalTrack): Standing {
  const objective = objectiveOf(track);
  const places = trackPlaces(pack, regionId, track);
  const counts = { bronze: 0, silver: 0, gold: 0 };
  for (const id of places) {
    const wins = learning[`${objective}-${id}`]?.successes ?? [];
    if (wins.length > 0) counts.bronze++;
    if (wins.some((w) => RANK[w.difficulty] >= RANK.ranger)) counts.silver++;
    if (new Set(wins.filter((w) => w.difficulty === 'expert').map((w) => w.day)).size >= GOLD_DAYS) counts.gold++;
  }
  return { counts, total: places.length };
}

/** The level the answers alone support. Platinum only comes from a Mastery Test. */
function answeredLevel(s: Standing): MedalLevel | undefined {
  if (s.total === 0) return undefined;
  if (s.counts.gold === s.total) return 'gold';
  if (s.counts.silver === s.total) return 'silver';
  if (s.counts.bronze === s.total) return 'bronze';
  return undefined;
}

export interface MedalView {
  track: MedalTrack;
  label: string;
  level?: MedalLevel;
  /** What to do next, in a child's words. */
  next: string;
  done: number;
  total: number;
  testReady: boolean;
  /** When the Mastery Test opens, if it isn't open yet. */
  testOpensAt?: number;
}

export function medalView(medals: Medals, learning: Learning, pack: Pack, regionId: string, track: MedalTrack, now: number): MedalView {
  const s = standing(learning, pack, regionId, track);
  const saved = medals[medalKey(regionId, track)];
  const derived = answeredLevel(s);
  const level = rankOf(saved?.level) >= rankOf(derived) ? saved?.level : derived;
  const label = MEDAL_TRACKS.find((t) => t.id === track)?.label ?? track;
  const base = { track, label, total: s.total, testReady: false, ...(level ? { level } : {}) };
  if (level === 'platinum') return { ...base, done: s.total, next: 'Platinum! You have mastered these.' };
  if (level === 'gold') {
    const opensAt = (saved?.level === 'gold' ? saved.at : now) + PLATINUM_WAIT_DAYS * DAY;
    const triedToday = saved?.failedDay === localDay(now);
    const ready = saved?.level === 'gold' && now >= opensAt && !triedToday;
    const next = ready ? 'Take the Mastery Test for Platinum!' : triedToday ? 'Try the Mastery Test again tomorrow.' : `The Mastery Test opens ${PLATINUM_WAIT_DAYS} days after Gold.`;
    return { ...base, done: s.total, next, testReady: ready, ...(ready ? {} : { testOpensAt: opensAt }) };
  }
  if (level === 'silver') return { ...base, done: s.counts.gold, next: `${s.total - s.counts.gold} left: right on Expert on two different days for Gold` };
  if (level === 'bronze') return { ...base, done: s.counts.silver, next: `${s.total - s.counts.silver} left: right on Ranger for Silver` };
  return { ...base, done: s.counts.bronze, next: `${s.total - s.counts.bronze} left: right once for Bronze` };
}

export interface MedalEarned {
  regionId: string;
  track: MedalTrack;
  level: MedalLevel;
}

/** Saves any medal the answers now support. Medals never go down. */
export function awardMedals(medals: Medals, learning: Learning, pack: Pack, now: number, regionIds?: readonly string[]): { medals: Medals; earned: MedalEarned[] } {
  const next: Medals = { ...medals };
  const earned: MedalEarned[] = [];
  for (const region of pack.regions) {
    if (regionIds && !regionIds.includes(region.id)) continue;
    for (const t of regionTracks(pack, region.id)) {
      const key = medalKey(region.id, t.id);
      const derived = answeredLevel(standing(learning, pack, region.id, t.id));
      if (!derived || rankOf(derived) <= rankOf(next[key]?.level)) continue;
      // Skipped levels count too, so a jump from none to Silver pays Bronze and Silver.
      for (let r = rankOf(next[key]?.level) + 1; r <= rankOf(derived); r++) earned.push({ regionId: region.id, track: t.id, level: MEDAL_LEVELS[r] as MedalLevel });
      next[key] = { level: derived, at: now };
    }
  }
  return { medals: next, earned };
}

export const medalPoints = (earned: readonly MedalEarned[]) => earned.reduce((sum, m) => sum + MEDAL_POINTS[m.level], 0);

/** One quick question per place, never a map click, so the test checks memory rather than mouse aim. */
export function masteryQuestions(pack: Pack, regionId: string, track: MedalTrack): Question[] {
  const objective = objectiveOf(track);
  return trackPlaces(pack, regionId, track).flatMap((id) => {
    const options = pack.questions.filter((q) => q.objectiveId === `${objective}-${id}` && q.inputType !== 'map-click' && !q.recallOf);
    const pick = options.find((q) => q.difficulty === 'ranger') ?? options.find((q) => q.difficulty === 'expert') ?? options[0];
    return pick ? [pick] : [];
  });
}
