import type { Pack, Question, QuestionOption } from './types';
import { allClues, allPlaces, allQuestions, GROUPS, usCards } from './us/templates';

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

const choice = (labels: string[], acceptedIndex: number) => {
  const options: QuestionOption[] = labels.map((label, i) => ({ id: `o${i}`, label }));
  return { options, acceptedId: `o${acceptedIndex}` };
};

const basics = (id: string, group: 'continent' | 'ocean', key: string, prompt: string, answer: string, wrong: string[], explanation: string, page: string): Question => ({
  id: `q-${group}-${id}`,
  version: 1,
  objectiveId: `${group}-${key}`,
  inputType: 'choice',
  prompt,
  ...choice([answer, ...wrong], 0),
  explanation,
  difficulty: 'scout',
    regionId: 'europe',
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
  version: 'usa-and-europe-1',
  regions: [
    { id: 'us-west', label: 'American West' },
    { id: 'us-midwest', label: 'Midwest' },
    { id: 'us-south', label: 'The South' },
    { id: 'us-northeast', label: 'Northeast' },
    { id: 'europe', label: 'Europe' },
  ].map((r) => {
    const group = GROUPS.find((g) => g.id === r.id);
    return { ...r, mapId: r.id === 'europe' ? ('world' as const) : ('us' as const), difficulties: ['scout', 'ranger', 'expert'] as const, markerGap: group?.gap ?? 4 };
  }),
  questions: [...allQuestions, ...worldBasics],
  clues: allClues,
  places: allPlaces,
  species: [
    { id: 'slatepaw', displayName: 'Slatepaw', artId: 'slatepaw', facing: 'right', homes: [], flavor: 'A round little mountain-dweller with mossy shoulders.', special: { name: 'Landslide', template: 'strong' } },
    { id: 'barkknight', displayName: 'The Bark Knight', artId: 'barkknight', facing: 'left', homes: ['us-west', 'us-midwest', 'us-south', 'us-northeast', 'europe'], flavor: 'A loyal guardian who patrols at night and never leaves a friend behind.', special: { name: 'Midnight Howl', template: 'strong' } },
    { id: 'sandwhisk', displayName: 'Sandwhisk', artId: 'sandwhisk', facing: 'left', homes: ['us-west'], flavor: 'It listens for lizards with enormous ears and never stops moving.', special: { name: 'Dust Devil', template: 'protect' } },
    { id: 'cindermite', displayName: 'Cindermite', artId: 'cindermite', facing: 'left', homes: ['us-west'], flavor: 'A warm, grumpy creature that naps in sun-baked rocks.', special: { name: 'Ember Burst', template: 'strong' } },
    { id: 'cragmaw', displayName: 'Old Cragmaw', artId: 'cragmaw', facing: 'left', homes: ['us-west', 'europe'], flavor: 'The great guardian of the high passes.', special: { name: 'Rockfall', template: 'strong' } },
    { id: 'galewing', displayName: 'Galewing', artId: 'galewing', facing: 'left', homes: ['us-midwest'], flavor: 'A prairie bird that rides in on the first spring storm.', special: { name: 'Prairie Breeze', template: 'heal' } },
    { id: 'lakeshell', displayName: 'Lakeshell', artId: 'lakeshell', facing: 'left', homes: ['us-midwest'], flavor: 'It suns itself on rocks along the Great Lakes.', special: { name: 'Shell Tide', template: 'protect' } },
    { id: 'thistlehop', displayName: 'Thistlehop', artId: 'thistlehop', facing: 'left', homes: ['us-midwest', 'us-northeast'], flavor: 'It bounds through the woods, all prickles and mischief.', special: { name: 'Bramble Wall', template: 'protect' } },
    { id: 'bayouchomp', displayName: 'Bayou Chomp', artId: 'bayouchomp', facing: 'left', homes: ['us-south'], flavor: 'It grins from the slow green water and loves a good snack.', special: { name: 'Swamp Snap', template: 'strong' } },
    { id: 'dillopod', displayName: 'Dillopod', artId: 'dillopod', facing: 'left', homes: ['us-south'], flavor: 'It rolls into a ball at the first sign of trouble.', special: { name: 'Roll Up', template: 'protect' } },
    { id: 'brinefin', displayName: 'Brinefin', artId: 'brinefin', facing: 'left', homes: ['us-south', 'europe'], flavor: 'It chases waves along the shore and hates to lose.', special: { name: 'Tide Pool', template: 'heal' } },
    { id: 'lobsnap', displayName: 'Lobsnap', artId: 'lobsnap', facing: 'left', homes: ['us-northeast'], flavor: 'It guards the rocky coast with two very serious claws.', special: { name: 'Claw Crash', template: 'strong' } },
    { id: 'mapleclop', displayName: 'Mapleclop', artId: 'mapleclop', facing: 'left', homes: ['us-northeast'], flavor: 'Its leafy antlers turn red every fall.', special: { name: 'Maple Mend', template: 'heal' } },
    { id: 'fjordling', displayName: 'Fjordling', artId: 'fjordling', facing: 'left', homes: ['europe'], flavor: 'It slips through cold blue fjords without a sound.', special: { name: 'Ice Bloom', template: 'heal' } },
    { id: 'alpenhorn', displayName: 'Alpenhorn', artId: 'alpenhorn', facing: 'left', homes: ['europe'], flavor: 'It leaps between Alpine peaks as if they were stepping stones.', special: { name: 'Peak Charge', template: 'strong' } },
  ],
  souvenirs: [
    { id: 'compass', displayName: 'Carved Compass', artId: 'compass', flavor: 'Its needle always seems to be pointing somewhere exciting.' },
    { id: 'shell', displayName: 'Patterned Shell', artId: 'shell', flavor: 'If you listen closely, it hums.' },
    { id: 'lantern', displayName: 'Tiny Lantern', artId: 'lantern', flavor: 'Bright enough for one small explorer.' },
    { id: 'feather', displayName: 'Storm Feather', artId: 'feather', flavor: 'It feels faintly of wind.' },
    { id: 'stone', displayName: 'River Stone', artId: 'stone', flavor: 'Worn smooth by a very long journey.' },
    { id: 'map-scrap', displayName: 'Old Map Scrap', artId: 'map-scrap', flavor: 'Part of a map nobody has finished yet.' },
  ],
  cards: usCards,
  starterSpeciesId: 'slatepaw',
  featuredSpeciesId: 'barkknight',
};
