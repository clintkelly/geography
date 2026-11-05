import type { CSSProperties } from 'react';
import type { Paint } from './palette';

/**
 * A shiny creature's colors. Each shiny gets its own from its id, so it never changes:
 * one of the rainbow colors, black or white. A rarer multicolor shiny paints its parts
 * different colors instead.
 */
export interface ShinyLook {
  a: ShinyColor;
  /** A multicolor shiny's colors: for its greys and whites, then its two main colors. */
  parts?: [ShinyColor, ShinyColor, ShinyColor];
}

export type ShinyColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'indigo' | 'violet' | 'pink' | 'black' | 'white';
export const SHINY_COLORS: readonly ShinyColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'pink', 'black', 'white'];

/** Sepia gives a warm base tone of about 35 degrees, so each hue turns from there. */
const tint = (hue: number, light = 1) => `grayscale(1) sepia(1) saturate(5) hue-rotate(${hue - 35}deg) brightness(${light})`;
export const SHINY_FILTER: Record<ShinyColor, string> = {
  red: tint(0, 0.95),
  orange: tint(28, 1.05),
  yellow: tint(55, 1.2),
  green: tint(120),
  blue: tint(210),
  indigo: tint(245, 0.9),
  violet: tint(280),
  pink: tint(325, 1.15),
  black: 'grayscale(1) brightness(0.62) contrast(1.2)',
  white: 'grayscale(1) brightness(1.5) contrast(0.75)',
};

const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/** About one shiny in five is multicolor. */
const MULTI_CHANCE = 0.2;

const isColor = (x: string): x is ShinyColor => (SHINY_COLORS as readonly string[]).includes(x);

/**
 * A shiny's look. Colors a child picked win: one color tints it all, and a main color with an
 * accent paints its greys the main color and its other colors the accent.
 */
export function shinyLook(instanceId: string, chosen?: readonly string[]): ShinyLook {
  const picked = (chosen ?? []).filter(isColor);
  if (picked.length === 1) return { a: picked[0] as ShinyColor };
  if (picked.length >= 2) {
    const [main, accent] = picked as [ShinyColor, ShinyColor];
    return { a: main, parts: [main, accent, accent] };
  }
  const h = hash(`look:${instanceId}`);
  const a = SHINY_COLORS[h % SHINY_COLORS.length] as ShinyColor;
  if ((hash(`multi:${instanceId}`) % 1000) >= MULTI_CHANCE * 1000) return { a };
  // Three different colors, the first one being its single color.
  const rest = SHINY_COLORS.filter((c) => c !== a);
  const m = hash(`parts:${instanceId}`);
  const b = rest[m % rest.length] as ShinyColor;
  const c = rest.filter((x) => x !== b)[(m >>> 12) % (rest.length - 1)] as ShinyColor;
  return { a, parts: [a, b, c] };
}

/** How each color paints a part of a multicolor shiny. */
export const SHINY_PAINT: Record<ShinyColor, Paint> = {
  red: { hue: 0, sat: 0.8 },
  orange: { hue: 28, sat: 0.9 },
  yellow: { hue: 50, sat: 0.9, light: 1.15 },
  green: { hue: 125, sat: 0.65 },
  blue: { hue: 212, sat: 0.75 },
  indigo: { hue: 245, sat: 0.6, light: 0.9 },
  violet: { hue: 280, sat: 0.6 },
  pink: { hue: 325, sat: 0.7, light: 1.15 },
  black: 'black',
  white: 'white',
};

/** A swatch for each color, for picking one. */
export const SWATCH: Record<ShinyColor, string> = { red: '#d83030', orange: '#f08a20', yellow: '#f2c81a', green: '#3aa84a', blue: '#2f7ad8', indigo: '#4a3fb0', violet: '#9a48c8', pink: '#f07ab8', black: '#3a3a3a', white: '#f4f4f4' };

export const NAMES: Record<ShinyColor, string> = { red: 'Red', orange: 'Orange', yellow: 'Gold', green: 'Green', blue: 'Blue', indigo: 'Indigo', violet: 'Violet', pink: 'Pink', black: 'Black', white: 'White' };
export function shinyName(look: ShinyLook): string {
  if (!look.parts) return NAMES[look.a];
  const names = [...new Set(look.parts)].map((c) => NAMES[c]);
  return `Multicolor ${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The CSS for a shiny, read by the glow animation. A multicolor shiny is already painted, so it only glows. */
export const lookStyle = (look: ShinyLook): CSSProperties => ({ '--look': look.parts ? 'saturate(1.1)' : SHINY_FILTER[look.a] } as CSSProperties);
