import type { Place } from '../content/types';
import type { Rng } from './rng';

export type TrailLength = 'short' | 'standard' | 'long';
export const TRAIL_LENGTHS: readonly TrailLength[] = ['short', 'standard', 'long'];
export type StopKind = 'regular' | 'event' | 'guardian';

export const TRAIL_STOPS: Record<TrailLength, readonly StopKind[]> = {
  short: ['regular', 'regular', 'guardian'],
  standard: ['regular', 'regular', 'event', 'regular', 'guardian'],
  long: ['regular', 'regular', 'event', 'regular', 'event', 'regular', 'guardian'],
};

function nextOptions(from: Place, places: readonly Place[], used: ReadonlySet<string>, rng: Rng): Place[] {
  const open = places.filter((p) => !used.has(p.id));
  if (from.neighbors) return rng.shuffle(open.filter((p) => from.neighbors?.includes(p.id)));
  const d = (p: Place) => Math.hypot(p.lonLat[0] - from.lonLat[0], p.lonLat[1] - from.lonLat[1]);
  return rng.shuffle([...open].sort((a, b) => d(a) - d(b)).slice(0, 3));
}

/** A random path through connected places that never revisits one. Shorter only if the region is smaller than the trail. */
export function walkTrail(places: readonly Place[], length: number, rng: Rng): Place[] {
  const wanted = Math.min(length, places.length);
  const walk = (path: Place[]): Place[] | null => {
    if (path.length === wanted) return path;
    const used = new Set(path.map((p) => p.id));
    for (const next of nextOptions(path[path.length - 1] as Place, places, used, rng)) {
      const found = walk([...path, next]);
      if (found) return found;
    }
    return null;
  };
  for (const start of rng.shuffle(places)) {
    const found = walk([start]);
    if (found) return found;
  }
  return rng.shuffle(places).slice(0, wanted);
}
