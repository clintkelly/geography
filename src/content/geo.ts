export interface Located {
  lonLat: readonly [number, number];
}

export const degreesApart = (a: Located, b: Located) => Math.hypot(a.lonLat[0] - b.lonLat[0], a.lonLat[1] - b.lonLat[1]);

/** Markers closer than this overlap on the map. */
export const MIN_MARKER_GAP = 4;

/** The first `count` items far enough from the anchor and from each other to tell apart on a map. */
export function spaced<T extends Located>(items: readonly T[], anchor: Located, count: number): T[] {
  const chosen: T[] = [];
  for (const item of items) {
    if (chosen.length === count) break;
    if ([anchor, ...chosen].every((o) => degreesApart(o, item) >= MIN_MARKER_GAP)) chosen.push(item);
  }
  return chosen;
}
