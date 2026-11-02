import type { CreatureType } from '../content/types';
import { beats, losesTo, STRONG_BONUS, TYPE_INFO, TYPE_LOOP } from '../engine/types';
import { artUrl } from './art';

export const flagUrl = (code: string) => `${import.meta.env.BASE_URL}flags/${code}.svg`;

export function TypeBadge({ type, plain }: { type: CreatureType; plain?: boolean }) {
  return <span className={`type-badge type-${type}${plain ? ' plain' : ''}`}><img src={artUrl(`type-${type}`)} alt="" width={16} height={16} />{TYPE_INFO[type].name}</span>;
}

/** The two things a child needs to know about one type. */
export function TypeLine({ type }: { type: CreatureType }) {
  return <span className="type-line"><TypeBadge type={type} /> <small>Strong against {TYPE_INFO[beats(type)].name}, weak against {TYPE_INFO[losesTo(type)].name}</small></span>;
}

/** The full explanation, available wherever types matter. */
export function TypeGuide({ open }: { open?: boolean }) {
  return (
    <details className="type-guide" open={open}>
      <summary>How types work</summary>
      <p>Every creature has a type. Each type is strong against one other type and weak against another, in a big circle.</p>
      <ul>
        {TYPE_LOOP.map((t) => (
          <li key={t}><TypeBadge type={t} /> beats <TypeBadge type={beats(t)} /> <small>{TYPE_INFO[t].why}</small></li>
        ))}
      </ul>
      <p><strong>Strong matchup:</strong> your Attack and strong Specials do {STRONG_BONUS} more damage.</p>
      <p><strong>Weak matchup:</strong> they do {STRONG_BONUS} less, but never below 1. A creature traveling alone has no weak matchups.</p>
      <p><strong>Tip:</strong> bring different types on your team. If you're stuck in a weak matchup, press W to switch. A right answer still matters most!</p>
    </details>
  );
}
