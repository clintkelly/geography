import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { PathId } from '../content/types';
import type { Companion } from '../engine/game';
import { levelOf, PATH_ORDER, pathOf, STAGE_2_LEVEL } from '../engine/progression';
import { Sprite } from './art';
import { species } from './content';
import { Key } from './keys';
import { TypeBadge } from './TypeGuide';

/** What a child does to raise a creature on each path, in plain steps. */
const HOW: Record<PathId, { icon: string; steps: string[] }> = {
  scholar: {
    icon: '📚',
    steps: [
      'Have it be the one fighting: put it first on your team, or switch to it.',
      'Pick Math, Words or Science under "Ask about".',
      '+1 for every math, vocabulary or science question you get right in a battle.',
    ],
  },
  ranger: {
    icon: '🥋',
    steps: [
      'Take it on your team on a Ranger or Expert trail.',
      '+1 every time your team wins a battle there, even if another creature is fighting.',
      'Scout trails don\'t count.',
    ],
  },
  banner: {
    icon: '🚩',
    steps: [
      'Have it be the one fighting: put it first on your team, or switch to it.',
      'Pick Flags under "Ask about".',
      '+1 for every flag question you get right in a battle.',
    ],
  },
};

/** How to steer a Wild Paths creature: what each path becomes, how to earn its points, and who's ahead. */
export function PathGuide({ c, onClose }: { c: Companion; onClose: () => void }) {
  const s = species(c.speciesId);
  const close = useRef<HTMLButtonElement>(null);
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  if (!s.paths) return null;

  const level = levelOf(c.bondXp);
  const locked = !!c.path || level >= STAGE_2_LEVEL;
  const lead = pathOf(c);
  const points = (p: PathId) => c.raised?.[p] ?? 0;
  const best = Math.max(...PATH_ORDER.map(points));
  // Points needed to pass the leader. A tie goes to the path listed first.
  const toLead = (p: PathId) => {
    if (p === lead) return 0;
    const tieWins = PATH_ORDER.indexOf(p) < PATH_ORDER.indexOf(lead);
    return best - points(p) + (tieWins ? 0 : 1);
  };

  return createPortal(
    <div className="guide-backdrop" onClick={onClose}>
      <section className="guide-card path-guide" role="dialog" aria-modal="true" aria-labelledby="path-guide-title" onClick={(e) => e.stopPropagation()}>
        <p className="guide-eyebrow">Wild Paths</p>
        <h2 id="path-guide-title">How to raise {c.nickname || s.displayName}</h2>
        {locked
          ? <p>It already chose the <strong>{s.paths.find((p) => p.id === lead)!.evolutions[0].name}</strong> path. Its path is set for good now.</p>
          : <p>
              {s.displayName} can grow into <strong>three different creatures</strong>. At <strong>level {STAGE_2_LEVEL}</strong> (it's level {level} now)
              it evolves along the path with the <strong>most points</strong>, and gets that path's new type, look and Special move. After that, the path is set for good.
            </p>}
        <div className="path-cols">
          {s.paths.map((p) => {
            const mine = p.id === lead;
            const need = toLead(p.id);
            return (
              <div key={p.id} className={`path-col path-${p.id}${mine ? ' path-ahead' : ''}`}>
                <h3>{HOW[p.id].icon} {p.id === 'scholar' ? 'Scholar' : p.id === 'ranger' ? 'Ranger' : 'Banner'}</h3>
                <span className="path-forms">
                  <Sprite id={p.evolutions[0].artId} size={64} />
                  <Sprite id={p.evolutions[1].artId} size={64} />
                </span>
                <small>{p.evolutions[0].name} → {p.evolutions[1].name}</small>
                <TypeBadge type={p.type} />
                <small>Special: <strong>{p.special.name}</strong></small>
                <ol>{HOW[p.id].steps.map((t) => <li key={t}>{t}</li>)}</ol>
                <strong className="path-score">{points(p.id)} points</strong>
                {!locked && (mine
                  ? <span className="path-status">⭐ In the lead!</span>
                  : <span className="path-status">{need} more to take the lead</span>)}
              </div>
            );
          })}
        </div>
        {!locked && <p className="muted">Tip: want a certain path? Keep it on that kind of trail until level {STAGE_2_LEVEL}. Questions answered while befriending and questions on the map don't count.</p>}
        <button ref={close} type="button" className="primary" onClick={onClose}>Got it <Key k="Enter" /></button>
      </section>
    </div>,
    document.body,
  );
}
