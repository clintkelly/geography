import { describe, expect, it } from 'vitest';
import type { Companion } from '../engine/game';
import { takeFile } from './music';
import { arrange } from './Stable';

const team: Companion[] = [
  { instanceId: '1', speciesId: 'slatepaw', bondXp: 10 },
  { instanceId: '2', speciesId: 'brinefin', bondXp: 300 },
  { instanceId: '3', speciesId: 'cindermite', bondXp: 50, nickname: 'Zippy' },
  { instanceId: '4', speciesId: 'strikewing', bondXp: 0, shiny: true },
];
const ids = (list: Companion[]) => list.map((c) => c.instanceId);

describe('stable sorting and filtering', () => {
  it('sorts by newest, oldest, level and name', () => {
    expect(ids(arrange(team, 'newest', 'all', ''))).toEqual(['4', '3', '2', '1']);
    expect(ids(arrange(team, 'oldest', 'all', ''))).toEqual(['1', '2', '3', '4']);
    expect(ids(arrange(team, 'level', 'all', ''))[0]).toBe('2');
    expect(ids(arrange(team, 'name', 'all', ''))[0]).toBe('2');
  });

  it('filters by type, counting both types of a dual-type creature, and by shiny', () => {
    expect(ids(arrange(team, 'oldest', 'stone', ''))).toEqual(['1']);
    expect(ids(arrange(team, 'oldest', 'volt', ''))).toEqual(['4']);
    expect(ids(arrange(team, 'oldest', 'gale', ''))).toEqual(['4']);
    expect(ids(arrange(team, 'oldest', 'shiny', ''))).toEqual(['4']);
  });

  it('finds by nickname or species name', () => {
    expect(ids(arrange(team, 'oldest', 'all', 'zip'))).toEqual(['3']);
    expect(ids(arrange(team, 'oldest', 'all', 'cinder'))).toEqual(['3']);
  });
});

describe('music takes', () => {
  it('picks among a track’s takes', () => {
    expect(takeFile('camp', 0)).toBe('camp');
    expect(takeFile('camp', 0.5)).toBe('camp-2');
    expect(takeFile('camp', 0.99)).toBe('camp-3');
    expect(takeFile('boss', 0.99)).toBe('boss-2');
  });
});
