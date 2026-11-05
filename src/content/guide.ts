/** The Field Guide: the real, prehistoric or legendary animal behind each creature. */
export type GuideKind = 'real' | 'prehistoric' | 'myth' | 'history';

export interface GuideEntry {
  kind: GuideKind;
  /** The real animal or legend, like "Spinosaurus". */
  basedOn: string;
  scientific: string | null;
  /** Prehistoric animals only: when they lived. */
  when: string | null;
  where: string;
  size: string | null;
  /** Myths and history: where the story comes from. */
  story: string | null;
  facts: { text: string; source: string }[];
}

const files = import.meta.glob<Record<string, GuideEntry>>('./guide/*.json', { eager: true, import: 'default' });
const GUIDE: Record<string, GuideEntry> = Object.assign({}, ...Object.values(files));

export const guideFor = (speciesId: string): GuideEntry | undefined => GUIDE[speciesId];

export const KIND_LABEL: Record<GuideKind, { icon: string; name: string }> = {
  real: { icon: '🐾', name: 'Real animal' },
  prehistoric: { icon: '🦴', name: 'Prehistoric' },
  myth: { icon: '✨', name: 'Myth or legend' },
  history: { icon: '🏛️', name: 'History' },
};
