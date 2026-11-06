import type { Lodge } from './lodges';
import type { TypedAnswer } from '../engine/answers';
import type { Moves } from './moves';
export type CreatureType = 'tide' | 'flame' | 'leaf' | 'stone' | 'gale' | 'frost' | 'volt' | 'light' | 'spirit' | 'sound' | 'metal' | 'burrow' | 'kungfu';
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
  /** Shows this flag instead of the label until the question is answered. */
  flag?: string;
  /** Something true about this option, shown if a child picks it by mistake. */
  about?: string;
}

export interface Question {
  id: string;
  version: number;
  objectiveId: string;
  /** 'typed' asks the child to type a number, such as a fraction, instead of picking one. */
  inputType: 'choice' | 'map-marker' | 'map-click' | 'typed';
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
  /** What it asks about, for the Camp focus setting. */
  topic?: 'location' | 'capital' | 'nickname' | 'fact' | 'flag' | 'basics' | 'animal' | 'history' | 'math' | 'word';
  /** For a typed question: the value that counts as right. */
  typed?: TypedAnswer;
  /** A tip shown after a miss on a study question, like the trick to adding fractions. */
  hint?: string;
  /** A flag shown with the question. */
  flag?: string;
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
  mapId: 'world' | 'pacific' | 'antarctica' | 'us';
  /** Groups regions in the picker. */
  continent: string;
  difficulties: readonly Difficulty[];
  /** Minimum distance between map markers, in degrees. */
  markerGap: number;
}

export interface Special {
  name: string;
  template: 'strong' | 'heal' | 'protect';
  /** The color of its burst on screen. */
  color: string;
}

/** A Wild Path: one way a branching creature can grow up, decided by how it was raised. */
export type PathId = 'scholar' | 'ranger' | 'banner';
export interface WildPath {
  id: PathId;
  /** The path's type, from stage 2 on. */
  type: CreatureType;
  evolutions: readonly [{ name: string; artId: string }, { name: string; artId: string }];
  special: Special;
}

export interface Species {
  id: string;
  displayName: string;
  artId: string;
  flavor: string;
  special: Special;
  /** Its own Attack and Guard. */
  moves: Moves;
  /** Regions this creature can be hunted and met in. */
  homes: readonly string[];
  /** Landscapes where its Attack gets the home-turf bonus. */
  habitats: readonly string[];
  /** Evolved forms, for stage 2 and stage 3. Rare creatures have none. */
  evolutions?: readonly { name: string; artId: string }[];
  /** Offered only once a child has found every place in its region. */
  rare?: boolean;
  /** Met only on trails at this difficulty or harder. */
  minDifficulty?: Exclude<Difficulty, 'scout'>;
  /** A study creature: it lives on Math or Words trails instead of in a region. */
  subject?: 'math' | 'words';
  /** Hatches from this kind of study egg. Egg creatures live nowhere else. */
  egg?: 'math' | 'words';
  /** A Lodge legendary, given for a Gold patch. */
  legendary?: boolean;
  /** Just added to the game: shown first in sightings and on trails until befriended. */
  fresh?: boolean;
  /** Comes out only at night, by the player's clock. */
  night?: boolean;
  /** Branching evolution: at stage 2 it follows one of these, and takes its type, look and Special. */
  paths?: readonly WildPath[];
  /** A continent boss, offered once every region on its continent is stamped. */
  boss?: { move: string; warning: string };
  type: CreatureType;
  /** A second type. A dual-type creature attacks with whichever type works best. */
  secondType?: CreatureType;
  /** The way the art faces, so a companion can be mirrored to face its opponent. */
  facing: 'left' | 'right';
}

/** A collectible card for one place. */
export interface StateCard {
  flag?: string;
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
  /** Vocabulary units, for the Words settings. */
  wordUnits?: readonly { id: string; title: string; words: number }[];
  /** Ranger Lodges, taken in order. */
  lodges?: readonly Lodge[];
}
