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
  heartbeat: 650,
  levelup: 1000,
  evolve: 1300,
  crit: 450,
  // Added for variety, measured from their waveforms.
  coin: 200,
  zoom: 420,
  super: 420,
  streak: 390,
  free: 1270,
  recall: 1150,
  locked: 690,
  'special-flame': 720,
  'special-tide': 750,
  'special-leaf': 600,
  'special-gale': 690,
  'special-frost': 800,
  'special-stone': 850,
  'special-volt': 460,
  'special-light': 780,
  'special-spirit': 700,
} as const;
/** Sounds with extra takes, -2 and -3. One is picked at random each time, so they don't get old. */
const TAKES: Partial<Record<keyof typeof LENGTH_MS, number>> = { correct: 3, attack: 3, hit: 3, guard: 3, win: 3, befriend: 3, special: 3 };
const FADE_MS = 100;
/** The retro effects are much louder than the others. */
const GAIN: Partial<Record<keyof typeof LENGTH_MS, number>> = { guard: 0.55, hit: 0.8, crit: 0.7, levelup: 0.6, heartbeat: 0.7, super: 0.9, streak: 0.8, recall: 0.6, 'special-flame': 0.5, 'special-gale': 0.65, 'special-stone': 0.85, 'special-volt': 0.8 };
/** Extra takes have their own length and loudness, matched to the first take. */
const TAKE: Record<string, [ms: number, gain: number]> = {
  'correct-2': [220, 1], 'correct-3': [480, 1], 'attack-2': [510, 0.65], 'attack-3': [300, 0.7], 'hit-2': [200, 0.95], 'hit-3': [440, 0.75],
  'guard-2': [240, 0.85], 'guard-3': [270, 0.6], 'win-2': [760, 1], 'win-3': [780, 1], 'befriend-2': [770, 0.55], 'befriend-3': [610, 1],
  'special-2': [1420, 1], 'special-3': [730, 1],
};

export type SoundId = keyof typeof LENGTH_MS;
/** Every file the game can play, takes included. */
export const SOUND_FILES = (Object.keys(LENGTH_MS) as SoundId[]).flatMap((id) => Array.from({ length: TAKES[id] ?? 1 }, (_, i) => (i === 0 ? id : `${id}-${i + 1}`)));
export const SOUND_IDS = Object.keys(LENGTH_MS) as SoundId[];

let settings: Pick<Settings, 'muted' | 'volume'> = { muted: false, volume: 0.7 };

export function configureSound(next: Pick<Settings, 'muted' | 'volume'>) {
  settings = next;
}

/** Sound is decoration: a blocked, missing or failed file never interrupts play. */
export function playSound(id: SoundId, force = false, rate = 1) {
  if (settings.muted && !force) return;
  try {
    const takes = TAKES[id] ?? 1;
    const take = Math.floor(Math.random() * takes) + 1;
    const file = take > 1 ? `${id}-${take}` : id;
    const [length, gain] = TAKE[file] ?? [LENGTH_MS[id], GAIN[id] ?? 1];
    const audio = new Audio(`${import.meta.env.BASE_URL}sfx/${file}.mp3`);
    const volume = settings.volume * gain;
    audio.volume = volume;
    audio.playbackRate = rate;
    audio.preservesPitch = false;
    void audio.play().catch(() => undefined);
    setTimeout(() => {
      audio.volume = volume / 2;
      setTimeout(() => audio.pause(), FADE_MS);
    }, Math.max(length - FADE_MS, 50));
  } catch {
    // Nothing to do; the game carries on silently.
  }
}
