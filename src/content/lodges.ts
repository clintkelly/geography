import type { CreatureType } from './types';

/** What a Lodge asks about. 'all' mixes every other Lodge's subject. */
export type LodgeSubject = 'animal' | 'flag' | 'location' | 'capital' | 'history' | 'math' | 'words' | 'all';
export type Stage = 1 | 2 | 3;

export interface LodgeFoe {
  speciesId: string;
  stage: Stage;
}

export interface Lodge {
  id: string;
  name: string;
  /** Lodges are taken in this order, each one harder than the last. */
  rank: number;
  /** The Lodge's own type: the leader's team, and the prize, are this type. */
  type: CreatureType;
  subject: LodgeSubject;
  /** What the questions are about, in a child's words. */
  subjectName: string;
  /** The battle backdrop, and the home turf for creatures that live there. */
  biome: string;
  leader: { name: string; artId: string; intro: string; win: string };
  /** Junior rangers, one creature each, before the leader. */
  juniors: (LodgeFoe & { name: string })[];
  /** The leader's team in battle order. The last one is the ace. */
  team: LodgeFoe[];
  /** A creature found nowhere else, given the first time the Lodge is beaten. */
  prizeSpeciesId: string;
  patchArtId: string;
  /** A legendary creature, given with the Gold patch after the Lodge's Mastery Test. */
  legendaryId: string;
  /** A quiz at the door: most answers right to get in. For the math and vocabulary Lodges. */
  gate?: boolean;
  /** The leader's creatures wear a Brain Shield that only a streak of right answers breaks. */
  shield?: boolean;
  /** Another Lodge's Gold patch needed before this one opens. */
  needsGold?: string;
  /** The creature level that makes this Lodge a fair fight. */
  recommendedLevel: number;
  /** The Ranger League: Elite Rangers battled one after another before the Champion (the leader). Not on the Lodge ladder. */
  gauntlet?: readonly LeagueRanger[];
  /** A Kaiju Alert: a giant monster heading for a real city, fought in three phases. Not on the Lodge ladder. */
  kaiju?: KaijuAlert;
}

export interface KaijuAlert {
  city: string;
  /** The country or state the city is in: the battle's place, and its region's questions. */
  placeId: string;
  /** How dangerous, 1 to 6: shown as stars, and sets its strength. */
  threat: number;
  /** Battle strength on the Lodge scale. */
  power: number;
}

/** An Elite Ranger of the League. Beating their last creature the first time wins their star creature. */
export interface LeagueRanger {
  name: string;
  artId: string;
  type: CreatureType;
  intro: string;
  team: readonly LodgeFoe[];
  prizeSpeciesId: string;
  /** How strong their creatures are, on the Lodge scale. */
  power: number;
}

const foe = (speciesId: string, stage: Stage): LodgeFoe => ({ speciesId, stage });
const junior = (name: string, speciesId: string, stage: Stage) => ({ name, speciesId, stage });

