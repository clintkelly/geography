import type { Pack, Species } from '../content/types';

/**
 * The creatures that call a region home: its own animals, by day and by night.
 * Creatures found almost everywhere, bosses, rares and Winter Festival guests don't count.
 */
export function regionCreatures(pack: Pack, regionId: string): Species[] {
  return pack.species.filter((s) => s.homes.includes(regionId) && s.homes.length <= 5 && !s.boss && !s.rare && !s.winter);
}

export function regionProgress(pack: Pack, known: ReadonlySet<string>, regionId: string): { found: number; total: number } {
  const here = regionCreatures(pack, regionId);
  return { found: here.filter((s) => known.has(s.id)).length, total: here.length };
}

/** Regions where every creature that lives there has been found. */
export function masteredRegions(pack: Pack, known: ReadonlySet<string>): string[] {
  return pack.regions.filter((r) => {
    const { found, total } = regionProgress(pack, known, r.id);
    return total > 0 && found === total;
  }).map((r) => r.id);
}

/** The player's calendar day, like 2026-11-06, by their own clock. */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's visitor: one regular creature a day, the same for everyone in the household. */
export function visitorFor(pack: Pack, day: string): Species | undefined {
  const pool = pack.species.filter((s) => s.homes.length > 0 && s.homes.length <= 5 && !s.boss && !s.rare && !s.night && !s.winter && !s.minDifficulty && !s.paths);
  if (pool.length === 0) return undefined;
  let h = 2166136261;
  for (const ch of `visitor:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return pool[h % pool.length];
}

/** Today's visitor is three times as likely to be shiny. */
export const VISITOR_SHINY_BOOST = 3;

/** Befriending the same kind again and again raises the shiny chance: half again for each one in a row, up to four times. */
export interface ShinyChain {
  speciesId: string;
  count: number;
}
export const CHAIN_STEP = 0.5;
export const CHAIN_MAX_BOOST = 4;

/** The shiny boost the next one of this kind would get from the chain. */
export function chainBoost(chain: ShinyChain | undefined, speciesId: string): number {
  if (!chain || chain.speciesId !== speciesId) return 1;
  return Math.min(CHAIN_MAX_BOOST, 1 + chain.count * CHAIN_STEP);
}

/** The chain after another creature of this kind joins. A different kind starts a new chain. */
export function extendChain(chain: ShinyChain | undefined, speciesId: string): ShinyChain {
  return chain?.speciesId === speciesId ? { speciesId, count: chain.count + 1 } : { speciesId, count: 1 };
}
