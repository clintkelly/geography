import { clampView, MAPS, type MapDef, type View } from '../content/maps';
import { PACK } from '../content/pack';
import type { Place, Region, Species, StateCard } from '../content/types';
import type { Companion, Reward } from '../engine/game';
import { formOf } from '../engine/progression';

export const place = (id: string) => PACK.places.find((p) => p.id === id) as Place;
export const species = (id: string) => PACK.species.find((s) => s.id === id) as Species;
export const souvenir = (id: string) => PACK.souvenirs.find((s) => s.id === id);
export const region = (id: string) => PACK.regions.find((r) => r.id === id) as Region;

const regionMaps = new Map<string, MapDef>();

/** Frames a region on its own places, keeping the wider view as a button. */
function zoomedTo(regionId: string, map: MapDef): MapDef {
  const points = PACK.places.filter((p) => p.regionId === regionId).map((p) => map.project(p.lonLat));
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  // World maps draw places far smaller than the US map, so the margin follows the region's size.
  const padX = map.id === 'us' ? 50 : Math.max(14, (Math.max(...xs) - Math.min(...xs)) * 0.14);
  const padY = map.id === 'us' ? 45 : Math.max(12, (Math.max(...ys) - Math.min(...ys)) * 0.14);
  const [x0, x1, y0, y1] = [Math.min(...xs) - padX, Math.max(...xs) + padX, Math.min(...ys) - padY, Math.max(...ys) + padY];
  const ratio = map.height / map.width;
  const w = Math.max(x1 - x0, (y1 - y0) / ratio);
  const view: View = clampView({ x: (x0 + x1 - w) / 2, y: (y0 + y1 - w * ratio) / 2, w }, map);
  return { ...map, presets: [{ label: region(regionId).label, view }, ...map.presets] };
}

export function mapFor(regionId: string): MapDef {
  const base = MAPS[region(regionId).mapId];
  // Antarctica already fills its own map.
  if (base.id === 'antarctica') return base;
  const cached = regionMaps.get(regionId);
  if (cached) return cached;
  const zoomed = zoomedTo(regionId, base);
  regionMaps.set(regionId, zoomed);
  return zoomed;
}
export const cardFor = (placeId: string) => PACK.cards.find((c) => c.placeId === placeId) as StateCard;

/** How a companion looks and what it's called right now. */
export function companionView(c: Companion) {
  const s = species(c.speciesId);
  const form = formOf(s, c.bondXp);
  return { species: s, stage: form.stage, artId: form.artId, formName: form.name, name: c.nickname || form.name, shiny: !!c.shiny };
}

export function rewardLabel(r: Reward): string {
  return r.kind === 'creature' ? species(r.speciesId).displayName : `${r.xp} bond XP for your companion`;
}
