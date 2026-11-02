import { MOVES } from './moves';
import type { Pack, Question, QuestionOption, Species } from './types';
import { allClues, allPlaces, allQuestions, GROUPS, allCards } from './us/templates';

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

const choice = (labels: string[], acceptedIndex: number) => {
  const options: QuestionOption[] = labels.map((label, i) => ({ id: `o${i}`, label }));
  return { options, acceptedId: `o${acceptedIndex}` };
};

const basics = (regionId: string, id: string, group: 'continent' | 'ocean', key: string, prompt: string, answer: string, wrong: string[], explanation: string, page: string): Question => ({
  id: `q-${group}-${id}`,
  version: 1,
  objectiveId: `${group}-${key}`,
  inputType: 'choice',
  prompt,
  ...choice([answer, ...wrong], 0),
  explanation,
  topic: 'basics',
  difficulty: 'scout',
  regionId,
  sourceUrl: wiki(page),
});

const worldBasics: Question[] = [
  basics('europe-west', 'europe-1', 'continent', 'europe', 'On which continent are France and Italy?', 'Europe', ['Asia', 'Africa', 'South America'], 'France and Italy are both in Europe.', 'Europe'),
  basics('europe-south', 'africa-1', 'continent', 'africa', 'Which continent lies directly south of Spain, across the Strait of Gibraltar?', 'Africa', ['Asia', 'Australia', 'Antarctica'], 'The narrow Strait of Gibraltar separates Spain from Africa.', 'Strait_of_Gibraltar'),
  basics('europe-north', 'antarctica-1', 'continent', 'antarctica', 'Which continent surrounds the South Pole?', 'Antarctica', ['Australia', 'South America', 'Africa'], 'Antarctica surrounds the South Pole.', 'Antarctica'),
  basics('europe-west', 'atlantic-1', 'ocean', 'atlantic', 'Which ocean lies between Europe and North America?', 'Atlantic Ocean', ['Pacific Ocean', 'Indian Ocean', 'Arctic Ocean'], 'The Atlantic Ocean separates Europe from North America.', 'Atlantic_Ocean'),
  basics('europe-east', 'pacific-1', 'ocean', 'pacific', 'Which is the largest ocean on Earth?', 'Pacific Ocean', ['Atlantic Ocean', 'Indian Ocean', 'Southern Ocean'], 'The Pacific is the largest of the five oceans.', 'Pacific_Ocean'),
  basics('europe-north', 'arctic-1', 'ocean', 'arctic', 'Which ocean surrounds the North Pole?', 'Arctic Ocean', ['Southern Ocean', 'Atlantic Ocean', 'Indian Ocean'], 'The Arctic Ocean surrounds the North Pole.', 'Arctic_Ocean'),
];

const CONTINENTS: Record<string, string> = { us: 'United States', europe: 'Europe', africa: 'Africa', asia: 'Asia', america: 'North America', south: 'South America', oceania: 'Oceania', antarctica: 'Antarctica' };
const continentOf = (id: string) => CONTINENTS[id.split('-')[0] as string] as string;

