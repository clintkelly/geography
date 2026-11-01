export type Difficulty = 'scout' | 'ranger' | 'expert';
export const DIFFICULTIES: readonly Difficulty[] = ['scout', 'ranger', 'expert'];

export interface QuestionOption {
  id: string;
  label: string;
  /** Present for map-marker options; places the marker. */
  lonLat?: readonly [number, number];
  /** Present for map-click options; the map feature that selects this option. */
  featureId?: string;
  /** Too small to click, so the map draws a dot for it. */
  tiny?: boolean;
}

export interface Question {
  id: string;
  version: number;
  objectiveId: string;
  inputType: 'choice' | 'map-marker' | 'map-click';
  prompt: string;
  options: QuestionOption[];
  acceptedId: string;
  explanation: string;
  difficulty: Difficulty;
  regionId: string;
  sourceUrl: string;
  /** Shown large after a correct answer, to be remembered. */
  fieldNote?: string;
  /** Identifies that fact, so the game knows the child has seen it. */
  noteId?: string;
  /** This question tests a Field Note, and appears only after the child has seen it. */
  recallOf?: string;
  /** Destination this question is local to, if any. */
  locationId?: string;
}

export interface Clue {
  id: string;
  version: number;
  targetId: string;
  objectiveId: string;
  text: string;
  sourceUrl: string;
}

export interface Place {
  id: string;
  name: string;
  featureId: string;
  regionId: string;
  lonLat: readonly [number, number];
  atlas: string[];
  tiny?: boolean;
  /** Which battle backdrop fits this place. */
  biome: string;
  /** Connected places. Without this, trails use the nearest places. */
  neighbors?: readonly string[];
}

export interface Region {
  id: string;
  label: string;
  mapId: 'world' | 'us';
  difficulties: readonly Difficulty[];
  /** Minimum distance between map markers, in degrees. */
  markerGap: number;
}

export interface Special {
  name: string;
  template: 'strong' | 'heal' | 'protect';
}

export interface Species {
  id: string;
  displayName: string;
  artId: string;
  flavor: string;
  special: Special;
  /** Regions this creature can be hunted and met in. */
  homes: readonly string[];
  /** The way the art faces, so a companion can be mirrored to face its opponent. */
  facing: 'left' | 'right';
}

/** A collectible card for one place. */
export interface StateCard {
  placeId: string;
  name: string;
  artId: string;
  subtitle: string;
  capital: string;
  facts: string[];
}

export interface Souvenir {
  id: string;
  displayName: string;
  artId: string;
  flavor: string;
}

export interface Pack {
  version: string;
  regions: readonly Region[];
  questions: readonly Question[];
  clues: readonly Clue[];
  places: readonly Place[];
  species: readonly Species[];
  souvenirs: readonly Souvenir[];
  cards: readonly StateCard[];
  starterSpeciesId: string;
  /** Offered first in every region until it is befriended. */
  featuredSpeciesId: string;
}
