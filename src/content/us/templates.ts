import countries from '../europe/countries.json';
import flags from '../flags.json';
import africa from '../world/africa.json';
import antarctica from '../world/antarctica.json';
import asia from '../world/asia.json';
import northAmerica from '../world/north-america.json';
import oceania from '../world/oceania.json';
import southAmerica from '../world/south-america.json';
import { degreesApart, spaced } from '../geo';
import type { Clue, Difficulty, Place, Question, QuestionOption, StateCard } from '../types';
import midwest from './midwest.json';
import northeast from './northeast.json';
import south from './south.json';
import west from './west.json';
import { animalsOf } from '../animals';
import { historyOf } from '../history';

/** One reviewed record per state or country. Questions and clues are generated from these. */
export interface PlaceRecord {
  id: string;
  name: string;
  postal?: string;
  /** The map feature: a FIPS code for states, an ISO number for countries. */
  fips: string;
  lonLat: [number, number];
  capital: string;
  /** Real, kid-familiar cities, never the capital. */
  sameStateCities: string[];
  largestCity: string;
  /** Only 'official' with a checked source. Questions never call a nickname official. */
  nickname: { text: string; status: 'official' | 'unverified'; others: string[] } | null;
  facts: string[];
  /** A question for each fact, whose answer is this place. Never names it. */
  asks: string[];
  /** Which battle backdrop fits this place. */
  biome: string;
  /** Bordering places, plus usual flights and sea crossings. */
  neighbors: string[];
  /** A place description that never names it. */
  hint?: string;
  hint2?: string;
  /** Too small to click on the map, so it gets a dot. */
  tiny?: boolean;
  /** Capital and country share a name, so capital questions don't work. */
  cityState?: boolean;
  /** How the name reads mid-sentence, such as "the Netherlands". */
  sentenceName?: string;
  wiki?: string;
}

export const WEST = west as unknown as PlaceRecord[];
export const COUNTRIES = countries as PlaceRecord[];

/** Europe is too crowded for one map, so it follows the UN's four subregions. */
const EUROPE_PARTS = {
  'europe-north': ['denmark', 'estonia', 'finland', 'iceland', 'ireland', 'latvia', 'lithuania', 'norway', 'sweden', 'uk'],
  'europe-west': ['austria', 'belgium', 'france', 'germany', 'liechtenstein', 'luxembourg', 'monaco', 'netherlands', 'switzerland'],
  'europe-south': ['albania', 'andorra', 'bosnia', 'croatia', 'greece', 'italy', 'malta', 'montenegro', 'north-macedonia', 'portugal', 'san-marino', 'serbia', 'slovenia', 'spain', 'vatican'],
  'europe-east': ['belarus', 'bulgaria', 'czechia', 'hungary', 'moldova', 'poland', 'romania', 'russia', 'slovakia', 'ukraine'],
} as const;
const europePart = (id: keyof typeof EUROPE_PARTS) => COUNTRIES.filter((c) => (EUROPE_PARTS[id] as readonly string[]).includes(c.id));

