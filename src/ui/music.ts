import { useEffect, useRef } from 'react';

export type Track = 'camp' | 'battle' | null;

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
