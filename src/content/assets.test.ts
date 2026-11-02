import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRAIL_EVENTS } from '../engine/events';
import { TYPE_LOOP } from '../engine/types';
import { TRACKS } from '../ui/music';
import { PACK } from './pack';

const ART = 'public/art';
const POSES = ['', '-attack', '-guard', '-special', '-hit'];
const FX = ['fx-spark', 'fx-heart', 'fx-coin', 'fx-flame', 'fx-badge'];
const BUILT_IN_BACKDROPS = PACK.places.map((p) => `backdrop-${p.biome}`);

const spriteIds = PACK.species.flatMap((s) => [...POSES.map((p) => `${s.artId}${p}`), ...(s.evolutions ?? []).map((e) => e.artId)]);
const expected: Record<string, { w: number; h: number; transparent: boolean }> = {};
const expect_ = (ids: string[], w: number, h: number, transparent: boolean) => ids.forEach((id) => { expected[id] = { w, h, transparent }; });
expect_(spriteIds, 128, 128, true);
expect_(PACK.cards.map((c) => c.artId), 128, 96, false);
expect_(BUILT_IN_BACKDROPS, 480, 192, false);
expect_(PACK.souvenirs.map((s) => s.artId), 64, 64, true);
expect_(PACK.regions.map((r) => `stamp-${r.id}`), 64, 64, true);
expect_(TYPE_LOOP.map((t) => `type-${t}`), 32, 32, true);
expect_(TYPE_LOOP.map((t) => `fxtype-${t}`), 32, 32, true);
expect_(TRAIL_EVENTS.map((e) => `event-${e.id}`), 128, 128, true);

function png(id: string) {
  const b = readFileSync(`${ART}/${id}.png`);
  return { signature: b.subarray(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25], hasTrns: b.includes('tRNS'), size: b.length };
}

describe('flags', () => {
  it('has a flag file for every country and state, and no extras', () => {
    const codes = PACK.cards.flatMap((c) => (c.flag ? [`${c.flag}.svg`] : []));
    expect(codes).toHaveLength(196 + 50);
    expect(readdirSync('public/flags').filter((f) => f.endsWith('.svg')).sort()).toEqual([...codes].sort());
  });
});

describe('music', () => {
  it('has a file for every track', () => {
    for (const track of TRACKS) expect(existsSync(`public/music/${track}.mp3`), track).toBe(true);
    expect(readdirSync('public/music').sort()).toEqual(TRACKS.map((t) => `${t}.mp3`).sort());
  });
});

describe('art', () => {
  it('has a file for every reference', () => {
    const all = [...Object.keys(expected), ...FX];
    expect(all.filter((id) => !existsSync(`${ART}/${id}.png`))).toEqual([]);
  });

  it('every file is a real image of the right size', () => {
    const wrong = Object.entries(expected).flatMap(([id, e]) => {
      const p = png(id);
      return p.signature === 'PNG' && p.w === e.w && p.h === e.h && p.size > 500 ? [] : [`${id}: ${p.w}x${p.h}, ${p.size} bytes`];
    });
    expect(wrong).toEqual([]);
  });

  it('sprites have transparency', () => {
    const solid = Object.entries(expected).filter(([id, e]) => {
      if (!e.transparent) return false;
      const p = png(id);
      return p.colorType !== 6 && p.colorType !== 4 && !p.hasTrns;
    });
    expect(solid.map(([id]) => id)).toEqual([]);
  });

  it('effect sprites are real images', () => {
    for (const id of FX) expect(png(id).signature, id).toBe('PNG');
  });

  it('has no leftover files that nothing uses', () => {
    const used = new Set([...Object.keys(expected), ...FX]);
    expect(readdirSync(ART).filter((f) => !used.has(f.replace('.png', '')))).toEqual([]);
  });

  it('every avatar choice is a creature', () => {
    for (const s of PACK.species) expect(existsSync(`${ART}/${s.artId}.png`), s.id).toBe(true);
  });
});

describe('sound', () => {
  it('has a file for every sound the game plays, and no extras', () => {
    const source = readFileSync('src/ui/sound.ts', 'utf8');
    const block = source.slice(source.indexOf('LENGTH_MS = {'), source.indexOf('} as const'));
    const ids = [...block.matchAll(/^\s*'?([a-z-]+)'?: \d+/gm)].map((m) => m[1] as string);
    expect(ids.length).toBeGreaterThan(5);
    expect(readdirSync('public/sfx').map((f) => f.replace('.mp3', '')).sort()).toEqual([...ids].sort());
  });
});
