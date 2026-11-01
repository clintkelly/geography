import { useEffect, useRef } from 'react';
import type { SaveData } from '../engine/game';

export const TRAIL_TRACKS = ['trail-us', 'trail-europe', 'trail-africa', 'trail-asia', 'trail-america', 'trail-south-america', 'trail-oceania', 'trail-antarctica'] as const;
export const TRACKS = ['camp', 'battle', 'boss', 'rare', 'event', 'victory', ...TRAIL_TRACKS] as const;
export type Track = (typeof TRACKS)[number] | null;

const trailTrack = (regionId: string): Track => {
  const continent = regionId.split('-')[0];
  return `trail-${continent === 'south' ? 'south-america' : continent}` as Track;
};

/** Each continent has a trail theme, and big moments have their own. */
export function trackFor(save: SaveData | null | undefined): Track {
  if (!save) return null;
  const e = save.expedition;
  if (!e) return save.lastSummary ? 'victory' : 'camp';
  if (e.battle) {
    const slot = e.slots[e.battle.slotIndex];
    if (slot?.rare) return 'rare';
    return slot?.kind === 'guardian' ? 'boss' : 'battle';
  }
  return e.event ? 'event' : trailTrack(e.regionId);
}

/** Quiet looping music. It starts on the first key or click, which browsers require, and never interrupts play. */
export function useMusic(track: Track, volume: number, muted: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const wanted = useRef({ track, volume, muted });
  wanted.current = { track, volume, muted };

  useEffect(() => {
    const apply = () => {
      const { track: t, volume: v, muted: m } = wanted.current;
      if (!audio.current) {
        audio.current = new Audio();
        audio.current.loop = true;
      }
      const el = audio.current;
      el.volume = v;
      if (!t || m || v === 0) {
        el.pause();
        return;
      }
      const src = `${import.meta.env.BASE_URL}music/${t}.mp3`;
      if (!el.src.endsWith(src)) el.src = src;
      void el.play().catch(() => undefined);
    };
    apply();
    window.addEventListener('pointerdown', apply);
    window.addEventListener('keydown', apply);
    return () => {
      window.removeEventListener('pointerdown', apply);
      window.removeEventListener('keydown', apply);
      audio.current?.pause();
    };
  }, []);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = volume;
    const src = `${import.meta.env.BASE_URL}music/${track}.mp3`;
    if (!track || muted || volume === 0) el.pause();
    else {
      if (!el.src.endsWith(src)) el.src = src;
      void el.play().catch(() => undefined);
    }
  }, [track, volume, muted]);
}
