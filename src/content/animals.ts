/** Reviewed animal facts, one file per part of the world. Each ask's answer is the place it is listed under. */
export interface AnimalFact {
  fact: string;
  ask: string;
  source: string;
}

const files = import.meta.glob<Record<string, AnimalFact[]>>('./animals/*.json', { eager: true, import: 'default' });
const BY_PLACE: Record<string, AnimalFact[]> = Object.assign({}, ...Object.values(files));

export const animalsOf = (placeId: string): readonly AnimalFact[] => BY_PLACE[placeId] ?? [];
