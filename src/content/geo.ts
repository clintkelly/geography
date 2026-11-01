export interface Located {
  lonLat: readonly [number, number];
}

export const degreesApart = (a: Located, b: Located) => Math.hypot(a.lonLat[0] - b.lonLat[0], a.lonLat[1] - b.lonLat[1]);

/** The first `count` items at least `gap` degrees from the anchor and each other, so their map markers don't overlap. */
export function spaced<T extends Located>(items: readonly T[], anchor: Located, count: number, gap: number): T[] {
  const chosen: T[] = [];
  for (const item of items) {
    if (chosen.length === count) break;
    if ([anchor, ...chosen].every((o) => degreesApart(o, item) >= gap)) chosen.push(item);
  }
  return chosen;
}
