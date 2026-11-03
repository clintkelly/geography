import type { CSSProperties } from 'react';
import type { CreatureType } from '../content/types';
import { artUrl } from './art';

/** How each type's particles move. Everything is decorative and deterministic, so replays look the same. */
const MOTION: Record<CreatureType, { arc: boolean; spin: number; spread: [number, number]; lift: number; ms: number }> = {
  // Water splashes up and falls back down.
  tide: { arc: true, spin: 0, spread: [70, 50], lift: -40, ms: 700 },
  // Embers rise and flicker out.
  flame: { arc: false, spin: 40, spread: [45, 30], lift: -90, ms: 760 },
  // Leaves drift and twirl.
  leaf: { arc: false, spin: 400, spread: [80, 40], lift: -30, ms: 900 },
  // Rock chunks burst out and drop hard.
  stone: { arc: true, spin: 180, spread: [60, 30], lift: -20, ms: 620 },
  // Wind streaks sweep sideways.
  gale: { arc: false, spin: 20, spread: [130, 14], lift: 0, ms: 600 },
  // Ice shards shatter outward, spinning.
  frost: { arc: false, spin: 270, spread: [75, 75], lift: 0, ms: 640 },
  // Sparks crackle out fast in every direction.
  volt: { arc: false, spin: 120, spread: [90, 90], lift: 0, ms: 420 },
  // Sparkles of light burst out wide and twinkle.
  light: { arc: false, spin: 90, spread: [100, 100], lift: -10, ms: 680 },
  // Wisps drift slowly upward, swaying.
  spirit: { arc: false, spin: 30, spread: [55, 40], lift: -70, ms: 1000 },
};

/** A fixed scatter, so particles don't jump around between renders. */
const SCATTER = [0.1, 0.83, 0.37, 0.62, 0.95, 0.24, 0.5, 0.71, 0.05, 0.44, 0.88, 0.3, 0.67, 0.15, 0.56, 0.78];
const at = (i: number) => SCATTER[i % SCATTER.length] ?? 0.5;

type Vars = CSSProperties & Record<`--${string}`, string>;

/** A spray of a type's particles where a hit lands. `toward` is the direction the hit came from. */
export function TypeHit({ type, toward }: { type: CreatureType; toward: 1 | -1 }) {
  const m = MOTION[type];
  return (
    <div className={`type-fx type-hit fx-${type}`} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2 + at(i);
        // Gale blows away from the attacker; the rest burst all around.
        const dx = type === 'gale' ? toward * -(60 + at(i + 3) * m.spread[0]) : Math.cos(angle) * m.spread[0] * (0.6 + at(i + 1) * 0.6);
        const dy = Math.sin(angle) * m.spread[1] * (0.6 + at(i + 2) * 0.6) + m.lift;
        const style: Vars = {
          '--dx': `${dx.toFixed(0)}px`,
          '--dy': `${dy.toFixed(0)}px`,
          '--spin': `${(m.spin * (i % 2 ? 1 : -1)).toFixed(0)}deg`,
          '--size': `${18 + Math.round(at(i + 4) * 14)}px`,
          animationDuration: `${m.ms}ms`,
          animationDelay: `${Math.round(at(i + 5) * 90)}ms`,
        };
        return <img key={i} src={artUrl(`fxtype-${type}`)} alt="" className={m.arc ? 'fx-arc' : 'fx-fly'} style={style} />;
      })}
    </div>
  );
}

/** A Special fills the whole scene with its type: a wave, rising embers, a leaf storm, falling rocks, wind, snow or lightning. */
export function TypeSpecial({ type }: { type: CreatureType }) {
  return (
    <div className={`type-fx type-special fx-${type}`} aria-hidden="true">
      <div className="type-wash" />
      {Array.from({ length: 16 }, (_, i) => {
        const style: Vars = {
          '--x': `${(at(i) * 100).toFixed(0)}%`,
          '--y': `${(at(i + 7) * 100).toFixed(0)}%`,
          '--spin': `${type === 'leaf' || type === 'frost' || type === 'light' ? 360 : 90}deg`,
          '--size': `${22 + Math.round(at(i + 3) * 22)}px`,
          animationDelay: `${Math.round(at(i + 9) * 260)}ms`,
        };
        return <img key={i} src={artUrl(`fxtype-${type}`)} alt="" className="fx-storm" style={style} />;
      })}
    </div>
  );
}