/** Big continents are split the same way, keeping each map readable. */
const AFRICA_PARTS = {
  north: ['algeria', 'egypt', 'libya', 'mauritania', 'morocco', 'sudan', 'tunisia'],
  west: ['benin', 'burkina-faso', 'cabo-verde', 'cote-divoire', 'gambia', 'ghana', 'guinea', 'guinea-bissau', 'liberia', 'mali', 'niger', 'nigeria', 'senegal', 'sierra-leone', 'togo'],
  central: ['angola', 'cameroon', 'central-african-republic', 'chad', 'congo', 'dr-congo', 'equatorial-guinea', 'gabon', 'sao-tome-and-principe'],
  east: ['burundi', 'comoros', 'djibouti', 'eritrea', 'ethiopia', 'kenya', 'madagascar', 'mauritius', 'rwanda', 'seychelles', 'somalia', 'south-sudan', 'tanzania', 'uganda'],
  south: ['botswana', 'eswatini', 'lesotho', 'malawi', 'mozambique', 'namibia', 'south-africa', 'zambia', 'zimbabwe'],
} as const;
const ASIA_PARTS = {
  west: ['armenia', 'azerbaijan', 'bahrain', 'cyprus', 'georgia-country', 'iraq', 'israel', 'jordan', 'kuwait', 'lebanon', 'oman', 'palestine', 'qatar', 'saudi-arabia', 'syria', 'turkey', 'united-arab-emirates', 'yemen'],
  south: ['afghanistan', 'bangladesh', 'bhutan', 'india', 'iran', 'kazakhstan', 'kyrgyzstan', 'maldives', 'nepal', 'pakistan', 'sri-lanka', 'tajikistan', 'turkmenistan', 'uzbekistan'],
  east: ['brunei', 'cambodia', 'china', 'indonesia', 'japan', 'laos', 'malaysia', 'mongolia', 'myanmar', 'north-korea', 'philippines', 'singapore', 'south-korea', 'taiwan', 'thailand', 'timor-leste', 'vietnam'],
} as const;
const AMERICA_PARTS = {
  mainland: ['belize', 'canada', 'costa-rica', 'el-salvador', 'guatemala', 'honduras', 'mexico', 'nicaragua', 'panama', 'usa'],
  caribbean: ['antigua-and-barbuda', 'bahamas', 'barbados', 'cuba', 'dominica', 'dominican-republic', 'grenada', 'haiti', 'jamaica', 'saint-kitts-and-nevis', 'saint-lucia', 'saint-vincent-and-the-grenadines', 'trinidad-and-tobago'],
} as const;
const from = (records: unknown, ids: readonly string[]) => (records as PlaceRecord[]).filter((c) => ids.includes(c.id));

/** Each region quizzes among its own places, with markers spaced for its zoomed map. */
export const GROUPS = [
  { id: 'us-west', records: WEST, noun: 'state', gap: 4 },
  { id: 'us-midwest', records: midwest as unknown as PlaceRecord[], noun: 'state', gap: 2.5 },
  { id: 'us-south', records: south as unknown as PlaceRecord[], noun: 'state', gap: 2.5 },
  { id: 'us-northeast', records: northeast as unknown as PlaceRecord[], noun: 'state', gap: 1.2 },
  { id: 'europe-north', records: europePart('europe-north'), noun: 'country', gap: 3 },
  { id: 'europe-west', records: europePart('europe-west'), noun: 'country', gap: 1.5 },
  { id: 'europe-south', records: europePart('europe-south'), noun: 'country', gap: 2 },
  { id: 'europe-east', records: europePart('europe-east'), noun: 'country', gap: 2.5 },
  { id: 'africa-north', records: from(africa, AFRICA_PARTS.north), noun: 'country', gap: 3 },
  { id: 'africa-west', records: from(africa, AFRICA_PARTS.west), noun: 'country', gap: 2 },
  { id: 'africa-central', records: from(africa, AFRICA_PARTS.central), noun: 'country', gap: 2 },
  { id: 'africa-east', records: from(africa, AFRICA_PARTS.east), noun: 'country', gap: 2 },
  { id: 'africa-south', records: from(africa, AFRICA_PARTS.south), noun: 'country', gap: 2 },
  { id: 'asia-west', records: from(asia, ASIA_PARTS.west), noun: 'country', gap: 2 },
  { id: 'asia-south', records: from(asia, ASIA_PARTS.south), noun: 'country', gap: 3 },
  { id: 'asia-east', records: from(asia, ASIA_PARTS.east), noun: 'country', gap: 3 },
  { id: 'america-mainland', records: from(northAmerica, AMERICA_PARTS.mainland), noun: 'country', gap: 1.5 },
  { id: 'america-caribbean', records: from(northAmerica, AMERICA_PARTS.caribbean), noun: 'country', gap: 1 },
  { id: 'south-america', records: from(southAmerica, southAmerica.map((c) => c.id)), noun: 'country', gap: 4 },
  { id: 'oceania', records: from(oceania, oceania.map((c) => c.id)), noun: 'country', gap: 4 },
  { id: 'antarctica', records: from(antarctica, antarctica.map((c) => c.id)), noun: 'place', gap: 6 },
] as const;

