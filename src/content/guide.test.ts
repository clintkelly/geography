import { describe, expect, it } from 'vitest';
import { guideFor } from './guide';
import { PACK } from './pack';

describe('Field Guide', () => {
  it('every creature has an entry with two or three sourced facts', () => {
    for (const s of PACK.species) {
      const g = guideFor(s.id);
      expect(g, s.id).toBeTruthy();
      expect(['real', 'prehistoric', 'myth', 'history'], s.id).toContain(g!.kind);
      expect(g!.basedOn.length, s.id).toBeGreaterThan(1);
      expect(g!.facts.length, s.id).toBeGreaterThanOrEqual(2);
      for (const f of g!.facts) expect(f.source, s.id).toMatch(/^https:\/\//);
      if (g!.kind === 'prehistoric') expect(g!.when, s.id).toBeTruthy();
      if (g!.kind === 'myth' || g!.kind === 'history') expect(g!.story, s.id).toBeTruthy();
    }
  });
});
