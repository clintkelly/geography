import type { Command, Companion } from '../engine/game';
import { levelOf, levelProgress, MAX_LEVEL } from '../engine/progression';
import { Sprite } from './art';
import { companionView } from './content';
import { Key } from './keys';

/** The creatures a child has befriended. Pass onPick to choose one, or dispatch to allow nicknames. */
export function Stable({ companions, activeId, teamIds, onPick, dispatch }: {
  companions: readonly Companion[];
  activeId: string;
  /** Everyone chosen for the trip, when choosing a team. */
  teamIds?: readonly string[];
  onPick?: (instanceId: string) => void;
  dispatch?: (c: Command) => void;
}) {
  return (
    <ul className="stable">
      {companions.map((c, i) => {
        const v = companionView(c);
        const level = levelOf(c.bondXp);
        const body = (
          <>
            <Sprite id={v.artId} size={96} className="idle-sprite" />
            <strong>{v.name}</strong>
            {c.nickname && <span className="muted">{v.formName}</span>}
            <span className="muted">Level {level} · Special: {v.species.special.name}</span>
            <span className="xp-track" role="img" aria-label={level >= MAX_LEVEL ? 'Maximum level' : `${Math.round(levelProgress(c.bondXp) * 100)} percent to the next level`}><span className="xp-fill" style={{ width: `${levelProgress(c.bondXp) * 100}%` }} /></span>
          </>
        );
        const active = teamIds ? teamIds.includes(c.instanceId) : c.instanceId === activeId;
        return (
          <li key={c.instanceId}>
            {onPick
              ? <button type="button" className="stable-card" aria-pressed={active} onClick={() => onPick(c.instanceId)}><Key k={i + 1} />{body}</button>
              : (
                <div className={`stable-card${active ? ' active' : ''}`}>
                  {body}
                  {dispatch && <input aria-label={`Nickname for ${v.formName}`} placeholder="Add a nickname" maxLength={20} value={c.nickname ?? ''} onChange={(e) => dispatch({ type: 'renameCompanion', instanceId: c.instanceId, nickname: e.target.value })} />}
                </div>
              )}
          </li>
        );
      })}
    </ul>
  );
}
