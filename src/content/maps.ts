import { geoAlbersUsa, geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import states from 'us-atlas/states-10m.json';
import world from 'world-atlas/countries-50m.json';

export interface View {
  x: number;
  y: number;
  w: number;
}

export interface MapDef {
  id: 'world' | 'us';
  width: number;
  height: number;
  features: { id: string; d: string }[];
  project: (lonLat: readonly [number, number]) => [number, number];
  presets: { label: string; view: View }[];
}

type Geo = Topology<Record<string, GeometryCollection<{ name: string }>>>;

function build(id: MapDef['id'], width: number, height: number, projection: GeoProjection, topology: unknown, object: string, sphere: GeoPermissibleObjects | null, keep: (f: string) => boolean) {
  const topo = topology as Geo;
  const shapes = feature(topo, topo.objects[object] as GeometryCollection<{ name: string }>);
  // Without an explicit outline, the map frames its own shapes.
  projection.fitExtent([[8, 8], [width - 8, height - 8]], (sphere ?? { ...shapes, features: shapes.features.filter((f) => keep(String(f.id))) }) as never);
  const path = geoPath(projection);
  return {
    id,
    width,
    height,
    features: shapes.features.map((f) => ({ id: String(f.id), d: path(f as GeoPermissibleObjects) ?? '' })).filter((f) => f.d && keep(f.id)),
    project: (lonLat: readonly [number, number]): [number, number] => projection([lonLat[0], lonLat[1]]) ?? [0, 0],
  };
}

const worldBase = build('world', 960, 500, geoNaturalEarth1(), world, 'countries', { type: 'Sphere' }, () => true);

/** Fits Europe from Iceland to Moscow and north past Scandinavia, padded to the map's aspect ratio. */
export const EUROPE_VIEW: View = (() => {
  const corners = [[-25, 34], [-25, 72], [46, 34], [46, 72], [10, 34], [10, 72]].map((c) => worldBase.project(c as [number, number]));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(x1 - x0, ((y1 - y0) * worldBase.width) / worldBase.height);
  return { x: (x0 + x1 - w) / 2, y: (y0 + y1 - (w * worldBase.height) / worldBase.width) / 2, w };
})();

export const worldMap: MapDef = {
  ...worldBase,
  presets: [
    { label: 'Europe', view: EUROPE_VIEW },
    { label: 'World', view: { x: 0, y: 0, w: worldBase.width } },
  ],
};

const FIFTY = (id: string) => id !== '11' && Number(id) <= 56;
// d3's Albers USA is a composite: Alaska and Hawaii are drawn as insets at the lower left.
const usBase = build('us', 960, 600, geoAlbersUsa(), states, 'states', null, FIFTY);

export const usMap: MapDef = {
  ...usBase,
  presets: [{ label: 'USA', view: { x: 0, y: 0, w: usBase.width } }],
};

export const MAPS = { world: worldMap, us: usMap };

export function clampView(v: View, map: MapDef): View {
  const w = Math.min(map.width, Math.max(70, v.w));
  const h = (w * map.height) / map.width;
  return { w, x: Math.min(map.width - w, Math.max(0, v.x)), y: Math.min(map.height - h, Math.max(0, v.y)) };
}
