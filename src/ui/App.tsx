import { useMemo, useState } from 'react';
import { MasteryTest } from './MasteryTest';
import { isExpeditionComplete } from '../engine/game';
import { indexedDbStore } from '../persistence/store';
import { speciesOf, stageOf } from '../engine/progression';
import { PACK } from '../content/pack';
import { Battle } from './Battle';
import { Camp } from './Camp';
import { Discovery } from './Discovery';
import { Evolution } from './Evolution';
import { trackFor, useMusic } from './music';
import { ProfileSelect } from './ProfileSelect';
import { Event } from './Event';
import { Prep } from './Prep';
import { ExpeditionComplete, Route } from './Route';
import { Settings } from './Settings';
import { Sprite } from './art';
import { configureSound } from './sound';
import { SoundTest } from './SoundTest';
import { useGame } from './useGame';

export function App() {
  const store = useMemo(() => indexedDbStore(), []);
  const game = useGame(store);
  const { save, household, dispatch, saveFailed, loadError, setActiveProfile, restore } = game;
  const [settingsOpen, setSettingsOpen] = useState(false);
  useMusic(trackFor(save), save?.settings.musicVolume ?? 0, save?.settings.muted ?? true);

  if (new URLSearchParams(location.search).has('sounds')) return <SoundTest />;

  if (loadError) {
    return <main className="screen"><section className="panel"><h1>This save can't be opened</h1><p>{loadError}</p><p>Your saved progress has not been changed.</p></section></main>;
  }
  if (!household) return <main className="screen" aria-busy="true" />;

  const e = save?.expedition;
  const evolving = save?.companions.find((c) => stageOf(c.bondXp, speciesOf(PACK, c.speciesId)) > (c.stageSeen ?? 1));
  let body;
  if (!save) body = <ProfileSelect household={household} onPick={setActiveProfile} />;
  else if (settingsOpen) body = <Settings save={save} household={household} store={store} dispatch={dispatch} restore={(h) => { setSettingsOpen(false); restore(h); }} onClose={() => setSettingsOpen(false)} />;
  else if (save.masteryTest) body = <MasteryTest test={save.masteryTest} dispatch={dispatch} />;
  else if (!e && evolving) body = <Evolution key={evolving.instanceId} companion={evolving} dispatch={dispatch} />;
  else if (!e) body = <Camp save={save} dispatch={dispatch} onSwitch={() => setActiveProfile(null)} onSettings={() => setSettingsOpen(true)} />;
  else if (!e.prepared) body = <Prep e={e} save={save} dispatch={dispatch} />;
  else if (e.event) body = <Event key={e.event.id} e={e} event={e.event} owned={save.companions.map((c) => c.speciesId)} dispatch={dispatch} />;
  else if (e.discovery === 'searching') body = <Discovery key={e.id} e={e} owned={save.companions.map((c) => c.speciesId)} dispatch={dispatch} />;
  else if (e.battle) body = <Battle key={e.battle.id} e={e} battle={e.battle} save={save} dispatch={dispatch} />;
  else if (isExpeditionComplete(e)) body = <ExpeditionComplete e={e} dispatch={dispatch} />;
  else body = <Route key={e.id} e={e} save={save} dispatch={dispatch} />;

  if (save) configureSound(save.settings);
  // Each new kind of screen gets a quick wipe. Turns within a battle don't.
  const screenKey = !save ? 'profiles' : settingsOpen ? 'settings' : save.masteryTest ? `mastery-${save.masteryTest.outcome ?? 'test'}` : !e ? 'camp' : e.battle ? e.battle.id : e.event ? e.event.id : `${e.discovery}-${e.slots.filter((s) => s.status === 'won').length}`;

  return (
    <div className="app">
      {saveFailed && <div className="save-error" role="alert">Your progress couldn't be saved. Check that this browser allows site storage before you keep playing.</div>}
      <header className="topbar">
        <strong>Atlaswild</strong>
        {save && (
          <span className="who">
            <Sprite id={save.profile.avatarId} size={28} />
            {save.profile.displayName} · {save.completedExpeditions} {save.completedExpeditions === 1 ? 'expedition' : 'expeditions'} completed
            <button type="button" className="topbar-button" onClick={() => { setSettingsOpen(false); setActiveProfile(null); }}>Switch</button>
          </span>
        )}
      </header>
      <div key={screenKey} className="wipe" aria-hidden="true" />
      <main className="screen">{body}</main>
    </div>
  );
}
