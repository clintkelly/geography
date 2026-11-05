import { describe, expect, it } from 'vitest';
import { PACK } from './pack';

const files = import.meta.glob<Record<string, { fact: string; ask: string; source: string }[]>>('./history/*.json', { eager: true, import: 'default' });
const entries = Object.values(files).flatMap((f) => Object.entries(f));

describe('history questions', () => {
  it('every entry is listed under a real place, with a source', () => {
    const places = new Set(PACK.places.map((p) => p.id));
    for (const [placeId, facts] of entries) {
      expect(places.has(placeId), placeId).toBe(true);
      for (const f of facts) expect(f.source, placeId).toMatch(/^https:\/\//);
    }
  });

  it('becomes questions at every difficulty, and the ask never names its answer', () => {
    const history = PACK.questions.filter((q) => q.topic === 'history');
    expect(history.length).toBe(entries.reduce((n, [, f]) => n + f.length, 0) * 3);
    for (const q of history) {
      const place = PACK.places.find((p) => p.id === q.locationId)!;
      expect(q.prompt.toLowerCase().includes(place.name.toLowerCase()), q.id).toBe(false);
    }
  });
});
