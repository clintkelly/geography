/** Reviewed history facts, one file per part of the world. Each ask's answer is the place it is listed under. */
export interface HistoryFact {
  fact: string;
  ask: string;
  source: string;
}

const files = import.meta.glob<Record<string, HistoryFact[]>>('./history/*.json', { eager: true, import: 'default' });
const BY_PLACE: Record<string, HistoryFact[]> = Object.assign({}, ...Object.values(files));

export const historyOf = (placeId: string): readonly HistoryFact[] => BY_PLACE[placeId] ?? [];
