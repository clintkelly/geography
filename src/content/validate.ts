import type { Pack } from './types';

/** Returns a list of problems; an empty list means the pack is usable. */
export function validatePack(pack: Pack): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const q of pack.questions) {
    if (seen.has(q.id)) problems.push(`duplicate question ${q.id}`);
    seen.add(q.id);
    const optionIds = q.options.map((o) => o.id);
    if (q.options.length !== 4) problems.push(`${q.id}: needs 4 options`);
    if (new Set(optionIds).size !== optionIds.length) problems.push(`${q.id}: duplicate option ids`);
    if (new Set(q.options.map((o) => o.label)).size !== optionIds.length) problems.push(`${q.id}: duplicate option labels`);
    if (optionIds.filter((id) => id === q.acceptedId).length !== 1) problems.push(`${q.id}: needs exactly one accepted option`);
    if (!q.explanation || !q.sourceUrl.startsWith('https://')) problems.push(`${q.id}: missing explanation or source`);
    if (q.inputType === 'map-marker' && q.options.some((o) => !o.lonLat)) problems.push(`${q.id}: marker without coordinates`);
  }
  const placeIds = new Set(pack.places.map((p) => p.id));
  for (const p of pack.places) {
    if (pack.clues.filter((c) => c.targetId === p.id).length < 2) problems.push(`${p.id}: needs 2 clues`);
    if (p.atlas.length === 0) problems.push(`${p.id}: needs an atlas entry`);
  }
  for (const c of pack.clues) {
    if (!placeIds.has(c.targetId)) problems.push(`${c.id}: unknown target`);
    const target = pack.places.find((p) => p.id === c.targetId);
    if (target && c.text.includes(target.name)) problems.push(`${c.id}: names its own answer`);
  }
  const speciesIds = new Set(pack.species.map((s) => s.id));
  for (const id of [pack.starterSpeciesId, ...pack.regularOpponentIds, ...pack.guardianIds]) {
    if (!speciesIds.has(id)) problems.push(`unknown species ${id}`);
  }
  return problems;
}
