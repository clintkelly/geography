import type { Pack, Question, QuestionOption } from './types';
import { europeClues, europePlaces, europeQuestions, usCards, usClues, usPlaces, usQuestions } from './us/templates';

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
  version: 'west-and-europe-3',
  regions: [
    { id: 'us-west', label: 'American West', mapId: 'us', difficulties: ['scout', 'ranger', 'expert'] },
    { id: 'europe', label: 'Europe', mapId: 'world', difficulties: ['scout', 'ranger', 'expert'] },
  ],
  questions: [...usQuestions, ...europeQuestions, ...worldBasics],
  clues: [...usClues, ...europeClues],
  places: [...usPlaces, ...europePlaces],
  species: [
    { id: 'slatepaw', displayName: 'Slatepaw', artId: 'slatepaw', facing: 'right', flavor: 'A round little mountain-dweller with mossy shoulders.', special: { name: 'Landslide', template: 'strong' } },
    { id: 'brinefin', displayName: 'Brinefin', artId: 'brinefin', facing: 'left', flavor: 'It chases waves along the shore and hates to lose.', special: { name: 'Tide Pool', template: 'heal' } },
    { id: 'thistlehop', displayName: 'Thistlehop', artId: 'thistlehop', facing: 'left', flavor: 'It bounds through the woods, all prickles and mischief.', special: { name: 'Bramble Wall', template: 'protect' } },
    { id: 'cindermite', displayName: 'Cindermite', artId: 'cindermite', facing: 'left', flavor: 'A warm, grumpy creature that naps in sun-baked rocks.', special: { name: 'Ember Burst', template: 'strong' } },
    { id: 'sandwhisk', displayName: 'Sandwhisk', artId: 'sandwhisk', facing: 'left', flavor: 'It listens for lizards with enormous ears and never stops moving.', special: { name: 'Dust Devil', template: 'protect' } },
    { id: 'cragmaw', displayName: 'Old Cragmaw', artId: 'cragmaw', facing: 'left', flavor: 'The great guardian of the high passes.', special: { name: 'Rockfall', template: 'strong' } },
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
  huntableIds: ['brinefin', 'thistlehop', 'cindermite', 'sandwhisk', 'cragmaw'],
  regularOpponentIds: ['brinefin', 'thistlehop', 'cindermite', 'sandwhisk'],
};
