export interface QuestionOption {
  id: string;
  label: string;
  /** Present for map-marker options; places the marker. */
  lonLat?: readonly [number, number];
}

export interface Question {
  id: string;
  version: number;
  objectiveId: string;
  inputType: 'choice' | 'map-marker';
  prompt: string;
  options: QuestionOption[];
  acceptedId: string;
  explanation: string;
  difficulty: 'foundation' | 'challenge';
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
  isoNumeric: string;
  lonLat: readonly [number, number];
  atlas: string[];
}

export interface Species {
  id: string;
  displayName: string;
  artId: string;
  flavor: string;
}

export interface Souvenir {
  id: string;
  displayName: string;
  artId: string;
  flavor: string;
}

export interface Pack {
  version: string;
  questions: readonly Question[];
  clues: readonly Clue[];
  places: readonly Place[];
  species: readonly Species[];
  souvenirs: readonly Souvenir[];
  starterSpeciesId: string;
  regularOpponentIds: readonly string[];
  guardianIds: readonly string[];
}