export const STATES = GROUPS.filter((g) => g.noun === 'state').flatMap((g) => g.records);

const wikiUrl = (s: PlaceRecord) => `https://en.wikipedia.org/wiki/${s.wiki ?? s.name.replaceAll(' ', '_')}${s.id === 'washington' ? '_(state)' : ''}`;

type Answer = Pick<Question, 'options' | 'acceptedId'>;

const flagOf = (s: PlaceRecord) => (flags as Record<string, string>)[s.id];

function buildQuestions(s: PlaceRecord, all: readonly PlaceRecord[], regionId: string, noun: string, gap: number): Question[] {
  const ranked = all.filter((o) => o.id !== s.id).sort((a, b) => degreesApart(a, s) - degreesApart(b, s));
  const near = spaced(ranked, s, 3, gap);
  const farList = [...ranked].reverse();
  const far = spaced([0, 2, 4, 6, 8, 1, 3, 5, 7].flatMap((i) => farList[i] ?? []), s, 3, gap);
  const name = s.sentenceName ?? s.name;
  // Wrong answers teach too: each option can say what it really is.
  const inName = (o: PlaceRecord) => o.sentenceName ?? o.name;
  const aboutCapital = (o: PlaceRecord) => (o.cityState ? `${o.capital} is its own tiny country.` : `${o.capital} is the capital of ${inName(o)}.`);
  const aboutPlace = (o: PlaceRecord) => {
    const known = o.nickname ? `, known as the ${o.nickname.text}` : '';
    return o.cityState ? `That's ${inName(o)}${known}.` : `That's ${inName(o)}${known}. Its capital is ${o.capital}.`;
  };
  const aboutCity = (city: string) => (city === s.largestCity ? `${city} is the largest city in ${name}, but not its capital.` : `${city} is a city in ${name}, but not its capital.`);
  const Name = name[0]?.toUpperCase() + name.slice(1);

  const choices = (labels: string[], about: (i: number) => string | undefined = () => undefined): Answer => ({
    options: labels.map((label, i) => {
      const note = i > 0 ? about(i - 1) : undefined;
      return { id: `o${i}`, label, ...(note ? { about: note } : {}) };
    }),
    acceptedId: 'o0',
  });
  const capitalsOf = (list: PlaceRecord[]) => choices([s.capital, ...list.map((o) => o.capital)], (i) => aboutCapital(list[i] as PlaceRecord));
  const namesOf = (list: PlaceRecord[]) => choices([s.name, ...list.map((o) => o.name)], (i) => aboutPlace(list[i] as PlaceRecord));
  const citiesHere = () => choices([s.capital, ...s.sameStateCities], (i) => aboutCity(s.sameStateCities[i] as string));
  const markers = (others: PlaceRecord[]): Answer => ({
    options: [s, ...others].map((o): QuestionOption => ({ id: o.id, label: o.name, lonLat: o.lonLat, ...(o.id === s.id ? {} : { about: aboutPlace(o) }) })),
    acceptedId: s.id,
  });
  const clickPlace: Answer = {
    options: all.map((o): QuestionOption => ({ id: o.id, label: o.name, featureId: o.fips, ...(o.id === s.id ? {} : { about: aboutPlace(o) }), ...(o.tiny ? { tiny: true, lonLat: o.lonLat } : {}) })),
    acceptedId: s.id,
  };

  const noteFor = (i: number) => ({ fieldNote: s.facts[i] as string, noteId: `fact-${s.id}-${i}` });
  const capitalWhy = `${s.capital} is the capital of ${name}.`;
  const whereWhy = s.cityState ? `This is ${name}.` : `This is ${name}. Its capital is ${s.capital}.`;
  const q = (difficulty: Difficulty, kind: string, n: number, objective: string, prompt: string, explanation: string, answer: Answer, inputType: Question['inputType'] = 'choice'): Question => ({
    topic: kind as Question['topic'],
    id: `q-${kind}-${s.id}-${difficulty}-${n}`,
    version: 1,
    objectiveId: `${objective}-${s.id}`,
    inputType,
    prompt,
    explanation,
    difficulty,
    regionId,
    locationId: s.id,
    sourceUrl: wikiUrl(s),
    // Different questions about a place rotate through its facts.
    ...noteFor((objective.length + n) % s.facts.length),
    ...answer,
  });

  const markerAsk = noun === 'place' ? `Which marker shows ${name}?` : `Which marker is on ${name}?`;
  const out: Question[] = [
    q('scout', 'location', 1, 'location', `${markerAsk}`, whereWhy, markers(far), 'map-marker'),
    q('ranger', 'location', 1, 'location', `${markerAsk}`, whereWhy, markers(near), 'map-marker'),
    q('expert', 'location', 1, 'location', `Click ${name} on the map.`, whereWhy, clickPlace, 'map-click'),
  ];
  if (!s.cityState) {
    out.push(
      q('scout', 'capital', 1, 'capital', `What is the capital of ${name}?`, capitalWhy, capitalsOf(far)),
      q('scout', 'capital', 2, 'capital', `${s.capital} is the capital of which ${noun}?`, capitalWhy, namesOf(far)),
      q('ranger', 'capital', 1, 'capital', `What is the capital of ${name}?`, capitalWhy, citiesHere()),
      q('ranger', 'capital', 2, 'capital', `In which ${noun} is the capital city ${s.capital}?`, capitalWhy, namesOf(near)),
      q('expert', 'capital', 1, 'capital', `Which of these cities is the capital of ${name}?`, capitalWhy, citiesHere()),
      q('expert', 'capital', 2, 'capital', `The city of ${s.capital} is the capital of which ${noun}? Click it on the map.`, capitalWhy, clickPlace, 'map-click'),
    );
  }
  if (s.nickname) {
    const known = `the ${s.nickname.text}`;
    const why = `${Name} is known as ${known}.`;
    out.push(
      q('scout', 'nickname', 1, 'nickname', `Which ${noun} is known as ${known}?`, why, namesOf(far)),
      q('ranger', 'nickname', 1, 'nickname', `Which ${noun} is known as ${known}?`, why, namesOf(near)),
      q('expert', 'nickname', 1, 'nickname', `${known[0]?.toUpperCase()}${known.slice(1)}: which ${noun} is that? Click it on the map.`, why, clickPlace, 'map-click'),
    );
  }
  const flag = flagOf(s);
  if (flag) {
    const why = `This is the flag of ${name}.`;
    const pickFlag = (list: PlaceRecord[]): Answer => {
      const answer = namesOf(list);
      return { ...answer, options: answer.options.map((o, i) => ({ ...o, flag: flagOf(i === 0 ? s : (list[i - 1] as PlaceRecord)) as string })) };
    };
    out.push(
      q('scout', 'flag', 1, 'flag', `Which ${noun} has this flag?`, why, namesOf(far)),
      q('ranger', 'flag', 1, 'flag', `Which ${noun} has this flag?`, why, namesOf(near)),
      q('expert', 'flag', 1, 'flag', `Which flag belongs to ${name}?`, why, pickFlag(near)),
    );
    for (const item of out.slice(-3, -1)) item.flag = flag;
  }
  // A question for each Field Note. The game holds these back until the child has seen the note.
  s.asks.forEach((ask, i) => {
    const recall = { ...noteFor(i), recallOf: `fact-${s.id}-${i}` };
    const fact = (difficulty: Difficulty, answer: Answer, inputType: Question['inputType'] = 'choice'): Question => ({
      ...q(difficulty, 'fact', i, `fact`, ask, s.facts[i] as string, answer, inputType),
      ...recall,
      objectiveId: `fact-${s.id}-${i}`,
    });
    out.push(fact('scout', namesOf(far)), fact('ranger', namesOf(near)), fact('expert', clickPlace, 'map-click'));
  });
  // Animal questions are asked straight away, and their fact is shown after the answer.
  animalsOf(s.id).forEach((a, i) => {
    const animal = (difficulty: Difficulty, answer: Answer, inputType: Question['inputType'] = 'choice'): Question => ({
      ...q(difficulty, 'animal', i, 'animal', a.ask, a.fact, answer, inputType),
      objectiveId: `animal-${s.id}-${i}`,
      fieldNote: a.fact,
      noteId: `animal-${s.id}-${i}`,
      sourceUrl: a.source,
    });
    out.push(animal('scout', namesOf(far)), animal('ranger', namesOf(near)), animal('expert', clickPlace, 'map-click'));
  });
  // History questions work the same way: asked straight away, with the fact shown after the answer.
  historyOf(s.id).forEach((h, i) => {
    const history = (difficulty: Difficulty, answer: Answer, inputType: Question['inputType'] = 'choice'): Question => ({
      ...q(difficulty, 'history', i, 'history', h.ask, h.fact, answer, inputType),
      objectiveId: `history-${s.id}-${i}`,
      fieldNote: h.fact,
      noteId: `history-${s.id}-${i}`,
      sourceUrl: h.source,
    });
    out.push(history('scout', namesOf(far)), history('ranger', namesOf(near)), history('expert', clickPlace, 'map-click'));
  });
  return out;
}

