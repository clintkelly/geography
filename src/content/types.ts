export type Difficulty = 'scout' | 'ranger' | 'expert';
export const DIFFICULTIES: readonly Difficulty[] = ['scout', 'ranger', 'expert'];

export interface QuestionOption {
  id: string;
  label: string;
  /** Present for map-marker options; places the marker. */
  lonLat?: readonly [number, number];
  /** Present for map-click options; the map feature that selects this option. */
  featureId?: string;
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
}

export interface Region {
  id: string;
  label: string;
  mapId: 'world' | 'us';
  difficulties: readonly Difficulty[];
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
  /** Companions only. */
  special?: Special;
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
  starterSpeciesId: string;
  regularOpponentIds: readonly string[];
  guardianIds: readonly string[];
}
