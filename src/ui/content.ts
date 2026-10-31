import { PACK } from '../content/pack';
import type { Place, Species } from '../content/types';
import type { Reward } from '../engine/game';

export const place = (id: string) => PACK.places.find((p) => p.id === id) as Place;
export const species = (id: string) => PACK.species.find((s) => s.id === id) as Species;
export const souvenir = (id: string) => PACK.souvenirs.find((s) => s.id === id);

export function rewardLabel(r: Reward): string {
  return r.kind === 'souvenir' ? (souvenir(r.souvenirId)?.displayName ?? 'Souvenir') : `${r.xp} bond XP for your companion`;
}
