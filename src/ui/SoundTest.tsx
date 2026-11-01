import { playSound, SOUND_IDS } from './sound';

/** Development page at ?sounds for approving effects by ear. */
export function SoundTest() {
  return (
    <main className="screen"><section className="panel">
      <h1>Sound check</h1>
      <div className="row">{SOUND_IDS.map((id) => <button key={id} type="button" onClick={() => playSound(id, true)}>{id}</button>)}</div>
    </section></main>
  );
}