export const PACK: Pack = {
  version: 'whole-world-4',
  regions: [
    { id: 'us-west', label: 'American West' },
    { id: 'us-midwest', label: 'Midwest' },
    { id: 'us-south', label: 'The South' },
    { id: 'us-northeast', label: 'Northeast' },
    { id: 'europe-north', label: 'Northern Europe' },
    { id: 'europe-west', label: 'Western Europe' },
    { id: 'europe-south', label: 'Southern Europe' },
    { id: 'europe-east', label: 'Eastern Europe' },
    { id: 'africa-north', label: 'North Africa' },
    { id: 'africa-west', label: 'West Africa' },
    { id: 'africa-central', label: 'Central Africa' },
    { id: 'africa-east', label: 'East Africa' },
    { id: 'africa-south', label: 'Southern Africa' },
    { id: 'asia-west', label: 'Western Asia' },
    { id: 'asia-south', label: 'South and Central Asia' },
    { id: 'asia-east', label: 'East and Southeast Asia' },
    { id: 'america-mainland', label: 'North and Central America' },
    { id: 'america-caribbean', label: 'The Caribbean' },
    { id: 'south-america', label: 'South America' },
    { id: 'oceania', label: 'Oceania' },
    { id: 'antarctica', label: 'Antarctica' },
  ].map((r) => {
    const group = GROUPS.find((g) => g.id === r.id);
    return { ...r, continent: continentOf(r.id), mapId: r.id.startsWith('us-') ? ('us' as const) : r.id === 'oceania' ? ('pacific' as const) : r.id === 'antarctica' ? ('antarctica' as const) : ('world' as const), difficulties: ['scout', 'ranger', 'expert'] as const, markerGap: group?.gap ?? 4 };
  }),
  questions: [...allQuestions, ...worldBasics],
  clues: allClues,
  places: allPlaces,
  species: ([
    { id: 'slatepaw', type: 'stone', displayName: 'Slatepaw', artId: 'slatepaw', facing: 'right', habitats: ['mountain', 'canyon'], homes: [], evolutions: [{ name: 'Slatehide', artId: 'slatepaw-2' }, { name: 'Slatekeep', artId: 'slatepaw-3' }], flavor: 'A round little mountain-dweller with mossy shoulders.', special: { name: 'Landslide', template: 'strong', color: '#d9a441' } },
    { id: 'barkknight', type: 'stone', displayName: 'The Bark Knight', artId: 'barkknight', facing: 'left', habitats: ['castle', 'forest'], homes: ['us-west', 'us-midwest', 'us-south', 'us-northeast', 'europe-north', 'europe-west', 'europe-south', 'europe-east', 'africa-north', 'africa-west', 'africa-central', 'africa-east', 'africa-south', 'asia-west', 'asia-south', 'asia-east', 'america-mainland', 'america-caribbean', 'south-america', 'oceania', 'antarctica'], evolutions: [{ name: 'Sir Bark Knight', artId: 'barkknight-2' }, { name: 'The Bark Legend', artId: 'barkknight-3' }], flavor: 'A loyal guardian who patrols at night and never leaves a friend behind.', special: { name: 'Midnight Howl', template: 'strong', color: '#3a4fa8' } },
    { id: 'sandwhisk', type: 'gale', displayName: 'Sandwhisk', artId: 'sandwhisk', facing: 'left', habitats: ['desert', 'canyon'], homes: ['us-west'], evolutions: [{ name: 'Dunewhisk', artId: 'sandwhisk-2' }, { name: 'Sirocco', artId: 'sandwhisk-3' }], flavor: 'It listens for lizards with enormous ears and never stops moving.', special: { name: 'Dust Devil', template: 'protect', color: '#d8b070' } },
    { id: 'cindermite', type: 'flame', displayName: 'Cindermite', artId: 'cindermite', facing: 'left', habitats: ['desert', 'canyon'], homes: ['us-west'], evolutions: [{ name: 'Cinderhorn', artId: 'cindermite-2' }, { name: 'Magma Titan', artId: 'cindermite-3' }], flavor: 'A warm, grumpy creature that naps in sun-baked rocks.', special: { name: 'Ember Burst', template: 'strong', color: '#f0642e' } },
    { id: 'cragmaw', type: 'stone', displayName: 'Old Cragmaw', artId: 'cragmaw', facing: 'left', habitats: ['mountain', 'snow'], homes: ['us-west', 'europe-west', 'europe-east'], evolutions: [{ name: 'Cragmaw the Elder', artId: 'cragmaw-2' }, { name: 'Cragmaw the Ancient', artId: 'cragmaw-3' }], flavor: 'The great guardian of the high passes.', special: { name: 'Rockfall', template: 'strong', color: '#d9a441' } },
    { id: 'galewing', type: 'gale', displayName: 'Galewing', artId: 'galewing', facing: 'left', habitats: ['plains', 'lake'], homes: ['us-midwest'], evolutions: [{ name: 'Galehawk', artId: 'galewing-2' }, { name: 'Stormcrown', artId: 'galewing-3' }], flavor: 'A prairie bird that rides in on the first spring storm.', special: { name: 'Prairie Breeze', template: 'heal', color: '#9fd8e8' } },
    { id: 'lakeshell', type: 'tide', displayName: 'Lakeshell', artId: 'lakeshell', facing: 'left', habitats: ['lake', 'coast'], homes: ['us-midwest'], evolutions: [{ name: 'Lakeguard', artId: 'lakeshell-2' }, { name: 'Great Lakeshell', artId: 'lakeshell-3' }], flavor: 'It suns itself on rocks along the Great Lakes.', special: { name: 'Shell Tide', template: 'protect', color: '#3fa8c8' } },
    { id: 'thistlehop', type: 'leaf', displayName: 'Thistlehop', artId: 'thistlehop', facing: 'left', habitats: ['forest', 'plains'], homes: ['us-midwest', 'us-northeast'], evolutions: [{ name: 'Thistlejack', artId: 'thistlehop-2' }, { name: 'Bramble King', artId: 'thistlehop-3' }], flavor: 'It bounds through the woods, all prickles and mischief.', special: { name: 'Bramble Wall', template: 'protect', color: '#8a4fc0' } },
    { id: 'bayouchomp', type: 'leaf', displayName: 'Bayou Chomp', artId: 'bayouchomp', facing: 'left', habitats: ['swamp', 'lake'], homes: ['us-south'], evolutions: [{ name: 'Bayou Jaws', artId: 'bayouchomp-2' }, { name: 'Bayou King', artId: 'bayouchomp-3' }], flavor: 'It grins from the slow green water and loves a good snack.', special: { name: 'Swamp Snap', template: 'strong', color: '#5f9a3a' } },
    { id: 'dillopod', type: 'stone', displayName: 'Dillopod', artId: 'dillopod', facing: 'left', habitats: ['desert', 'plains'], homes: ['us-south'], evolutions: [{ name: 'Dillotank', artId: 'dillopod-2' }, { name: 'Dillofort', artId: 'dillopod-3' }], flavor: 'It rolls into a ball at the first sign of trouble.', special: { name: 'Roll Up', template: 'protect', color: '#b89060' } },
    { id: 'brinefin', type: 'tide', displayName: 'Brinefin', artId: 'brinefin', facing: 'left', habitats: ['coast', 'tropical'], homes: ['us-south', 'europe-north', 'europe-south'], evolutions: [{ name: 'Brineblade', artId: 'brinefin-2' }, { name: 'Tidelord', artId: 'brinefin-3' }], flavor: 'It chases waves along the shore and hates to lose.', special: { name: 'Tide Pool', template: 'heal', color: '#2fb8a8' } },
    { id: 'lobsnap', type: 'tide', displayName: 'Lobsnap', artId: 'lobsnap', facing: 'left', habitats: ['harbor', 'coast'], homes: ['us-northeast'], evolutions: [{ name: 'Lobcrusher', artId: 'lobsnap-2' }, { name: 'Lobster Admiral', artId: 'lobsnap-3' }], flavor: 'It guards the rocky coast with two very serious claws.', special: { name: 'Claw Crash', template: 'strong', color: '#e0503a' } },
    { id: 'mapleclop', type: 'leaf', displayName: 'Mapleclop', artId: 'mapleclop', facing: 'left', habitats: ['forest', 'mountain'], homes: ['us-northeast'], evolutions: [{ name: 'Maplehart', artId: 'mapleclop-2' }, { name: 'Autumn Monarch', artId: 'mapleclop-3' }], flavor: 'Its leafy antlers turn red every fall.', special: { name: 'Maple Mend', template: 'heal', color: '#d86a2a' } },
    { id: 'fjordling', type: 'frost', displayName: 'Fjordling', artId: 'fjordling', facing: 'left', habitats: ['fjord', 'snow'], homes: ['europe-north', 'europe-east'], evolutions: [{ name: 'Fjordguard', artId: 'fjordling-2' }, { name: 'Frost Sentinel', artId: 'fjordling-3' }], flavor: 'It slips through cold blue fjords without a sound.', special: { name: 'Ice Bloom', template: 'heal', color: '#a8e0f0' } },
    { id: 'alpenhorn', type: 'frost', displayName: 'Alpenhorn', artId: 'alpenhorn', facing: 'left', habitats: ['mountain', 'snow'], homes: ['europe-west', 'europe-south'], evolutions: [{ name: 'Alpenram', artId: 'alpenhorn-2' }, { name: 'Summit King', artId: 'alpenhorn-3' }], flavor: 'It leaps between Alpine peaks as if they were stepping stones.', special: { name: 'Peak Charge', template: 'strong', color: '#e8e8f0' } },
    { id: 'thunderhoof', type: 'gale', displayName: 'Thunderhoof', artId: 'thunderhoof', facing: 'left', rare: true, habitats: ['plains', 'desert'], homes: ['us-west'], flavor: 'They say its hooves crack like summer storms across the plains.', special: { name: 'Thunder Stampede', template: 'strong', color: '#ffe066' } },
    { id: 'aurorawl', type: 'frost', displayName: 'Aurorawl', artId: 'aurorawl', facing: 'left', rare: true, habitats: ['lake', 'snow'], homes: ['us-midwest'], flavor: 'It appears only on nights when the northern lights reach the lakes.', special: { name: 'Aurora Veil', template: 'protect', color: '#7ce0b8' } },
    { id: 'stormray', type: 'tide', displayName: 'Stormray', artId: 'stormray', facing: 'left', rare: true, habitats: ['coast', 'tropical'], homes: ['us-south'], flavor: 'It glides out of storms on the Gulf of Mexico and vanishes with the rain.', special: { name: 'Gulf Gale', template: 'heal', color: '#6a8fd8' } },
    { id: 'lanternwhale', type: 'tide', displayName: 'Lanternwhale', artId: 'lanternwhale', facing: 'left', rare: true, habitats: ['harbor', 'fjord'], homes: ['us-northeast'], flavor: 'Sailors swear its light has guided lost ships home.', special: { name: 'Harbor Light', template: 'heal', color: '#ffd27a' } },
    { id: 'castlewyrm', type: 'flame', displayName: 'Castlewyrm', artId: 'castlewyrm', facing: 'left', rare: true, habitats: ['castle', 'mountain'], homes: ['europe-north', 'europe-west', 'europe-south', 'europe-east'], flavor: 'A tiny dragon that has guarded the same old tower for a thousand years.', special: { name: 'Golden Breath', template: 'strong', color: '#ffc23a' } },
    { id: 'baobun', type: 'leaf', displayName: 'Baobun', artId: 'baobun', facing: 'left', habitats: ['plains', 'desert'], homes: ['africa-north', 'africa-west', 'africa-central', 'africa-east', 'africa-south'], evolutions: [{ name: 'Baobark', artId: 'baobun-2' }, { name: 'Baobab Elder', artId: 'baobun-3' }], flavor: "It naps under the savanna sun and stores water in its round belly.", special: { name: 'Root Shield', template: 'protect', color: '#8a6a3f' } },
    { id: 'zebrisk', type: 'gale', displayName: 'Zebrisk', artId: 'zebrisk', facing: 'left', habitats: ['plains', 'tropical'], homes: ['africa-north', 'africa-west', 'africa-central', 'africa-east', 'africa-south'], evolutions: [{ name: 'Zebrush', artId: 'zebrisk-2' }, { name: 'Stripe Sovereign', artId: 'zebrisk-3' }], flavor: "Nobody has ever counted its stripes, because it never stands still.", special: { name: 'Stripe Dash', template: 'strong', color: '#c8b48a' } },
    { id: 'bambloom', type: 'leaf', displayName: 'Bambloom', artId: 'bambloom', facing: 'left', habitats: ['forest', 'mountain'], homes: ['asia-west', 'asia-south', 'asia-east'], evolutions: [{ name: 'Bambrawl', artId: 'bambloom-2' }, { name: 'Grand Bamboo', artId: 'bambloom-3' }], flavor: "It chews bamboo all day and shares with anyone who asks.", special: { name: 'Bamboo Mend', template: 'heal', color: '#6fae4a' } },
    { id: 'lanternox', type: 'flame', displayName: 'Lanternox', artId: 'lanternox', facing: 'left', habitats: ['castle', 'plains'], homes: ['asia-west', 'asia-south', 'asia-east'], evolutions: [{ name: 'Lanternbull', artId: 'lanternox-2' }, { name: 'Festival Ox', artId: 'lanternox-3' }], flavor: "Its little lantern lights the path home on foggy mornings.", special: { name: 'Lantern Glow', template: 'protect', color: '#f0a040' } },
    { id: 'moosedrift', type: 'frost', displayName: 'Moosedrift', artId: 'moosedrift', facing: 'left', habitats: ['snow', 'forest'], homes: ['america-mainland', 'america-caribbean'], evolutions: [{ name: 'Moosefrost', artId: 'moosedrift-2' }, { name: 'Blizzard Moose', artId: 'moosedrift-3' }], flavor: "It wanders through snowdrifts and never seems to get cold.", special: { name: 'Snow Charge', template: 'strong', color: '#a8c8e8' } },
    { id: 'conchling', type: 'tide', displayName: 'Conchling', artId: 'conchling', facing: 'left', habitats: ['coast', 'tropical'], homes: ['america-mainland', 'america-caribbean'], evolutions: [{ name: 'Conchguard', artId: 'conchling-2' }, { name: 'Conch Captain', artId: 'conchling-3' }], flavor: "It trades up to a bigger shell whenever it finds one.", special: { name: 'Shell Song', template: 'heal', color: '#f08aa8' } },
    { id: 'capyboop', type: 'tide', displayName: 'Capyboop', artId: 'capyboop', facing: 'left', habitats: ['swamp', 'lake'], homes: ['south-america'], evolutions: [{ name: 'Capybuddy', artId: 'capyboop-2' }, { name: 'Capy Chief', artId: 'capyboop-3' }], flavor: "Everyone in the river wants to sit next to it.", special: { name: 'Warm Soak', template: 'heal', color: '#b8855a' } },
    { id: 'llamist', type: 'gale', displayName: 'Llamist', artId: 'llamist', facing: 'left', habitats: ['mountain', 'canyon'], homes: ['south-america'], evolutions: [{ name: 'Llamacloud', artId: 'llamist-2' }, { name: 'Stormwool', artId: 'llamist-3' }], flavor: "Its wool is so fluffy that clouds get stuck in it.", special: { name: 'Mist Veil', template: 'protect', color: '#d0d8e8' } },
    { id: 'koalump', type: 'leaf', displayName: 'Koalump', artId: 'koalump', facing: 'left', habitats: ['forest', 'coast'], homes: ['oceania'], evolutions: [{ name: 'Koalog', artId: 'koalump-2' }, { name: 'Gum Tree King', artId: 'koalump-3' }], flavor: "It sleeps nearly all day, and it is grumpy if you wake it.", special: { name: 'Eucalyptus Nap', template: 'heal', color: '#8a9a8a' } },
    { id: 'reefling', type: 'tide', displayName: 'Reefling', artId: 'reefling', facing: 'left', habitats: ['coast', 'tropical'], homes: ['oceania'], evolutions: [{ name: 'Reefrider', artId: 'reefling-2' }, { name: 'Coral Regent', artId: 'reefling-3' }], flavor: "It hides among bright coral and changes color when it is happy.", special: { name: 'Coral Crash', template: 'strong', color: '#f06a5a' } },
    { id: 'pengwee', type: 'frost', displayName: 'Pengwee', artId: 'pengwee', facing: 'left', habitats: ['snow', 'coast'], homes: ['antarctica'], evolutions: [{ name: 'Pengrand', artId: 'pengwee-2' }, { name: 'Emperor Pengwee', artId: 'pengwee-3' }], flavor: "It slides everywhere on its belly and calls that walking.", special: { name: 'Belly Slide', template: 'strong', color: '#4a7ac8' } },
    { id: 'floeseal', type: 'frost', displayName: 'Floeseal', artId: 'floeseal', facing: 'left', habitats: ['snow', 'lake'], homes: ['antarctica'], evolutions: [{ name: 'Floeguard', artId: 'floeseal-2' }, { name: 'Berg Warden', artId: 'floeseal-3' }], flavor: "It naps on floating ice and wakes up somewhere new.", special: { name: 'Ice Blanket', template: 'protect', color: '#c8e8f0' } },
    { id: 'sunmane', type: 'flame', displayName: 'Sunmane', artId: 'sunmane', facing: 'left', rare: true, habitats: ['plains', 'desert'], homes: ['africa-north', 'africa-west', 'africa-central', 'africa-east', 'africa-south'], flavor: "Its mane glows like sunrise over the savanna.", special: { name: 'Solar Roar', template: 'strong', color: '#ffc23a' } },
    { id: 'jadewyrm', type: 'stone', displayName: 'Jadewyrm', artId: 'jadewyrm', facing: 'left', rare: true, habitats: ['mountain', 'lake'], homes: ['asia-west', 'asia-south', 'asia-east'], flavor: "It coils among misty peaks and shines like polished jade.", special: { name: 'Jade Coil', template: 'protect', color: '#3ab88a' } },
    { id: 'quetzalight', type: 'gale', displayName: 'Quetzalight', artId: 'quetzalight', facing: 'left', rare: true, habitats: ['forest', 'tropical'], homes: ['america-mainland', 'america-caribbean'], flavor: "Its long tail feathers trail light through the cloud forest.", special: { name: 'Plume Flare', template: 'heal', color: '#3ad8a0' } },
    { id: 'jagglow', type: 'leaf', displayName: 'Jagglow', artId: 'jagglow', facing: 'left', rare: true, habitats: ['tropical', 'swamp'], homes: ['south-america'], flavor: "At night, all you can see are its glowing spots.", special: { name: 'Night Pounce', template: 'strong', color: '#3ac8d8' } },
    { id: 'kiwisp', type: 'leaf', displayName: 'Kiwisp', artId: 'kiwisp', facing: 'left', rare: true, habitats: ['forest', 'coast'], homes: ['oceania'], flavor: "A small round bird that leads lost hikers home by wisp-light.", special: { name: 'Wisp Trail', template: 'heal', color: '#c8e070' } },
    { id: 'glaciarch', type: 'frost', displayName: 'Glaciarch', artId: 'glaciarch', facing: 'left', rare: true, habitats: ['snow', 'coast'], homes: ['antarctica'], flavor: "An ancient ice whale that sings under the frozen sea.", special: { name: 'Glacier Song', template: 'protect', color: '#9fe0f0' } },
    { id: 'howlpup', type: 'frost', displayName: 'Howlpup', artId: 'howlpup', facing: 'left', habitats: ['snow', 'forest'], homes: ['us-west', 'us-midwest', 'america-mainland', 'europe-north', 'europe-east', 'asia-east'], evolutions: [{ name: 'Howlfang', artId: 'howlpup-2' }, { name: 'Moonfang', artId: 'howlpup-3' }], flavor: "It practices its howl every night, and it gets a little louder each time.", special: { name: 'Moon Howl', template: 'strong', color: '#8fd0f0' } },
    { id: 'toothling', type: 'tide', displayName: 'Toothling', artId: 'toothling', facing: 'left', habitats: ['coast', 'tropical'], homes: ['us-west', 'us-south', 'america-caribbean', 'africa-south', 'asia-east', 'oceania'], evolutions: [{ name: 'Razorjaw', artId: 'toothling-2' }, { name: 'Megalodon', artId: 'toothling-3' }], flavor: "A tiny shark with a very big plan: to grow up into a Megalodon.", special: { name: 'Mega Chomp', template: 'strong', color: '#4a7a9a' } },
    { id: 'pebbletort', type: 'stone', displayName: 'Pebbletort', artId: 'pebbletort', facing: 'left', habitats: ['desert', 'plains'], homes: ['us-west', 'us-south', 'africa-north', 'africa-south', 'south-america', 'asia-west'], evolutions: [{ name: 'Cragtort', artId: 'pebbletort-2' }, { name: 'Mount Tortoise', artId: 'pebbletort-3' }], flavor: "It is never in a hurry, and it always gets there in the end.", special: { name: 'Mountain Shell', template: 'protect', color: '#9a8f78' } },
    { id: 'lilyhop', type: 'leaf', displayName: 'Lilyhop', artId: 'lilyhop', facing: 'left', habitats: ['swamp', 'tropical'], homes: ['us-south', 'us-northeast', 'america-mainland', 'south-america', 'africa-central', 'asia-south'], evolutions: [{ name: 'Lilyleap', artId: 'lilyhop-2' }, { name: 'Lily Monarch', artId: 'lilyhop-3' }], flavor: "It wears its favorite lily pad everywhere, even on dry land.", special: { name: 'Rain Song', template: 'heal', color: '#4fb86a' } },
    { id: 'emberwolf', type: 'flame', displayName: 'Emberwolf', artId: 'emberwolf', facing: 'left', rare: true, habitats: ['desert', 'canyon'], homes: ['us-west', 'asia-west'], flavor: "Travelers follow its glowing paw prints across the night desert.", special: { name: 'Cinder Howl', template: 'strong', color: '#f0642e' } },
    { id: 'inkraken', type: 'tide', displayName: 'Inkraken', artId: 'inkraken', facing: 'left', rare: true, habitats: ['harbor', 'coast'], homes: ['us-northeast', 'europe-north', 'asia-east'], flavor: "Old sailors tell stories about it, and it remembers every one.", special: { name: 'Ink Cloud', template: 'protect', color: '#7a3aa8' } },
    { id: 'ironbison', type: 'stone', displayName: 'Iron Bison', artId: 'ironbison', facing: 'left', boss: { move: 'Iron Stampede', warning: "It paws the ground. Guard now!" }, habitats: ['plains', 'mountain'], homes: ['us-west', 'us-midwest', 'us-south', 'us-northeast'], flavor: "The ground shakes for miles when it decides to run.", special: { name: 'Iron Stampede', template: 'strong', color: '#8a8f98' } },
    { id: 'bastion', type: 'stone', displayName: 'Bastion', artId: 'bastion', facing: 'left', boss: { move: 'Falling Tower', warning: "Its turrets tilt forward. Guard now!" }, habitats: ['castle', 'mountain'], homes: ['europe-north', 'europe-west', 'europe-south', 'europe-east'], flavor: "A walking fortress that remembers every king who ever lived inside it.", special: { name: 'Stone Rampart', template: 'protect', color: '#a89a80' } },
    { id: 'sphinxar', type: 'flame', displayName: 'Sphinxar', artId: 'sphinxar', facing: 'left', boss: { move: 'Burning Sands', warning: "The sand starts to glow. Guard now!" }, habitats: ['desert', 'canyon'], homes: ['africa-north', 'africa-west', 'africa-central', 'africa-east', 'africa-south'], flavor: "It has guarded the sands for ages, and it loves a good riddle.", special: { name: 'Ember Riddle', template: 'strong', color: '#f0a040' } },
    { id: 'typhoondrake', type: 'tide', displayName: 'Typhoon Drake', artId: 'typhoondrake', facing: 'left', boss: { move: 'Great Wave', warning: "A huge wave rises behind it. Guard now!" }, habitats: ['coast', 'lake'], homes: ['asia-west', 'asia-south', 'asia-east'], flavor: "Fishermen read the clouds to know when it wakes.", special: { name: 'Typhoon Coil', template: 'strong', color: '#3a7ad8' } },
    { id: 'hurricoil', type: 'gale', displayName: 'Hurricoil', artId: 'hurricoil', facing: 'left', boss: { move: 'Hurricane Spin', warning: "Its wings begin to spiral. Guard now!" }, habitats: ['coast', 'tropical'], homes: ['america-mainland', 'america-caribbean'], flavor: "Every storm season, sailors watch for its spiral wings.", special: { name: 'Eye of the Storm', template: 'protect', color: '#8ad0e8' } },
    { id: 'amazorn', type: 'leaf', displayName: 'Amazorn', artId: 'amazorn', facing: 'left', boss: { move: 'Vine Crush', warning: "Vines creep across the ground. Guard now!" }, habitats: ['tropical', 'swamp'], homes: ['south-america'], flavor: "The jungle quietly moves out of its way.", special: { name: 'Thorn Wall', template: 'protect', color: '#3a8a3f' } },
    { id: 'coralcolossus', type: 'tide', displayName: 'Coral Colossus', artId: 'coralcolossus', facing: 'left', boss: { move: 'Reef Slam', warning: "It raises a coral fist. Guard now!" }, habitats: ['coast', 'tropical'], homes: ['oceania'], flavor: "An island that stood up one day and started walking.", special: { name: 'Reef Mend', template: 'heal', color: '#f07a6a' } },
    { id: 'frostmaw', type: 'frost', displayName: 'Frostmaw', artId: 'frostmaw', facing: 'left', boss: { move: 'Ice Quake', warning: "The ice begins to crack. Guard now!" }, habitats: ['snow', 'coast'], homes: ['antarctica'], flavor: "Its tusks are older than the ice shelf it sleeps on.", special: { name: 'Glacier Tusks', template: 'strong', color: '#a8e0f0' } },
  ] as Omit<Species, 'moves'>[]).map((s) => ({ ...s, moves: MOVES[s.id]! })),
  souvenirs: [
    { id: 'compass', displayName: 'Carved Compass', artId: 'compass', flavor: 'Its needle always seems to be pointing somewhere exciting.' },
    { id: 'shell', displayName: 'Patterned Shell', artId: 'shell', flavor: 'If you listen closely, it hums.' },
    { id: 'lantern', displayName: 'Tiny Lantern', artId: 'lantern', flavor: 'Bright enough for one small explorer.' },
    { id: 'feather', displayName: 'Storm Feather', artId: 'feather', flavor: 'It feels faintly of wind.' },
    { id: 'stone', displayName: 'River Stone', artId: 'stone', flavor: 'Worn smooth by a very long journey.' },
    { id: 'map-scrap', displayName: 'Old Map Scrap', artId: 'map-scrap', flavor: 'Part of a map nobody has finished yet.' },
  ],
  cards: allCards,
  starterSpeciesId: 'slatepaw',
  featuredSpeciesId: 'barkknight',
};
