import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import type { Difficulty } from '../content/types';
import { reduce, newSave, type SaveData } from './game';
import type { Learning } from './learning';
import { awardMedals, masteryQuestions, medalKey, medalView, PLATINUM_WAIT_DAYS, trackPlaces } from './medals';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-02T12:00:00').getTime();
const REGION = 'us-northeast';

/** Learning where every place in the region has these wins for one track. */
function learned(objective: string, wins: { day: string; difficulty: Difficulty }[], skip = 0): Learning {
  const out: Learning = {};
  trackPlaces(PACK, REGION, objective === 'location' ? 'places' : objective === 'capital' ? 'capitals' : 'flags').slice(skip).forEach((id) => {
    out[`${objective}-${id}`] = { stage: 1, nextDue: 0, missed: false, successes: wins.map((w) => ({ ...w, questionId: `q-${id}` })) };
  });
  return out;
}

describe('mastery medals', () => {
  it('covers every place in a region, with no flags or capitals in Antarctica', () => {
    expect(trackPlaces(PACK, REGION, 'capitals')).toHaveLength(9);
    expect(trackPlaces(PACK, REGION, 'flags')).toHaveLength(9);
    expect(trackPlaces(PACK, 'antarctica', 'flags')).toHaveLength(0);
    expect(trackPlaces(PACK, 'antarctica', 'places').length).toBeGreaterThan(0);
  });

  it('needs every place: one missing place means no medal', () => {
    const view = medalView({}, learned('capital', [{ day: '2026-11-02', difficulty: 'scout' }], 1), PACK, REGION, 'capitals', T0);
    expect(view.level).toBeUndefined();
    expect(view.next).toContain('1 left');
  });

  it('Bronze for right once, Silver on Ranger, Gold on Expert on two days', () => {
    const level = (wins: { day: string; difficulty: Difficulty }[]) => medalView({}, learned('capital', wins), PACK, REGION, 'capitals', T0).level;
    expect(level([{ day: '2026-11-01', difficulty: 'scout' }])).toBe('bronze');
    expect(level([{ day: '2026-11-01', difficulty: 'ranger' }])).toBe('silver');
    expect(level([{ day: '2026-11-01', difficulty: 'expert' }, { day: '2026-11-01', difficulty: 'expert' }])).toBe('silver');
    expect(level([{ day: '2026-11-01', difficulty: 'expert' }, { day: '2026-11-02', difficulty: 'expert' }])).toBe('gold');
  });

  it('medals never go down, and skipped levels are all earned', () => {
    const gold = learned('flag', [{ day: '2026-11-01', difficulty: 'expert' }, { day: '2026-11-02', difficulty: 'expert' }]);
    const first = awardMedals({}, gold, PACK, T0);
    expect(first.earned.filter((m) => m.regionId === REGION && m.track === 'flags').map((m) => m.level)).toEqual(['bronze', 'silver', 'gold']);
    expect(first.medals[medalKey(REGION, 'flags')]?.level).toBe('gold');
    const later = awardMedals(first.medals, {}, PACK, T0 + DAY);
    expect(later.earned).toEqual([]);
    expect(medalView(later.medals, {}, PACK, REGION, 'flags', T0 + DAY).level).toBe('gold');
  });

  it('the Mastery Test opens a week after Gold', () => {
    const gold = awardMedals({}, learned('capital', [{ day: '2026-11-01', difficulty: 'expert' }, { day: '2026-11-02', difficulty: 'expert' }]), PACK, T0).medals;
    expect(medalView(gold, {}, PACK, REGION, 'capitals', T0 + (PLATINUM_WAIT_DAYS - 1) * DAY).testReady).toBe(false);
    expect(medalView(gold, {}, PACK, REGION, 'capitals', T0 + PLATINUM_WAIT_DAYS * DAY).testReady).toBe(true);
  });

  it('asks one quick question per place and never a map click', () => {
    for (const track of ['places', 'capitals', 'flags'] as const) {
      const qs = masteryQuestions(PACK, REGION, track);
      expect(qs).toHaveLength(9);
      expect(new Set(qs.map((q) => q.locationId)).size).toBe(9);
      for (const q of qs) expect(q.inputType).not.toBe('map-click');
    }
  });
});