export const LODGES: readonly Lodge[] = [
  {
    id: 'wildwood', name: 'Wildwood Lodge', rank: 1, type: 'leaf', subject: 'animal', subjectName: 'Animals and where they live', biome: 'forest',
    leader: { name: 'Ranger Hazel', artId: 'leader-wildwood', intro: 'Every animal has a home. Show me you know where they live!', win: 'You know your wild neighbors. Take the Wildwood Patch!' },
    juniors: [junior('Junior Ranger Milo', 'thistlehop', 1), junior('Junior Ranger June', 'lilyhop', 1)],
    team: [foe('mapleclop', 1), foe('koalump', 1)],
    prizeSpeciesId: 'rustlepaw', patchArtId: 'patch-wildwood', legendaryId: 'qiloom', recommendedLevel: 1,
  },
  {
    id: 'banner', name: 'Banner Lodge', rank: 2, type: 'gale', subject: 'flag', subjectName: 'Flags of the world', biome: 'coast',
    leader: { name: 'Captain Soren', artId: 'leader-banner', intro: 'A flag tells a story in the wind. Can you read them?', win: 'Every flag flies for you now. Take the Banner Patch!' },
    juniors: [junior('Junior Ranger Ada', 'puffgust', 1), junior('Junior Ranger Theo', 'monarflit', 1)],
    team: [foe('corgust', 1), foe('cranewind', 1), foe('albasoar', 2)],
    prizeSpeciesId: 'aquilift', patchArtId: 'patch-banner', legendaryId: 'rocquill', recommendedLevel: 2,
  },
  {
    id: 'compass', name: 'Compass Lodge', rank: 3, type: 'stone', subject: 'location', subjectName: 'Finding places on the map', biome: 'mountain',
    leader: { name: 'Ranger Marisol', artId: 'leader-compass', intro: 'A good explorer never gets lost. Let\'s see your map skills!', win: 'You could find your way anywhere. Take the Compass Patch!' },
    juniors: [junior('Junior Ranger Ravi', 'pebbletort', 1), junior('Junior Ranger Lena', 'sentrikat', 1)],
    team: [foe('cragmaw', 1), foe('rockguana', 1), foe('peakprowl', 2)],
    prizeSpeciesId: 'screepip', patchArtId: 'patch-compass', legendaryId: 'gargrim', recommendedLevel: 3,
  },
  {
    id: 'echo', name: 'Echo Lodge', rank: 4, type: 'sound', subject: 'words', subjectName: 'Vocabulary words', biome: 'canyon',
    leader: { name: 'Maestro Kofi', artId: 'leader-echo', intro: 'Words are music. Let\'s hear how many you know!', win: 'What a vocabulary! Take the Echo Patch!' },
    juniors: [junior('Junior Ranger Ivy', 'coquito', 2), junior('Junior Ranger Sam', 'howlero', 2)],
    team: [foe('songfluke', 2), foe('mimilyre', 2), foe('rumbelph', 3)],
    prizeSpeciesId: 'chucklebeak', patchArtId: 'patch-echo', legendaryId: 'sirenade', gate: true, shield: true, recommendedLevel: 5,
  },
  {
    id: 'gearworks', name: 'Gearworks Lodge', rank: 5, type: 'metal', subject: 'math', subjectName: 'Math', biome: 'castle',
    leader: { name: 'Engineer Priya', artId: 'leader-gearworks', intro: 'Every machine runs on math. Let\'s test your gears!', win: 'Your mind runs like clockwork. Take the Gearworks Patch!' },
    juniors: [junior('Junior Ranger Omar', 'ferrosnail', 2), junior('Junior Ranger Bea', 'armorfin', 2)],
    team: [foe('clubclank', 2), foe('domeplod', 2), foe('hornclank', 3)],
    prizeSpeciesId: 'rivethorn', patchArtId: 'patch-gearworks', legendaryId: 'talosteel', gate: true, shield: true, recommendedLevel: 6,
  },
  {
    id: 'lantern', name: 'Lantern Lodge', rank: 6, type: 'light', subject: 'capital', subjectName: 'Capital cities', biome: 'harbor',
    leader: { name: 'Ranger Aurelio', artId: 'leader-lantern', intro: 'Capital cities shine brightest at night. Do you know them all?', win: 'You light up the map! Take the Lantern Patch!' },
    juniors: [junior('Junior Ranger Kai', 'jellume', 2), junior('Junior Ranger Rosa', 'maukit', 2)],
    team: [foe('cavestar', 2), foe('tiledrake', 2), foe('peacrest', 3), foe('sunbeary', 3)],
    prizeSpeciesId: 'gleamarin', patchArtId: 'patch-lantern', legendaryId: 'glowplume', recommendedLevel: 7,
  },
  {
    id: 'ancient', name: 'Ancient Lodge', rank: 7, type: 'spirit', subject: 'history', subjectName: 'History', biome: 'desert',
    leader: { name: 'Keeper Noor', artId: 'leader-ancient', intro: 'The past is full of stories. How many do you remember?', win: 'You carry the stories of the world. Take the Ancient Patch!' },
    juniors: [junior('Junior Ranger Eli', 'hushowl', 3), junior('Junior Ranger Mei', 'spectrab', 3)],
    team: [foe('kermoon', 3), foe('kitsulit', 3), foe('tarspook', 3), foe('huginnet', 3)],
    prizeSpeciesId: 'lazarine', patchArtId: 'patch-ancient', legendaryId: 'bakumist', recommendedLevel: 8,
  },
  {
    id: 'summit', name: 'Summit Lodge', rank: 8, type: 'frost', subject: 'all', subjectName: 'A bit of everything', biome: 'snow',
    leader: { name: 'Grand Ranger Tova', artId: 'leader-summit', intro: 'You climbed every Lodge to reach the top. One last test!', win: 'You are a Grand Ranger! Take the Summit Patch!' },
    juniors: [junior('Junior Ranger Finn', 'snowmonk', 3), junior('Junior Ranger Nia', 'reinfrost', 3)],
    team: [foe('moosedrift', 3), foe('alpenhorn', 3), foe('glassfin', 3), foe('glaciarch', 3)],
    prizeSpeciesId: 'floecub', patchArtId: 'patch-summit', legendaryId: 'yetitan', needsGold: 'gearworks', recommendedLevel: 10,
  },
  {
    id: 'league', name: 'Starfall League', rank: 9, type: 'light', subject: 'all', subjectName: 'A bit of everything', biome: 'mountain',
    leader: { name: 'Champion Celeste', artId: 'leader-league-champion', intro: 'Four Elite Rangers, then me. Only the best explorers reach the stars!', win: 'You are the Starfall Champion! Your team joins the Hall of Fame!' },
    juniors: [],
    gauntlet: [
      { name: 'Elite Ranger Ignacio', artId: 'leader-league-ember', type: 'flame', intro: 'My fire burns like the summer sun!', team: [foe('embertig', 3), foe('solarion', 3)], prizeSpeciesId: 'solarion', power: 9 },
      { name: 'Elite Ranger Maile', artId: 'leader-league-tide', type: 'tide', intro: 'Ride the waves with me, if you can!', team: [foe('narspire', 3), foe('delphinova', 3)], prizeSpeciesId: 'delphinova', power: 9 },
      { name: 'Elite Ranger Bjorn', artId: 'leader-league-frost', type: 'frost', intro: 'The north sky is cold and clear. So is my strategy.', team: [foe('tuskfrost', 3), foe('ursastar', 3)], prizeSpeciesId: 'ursastar', power: 10 },
      { name: 'Elite Ranger Zhi', artId: 'leader-league-gale', type: 'gale', intro: 'Feel the wind? My dragon rides it!', team: [foe('strikewing', 3), foe('dracostar', 3)], prizeSpeciesId: 'dracostar', power: 10 },
    ],
    team: [foe('typhoondrake', 3), foe('glimmerhorn', 3), foe('cosmobill', 3)],
    prizeSpeciesId: 'cosmobill', patchArtId: 'patch-league', legendaryId: 'cosmobill', recommendedLevel: 12,
  },
  {
    id: 'kaiju-quakeback', name: 'Kaiju Alert: San Francisco', rank: 4, type: 'stone', subject: 'all', subjectName: 'Places near San Francisco', biome: 'coast',
    leader: { name: 'Quakeback', artId: 'quakeback-3', intro: "The ground is shaking! Quakeback is stomping toward San Francisco!", win: "Quakeback lumbers back under the hills. San Francisco is safe!" },
    juniors: [],
    team: [foe('quakeback', 3), foe('quakeback', 3), foe('quakeback', 3)],
    prizeSpeciesId: 'quakeback', patchArtId: 'patch-kaiju', legendaryId: 'quakeback', recommendedLevel: 5,
    kaiju: { city: 'San Francisco', placeId: 'california', threat: 1, power: 4 },
  },
  {
    id: 'kaiju-tidalorn', name: 'Kaiju Alert: Tokyo', rank: 5, type: 'tide', subject: 'all', subjectName: 'Places near Tokyo', biome: 'coast',
    leader: { name: 'Tidalorn', artId: 'tidalorn-3', intro: "A huge wave is rising in Tokyo Bay. Tidalorn is coming ashore!", win: "Tidalorn swims back out to sea. Tokyo is safe!" },
    juniors: [],
    team: [foe('tidalorn', 3), foe('tidalorn', 3), foe('tidalorn', 3)],
    prizeSpeciesId: 'tidalorn', patchArtId: 'patch-kaiju', legendaryId: 'tidalorn', recommendedLevel: 6,
    kaiju: { city: 'Tokyo', placeId: 'japan', threat: 2, power: 5 },
  },
  {
    id: 'kaiju-stormcrab', name: 'Kaiju Alert: Rio de Janeiro', rank: 6, type: 'metal', subject: 'all', subjectName: 'Places near Rio de Janeiro', biome: 'coast',
    leader: { name: 'Stormcrab', artId: 'stormcrab-3', intro: "Giant steel claws are rising out of Guanabara Bay. Stormcrab is heading for Rio!", win: "Stormcrab scuttles back into the deep. Rio is safe!" },
    juniors: [],
    team: [foe('stormcrab', 3), foe('stormcrab', 3), foe('stormcrab', 3)],
    prizeSpeciesId: 'stormcrab', patchArtId: 'patch-kaiju', legendaryId: 'stormcrab', recommendedLevel: 7,
    kaiju: { city: 'Rio de Janeiro', placeId: 'brazil', threat: 3, power: 6 },
  },
  {
    id: 'kaiju-magmantis', name: 'Kaiju Alert: Naples', rank: 7, type: 'flame', subject: 'all', subjectName: 'Places near Naples', biome: 'coast',
    leader: { name: 'Magmantis', artId: 'magmantis-3', intro: "Mount Vesuvius is glowing! Magmantis is leaping toward Naples!", win: "Magmantis bows and returns to the volcano. Naples is safe!" },
    juniors: [],
    team: [foe('magmantis', 3), foe('magmantis', 3), foe('magmantis', 3)],
    prizeSpeciesId: 'magmantis', patchArtId: 'patch-kaiju', legendaryId: 'magmantis', recommendedLevel: 8,
    kaiju: { city: 'Naples', placeId: 'italy', threat: 4, power: 7 },
  },
  {
    id: 'kaiju-krakenmaw', name: 'Kaiju Alert: Sydney', rank: 8, type: 'tide', subject: 'all', subjectName: 'Places near Sydney', biome: 'coast',
    leader: { name: 'Krakenmaw', artId: 'krakenmaw-3', intro: "Lightning is flashing under Sydney Harbour. Krakenmaw is rising!", win: "Krakenmaw sinks back into the storm deep. Sydney is safe!" },
    juniors: [],
    team: [foe('krakenmaw', 3), foe('krakenmaw', 3), foe('krakenmaw', 3)],
    prizeSpeciesId: 'krakenmaw', patchArtId: 'patch-kaiju', legendaryId: 'krakenmaw', recommendedLevel: 10,
    kaiju: { city: 'Sydney', placeId: 'australia', threat: 5, power: 8 },
  },
  {
    id: 'kaiju-glacierhorn', name: 'Kaiju Alert: Reykjavík', rank: 9, type: 'frost', subject: 'all', subjectName: 'Places near Reykjavík', biome: 'coast',
    leader: { name: 'Glacierhorn', artId: 'glacierhorn-3', intro: "A blizzard is rolling off the glacier. Glacierhorn is charging at Reykjavík!", win: "Glacierhorn turns back toward the ice cap. Reykjavík is safe!" },
    juniors: [],
    team: [foe('glacierhorn', 3), foe('glacierhorn', 3), foe('glacierhorn', 3)],
    prizeSpeciesId: 'glacierhorn', patchArtId: 'patch-kaiju', legendaryId: 'glacierhorn', recommendedLevel: 10,
    kaiju: { city: 'Reykjavík', placeId: 'iceland', threat: 6, power: 9 },
  },
];
