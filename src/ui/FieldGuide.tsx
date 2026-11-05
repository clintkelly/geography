import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { guideFor, KIND_LABEL, type GuideKind } from '../content/guide';
import { Sprite } from './art';
import { region, species } from './content';
import { Key } from './keys';

/** A small tag for what a creature is based on: a real animal, a prehistoric one, a legend or history. */
export function KindTag({ speciesId }: { speciesId: string }) {
  const g = guideFor(speciesId);
  if (!g) return null;
  const k = KIND_LABEL[g.kind];
  return <span className={`kind-tag kind-${g.kind}`} title={k.name}><span aria-hidden="true">{k.icon}</span> {k.name}</span>;
}

/** The Field Guide card: the real animal or legend behind a creature. Enter or Escape closes it. */
export function GuideCard({ speciesId, artId, onClose, first }: { speciesId: string; artId?: string; onClose: () => void; first?: boolean }) {
  const s = species(speciesId);
  const g = guideFor(speciesId);
  const close = useRef<HTMLButtonElement>(null);
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    close.current?.focus();
    // Captured first, so the battle's own keys don't fire while the card is open.
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

  if (!g) return null;
  const k = KIND_LABEL[g.kind];
  const homes = s.homes.map((h) => region(h).label);
  const rows: [string, string | null][] = [
    ['When', g.when],
    [g.kind === 'myth' ? 'Story from' : 'Where', g.where],
    ['Size', g.size],
  ];
  // Drawn on the page itself, so the battle scene's layers can't sit on top of it.
  return createPortal(
    <div className="guide-backdrop" onClick={onClose}>
      <section className={`guide-card kind-${g.kind}`} role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(e) => e.stopPropagation()}>
        <p className="guide-eyebrow">{first ? 'New creature! ' : ''}Field Guide</p>
        <div className="guide-head">
          <Sprite id={artId ?? s.artId} size={96} />
          <div>
            <h2 id="guide-title">{s.displayName}</h2>
            <span className={`kind-tag kind-${g.kind}`}><span aria-hidden="true">{k.icon}</span> {k.name}</span>
            <p className="guide-based">Based on: <strong>{g.basedOn}</strong>{g.scientific && <> <em>({g.scientific})</em></>}</p>
          </div>
        </div>
        <dl className="guide-rows">
          {rows.filter((r): r is [string, string] => !!r[1]).map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}
          {homes.length > 0 && <div><dt>In the game</dt><dd>{homes.join(', ')}</dd></div>}
        </dl>
        {g.story && <p className="guide-story">{g.story}</p>}
        <ul className="guide-facts">
          <li>{s.flavor}</li>
          {g.facts.map((f) => <li key={f.text}>{f.text} <a href={f.source} target="_blank" rel="noreferrer" className="guide-source">source</a></li>)}
        </ul>
        <button ref={close} type="button" className="primary" onClick={onClose}>{first ? 'Let\'s go!' : 'Close'} <Key k="Enter" /></button>
      </section>
    </div>,
    document.body,
  );
}

export const kindOf = (speciesId: string): GuideKind | undefined => guideFor(speciesId)?.kind;
