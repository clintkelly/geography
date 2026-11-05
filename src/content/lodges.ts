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
];
