import type { Settings } from '../engine/game';

/** Where each file's audible part ends, measured from its waveform. The files run longer. */
const LENGTH_MS = {
  correct: 1000,
  'not-yet': 500,
  win: 1000,
  retreat: 800,
  card: 1000,
  attack: 700,
  guard: 900,
  special: 1000,
  hit: 550,
  befriend: 600,
  spend: 600,
} as const;
const FADE_MS = 100;

export type SoundId = keyof typeof LENGTH_MS;
export const SOUND_IDS = Object.keys(LENGTH_MS) as SoundId[];

let settings: Pick<Settings, 'muted' | 'volume'> = { muted: false, volume: 0.7 };

export function configureSound(next: Pick<Settings, 'muted' | 'volume'>) {
  settings = next;
}

/** Sound is decoration: a blocked, missing or failed file never interrupts play. */
export function playSound(id: SoundId, force = false) {
  if (settings.muted && !force) return;
  try {
    const audio = new Audio(`${import.meta.env.BASE_URL}sfx/${id}.mp3`);
    audio.volume = settings.volume;
    void audio.play().catch(() => undefined);
    setTimeout(() => {
      audio.volume = settings.volume / 2;
      setTimeout(() => audio.pause(), FADE_MS);
    }, LENGTH_MS[id] - FADE_MS);
  } catch {
    // Nothing to do; the game carries on silently.
  }
}
