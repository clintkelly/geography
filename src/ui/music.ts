import { useEffect, useRef } from 'react';
import { isExpeditionComplete, type SaveData } from '../engine/game';

export const TRAIL_TRACKS = ['trail-us', 'trail-europe', 'trail-africa', 'trail-asia', 'trail-america', 'trail-south-america', 'trail-oceania', 'trail-antarctica'] as const;
export const TRACKS = ['camp', 'battle', 'boss', 'rare', 'event', 'victory', 'lodge', 'leader', 'summit', 'study', 'quiz', ...TRAIL_TRACKS] as const;
export type Track = (typeof TRACKS)[number] | null;

/** Extra takes of each track, -2 and -3, so long play doesn't hear the same loop every time. */
const TAKES: Partial<Record<NonNullable<Track>, number>> = Object.fromEntries(TRACKS.map((t) => [t, t === 'camp' || t === 'battle' ? 3 : 2]));

/** Every music file, takes included. */
export const MUSIC_FILES = TRACKS.flatMap((t) => Array.from({ length: TAKES[t] ?? 1 }, (_, i) => (i === 0 ? t : `${t}-${i + 1}`)));

/** Each time a track starts, one of its takes is picked. Exported for tests. */
export function takeFile(track: NonNullable<Track>, random = Math.random()): string {
  const n = Math.floor(random * (TAKES[track] ?? 1)) + 1;
  return n > 1 ? `${track}-${n}` : track;
}

const trailTrack = (regionId: string): Track => {
  const continent = regionId.split('-')[0];
  return `trail-${continent === 'south' ? 'south-america' : continent}` as Track;
};

/** Each continent has a trail theme, and big moments have their own. */
export function trackFor(save: SaveData | null | undefined): Track {
  if (!save) return null;
  const e = save.expedition;
  if (save.lodgeQuiz && !save.lodgeQuiz.outcome) return 'quiz';
  if (!e) return save.lastSummary || save.hatched ? 'victory' : 'camp';
  // Ranger Lodges have their own hall theme, a leader theme, and a theme for the last Lodge.
  if (e.lodgeId) {
    if (isExpeditionComplete(e)) return 'victory';
    const role = e.battle ? e.slots[e.battle.slotIndex]?.role : undefined;
    if (!role || role === 'junior') return e.battle ? 'battle' : 'lodge';
    return e.lodgeId === 'summit' ? 'summit' : 'leader';
  }
  if (e.battle) {
    const slot = e.slots[e.battle.slotIndex];
    if (slot?.rare) return 'rare';
    return slot?.kind === 'guardian' ? 'boss' : 'battle';
  }
  // Math and Words trails have their own thinking theme.
  return e.event ? 'event' : e.focus === 'math' || e.focus === 'words' ? 'study' : trailTrack(e.regionId);
}

/** Quiet looping music. It starts on the first key or click, which browsers require, and never interrupts play. */
export function useMusic(track: Track, volume: number, muted: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const wanted = useRef({ track, volume, muted });
  const playing = useRef<{ track: NonNullable<Track>; file: string } | null>(null);
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
      if (playing.current?.track !== t) playing.current = { track: t, file: takeFile(t) };
      const src = `${import.meta.env.BASE_URL}music/${playing.current.file}.mp3`;
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
    if (track && playing.current?.track !== track) playing.current = { track, file: takeFile(track) };
    const src = `${import.meta.env.BASE_URL}music/${playing.current?.file ?? track}.mp3`;
    if (!track || muted || volume === 0) el.pause();
    else {
      if (!el.src.endsWith(src)) el.src = src;
      void el.play().catch(() => undefined);
    }
  }, [track, volume, muted]);
}
