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

describe('trip newcomers', () => {
  it('matches two of the same kind to two different stable entries', async () => {
    const { newcomers } = await import('./Camp');
    const save = { companions: [
      { instanceId: 'a', speciesId: 'slatepaw', bondXp: 500 },
      { instanceId: 'b', speciesId: 'glaciarch', bondXp: 0 },
      { instanceId: 'c', speciesId: 'glaciarch', bondXp: 0 },
    ] } as unknown as Parameters<typeof newcomers>[0];
    expect(newcomers(save, ['glaciarch', 'glaciarch']).map((c) => c.instanceId)).toEqual(['c', 'b']);
    expect(newcomers(save, ['slatepaw'])).toEqual([]);
  });
});

describe('shiny looks', () => {
  it('cover every color, one per creature, and stay the same for a creature', async () => {
    const { SHINY_COLORS, shinyLook, shinyName } = await import('./shiny');
    const looks = Array.from({ length: 2000 }, (_, i) => shinyLook(`p1-companion-${i}`));
    for (const c of SHINY_COLORS) expect(looks.some((l) => l.a === c), c).toBe(true);
    expect(shinyLook('p1-companion-7')).toEqual(shinyLook('p1-companion-7'));
    expect(shinyName({ a: 'yellow' })).toBe('Gold');
  });
});

describe('multicolor shinies', () => {
  const px = (...colors: [number, number, number, number][]) => new Uint8ClampedArray(colors.flat());
  it('find a sprite\'s main colors and paint each part its own color, keeping the outline', async () => {
    const { findPalette, recolor } = await import('./palette');
    const yellow: [number, number, number, number] = [240, 200, 40, 255];
    const blue: [number, number, number, number] = [40, 90, 220, 255];
    const outline: [number, number, number, number] = [0, 0, 0, 255];
    const grey: [number, number, number, number] = [150, 150, 150, 255];
    const clear: [number, number, number, number] = [10, 200, 10, 0];
    const data = px(...Array(10).fill(yellow), ...Array(5).fill(blue), outline, grey, clear);
    const palette = findPalette(data);
    expect(palette.hues).toHaveLength(2);
    recolor(data, palette, ['white', { hue: 0, sat: 0.8 }, { hue: 120, sat: 0.8 }]);
    const at = (i: number) => [...data.slice(i * 4, i * 4 + 4)];
    // Blue (hue about 220) sorts after yellow (about 47): yellow turns red, blue turns green.
    expect(at(0)[0]).toBeGreaterThan(at(0)[1]! + 60);
    expect(at(10)[1]).toBeGreaterThan(at(10)[0]! + 40);
    expect(at(15)).toEqual(outline);
    expect(at(16)[0]).toBe(at(16)[2]);
    expect(at(17)).toEqual(clear);
  });

  it('about one shiny in five is multicolor, with three different colors', async () => {
    const { shinyLook, shinyName } = await import('./shiny');
    const looks = Array.from({ length: 2000 }, (_, i) => shinyLook(`p1-companion-${i}`));
    const multi = looks.filter((l) => l.parts);
    expect(multi.length / looks.length).toBeGreaterThan(0.15);
    expect(multi.length / looks.length).toBeLessThan(0.25);
    for (const l of multi) expect(new Set(l.parts).size).toBe(3);
    expect(shinyName({ a: 'red', parts: ['red', 'blue', 'white'] })).toBe('Multicolor Red, Blue and White');
  });

  it('picked colors win over its own', async () => {
    const { shinyLook, shinyName } = await import('./shiny');
    expect(shinyLook('p1-companion-1', ['yellow', 'red'])).toEqual({ a: 'yellow', parts: ['yellow', 'red', 'red'] });
    expect(shinyName(shinyLook('p1-companion-1', ['yellow', 'red']))).toBe('Multicolor Gold and Red');
    expect(shinyLook('p1-companion-1', ['blue'])).toEqual({ a: 'blue' });
    expect(shinyLook('p1-companion-1', ['nope'])).toEqual(shinyLook('p1-companion-1'));
  });
});
