import type { Companion } from '../engine/game';
import { Sprite } from './art';
import { species } from './content';
import { Key } from './keys';

/** The creatures a child has befriended. Pass onPick to make them selectable. */
export function Stable({ companions, activeId, onPick }: { companions: readonly Companion[]; activeId: string; onPick?: (instanceId: string) => void }) {
  return (
    <ul className="stable">
      {companions.map((c, i) => {
        const s = species(c.speciesId);
        const body = (
          <>
            <Sprite id={s.artId} size={96} />
            <strong>{s.displayName}</strong>
            <span className="muted">Special: {s.special.name}</span>
            {c.bondXp > 0 && <span className="muted">Bond: {c.bondXp} XP</span>}
          </>
        );
        const active = c.instanceId === activeId;
        return (
          <li key={c.instanceId}>
            {onPick
              ? <button type="button" className="stable-card" aria-pressed={active} onClick={() => onPick(c.instanceId)}><Key k={i + 1} />{body}</button>
              : <div className={`stable-card${active ? ' active' : ''}`}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
