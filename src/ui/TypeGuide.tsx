import type { CreatureType } from '../content/types';
import { beatsAll, losesToAll, STRONG_BONUS, TYPE_INFO, TYPE_LOOP, TYPE_TRIANGLE, typesOf, why } from '../engine/types';
import { artUrl } from './art';

export const flagUrl = (code: string) => `${import.meta.env.BASE_URL}flags/${code}.svg`;

export function TypeBadge({ type, plain }: { type: CreatureType; plain?: boolean }) {
  return <span className={`type-badge type-${type}${plain ? ' plain' : ''}`}><img src={artUrl(`type-${type}`)} alt="" width={16} height={16} />{TYPE_INFO[type].name}</span>;
}

/** One badge per type, so a dual-type creature shows both. */
export function TypeBadges({ species }: { species: { type: CreatureType; secondType?: CreatureType } }) {
  return <>{typesOf(species).map((t) => <TypeBadge key={t} type={t} />)}</>;
}

/** The two things a child needs to know about a creature's types. */
export function TypeLine({ species }: { species: { type: CreatureType; secondType?: CreatureType } }) {
  const types = typesOf(species);
  const list = (f: (t: CreatureType) => CreatureType[]) => [...new Set(types.flatMap((t) => f(t).map((x) => TYPE_INFO[x].name)))].join(' and ');
  return <span className="type-line"><TypeBadges species={species} /> <small>Strong against {list(beatsAll)}, weak against {list(losesToAll)}{types.length > 1 ? '. Two types: it attacks with whichever works best' : ''}</small></span>;
}

/** The full explanation, available wherever types matter. */
export function TypeGuide({ open }: { open?: boolean }) {
  return (
    <details className="type-guide" open={open}>
      <summary>How types work</summary>
      <p>Every creature has a type. Seven types make a big circle: each is strong against the next one and weak against the one before.</p>
      <ul>
        {TYPE_LOOP.map((t, i) => {
          const next = TYPE_LOOP[(i + 1) % TYPE_LOOP.length] as CreatureType;
          return <li key={t}><TypeBadge type={t} /> beats <TypeBadge type={next} /> <small>{why(t, next)}</small></li>;
        })}
      </ul>
      <p>Light and Spirit make a little triangle with Stone, so Stone is in both.</p>
      <ul>
        {TYPE_TRIANGLE.map((t, i) => {
          const next = TYPE_TRIANGLE[(i + 1) % TYPE_TRIANGLE.length] as CreatureType;
          return <li key={t}><TypeBadge type={t} /> beats <TypeBadge type={next} /> <small>{why(t, next)}</small></li>;
        })}
      </ul>
      <p><strong>Strong matchup:</strong> your Attack and strong Specials do {STRONG_BONUS} more damage.</p>
      <p><strong>Weak matchup:</strong> they do {STRONG_BONUS} less, but never below 1. A creature traveling alone has no weak matchups.</p>
      <p><strong>Two types:</strong> some creatures have two types. They attack with whichever type works best. When you hit one, both of its types count: strong against one and weak against the other cancel out.</p>
      <p><strong>Tip:</strong> bring different types on your team. If you're stuck in a weak matchup, press W to switch. A right answer still matters most!</p>
    </details>
  );
}