describe('the Mastery Test', () => {
  const ready = (): { save: SaveData; now: number } => {
    const base = newSave(PACK, 7, 'p1');
    const learning = learned('capital', [{ day: '2026-11-01', difficulty: 'expert' }, { day: '2026-11-02', difficulty: 'expert' }]);
    const medals = awardMedals({}, learning, PACK, T0).medals;
    return { save: { ...base, learning, medals }, now: T0 + PLATINUM_WAIT_DAYS * DAY };
  };
  const answerAll = (save: SaveData, now: number, wrong: number[]) => {
    let s = reduce(save, { type: 'startMastery', regionId: REGION, track: 'capitals' }, PACK, now);
    for (let i = 0; s.masteryTest && !s.masteryTest.outcome; i++) {
      const q = s.masteryTest.questions[s.masteryTest.index]!;
      const pick = wrong.includes(i) ? q.options.find((o) => o.id !== q.acceptedId)!.id : q.acceptedId;
      s = reduce(s, { type: 'masteryAnswer', optionId: pick }, PACK, now);
      s = reduce(s, { type: 'masteryNext' }, PACK, now);
    }
    return s;
  };

  it('can only start when the test is open', () => {
    const { save, now } = ready();
    expect(reduce(save, { type: 'startMastery', regionId: REGION, track: 'capitals' }, PACK, now - DAY)).toBe(save);
    expect(reduce(save, { type: 'startMastery', regionId: REGION, track: 'capitals' }, PACK, now).masteryTest?.questions).toHaveLength(9);
  });

  it('one miss still passes, earns Platinum and banks points', () => {
    const { save, now } = ready();
    const s = answerAll(save, now, [3]);
    expect(s.masteryTest?.outcome).toBe('passed');
    expect(s.medals?.[medalKey(REGION, 'capitals')]?.level).toBe('platinum');
    expect(s.bankedPoints).toBe(5);
    expect(s.badges).toContain('medal-platinum');
    expect(reduce(s, { type: 'closeMastery' }, PACK, now).masteryTest).toBeNull();
  });

  it('two misses end the test, and the next try waits until tomorrow', () => {
    const { save, now } = ready();
    const s = answerAll(save, now, [0, 1]);
    expect(s.masteryTest?.outcome).toBe('failed');
    expect(s.masteryTest?.index).toBe(1);
    const closed = reduce(s, { type: 'closeMastery' }, PACK, now);
    expect(closed.medals?.[medalKey(REGION, 'capitals')]?.level).toBe('gold');
    expect(reduce(closed, { type: 'startMastery', regionId: REGION, track: 'capitals' }, PACK, now)).toBe(closed);
    expect(reduce(closed, { type: 'startMastery', regionId: REGION, track: 'capitals' }, PACK, now + DAY).masteryTest).toBeTruthy();
  });

  it('stopping partway counts as today\'s try', () => {
    const { save, now } = ready();
    const started = reduce(save, { type: 'startMastery', regionId: REGION, track: 'capitals' }, PACK, now);
    const quit = reduce(started, { type: 'closeMastery' }, PACK, now);
    expect(quit.masteryTest).toBeNull();
    expect(medalView(quit.medals!, quit.learning, PACK, REGION, 'capitals', now).testReady).toBe(false);
  });

  it('banked medal points are added to the next trail', () => {
    const save = { ...newSave(PACK, 7, 'p1'), bankedPoints: 4 };
    const offer = save.offers.find((o) => o.regionId === 'us-west')!;
    const s = reduce(save, { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty: 'scout', trail: 'short' }, PACK, T0);
    expect(s.bankedPoints).toBe(0);
    const plain = reduce(newSave(PACK, 7, 'p1'), { type: 'start', offerId: offer.id, regionId: 'us-west', difficulty: 'scout', trail: 'short' }, PACK, T0);
    expect(s.expedition!.points).toBe(plain.expedition!.points + 4);
  });
});
