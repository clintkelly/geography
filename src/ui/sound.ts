import type { Settings } from '../engine/game';
import { CRY_FAMILIES, CRY_OF, type CryFamily } from '../content/cries';

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
  'special-sound': 1300,
  'special-metal': 1000,
  'special-burrow': 520,
  'special-kungfu': 1210,
  // Eggs, Lodge shields, Brain Blast and combos.
  hatch: 1730,
  egg: 860,
  shield: 620,
  brainblast: 710,
  combo: 760,
} as const;
/** Sounds with extra takes, -2 and -3. One is picked at random each time, so they don't get old. */
const TAKES: Partial<Record<keyof typeof LENGTH_MS, number>> = { correct: 3, attack: 3, hit: 3, guard: 3, win: 3, befriend: 3, special: 3 };
const FADE_MS = 100;
/** The retro effects are much louder than the others. */
const GAIN: Partial<Record<keyof typeof LENGTH_MS, number>> = { guard: 0.55, hit: 0.8, crit: 0.7, levelup: 0.6, heartbeat: 0.7, super: 0.9, streak: 0.8, recall: 0.6, 'special-flame': 0.5, 'special-gale': 0.65, 'special-stone': 0.85, 'special-volt': 0.8, 'special-sound': 0.55, combo: 0.7, brainblast: 0.8, 'special-kungfu': 0.7 };
/** Extra takes have their own length and loudness, matched to the first take. */
const TAKE: Record<string, [ms: number, gain: number]> = {
  'correct-2': [220, 1], 'correct-3': [480, 1], 'attack-2': [510, 0.65], 'attack-3': [300, 0.7], 'hit-2': [200, 0.95], 'hit-3': [440, 0.75],
  'guard-2': [240, 0.85], 'guard-3': [270, 0.6], 'win-2': [760, 1], 'win-3': [780, 1], 'befriend-2': [770, 0.55], 'befriend-3': [610, 1],
  'special-2': [1420, 1], 'special-3': [730, 1],
};

export type SoundId = keyof typeof LENGTH_MS;
/** Every file the game can play, takes included. */
export const SOUND_FILES = [...(Object.keys(LENGTH_MS) as SoundId[]).flatMap((id) => Array.from({ length: TAKES[id] ?? 1 }, (_, i) => (i === 0 ? id : `${id}-${i + 1}`))), ...CRY_FAMILIES.map((f) => `cry-${f}`)];
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

/** Where each cry's audible part ends, and how loud to play it. Measured from the files. */
const CRY: Partial<Record<CryFamily, [ms: number, gain: number]>> = {
  bark: [800, 0.65], bleat: [1010, 0.76], bubble: [1280, 0.81], buzz: [610, 0.66], chatter: [1640, 0.85], chirp: [840, 0.76], click: [910, 0.76], croak: [1750, 0.77], dolphin: [890, 0.73], ghost: [1730, 0.82], growl: [800, 0.75], grunt: [1760, 0.81], hiss: [880, 0.76], honk: [1740, 0.98], hoot: [750, 0.83], howl: [910, 0.77], neigh: [1720, 0.86], roar: [1770, 0.84], robot: [1400, 0.72], rumble: [830, 0.79], screech: [780, 0.73], squeak: [1600, 0.68], trumpet: [910, 0.77], whale: [1740, 0.84],
};

/** A creature's own pitch, from its id: the same every time, different from its neighbors. */
export function cryPitch(speciesId: string, stage = 1): number {
  let h = 0;
  for (const ch of speciesId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const own = 0.86 + ((h % 1000) / 1000) * 0.36;
  // Bigger, older forms sound deeper.
  return own * (stage >= 3 ? 0.8 : stage === 2 ? 0.9 : 1);
}

/** The creature calls out. Silent for a creature with no cry yet. */
export function playCry(speciesId: string, stage = 1) {
  const family = CRY_OF[speciesId];
  if (!family || settings.muted) return;
  try {
    const [length, gain] = CRY[family] ?? [1500, 0.8];
    const audio = new Audio(`${import.meta.env.BASE_URL}sfx/cry-${family}.mp3`);
    const volume = settings.volume * gain;
    const rate = cryPitch(speciesId, stage);
    audio.volume = volume;
    audio.playbackRate = rate;
    audio.preservesPitch = false;
    void audio.play().catch(() => undefined);
    setTimeout(() => {
      audio.volume = volume / 2;
      setTimeout(() => audio.pause(), FADE_MS);
    }, Math.max(length / rate - FADE_MS, 50));
  } catch {
    // A missing cry never interrupts play.
  }
}
