import type { Settings } from '../engine/game';

/** Where each file's audible part ends, measured from its waveform. The files run longer. */
const LENGTH_MS = {
  correct: 1000,
  'not-yet': 500,
  win: 1000,
  retreat: 800,
  card: 1000,
  attack: 700,
  guard: 350,
  special: 1000,
  hit: 600,
  befriend: 600,
  spend: 600,
} as const;
const FADE_MS = 100;
/** The retro punches are much louder than the other effects. */
const GAIN: Partial<Record<keyof typeof LENGTH_MS, number>> = { guard: 0.55, hit: 0.8 };

export type SoundId = keyof typeof LENGTH_MS;
export const SOUND_IDS = Object.keys(LENGTH_MS) as SoundId[];

let settings: Pick<Settings, 'muted' | 'volume'> = { muted: false, volume: 0.7 };

export function configureSound(next: Pick<Settings, 'muted' | 'volume'>) {
  settings = next;
}

/** Sound is decoration: a blocked, missing or failed file never interrupts play. */
export function playSound(id: SoundId, force = false, rate = 1) {
  if (settings.muted && !force) return;
  try {
    const audio = new Audio(`${import.meta.env.BASE_URL}sfx/${id}.mp3`);
    const volume = settings.volume * (GAIN[id] ?? 1);
    audio.volume = volume;
    audio.playbackRate = rate;
    audio.preservesPitch = false;
    void audio.play().catch(() => undefined);
    setTimeout(() => {
      audio.volume = volume / 2;
      setTimeout(() => audio.pause(), FADE_MS);
    }, LENGTH_MS[id] - FADE_MS);
  } catch {
    // Nothing to do; the game carries on silently.
  }
}
