import { useEffect, useState } from 'react';
import { PACK } from '../content/pack';
import { Sprite } from './art';
import { region, species } from './content';
import { playCry, playSound } from './sound';
import { TypeBadges } from './TypeGuide';

const COLORS = ['#f05a5a', '#f0b030', '#50c060', '#40a0f0', '#a070f0', '#f070c0'];

/** Falling confetti over whatever it sits in. */
export function Confetti({ count = 36 }: { count?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 9) * 70}ms`,
            animationDuration: `${1400 + ((i * 53) % 900)}ms`,
            transform: `rotate(${(i * 47) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/** A count that ticks up to its number, for the "creatures found" moment. */
function TickUp({ to }: { to: number }) {
  const [n, setN] = useState(Math.max(0, to - 1));
  useEffect(() => {
    const t = setTimeout(() => setN(to), 900);
    return () => clearTimeout(t);
  }, [to]);
  return <strong className={n === to ? 'tick-done' : ''}>{n}</strong>;
}

/**
 * The first time a child gets a kind of creature: a big reveal with confetti, its types, its home,
 * its place in the collection, and its call.
 */
export function NewCreatureReveal({ speciesId, found, shiny }: { speciesId: string; found: number; shiny?: boolean }) {
  const s = species(speciesId);
  useEffect(() => {
    playSound('card');
    const a = setTimeout(() => playSound('levelup'), 350);
    const b = setTimeout(() => playCry(speciesId), 1000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [speciesId]);
  const home = s.homes.length > 5 ? 'all over the world' : s.homes[0] ? region(s.homes[0]).label : undefined;
  return (
    <div className={`new-creature${shiny ? ' new-creature-shiny' : ''}`}>
      <Confetti />
      <p className="new-creature-ribbon">✨ NEW CREATURE! ✨</p>
      <div className="new-creature-stage">
        <div className="new-creature-rays" aria-hidden="true" />
        <Sprite id={s.artId} size={176} className="new-creature-sprite" />
      </div>
      <h2 className="new-creature-name">{s.displayName}</h2>
      <div className="new-creature-meta">
        <TypeBadges species={s} />
        {home && <span className="muted">Lives in {home}{s.night ? ' (at night)' : ''}</span>}
      </div>
      <p className="new-creature-count">Creature <TickUp to={found} /> of {PACK.species.length} found!</p>
    </div>
  );
}
