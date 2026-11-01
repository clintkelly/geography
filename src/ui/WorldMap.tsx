import { useMemo, useRef, useState, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { clampView, type MapDef, type View } from '../content/maps';
import { useKeys } from './keys';

export type Highlight = 'candidate' | 'ruledOut' | 'found' | 'route' | 'atlas' | 'correct' | 'wrong' | 'selectable';

interface Props {
  map: MapDef;
  highlights?: Record<string, Highlight>;
  onFeatureClick?: (featureId: string) => void;
  /** Overlays receive the scale, so markers stay a constant on-screen size when zoomed. */
  children?: (scale: number) => ReactNode;
  label: string;
  interactive?: boolean;
}

export function WorldMap({ map, highlights = {}, onFeatureClick, children, label, interactive = true }: Props) {
  const home = (map.presets[0] as { view: View }).view;
  const [view, setView] = useState<View>(() => clampView(home, map));
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const ratio = map.height / map.width;
  const scale = view.w / map.width;

  const shapes = useMemo(
    () =>
      map.features.map((c, i) => {
        const h = highlights[c.id];
        return (
          <path
            key={i}
            d={c.d}
            data-feature={c.id}
            className={`land${h ? ` land-${h}` : ''}`}
            onClick={() => {
              if (!drag.current?.moved) onFeatureClick?.(c.id);
            }}
          />
        );
      }),
    [map, highlights, onFeatureClick],
  );

  const zoom = (factor: number, cx = 0.5, cy = 0.5) =>
    setView((v) => {
      const w = Math.min(map.width, Math.max(70, v.w * factor));
      return clampView({ w, x: v.x + (v.w - w) * cx, y: v.y + (v.w - w) * ratio * cy }, map);
    });

  const pan = (dx: number, dy: number) => setView((v) => clampView({ ...v, x: v.x + dx * v.w, y: v.y + dy * v.w }, map));
  useKeys(
    interactive
      ? {
          '+': () => zoom(0.7),
          '=': () => zoom(0.7),
          '-': () => zoom(1.4),
          arrowleft: () => pan(-0.1, 0),
          arrowright: () => pan(0.1, 0),
          arrowup: () => pan(0, -0.1),
          arrowdown: () => pan(0, 0.1),
        }
      : {},
  );

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
    setView(clampView({ ...d.view, x: d.view.x - dx * units, y: d.view.y - dy * units }, map));
  };

  return (
    <div className="map">
      <svg
        role="img"
        aria-label={label}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w * ratio}`}
        style={{ aspectRatio: `${map.width} / ${map.height}` }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <rect x={0} y={0} width={map.width} height={map.height} className="sea" />
        {shapes}
        {children?.(scale)}
      </svg>
      {interactive && (
        <div className="map-controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(0.7)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1.4)}>−</button>
          {map.presets.map((p) => (
            <button key={p.label} type="button" onClick={() => setView(clampView(p.view, map))}>{p.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Marker({ at, scale, label, onClick, tone = 'default' }: {
  at: [number, number];
  scale: number;
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'done' | 'current' | 'correct' | 'wrong';
}) {
  const [x, y] = at;
  const r = 15 * scale;
  return (
    <g className={`marker marker-${tone}`} onClick={onClick}>
      <circle cx={x} cy={y} r={r * 1.8} className="marker-hit" />
      <circle cx={x} cy={y} r={r} className="marker-dot" />
      <text x={x} y={y} fontSize={r * 1.2} dy="0.36em" textAnchor="middle">{label}</text>
    </g>
  );
}

/** A clickable dot for a place too small to click on the map. */
export function Dot({ at, scale, onClick, tone = 'default', id }: { at: [number, number]; scale: number; onClick?: () => void; tone?: 'default' | 'correct' | 'wrong'; id: string }) {
  const [x, y] = at;
  return (
    <g className={`dot dot-${tone}`} data-place={id} onClick={onClick}>
      <circle cx={x} cy={y} r={11 * scale} className="marker-hit" />
      <circle cx={x} cy={y} r={4.5 * scale} className="dot-mark" />
    </g>
  );
}
