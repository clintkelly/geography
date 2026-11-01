import type { Household } from '../persistence/store';
import { Sprite } from './art';
import { Key, useKeys } from './keys';

export function ProfileSelect({ household, onPick }: { household: Household; onPick: (id: string) => void }) {
  const saves = household.meta.profileIds.map((id) => household.profiles[id]).filter((s) => !!s);
  useKeys(Object.fromEntries(saves.map((s, i) => [String(i + 1), () => onPick(s.profile.id)])));

  return (
    <div className="stack">
      <h1>Who's exploring?</h1>
      <div className="profiles">
        {saves.map((s, i) => (
          <button key={s.profile.id} type="button" className="profile-card" onClick={() => onPick(s.profile.id)}>
            <Sprite id={s.profile.avatarId} size={128} />
            <strong>{s.profile.displayName}</strong>
            <span className="muted">{s.completedExpeditions} expeditions · {s.souvenirIds.length} souvenirs{s.expedition ? ' · trip in progress' : ''}</span>
            <Key k={i + 1} />
          </button>
        ))}
      </div>
    </div>
  );
}
