import type { AttackStyle, GuardStyle } from '../engine/combat';

export interface Moves {
  attack: string;
  guard: string;
  /** Fierce hits 1 harder but gives no charge, and a miss takes 1 extra damage. */
  attackStyle: AttackStyle;
  /** Each style trades damage, block and charge evenly. */
  guardStyle: GuardStyle;
}

const m = (attack: string, attackStyle: AttackStyle, guard: string, guardStyle: GuardStyle): Moves => ({ attack, attackStyle, guard, guardStyle });

/** Every creature's own Attack and Guard. The Special lives on the species. */
export const MOVES: Record<string, Moves> = {
  slatepaw: m('Pebble Toss', 'steady', 'Moss Curl', 'wall'),
  barkknight: m('Loyal Bite', 'steady', 'Shield Stance', 'steady'),
  sandwhisk: m('Sand Flick', 'steady', 'Burrow Dash', 'focus'),
  cindermite: m('Hot Headbutt', 'fierce', 'Rock Shell', 'wall'),
  cragmaw: m('Crag Smash', 'fierce', 'Stone Hide', 'wall'),
  galewing: m('Wing Slice', 'steady', 'Gust Shield', 'focus'),
  lakeshell: m('Shell Bash', 'steady', 'Shell Hide', 'wall'),
  thistlehop: m('Thorn Kick', 'steady', 'Prickle Ball', 'spiky'),
  bayouchomp: m('Swamp Chomp', 'fierce', 'Mud Wallow', 'steady'),
  dillopod: m('Tail Swipe', 'steady', 'Armor Ball', 'wall'),
  brinefin: m('Fin Slash', 'steady', 'Wave Dodge', 'focus'),
  lobsnap: m('Big Pinch', 'fierce', 'Claw Block', 'spiky'),
  mapleclop: m('Antler Butt', 'steady', 'Leaf Pile', 'focus'),
  fjordling: m('Icy Splash', 'steady', 'Frost Coat', 'steady'),
  alpenhorn: m('Horn Ram', 'fierce', 'Hoof Stand', 'steady'),
  thunderhoof: m('Thunder Kick', 'fierce', 'Static Field', 'spiky'),
  aurorawl: m('Glow Talons', 'steady', 'Night Hush', 'focus'),
  stormray: m('Ray Lash', 'steady', 'Storm Glide', 'focus'),
  lanternwhale: m('Tail Splash', 'steady', 'Deep Dive', 'wall'),
  castlewyrm: m('Tiny Flame', 'steady', 'Tower Tuck', 'wall'),
  baobun: m('Bark Bop', 'steady', 'Trunk Hug', 'wall'),
  zebrisk: m('Stripe Kick', 'steady', 'Zigzag Dodge', 'focus'),
  bambloom: m('Bamboo Swat', 'steady', 'Bamboo Thicket', 'spiky'),
  lanternox: m('Ox Charge', 'fierce', 'Lantern Light', 'steady'),
  moosedrift: m('Antler Toss', 'fierce', 'Snow Drift', 'wall'),
  conchling: m('Shell Spin', 'steady', 'Shell Retreat', 'wall'),
  capyboop: m('Belly Bump', 'steady', 'Calm Float', 'focus'),
  llamist: m('Spit Shot', 'steady', 'Wool Puff', 'wall'),
  koalump: m('Sleepy Swipe', 'steady', 'Branch Cling', 'wall'),
  reefling: m('Coral Jab', 'steady', 'Color Flash', 'spiky'),
  pengwee: m('Flipper Slap', 'steady', 'Huddle Up', 'steady'),
  floeseal: m('Flipper Splash', 'steady', 'Blubber Block', 'wall'),
  sunmane: m('Sun Claw', 'fierce', 'Blazing Mane', 'spiky'),
  jadewyrm: m('Jade Tail', 'steady', 'Coil Up', 'wall'),
  quetzalight: m('Plume Strike', 'steady', 'Feather Veil', 'focus'),
  jagglow: m('Shadow Swipe', 'fierce', 'Spot Blink', 'focus'),
  kiwisp: m('Beak Peck', 'steady', 'Wisp Hide', 'focus'),
  glaciarch: m('Tail Crash', 'fierce', 'Ice Dive', 'wall'),
  howlpup: m('Frost Bite', 'steady', 'Pack Stand', 'spiky'),
  toothling: m('Tooth Torpedo', 'fierce', 'Shark Dive', 'focus'),
  pebbletort: m('Boulder Bonk', 'steady', 'Shell Fortress', 'wall'),
  lilyhop: m('Tongue Lash', 'steady', 'Lily Leap', 'focus'),
  emberwolf: m('Ember Fang', 'fierce', 'Smoke Screen', 'focus'),
  inkraken: m('Tentacle Whip', 'steady', 'Ink Wrap', 'wall'),
  ironbison: m('Horn Charge', 'fierce', 'Iron Hide', 'wall'),
  bastion: m('Tower Punch', 'steady', 'Gatehouse', 'wall'),
  sphinxar: m('Riddle Claw', 'steady', 'Sand Veil', 'focus'),
  typhoondrake: m('Tidal Bite', 'fierce', 'Rain Wall', 'steady'),
  hurricoil: m('Gale Lash', 'steady', 'Wind Spiral', 'spiky'),
  amazorn: m('Thorn Lash', 'fierce', 'Canopy Cover', 'wall'),
  coralcolossus: m('Coral Fist', 'fierce', 'Reef Armor', 'spiky'),
  frostmaw: m('Tusk Swing', 'fierce', 'Ice Shell', 'wall'),
};
