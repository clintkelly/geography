import { MAPS } from '../content/maps';
import { PACK } from '../content/pack';
import type { Place, Region, Species } from '../content/types';
import type { Reward } from '../engine/game';

export const place = (id: string) => PACK.places.find((p) => p.id === id) as Place;
export const species = (id: string) => PACK.species.find((s) => s.id === id) as Species;
export const souvenir = (id: string) => PACK.souvenirs.find((s) => s.id === id);
export const region = (id: string) => PACK.regions.find((r) => r.id === id) as Region;
export const mapFor = (regionId: string) => MAPS[region(regionId).mapId];

export function rewardLabel(r: Reward): string {
  return r.kind === 'souvenir' ? (souvenir(r.souvenirId)?.displayName ?? 'Souvenir') : `${r.xp} bond XP for your companion`;
}
