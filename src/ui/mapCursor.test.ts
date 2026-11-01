import { describe, expect, it } from 'vitest';
import { MAPS } from '../content/maps';
import { PACK } from '../content/pack';
import { centerItem, nextInDirection } from './mapCursor';

const grid = [
  { id: 'middle', x: 50, y: 50 },
  { id: 'east', x: 80, y: 52 },
  { id: 'farEast', x: 200, y: 50 },
  { id: 'north', x: 48, y: 20 },
  { id: 'south', x: 55, y: 90 },
  { id: 'west', x: 10, y: 45 },
];

describe('map cursor', () => {
  it('moves to the nearest place in each direction', () => {
    const from = grid[0]!;
    expect(nextInDirection(grid, from, 'right')).toBe('east');
    expect(nextInDirection(grid, from, 'left')).toBe('west');
    expect(nextInDirection(grid, from, 'up')).toBe('north');
    expect(nextInDirection(grid, from, 'down')).toBe('south');
  });

  it('stays put at the edge of the map', () => {
    expect(nextInDirection(grid, grid[2]!, 'right')).toBeNull();
  });

  it('starts near the middle', () => {
    expect(centerItem(grid)!.id).not.toBe('farEast');
  });

  it.each(PACK.regions.map((r) => r.id))('can reach every place in %s with arrow keys alone', (regionId) => {
    const map = MAPS[PACK.regions.find((r) => r.id === regionId)!.mapId];
    const items = PACK.places.filter((p) => p.regionId === regionId).map((p) => {
      const [x, y] = map.project(p.lonLat);
      return { id: p.id, x, y };
    });
    const start = centerItem(items)!;
    const seen = new Set([start.id]);
    const queue = [start];
    while (queue.length > 0) {
      const from = queue.pop()!;
      for (const d of ['left', 'right', 'up', 'down'] as const) {
        const id = nextInDirection(items, from, d);
        if (id && !seen.has(id)) {
          seen.add(id);
          queue.push(items.find((i) => i.id === id)!);
        }
      }
    }
    expect(items.filter((i) => !seen.has(i.id)).map((i) => i.id)).toEqual([]);
  });
});
