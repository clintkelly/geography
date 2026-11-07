import type { Pack } from './types';
import type { PlaceRecord } from './us/templates';

/** Returns a list of problems; an empty list means the pack is usable. */
export function validatePack(pack: Pack): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const q of pack.questions) {
    if (seen.has(q.id)) problems.push(`duplicate question ${q.id}`);
    seen.add(q.id);
    const optionIds = q.options.map((o) => o.id);
    const study = q.topic === 'math' || q.topic === 'word' || q.topic === 'science';
    if (q.inputType === 'typed') {
      if (!q.typed || q.options.length !== 1) problems.push(`${q.id}: a typed question needs its answer and one option to show`);
    } else if (q.inputType !== 'map-click' && q.options.length !== 4) problems.push(`${q.id}: needs 4 options`);
    if (new Set(optionIds).size !== optionIds.length) problems.push(`${q.id}: duplicate option ids`);
    if (new Set(q.options.map((o) => o.label)).size !== optionIds.length) problems.push(`${q.id}: duplicate option labels`);
    if (optionIds.filter((id) => id === q.acceptedId).length !== 1) problems.push(`${q.id}: needs exactly one accepted option`);
    // Math is worked out, and vocabulary is reviewed by a parent, so only geography needs a web source.
    if (!q.explanation || (!study && !q.sourceUrl.startsWith('https://'))) problems.push(`${q.id}: missing explanation or source`);
    if (study && q.regionId !== 'study') problems.push(`${q.id}: study questions belong to the study region`);
    if (q.inputType === 'map-marker' && q.options.some((o) => !o.lonLat)) problems.push(`${q.id}: marker without coordinates`);
    if (q.inputType === 'map-click' && q.options.some((o) => !o.featureId)) problems.push(`${q.id}: clickable option without a map feature`);
    if (new Set(q.options.map((o) => o.label)).size !== q.options.length) problems.push(`${q.id}: repeated option`);
    if (!study && !pack.regions.some((r) => r.id === q.regionId)) problems.push(`${q.id}: unknown region`);
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
  const regionIds = new Set(pack.regions.map((r) => r.id));
  for (const p of pack.places) if (!regionIds.has(p.regionId)) problems.push(`${p.id}: unknown region`);
  const speciesIds = new Set(pack.species.map((s) => s.id));
  for (const id of [pack.starterSpeciesId, pack.featuredSpeciesId]) {
    if (!speciesIds.has(id)) problems.push(`unknown species ${id}`);
  }
  for (const r of pack.regions) {
    if (pack.species.filter((s) => s.homes.includes(r.id)).length < 3) problems.push(`${r.id}: needs 3 creatures`);
  }
  for (const p of pack.places) {
    for (const n of p.neighbors ?? []) {
      const other = pack.places.find((o) => o.id === n);
      if (!other) problems.push(`${p.id}: unknown neighbor ${n}`);
      else if (!other.neighbors?.includes(p.id)) problems.push(`${p.id}: neighbor ${n} does not list it back`);
    }
  }
  for (const c of pack.cards) if (!pack.places.some((p) => p.id === c.placeId)) problems.push(`card for unknown place ${c.placeId}`);
  return problems;
}

/** Rules for place records. Consistency only: this cannot prove a fact is true. */
export function validateRecords(records: readonly PlaceRecord[]): string[] {
  const problems: string[] = [];
  for (const s of records) {
    const cities = s.sameStateCities;
    if (!s.cityState && cities.length !== 3) problems.push(`${s.id}: needs 3 same-place cities`);
    if (new Set(cities).size !== cities.length) problems.push(`${s.id}: duplicate city`);
    if (cities.includes(s.capital)) problems.push(`${s.id}: capital listed as a wrong answer`);
    if (s.largestCity !== s.capital && !cities.includes(s.largestCity)) problems.push(`${s.id}: largest city is not offered`);
    if (s.nickname?.others.includes(s.nickname.text)) problems.push(`${s.id}: duplicate nickname`);
    if (s.nickname?.text.includes(s.name)) problems.push(`${s.id}: nickname names the place`);
    if (s.hint?.includes(s.name) || s.hint2?.includes(s.name)) problems.push(`${s.id}: hint names the place`);
    if (!s.nickname && !s.hint) problems.push(`${s.id}: needs a nickname or a hint`);
    if (s.cityState && !s.hint2) problems.push(`${s.id}: a city-state needs a second hint`);
    if (!s.cityState && cities[0]?.includes(s.name)) problems.push(`${s.id}: clue city names the place`);
    if (s.facts.length < 2) problems.push(`${s.id}: needs 2 facts`);
    if (s.asks.length !== s.facts.length) problems.push(`${s.id}: needs a question for each fact`);
    if (s.asks.some((a) => a.includes(s.name))) problems.push(`${s.id}: a fact question names its answer`);
  }
  return problems;
}
