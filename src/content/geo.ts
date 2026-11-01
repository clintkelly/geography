export interface Located {
  lonLat: readonly [number, number];
}

/** Longitude means little near the South Pole, so Antarctica measures on a flat view from above. */
const polar = ({ lonLat: [lon, lat] }: Located) => {
  const r = 90 + lat;
  const angle = (lon * Math.PI) / 180;
  return [r * Math.cos(angle), r * Math.sin(angle)] as const;
};

export function degreesApart(a: Located, b: Located): number {
  const [from, to] = a.lonLat[1] < -60 && b.lonLat[1] < -60 ? [polar(a), polar(b)] : [a.lonLat, b.lonLat];
  return Math.hypot((from[0] as number) - (to[0] as number), (from[1] as number) - (to[1] as number));
}

/** The first `count` items at least `gap` degrees from the anchor and each other, so their map markers don't overlap. */
export function spaced<T extends Located>(items: readonly T[], anchor: Located, count: number, gap: number): T[] {
  const chosen: T[] = [];
  for (const item of items) {
    if (chosen.length === count) break;
    if ([anchor, ...chosen].every((o) => degreesApart(o, item) >= gap)) chosen.push(item);
  }
  return chosen;
}
