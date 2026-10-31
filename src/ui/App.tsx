import { useMemo } from 'react';
import { isExpeditionComplete } from '../engine/game';
import { indexedDbStore } from '../persistence/store';
import { Battle } from './Battle';
import { Camp } from './Camp';
import { Discovery } from './Discovery';
import { ExpeditionComplete, Route } from './Route';
import { useGame } from './useGame';

export function App() {
  const store = useMemo(() => indexedDbStore(), []);
  const { save, dispatch, saveFailed, loadError } = useGame(store);

  if (loadError) {
    return <main className="screen"><section className="panel"><h1>This save can't be opened</h1><p>{loadError}</p><p>Your saved progress has not been changed.</p></section></main>;
  }
  if (!save) return <main className="screen" aria-busy="true" />;

  const e = save.expedition;
  let body;
  if (!e) body = <Camp save={save} dispatch={dispatch} />;
  else if (e.discovery === 'searching') body = <Discovery key={e.id} e={e} dispatch={dispatch} />;
  else if (e.battle) body = <Battle key={e.battle.id} e={e} battle={e.battle} save={save} dispatch={dispatch} />;
  else if (isExpeditionComplete(e)) body = <ExpeditionComplete e={e} dispatch={dispatch} />;
  else body = <Route key={e.id} e={e} dispatch={dispatch} />;

  return (
    <div className="app">
      {saveFailed && <div className="save-error" role="alert">Your progress couldn't be saved. Check that this browser allows site storage before you keep playing.</div>}
      <header className="topbar">
        <strong>Atlaswild</strong>
        <span>{save.profile.displayName} · {save.completedExpeditions} {save.completedExpeditions === 1 ? 'expedition' : 'expeditions'} completed</span>
      </header>
      <main className="screen">{body}</main>
    </div>
  );
}
