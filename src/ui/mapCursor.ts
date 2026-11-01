import { useState } from 'react';
import { useKeys } from './keys';

export interface CursorItem {
  id: string;
  x: number;
  y: number;
}

type Direction = 'left' | 'right' | 'up' | 'down';
const VECTORS: Record<Direction, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

/** The closest place in a direction, preferring ones straight ahead over ones off to the side. */
export function nextInDirection(items: readonly CursorItem[], from: CursorItem, direction: Direction): string | null {
  const [dx, dy] = VECTORS[direction];
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    if (item.id === from.id) continue;
    const vx = item.x - from.x;
    const vy = item.y - from.y;
    const ahead = vx * dx + vy * dy;
    const aside = Math.abs(vx * dy - vy * dx);
    if (ahead <= 0 || aside > ahead * 2.5) continue;
    const score = ahead + aside * 2;
    if (!best || score < best.score) best = { id: item.id, score };
  }
  return best?.id ?? null;
}

/** The place nearest the middle, where the cursor starts. */
export function centerItem(items: readonly CursorItem[]): CursorItem | undefined {
  const cx = items.reduce((sum, i) => sum + i.x, 0) / items.length;
  const cy = items.reduce((sum, i) => sum + i.y, 0) / items.length;
  return [...items].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
}

/** Arrow keys walk a highlight between places on a blank map, and Enter picks one. Names stay hidden. */
export function useMapCursor(items: readonly CursorItem[], onPick: (id: string) => void, active: boolean): string | null {
  const [chosen, setChosen] = useState<string | null>(null);
  const cursor = active && items.some((i) => i.id === chosen) ? chosen : null;

  const move = (direction: Direction) => () => {
    const current = items.find((i) => i.id === cursor);
    if (!current) {
      setChosen(centerItem(items)?.id ?? null);
      return;
    }
    const next = nextInDirection(items, current, direction);
    if (next) setChosen(next);
  };

  const keys: Record<string, () => void> = {};
  if (active) Object.assign(keys, { arrowleft: move('left'), arrowright: move('right'), arrowup: move('up'), arrowdown: move('down') });
  if (active && cursor) keys.enter = () => onPick(cursor);
  useKeys(keys);
  return cursor;
}
