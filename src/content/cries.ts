/**
 * Every creature's cry: one of a few recorded animal sounds, played at the creature's own pitch,
 * lower as it evolves, so no two creatures sound quite alike.
 */
export const CRY_FAMILIES = ['bark', 'bleat', 'bubble', 'buzz', 'chatter', 'chirp', 'click', 'croak', 'dolphin', 'ghost', 'growl', 'grunt', 'hiss', 'honk', 'hoot', 'howl', 'neigh', 'roar', 'robot', 'rumble', 'screech', 'squeak', 'trumpet', 'whale'] as const;
export type CryFamily = (typeof CRY_FAMILIES)[number];

const BY_FAMILY: Record<CryFamily, readonly string[]> = {
  bark: ['querifox', 'phasepup', 'earfox', 'dholecall', 'thylashade', 'fenneckit', 'paintpup', 'sealmonk', 'leoseal', 'aardshade', 'barkknight', 'bernasnow', 'burrowbark', 'corgust', 'doxdig', 'fjordling', 'floeseal', 'frostmaw', 'glidewisp', 'minusfox', 'poodlebloom', 'prairiepup', 'sandwhisk', 'sentrikat', 'spotspark', 'wordcollie'],
  bleat: ['pronghaste', 'springbolt', 'alpenhorn', 'boltgoat', 'humpyre', 'llamble', 'llamist', 'mapleclop', 'moosedrift', 'oryxflare', 'reinfrost', 'saigasnoot', 'voltewe'],
  bubble: ['flatflop', 'raysting', 'brinelet', 'sailsprint', 'marlinspear', 'archerspit', 'dragonlure', 'finglider', 'puffspike', 'remoraclip', 'bassbrawl', 'krakenmaw', 'swordstrike', 'krakeneye', 'jawstorm', 'sturgeonplate', 'leapsalmon', 'toothfrost', 'barraclad', 'brinefin', 'emberhead', 'glassfin', 'jellume', 'lazarine', 'lumangler', 'torpezap', 'zapeel', 'zapwhisker'],
  buzz: ['boomardier', 'solubee', 'magnetle', 'atomoth', 'leafcutter', 'hopleg', 'dragondart', 'buzzquito', 'longhornet', 'moundmite', 'magmantis', 'tardiguard', 'goliathorn', 'cavestar', 'centipod', 'cindermite', 'glowbug', 'hexhive', 'hornclank', 'krillume', 'lunaflit', 'mantido', 'monarflit', 'primecada', 'stepant', 'stormray', 'webangle'],
  chatter: ['drumpeck', 'orangusage', 'barbamonk', 'rackit', 'mandrilux', 'galagleam', 'gleamarin', 'gorilith', 'lexibo', 'lorishade', 'monkido', 'nightfinger', 'noseling', 'numbanzee', 'slothmoss', 'snowmonk', 'sparkemur', 'tarspook'],
  chirp: ['deedee', 'martinswift', 'thornshrike', 'jaycall', 'honeyguide', 'paradance', 'macawsong', 'todyzip', 'snowflit', 'roadzoom', 'chucklebeak', 'glowplume', 'kiwikin', 'kiwisp', 'mimilyre', 'mynatter', 'parrolex', 'sparkiwi', 'toucanopy', 'zippabee'],
  click: ['gyrosnail', 'musselock', 'limpshell', 'barnaclump', 'yetipinch', 'stormcrab', 'birdeater', 'bluepinch', 'storkwing', 'conchling', 'ferrosnail', 'lobsnap', 'octofract', 'pentastar', 'spectrab', 'spiralite', 'spiralnaut'],
  croak: ['fizzalotl', 'hellbend', 'tokaygrip', 'dartblaze', 'axoglow', 'clearhop', 'coquito', 'goliathop', 'lilyhop', 'olmling', 'salamblaze'],
  dolphin: ['botoglow', 'orcalash', 'otterkit', 'delphinova', 'whistlefin'],
  ghost: ['bakumist', 'kitsulit', 'pagegrub', 'sirenade'],
  growl: ['cloudprowl', 'ocelotus', 'glidepanther', 'wolvfrost', 'fossakick', 'manulmist', 'slothroar', 'sandshade', 'caracalfu', 'honeyfu', 'goldcatshade', 'lynxshade', 'badgerock', 'carpabear', 'pardojo', 'balamcub', 'bambloom', 'cheetgale', 'dashpurr', 'embertig', 'floecub', 'jagglow', 'kermoon', 'maukit', 'peakprowl', 'pumastone', 'sabrefang', 'scorchdevil', 'solarion', 'sunbeary', 'sunmane', 'tigrifu', 'ursastar'],
  grunt: ['metrodillo', 'muskguard', 'glacierhorn', 'damberly', 'bustarboom', 'trunkseal', 'digdillo', 'tuskhog', 'snapjaw', 'aardig', 'bisolith', 'breezenose', 'capyboop', 'coatikit', 'coatimo', 'coralcolossus', 'cosmobill', 'digbill', 'dillopod', 'domeplod', 'emberbill', 'frostbill', 'glowbill', 'gophshell', 'ironbison', 'koalump', 'lakeshell', 'lanternox', 'logshell', 'nudig', 'paddlet', 'pangoroll', 'pebblenose', 'pebbletort', 'platybolt', 'pygmippo', 'rivethorn', 'roozoom', 'screepip', 'seagrazer', 'spiralbore', 'starnoze', 'thistlehop', 'thunderhoof', 'wombrick'],
  hiss: ['crystalisk', 'hissroach', 'mintchame', 'basilisprint', 'dracoglide', 'chamelume', 'gharialance', 'coilball', 'leapcroc', 'hornsquirt', 'leafviper', 'cobrafu', 'amazorn', 'bayouchomp', 'catatumboa', 'gilablaze', 'nilesnap', 'possumoon', 'rockguana', 'sunscarab', 'thornback'],
  honk: ['herostride', 'goldplume', 'pouchdive', 'boomstrut', 'dodobell', 'gobblaze', 'strapguin', 'congopeak', 'braypen', 'clawhatch', 'cranekick', 'cranewind', 'flaminglow', 'gearbill', 'honkabat', 'honkonius', 'ibiscribe', 'ostrigust', 'pengwee', 'puffgust', 'shoestone'],
  hoot: ['lensowl', 'powerowl', 'fishowl', 'greyhush', 'burrowl', 'elfowl', 'coocity', 'athenowl', 'aurorawl', 'hootmonk', 'howlero', 'hushowl', 'peacrest', 'peavolt'],
  howl: ['stiltwolf', 'loonsong', 'emberwolf', 'howlpup', 'lupina'],
  neigh: ['chalkpony', 'glimmerhorn', 'hoofshell', 'okaleaf', 'pegawing', 'reefling', 'terracolt', 'zebrisk'],
  roar: ['tidalorn', 'quakeback', 'armorfin', 'castlewyrm', 'cavewyrm', 'clubclank', 'dracostar', 'goldgriff', 'hurricoil', 'inkraken', 'jadewyrm', 'komodrake', 'krakling', 'lamassling', 'longlet', 'mosaroar', 'plesiling', 'qiloom', 'quetzalight', 'rexroar', 'seaneck', 'sphinxar', 'spinosail', 'tiledrake', 'toothling', 'typhoondrake', 'wawelet', 'yetitan'],
  robot: ['talosteel'],
  rumble: ['baobun', 'bastion', 'cragmaw', 'gargrim', 'slatepaw'],
  screech: ['gullaugh', 'monkeagle', 'ospreydive', 'harpyclaw', 'kickretary', 'hammerkop', 'crestalon', 'talonfu', 'albasoar', 'aquilift', 'bennuflare', 'condorise', 'galewing', 'huginnet', 'rocquill', 'simurling', 'strikewing'],
  squeak: ['gravitail', 'cheekstash', 'martenleap', 'tenrecquill', 'ermiwhite', 'voledash', 'skunkstand', 'wormwell', 'ferretdash', 'quokkit', 'molediggs', 'squirrust', 'snowshoe', 'quillsteel', 'chipdig', 'hutiboo', 'echobat', 'quillnight', 'rustlepaw', 'solenox'],
  trumpet: ['rumbelph', 'trumpasaur', 'tuskfrost'],
  whale: ['bowfrost', 'clickwhale', 'chirpuga', 'glaciarch', 'lanternwhale', 'narspire', 'songfluke'],
};

export const CRY_OF: Readonly<Record<string, CryFamily>> = Object.fromEntries((Object.entries(BY_FAMILY) as [CryFamily, readonly string[]][]).flatMap(([f, ids]) => ids.map((id) => [id, f])));
