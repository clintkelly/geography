import { PACK } from '../content/pack';
import type { Command, SaveData } from '../engine/game';
import { isDue, isFamiliar } from '../engine/learning';
import { region } from './content';

const describe = (objectiveId: string) => PACK.questions.find((q) => q.objectiveId === objectiveId)?.prompt ?? objectiveId;

/** What the parent needs to see about one child. Never compares children. */
export function Parent({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const recent = save.attempts.filter((a) => a.context !== 'discovery' && !a.assisted).slice(-60);
  const right = recent.filter((a) => a.correct).length;
  const learning = Object.entries(save.learning);
  const now = Date.now();
  const missed = learning.filter(([, p]) => p.missed).map(([id]) => id).slice(0, 8);
  const due = learning.filter(([, p]) => !p.missed && isDue(p, now)).map(([id]) => id);
  const familiar = learning.filter(([, p]) => isFamiliar(p, 'scout')).length;
  const toggle = (regionId: string, on: boolean) => dispatch({
    type: 'updateSettings',
    patch: { disabledRegions: on ? save.settings.disabledRegions.filter((r) => r !== regionId) : [...save.settings.disabledRegions, regionId] },
  });
  const onlyOneLeft = PACK.regions.length - save.settings.disabledRegions.length <= 1;

  return (
    <section className="panel">
      <h2>Progress for {save.profile.displayName}</h2>
      <p>{recent.length > 0 ? <>Recent accuracy: <strong>{Math.round((right / recent.length) * 100)}%</strong> of the last {recent.length} unaided answers.</> : 'No answers yet.'}</p>
      <p>{save.completedExpeditions} expeditions · {save.companions.length} creatures · {save.stateCards.length} State Cards · {save.foundPlaces.length} places found · {familiar} topics familiar{save.expedition ? ' · a trip in progress' : ''}</p>
      <p className="muted">"Familiar" means three unaided right answers across at least two days. It's a game measure, not a test score.</p>
      {missed.length > 0 && <><h3>Recently missed</h3><ul>{missed.map((id) => <li key={id}>{describe(id)}</li>)}</ul></>}
      <p>{due.length} {due.length === 1 ? 'topic is' : 'topics are'} due for review.</p>
      <h3>Regions</h3>
      {PACK.regions.map((r) => {
        const on = !save.settings.disabledRegions.includes(r.id);
        return <label key={r.id} className="field"><input type="checkbox" checked={on} disabled={on && onlyOneLeft} onChange={(e) => toggle(r.id, e.target.checked)} /> {region(r.id).label}</label>;
      })}
      <h3>Start over</h3>
      <button type="button" onClick={() => { if (window.confirm(`Erase all of ${save.profile.displayName}'s progress? This can't be undone without a backup.`)) dispatch({ type: 'resetProfile' }); }}>Reset this profile</button>
    </section>
  );
}
