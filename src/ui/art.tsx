import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ANIMATED_ART, idleFrames } from '../content/animations';
import type { Species } from '../content/types';
import type { Pose } from './battleAnimation';
import { findPalette, recolor, type Palette } from './palette';
import { lookStyle, SHINY_PAINT, type ShinyLook } from './shiny';

export const artUrl = (id: string) => `${import.meta.env.BASE_URL}art/${id}.png`;
/** Evolved forms have one sprite, which moves through the same lunges and shakes. */
export const poseUrl = (s: Species, pose: Pose, artId = s.artId) => artUrl(pose === 'idle' || artId !== s.artId ? artId : `${artId}-${pose}`);

const images = new Map<string, Promise<ImageData>>();
const palettes = new Map<string, Promise<Palette>>();
const painted = new Map<string, Promise<string>>();
const ready = new Map<string, string>();

function pixels(src: string): Promise<ImageData> {
  let found = images.get(src);
  if (!found) {
    found = new Promise<ImageData>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { reject(new Error('No canvas')); return; }
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    });
    images.set(src, found);
  }
  return found;
}

/** Paints a multicolor shiny once, using the groups from its normal image so every pose matches. */
function paint(src: string, base: string, parts: readonly string[]): Promise<string> {
  const key = `${src}|${base}|${parts.join(',')}`;
  let found = painted.get(key);
  if (!found) {
    let palette = palettes.get(base);
    if (!palette) { palette = pixels(base).then((d) => findPalette(d.data)); palettes.set(base, palette); }
    found = Promise.all([pixels(src), palette]).then(([d, pal]) => {
      const copy = new ImageData(new Uint8ClampedArray(d.data), d.width, d.height);
      recolor(copy.data, pal, parts.map((c) => SHINY_PAINT[c as keyof typeof SHINY_PAINT]));
      const canvas = document.createElement('canvas');
      canvas.width = d.width;
      canvas.height = d.height;
      canvas.getContext('2d')?.putImageData(copy, 0, 0);
      const url = canvas.toDataURL();
      ready.set(key, url);
      return url;
    });
    painted.set(key, found);
  }
  return found;
}

/** The painted image for a multicolor shiny, or null until it's ready (and always null otherwise). */
function useMulticolor(src: string, base: string, look: ShinyLook): string | null {
  const key = look.parts ? `${src}|${base}|${look.parts.join(',')}` : '';
  const [url, setUrl] = useState<string | null>(() => (key ? ready.get(key) ?? null : null));
  useEffect(() => {
    if (!look.parts) { setUrl(null); return; }
    let live = true;
    setUrl(ready.get(key) ?? null);
    paint(src, base, look.parts).then((u) => { if (live) setUrl(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [key]); // eslint-disable-line
  return url;
}

/**
 * A creature image in its shiny colors. `base` is the creature's normal image, which decides
 * a multicolor shiny's parts. Until the painting is ready it shows its single color.
 */
export function ShinyImg({ src, base, look, className, width, height, alt = '' }: { src: string; base?: string; look: ShinyLook; className: string; width?: number; height?: number; alt?: string }) {
  const multi = useMulticolor(src, base ?? src, look);
  return <img src={multi ?? src} alt={alt} width={width} height={height} className={`${className} shiny`} style={lookStyle(multi ? look : { a: look.a })} />;
}

/** One shared clock for every idle animation, so they all step together and only one timer runs. */
const IDLE_MS = 220;
let tick = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => { tick++; listeners.forEach((l) => l()); }, IDLE_MS);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = undefined; }
  };
}
const animated = new Set(ANIMATED_ART);
export const isAnimated = (artId: string) => animated.has(artId);

/** The image to show now: an animated sprite steps through its idle frames, anything else stays still. */
export function useIdleUrl(artId: string, still: string): string {
  const now = useSyncExternalStore(isAnimated(artId) ? subscribe : () => () => undefined, () => (isAnimated(artId) ? tick : 0));
  if (!isAnimated(artId)) return still;
  const frames = idleFrames(artId);
  return artUrl(frames[now % frames.length] as string);
}

export function Sprite({ id, size, flip, className, alt = '', shiny }: { id: string; size: number; flip?: boolean; className?: string; alt?: string; shiny?: ShinyLook | undefined }) {
  const classes = `sprite ${flip ? 'flip ' : ''}${className ?? ''}`;
  const src = useIdleUrl(id, artUrl(id));
  if (!shiny) return <img src={src} alt={alt} width={size} height={size} className={classes} />;
  return <Sparkle size={size}><ShinyImg src={artUrl(id)} look={shiny} className={classes} width={size} height={size} alt={alt} /></Sparkle>;
}

/** Twinkling stars around a shiny creature. */
export function Sparkle({ size, children }: { size: number; children: ReactNode }) {
  return (
    <span className="shiny-wrap" style={{ width: size, height: size }}>
      {children}
      {[0, 1, 2, 3].map((i) => <span key={i} className={`twinkle twinkle-${i}`} aria-hidden="true">✦</span>)}
    </span>
  );
}

/** A small effect sprite, decorative only. */
export const Fx = ({ id, className }: { id: string; className?: string }) => <img src={artUrl(`fx-${id}`)} alt="" className={`fx ${className ?? ''}`} />;

export function CardArt({ id, width }: { id: string; width: number }) {
  return <img src={artUrl(id)} alt="" width={width} height={(width * 96) / 128} className="sprite card-art" />;
}
