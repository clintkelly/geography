import type { Clue, Difficulty, Place, Question, QuestionOption } from '../types';
import records from './west.json';

export interface StateRecord {
  id: string;
  name: string;
  postal: string;
  fips: string;
  lonLat: [number, number];
  capital: string;
  /** Real, kid-familiar cities, never the capital. */
  sameStateCities: string[];
  largestCity: string;
  /** Only 'official' with a checked source. Questions never call a nickname official. */
  nickname: { text: string; status: 'official' | 'unverified'; others: string[] };
  facts: string[];
}

export const REGION_ID = 'us-west';
export const STATES = records as StateRecord[];

const wiki = (s: StateRecord) => `https://en.wikipedia.org/wiki/${s.name.replaceAll(' ', '_')}${s.id === 'washington' ? '_(state)' : ''}`;

function byDistance(s: StateRecord): StateRecord[] {
  const d = (o: StateRecord) => Math.hypot(o.lonLat[0] - s.lonLat[0], o.lonLat[1] - s.lonLat[1]);
  return STATES.filter((o) => o.id !== s.id).sort((a, b) => d(a) - d(b));
}
const near = (s: StateRecord) => byDistance(s).slice(0, 3);
const far = (s: StateRecord) => {
  const ranked = byDistance(s).reverse();
  return [ranked[0], ranked[2], ranked[4]] as StateRecord[];
};

const choices = (labels: string[]): Pick<Question, 'options' | 'acceptedId'> => ({
  options: labels.map((label, i) => ({ id: `o${i}`, label })),
  acceptedId: 'o0',
});
const markers = (s: StateRecord, others: StateRecord[]): Pick<Question, 'options' | 'acceptedId'> => ({
  options: [s, ...others].map((o): QuestionOption => ({ id: o.id, label: o.name, lonLat: o.lonLat })),
  acceptedId: s.id,
});
const clickState = (s: StateRecord): Pick<Question, 'options' | 'acceptedId'> => ({
  options: STATES.map((o): QuestionOption => ({ id: o.id, label: o.name, featureId: o.fips })),
  acceptedId: s.id,
});

function questionsFor(s: StateRecord): Question[] {
  const known = `the ${s.nickname.text}`;
  const capitalWhy = `${s.capital} is the capital of ${s.name}.`;
  const nickWhy = `${s.name} is known as ${known}.`;
  const whereWhy = `This is ${s.name}. Its capital is ${s.capital}.`;
  const q = (
    difficulty: Difficulty,
    kind: string,
    n: number,
    objective: string,
    prompt: string,
    explanation: string,
    answer: Pick<Question, 'options' | 'acceptedId'>,
    inputType: Question['inputType'] = 'choice',
  ): Question => ({
    id: `q-${kind}-${s.id}-${difficulty}-${n}`,
    version: 1,
    objectiveId: `${objective}-${s.id}`,
    inputType,
    prompt,
    explanation,
    difficulty,
    regionId: REGION_ID,
    locationId: s.id,
    sourceUrl: wiki(s),
    ...answer,
  });

  return [
    q('scout', 'capital', 1, 'capital', `What is the capital of ${s.name}?`, capitalWhy, choices([s.capital, ...far(s).map((o) => o.capital)])),
    q('scout', 'capital', 2, 'capital', `${s.capital} is the capital of which state?`, capitalWhy, choices([s.name, ...far(s).map((o) => o.name)])),
    q('scout', 'nickname', 1, 'nickname', `Which state is known as ${known}?`, nickWhy, choices([s.name, ...far(s).map((o) => o.name)])),
    q('scout', 'location', 1, 'location', `Which marker is on ${s.name}?`, whereWhy, markers(s, far(s)), 'map-marker'),

    q('ranger', 'capital', 1, 'capital', `What is the capital of ${s.name}?`, capitalWhy, choices([s.capital, ...s.sameStateCities])),
    q('ranger', 'capital', 2, 'capital', `In which state is the capital city ${s.capital}?`, capitalWhy, choices([s.name, ...near(s).map((o) => o.name)])),
    q('ranger', 'nickname', 1, 'nickname', `Which state is known as ${known}?`, nickWhy, choices([s.name, ...near(s).map((o) => o.name)])),
    q('ranger', 'location', 1, 'location', `Which marker is on ${s.name}?`, whereWhy, markers(s, near(s)), 'map-marker'),

    q('expert', 'capital', 1, 'capital', `Which of these cities is the state capital of ${s.name}?`, capitalWhy, choices([s.capital, ...s.sameStateCities])),
    q('expert', 'nickname', 1, 'nickname', `${known[0]?.toUpperCase()}${known.slice(1)}: which state is that? Click it on the map.`, nickWhy, clickState(s), 'map-click'),
    q('expert', 'location', 1, 'location', `Click ${s.name} on the map.`, whereWhy, clickState(s), 'map-click'),
    q('expert', 'capital', 2, 'capital', `The city of ${s.capital} is the capital of which state? Click it on the map.`, capitalWhy, clickState(s), 'map-click'),
  ];
}

function cluesFor(s: StateRecord): Clue[] {
  const objectiveId = `location-${s.id}`;
  const clue = (n: number, text: string): Clue => ({ id: `clue-${s.id}-${n}`, version: 1, targetId: s.id, objectiveId, text, sourceUrl: wiki(s) });
  return [
    clue(1, `Tracks lead toward the ${s.nickname.text}.`),
    clue(2, `This state's capital is ${s.capital}.`),
    clue(3, `Travelers in ${s.sameStateCities[0]} reported a sighting.`),
  ];
}

export const usPlaces: Place[] = STATES.map((s) => ({
  id: s.id,
  name: s.name,
  featureId: s.fips,
  regionId: REGION_ID,
  lonLat: s.lonLat,
  atlas: [`Capital: ${s.capital}`, `Known as the ${s.nickname.text}`, `Cities: ${s.sameStateCities.join(', ')}`, ...s.facts],
}));
export const usQuestions = STATES.flatMap(questionsFor);
export const usClues = STATES.flatMap(cluesFor);
