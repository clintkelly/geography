import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { useMemo, useRef, useState, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import topology from 'world-atlas/countries-50m.json';

const WIDTH = 960;
const HEIGHT = 500;

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' });
const pathOf = geoPath(projection);

const topo = topology as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const countries = feature(topo, topo.objects.countries).features.map((f) => ({
  id: String(f.id),
  d: pathOf(f as GeoPermissibleObjects) ?? '',
}));

export function project(lonLat: readonly [number, number]): [number, number] {
  return projection([lonLat[0], lonLat[1]]) ?? [0, 0];
}

export interface View {
  x: number;
  y: number;
  w: number;
}

const WORLD: View = { x: 0, y: 0, w: WIDTH };
/** Fits Europe from Iberia to the Aegean and north past Britain, padded to the map's aspect ratio. */
export const EUROPE: View = (() => {
  const corners = [[-13, 35], [-13, 59], [30, 35], [30, 59], [8, 35], [8, 59]].map((c) => project(c as [number, number]));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(x1 - x0, ((y1 - y0) * WIDTH) / HEIGHT);
  return { x: (x0 + x1 - w) / 2, y: (y0 + y1 - (w * HEIGHT) / WIDTH) / 2, w };
})();

export const clampView = (v: View): View => {
  const w = Math.min(WIDTH, Math.max(70, v.w));
  const h = (w * HEIGHT) / WIDTH;
  return { w, x: Math.min(WIDTH - w, Math.max(0, v.x)), y: Math.min(HEIGHT - h, Math.max(0, v.y)) };
};

interface Props {
  highlights?: Record<string, 'candidate' | 'ruledOut' | 'found' | 'route' | 'atlas'>;
  onCountryClick?: (isoNumeric: string) => void;
  initialView?: View;
  /** Overlays receive the current scale so markers stay a constant on-screen size when zoomed. */
  children?: (scale: number) => ReactNode;
  label: string;
  interactive?: boolean;
}

export function WorldMap({ highlights = {}, onCountryClick, initialView = EUROPE, children, label, interactive = true }: Props) {
  const [view, setView] = useState<View>(() => clampView(initialView));
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const height = (view.w * HEIGHT) / WIDTH;
  const scale = view.w / WIDTH;

  const shapes = useMemo(
    () =>
      countries.map((c, i) => {
        const h = highlights[c.id];
        return (
          <path
            key={i}
            d={c.d}
            className={`land${h ? ` land-${h}` : ''}`}
            onClick={() => {
              if (!drag.current?.moved) onCountryClick?.(c.id);
            }}
          />
        );
      }),
    [highlights, onCountryClick],
  );

  const zoom = (factor: number, cx = 0.5, cy = 0.5) =>
    setView((v) => {
      const w = Math.min(WIDTH, Math.max(70, v.w * factor));
      const h = (v.w * HEIGHT) / WIDTH;
      return clampView({ w, x: v.x + (v.w - w) * cx, y: v.y + (h - (w * HEIGHT) / WIDTH) * cy });
    });

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    zoom(e.deltaY > 0 ? 1.15 : 0.87, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (interactive) drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || e.buttons === 0) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    if (!d.moved) return;
    const units = d.view.w / e.currentTarget.getBoundingClientRect().width;
    setView(clampView({ ...d.view, x: d.view.x - dx * units, y: d.view.y - dy * units }));
  };

  return (
    <div className="map">
      <svg
        ref={svg}
        role="img"
        aria-label={label}
        viewBox={`${view.x} ${view.y} ${view.w} ${height}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="sea" />
        {shapes}
        {children?.(scale)}
      </svg>
      {interactive && (
        <div className="map-controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(0.7)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1.4)}>−</button>
          <button type="button" onClick={() => setView(clampView(EUROPE))}>Europe</button>
          <button type="button" onClick={() => setView(WORLD)}>World</button>
        </div>
      )}
    </div>
  );
}

export function Marker({ lonLat, scale, label, onClick, tone = 'default' }: {
  lonLat: readonly [number, number];
  scale: number;
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'done' | 'current' | 'correct' | 'wrong';
}) {
  const [x, y] = project(lonLat);
  const r = 15 * scale;
  return (
    <g className={`marker marker-${tone}`} onClick={onClick}>
      <circle cx={x} cy={y} r={r * 1.8} className="marker-hit" />
      <circle cx={x} cy={y} r={r} className="marker-dot" />
      <text x={x} y={y} fontSize={r * 1.2} dy="0.36em" textAnchor="middle">{label}</text>
    </g>
  );
}
