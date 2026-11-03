import { describe, expect, it } from 'vitest';
import { nextMilestone } from './TrailBar';

describe('trail bar streak goal', () => {
  it('points at the next streak that pays out', () => {
    expect(nextMilestone(0)).toMatchObject({ at: 3, label: 'Hot Streak!' });
    expect(nextMilestone(3)?.at).toBe(5);
    expect(nextMilestone(8)?.at).toBe(10);
    expect(nextMilestone(10)?.at).toBe(15);
    expect(nextMilestone(15)?.at).toBe(20);
  });
});