function buildClues(s: PlaceRecord, noun: string): Clue[] {
  const clue = (n: number, text: string): Clue => ({ id: `clue-${s.id}-${n}`, version: 1, targetId: s.id, objectiveId: `location-${s.id}`, text, sourceUrl: wikiUrl(s) });
  const first = s.nickname ? `the ${s.nickname.text}` : s.hint;
  const clues = [clue(1, `Tracks lead to ${first}.`)];
  // A capital that contains the country's name would give the answer away.
  clues.push(clue(2, s.hint2 ?? `This ${noun}'s capital is ${s.capital}.`));
  if (s.sameStateCities[0] && !s.cityState) clues.push(clue(3, `Travelers in ${s.sameStateCities[0]} reported a sighting.`));
  return clues;
}

function buildPlace(s: PlaceRecord, regionId: string): Place {
  const about = s.nickname ? `Known as the ${s.nickname.text}` : (s.hint as string);
  return {
    id: s.id,
    name: s.name,
    featureId: s.fips,
    regionId,
    lonLat: s.lonLat,
    neighbors: s.neighbors,
    biome: s.biome,
    ...(s.tiny ? { tiny: true } : {}),
    atlas: [
      ...(s.cityState ? [] : [`Capital: ${s.capital}`]),
      about[0]?.toUpperCase() + about.slice(1),
      ...(s.sameStateCities.length > 0 ? [`${s.cityState ? 'Places' : 'Cities'}: ${s.sameStateCities.join(', ')}`] : []),
      ...s.facts,
    ],
  };
}

const forGroups = <T>(build: (g: (typeof GROUPS)[number]) => T[]) => GROUPS.flatMap(build);

export const allPlaces = forGroups((g) => g.records.map((s) => buildPlace(s, g.id)));
export const allQuestions = forGroups((g) => g.records.flatMap((s) => buildQuestions(s, g.records, g.id, g.noun, g.gap)));
export const allClues = forGroups((g) => g.records.flatMap((s) => buildClues(s, g.noun)));
export const usQuestions = allQuestions.filter((q) => q.regionId.startsWith('us-'));
export const europeQuestions = allQuestions.filter((q) => q.regionId.startsWith('europe-'));

const hintLine = (s: PlaceRecord) => (s.hint ? s.hint[0]?.toUpperCase() + s.hint.slice(1) : s.name);

export const allCards: StateCard[] = GROUPS.flatMap((g) => g.records as readonly PlaceRecord[]).map((s) => ({
  placeId: s.id,
  name: s.name,
  artId: `card-${s.id}`,
  subtitle: s.nickname ? `The ${s.nickname.text}` : hintLine(s),
  capital: s.cityState ? '' : s.capital,
  ...(flagOf(s) ? { flag: flagOf(s) as string } : {}),
  facts: s.facts,
}));
