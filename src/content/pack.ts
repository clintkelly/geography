import type { Clue, Pack, Place, Question, QuestionOption } from './types';

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

const places: Place[] = [
  { id: 'portugal', name: 'Portugal', isoNumeric: '620', lonLat: [-8.2, 39.6], atlas: ['Capital: Lisbon', 'Western edge of mainland Europe, on the Atlantic Ocean', 'Its only land neighbor is Spain'] },
  { id: 'spain', name: 'Spain', isoNumeric: '724', lonLat: [-3.6, 40.2], atlas: ['Capital: Madrid', 'Shares the Iberian Peninsula with Portugal', 'The Pyrenees mountains separate it from France'] },
  { id: 'france', name: 'France', isoNumeric: '250', lonLat: [2.5, 46.8], atlas: ['Capital: Paris, on the River Seine', 'North of Spain, across the Pyrenees', 'Coasts on the Atlantic, the English Channel, and the Mediterranean'] },
  { id: 'uk', name: 'United Kingdom', isoNumeric: '826', lonLat: [-1.8, 52.9], atlas: ['Capital: London, on the River Thames', 'Mostly on the island of Great Britain', 'Across the English Channel from France'] },
  { id: 'italy', name: 'Italy', isoNumeric: '380', lonLat: [12.5, 43.0], atlas: ['Capital: Rome, on the River Tiber', 'A boot-shaped peninsula reaching into the Mediterranean Sea', 'The Alps lie along its northern border'] },
  { id: 'greece', name: 'Greece', isoNumeric: '300', lonLat: [22.0, 39.3], atlas: ['Capital: Athens', 'At the southern end of the Balkan Peninsula', 'Has thousands of islands in the Aegean and Ionian Seas'] },
];

const inSentence = (p: Place) => (p.id === 'uk' ? 'the United Kingdom' : p.name);

const clue = (targetId: string, n: number, text: string, page: string): Clue => ({
  id: `clue-${targetId}-${n}`,
  version: 1,
  targetId,
  objectiveId: `location-${targetId}`,
  text,
  sourceUrl: wiki(page),
});

const clues: Clue[] = [
  clue('portugal', 1, 'Tracks were spotted in the country directly west of Spain, facing the Atlantic Ocean.', 'Portugal'),
  clue('portugal', 2, 'The capital of this country is Lisbon, where the River Tagus meets the sea.', 'Lisbon'),
  clue('spain', 1, 'A sighting came from the larger of the two countries on the Iberian Peninsula.', 'Iberian_Peninsula'),
  clue('spain', 2, 'The capital of this country is Madrid, close to the middle of the peninsula.', 'Madrid'),
  clue('france', 1, 'Listen for calls in the country just north of Spain, on the far side of the Pyrenees mountains.', 'Pyrenees'),
  clue('france', 2, 'The River Seine runs through the capital of this country, Paris.', 'Paris'),
  clue('uk', 1, 'Most of this country lies on the island of Great Britain, across the English Channel from France.', 'United_Kingdom'),
  clue('uk', 2, 'The River Thames flows through the capital of this country, London.', 'London'),
  clue('italy', 1, 'Feathers were found in the boot-shaped country reaching into the Mediterranean Sea.', 'Italy'),
  clue('italy', 2, 'The River Tiber flows through the capital of this country, Rome.', 'Rome'),
  clue('greece', 1, 'A sighting came from the southern end of the Balkan Peninsula, among thousands of islands.', 'Greece'),
  clue('greece', 2, 'The capital of this country is Athens, below the ancient Acropolis.', 'Athens'),
];

const capitals: Record<string, string> = { portugal: 'Lisbon', spain: 'Madrid', france: 'Paris', uk: 'London', italy: 'Rome', greece: 'Athens' };

const choice = (labels: string[], acceptedIndex: number) => {
  const options: QuestionOption[] = labels.map((label, i) => ({ id: `o${i}`, label }));
  return { options, acceptedId: `o${acceptedIndex}` };
};

function capitalQuestions(p: Place): Question[] {
  const capital = capitals[p.id] as string;
  const others = places.filter((o) => o.id !== p.id);
  const offset = places.indexOf(p);
  const pickThree = <T,>(items: T[]) => [0, 1, 2].map((i) => items[(i * 2 + offset) % items.length] as T);
  const base = { version: 1, objectiveId: `capital-${p.id}`, inputType: 'choice' as const, difficulty: 'foundation' as const, sourceUrl: wiki(capital), locationId: p.id };
  return [
    {
      ...base,
      id: `q-capital-${p.id}-1`,
      prompt: `What is the capital of ${inSentence(p)}?`,
      ...choice([capital, ...pickThree(others).map((o) => capitals[o.id] as string)], 0),
      explanation: `${capital} is the capital of ${inSentence(p)}.`,
    },
    {
      ...base,
      id: `q-capital-${p.id}-2`,
      prompt: `${capital} is the capital of which country?`,
      ...choice([p.name, ...pickThree(others).map((o) => o.name)], 0),
      explanation: `${capital} is the capital of ${inSentence(p)}.`,
    },
  ];
}

