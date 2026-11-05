/**
 * Recoloring a sprite by its palette, for multicolor shinies. Pixel art uses few colors, and a
 * creature's parts are usually different colors, so grouping its colors finds its parts:
 * a bee's yellow and black stripes, a parrot's grey feathers and red tail.
 *
 * Pixels fall into groups: the dark outline (never changed), the greys and whites, and up to
 * two main hues. The groups come from the creature's normal image, so every pose and the
 * attack and hit frames color the same parts the same way.
 */

export interface Palette {
  /** The main hues, in degrees, sorted so the same creature always lists them in the same order. */
  hues: number[];
}

/** A color to paint a group: a hue, or black or white. */
export type Paint = { hue: number; sat: number; light?: number } | 'black' | 'white';

const OUTLINE = 0.07;
const GREY = 0.2;
const BINS = 36;

function hsl(r: number, g: number, b: number): [number, number, number] {
  const x = r / 255;
  const y = g / 255;
  const z = b / 255;
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return [h * 60, s, l];
}

function rgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

type Kind = 'clear' | 'outline' | 'grey' | 'hue';
function kindOf(data: Uint8ClampedArray, i: number): { kind: Kind; h: number; s: number; l: number } {
  if ((data[i + 3] as number) < 40) return { kind: 'clear', h: 0, s: 0, l: 0 };
  const [h, s, l] = hsl(data[i] as number, data[i + 1] as number, data[i + 2] as number);
  if (l < OUTLINE) return { kind: 'outline', h, s, l };
  if (s < GREY || l > 0.94) return { kind: 'grey', h, s, l };
  return { kind: 'hue', h, s, l };
}

/** Finds a sprite's main hues: the biggest one, and a second if it is clearly different and not tiny. */
export function findPalette(data: Uint8ClampedArray): Palette {
  const bins = new Array<number>(BINS).fill(0);
  const sums = new Array<number>(BINS).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const p = kindOf(data, i);
    if (p.kind !== 'hue') continue;
    const bin = Math.floor(p.h / (360 / BINS)) % BINS;
    bins[bin] = (bins[bin] as number) + 1;
    sums[bin] = (sums[bin] as number) + p.h;
  }
  const total = bins.reduce((a, b) => a + b, 0);
  if (total === 0) return { hues: [] };
  // A peak is a bin plus its neighbors, so a hue split across two bins still counts as one.
  const weight = (b: number) => (bins[(b + BINS - 1) % BINS] as number) + (bins[b] as number) + (bins[(b + 1) % BINS] as number);
  const order = Array.from({ length: BINS }, (_, b) => b).sort((x, y) => weight(y) - weight(x));
  const top = order[0] as number;
  const center = (b: number) => (bins[b] ? (sums[b] as number) / (bins[b] as number) : (b + 0.5) * (360 / BINS));
  const hues = [center(top)];
  const second = order.find((b) => apart(center(b), hues[0] as number) >= 35 && weight(b) >= total * 0.07);
  if (second !== undefined) hues.push(center(second));
  return { hues: hues.sort((a, b) => a - b) };
}

/** Which group a pixel belongs to: 0 for greys and whites, then 1 and 2 for the main hues. Null keeps it as is. */
function groupOf(p: ReturnType<typeof kindOf>, palette: Palette): number | null {
  if (p.kind === 'clear' || p.kind === 'outline') return null;
  if (p.kind === 'grey' || palette.hues.length === 0) return 0;
  let best = 0;
  palette.hues.forEach((h, i) => { if (apart(p.h, h) < apart(p.h, palette.hues[best] as number)) best = i; });
  return best + 1;
}

/** Paints each group its own color, keeping each pixel's light and shade. Changes `data` in place. */
export function recolor(data: Uint8ClampedArray, palette: Palette, paints: readonly Paint[]): void {
  for (let i = 0; i < data.length; i += 4) {
    const p = kindOf(data, i);
    const group = groupOf(p, palette);
    if (group === null) continue;
    const paint = paints[group % paints.length] as Paint;
    let out: [number, number, number];
    if (paint === 'black') out = rgb(0, 0, 0.16 + p.l * 0.42);
    else if (paint === 'white') out = rgb(0, 0, 0.62 + p.l * 0.38);
    else out = rgb(paint.hue, paint.sat, Math.min(0.92, Math.max(0.12, p.l * (paint.light ?? 1))));
    data[i] = out[0];
    data[i + 1] = out[1];
    data[i + 2] = out[2];
  }
}