function markerQuestion(p: Place): Question {
  const offset = places.indexOf(p);
  const nearby = [1, 2, 3].map((i) => places[(offset + i) % places.length] as Place);
  return {
    id: `q-location-${p.id}-1`,
    version: 1,
    objectiveId: `location-${p.id}`,
    inputType: 'map-marker',
    prompt: `Which marker is on ${inSentence(p)}?`,
    options: [p, ...nearby].map((o) => ({ id: o.id, label: o.name, lonLat: o.lonLat })),
    acceptedId: p.id,
    explanation: `${p.name}: ${p.atlas[1] as string}.`,
    difficulty: 'foundation',
    sourceUrl: wiki(p.name.replaceAll(' ', '_')),
    locationId: p.id,
  };
}

const basics = (id: string, group: 'continent' | 'ocean', key: string, prompt: string, answer: string, wrong: string[], explanation: string, page: string): Question => ({
  id: `q-${group}-${id}`,
  version: 1,
  objectiveId: `${group}-${key}`,
  inputType: 'choice',
  prompt,
  ...choice([answer, ...wrong], 0),
  explanation,
  difficulty: 'foundation',
  sourceUrl: wiki(page),
});

const worldBasics: Question[] = [
  basics('europe-1', 'continent', 'europe', 'On which continent are France and Italy?', 'Europe', ['Asia', 'Africa', 'South America'], 'France and Italy are both in Europe.', 'Europe'),
  basics('africa-1', 'continent', 'africa', 'Which continent lies directly south of Spain, across the Strait of Gibraltar?', 'Africa', ['Asia', 'Australia', 'Antarctica'], 'The narrow Strait of Gibraltar separates Spain from Africa.', 'Strait_of_Gibraltar'),
  basics('antarctica-1', 'continent', 'antarctica', 'Which continent surrounds the South Pole?', 'Antarctica', ['Australia', 'South America', 'Africa'], 'Antarctica surrounds the South Pole.', 'Antarctica'),
  basics('atlantic-1', 'ocean', 'atlantic', 'Which ocean lies between Europe and North America?', 'Atlantic Ocean', ['Pacific Ocean', 'Indian Ocean', 'Arctic Ocean'], 'The Atlantic Ocean separates Europe from North America.', 'Atlantic_Ocean'),
  basics('pacific-1', 'ocean', 'pacific', 'Which is the largest ocean on Earth?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean', 'Southern Ocean'], 'The Pacific is the largest of the five oceans.', 'Pacific_Ocean'),
  basics('arctic-1', 'ocean', 'arctic', 'Which ocean surrounds the North Pole?', 'Arctic Ocean', ['Southern Ocean', 'Atlantic Ocean', 'Indian Ocean'], 'The Arctic Ocean surrounds the North Pole.', 'Arctic_Ocean'),
];

export const PACK: Pack = {
  version: 'world-basics-fixture-1',
  questions: [...places.flatMap(capitalQuestions), ...places.map(markerQuestion), ...worldBasics],
  clues,
  places,
  species: [
    { id: 'slatepaw', displayName: 'Slatepaw', artId: 'slatepaw', flavor: 'A round little mountain-dweller with mossy shoulders.' },
    { id: 'brinefin', displayName: 'Brinefin', artId: 'brinefin', flavor: 'It chases waves along the shore and hates to lose.' },
    { id: 'thistlehop', displayName: 'Thistlehop', artId: 'thistlehop', flavor: 'It bounds through the woods, all prickles and mischief.' },
    { id: 'cindermite', displayName: 'Cindermite', artId: 'cindermite', flavor: 'A warm, grumpy creature that naps in sun-baked rocks.' },
    { id: 'cragmaw', displayName: 'Old Cragmaw', artId: 'cragmaw', flavor: 'The great guardian of the high passes.' },
  ],
  souvenirs: [
    { id: 'compass', displayName: 'Carved Compass', artId: 'compass', flavor: 'Its needle always seems to be pointing somewhere exciting.' },
    { id: 'shell', displayName: 'Patterned Shell', artId: 'shell', flavor: 'If you listen closely, it hums.' },
    { id: 'lantern', displayName: 'Tiny Lantern', artId: 'lantern', flavor: 'Bright enough for one small explorer.' },
    { id: 'feather', displayName: 'Storm Feather', artId: 'feather', flavor: 'It feels faintly of wind.' },
    { id: 'stone', displayName: 'River Stone', artId: 'stone', flavor: 'Worn smooth by a very long journey.' },
    { id: 'map-scrap', displayName: 'Old Map Scrap', artId: 'map-scrap', flavor: 'Part of a map nobody has finished yet.' },
  ],
  starterSpeciesId: 'slatepaw',
  regularOpponentIds: ['brinefin', 'thistlehop', 'cindermite'],
  guardianIds: ['cragmaw'],
};
