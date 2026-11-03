import { useEffect, useState } from 'react';
import type { Command, Companion } from '../engine/game';
import { STAGES } from '../engine/progression';
import { Fx, Sprite } from './art';
import { companionView } from './content';
import { Key, useKeys } from './keys';
import { playSound } from './sound';

/** Shown once per evolution, the next time the child is back at camp. */
export function Evolution({ companion, dispatch }: { companion: Companion; dispatch: (c: Command) => void }) {
  const view = companionView(companion);
  const previous = view.stage === 3 ? view.species.evolutions?.[0]?.artId : view.species.artId;
  const [done, setDone] = useState(false);
  useEffect(() => {
    playSound('evolve');
    // The old form glows white, then a flash, then the new form.
    const t = setTimeout(() => { setDone(true); playSound('levelup'); }, 2200);
    return () => clearTimeout(t);
  }, []);
  const stats = STAGES[view.stage];
  const finish = () => dispatch({ type: 'ackEvolution', instanceId: companion.instanceId });
  useKeys({ enter: finish });
  return (
    <section className="panel complete evolving">
      <h1>{done ? `It evolved into ${view.formName}!` : 'Something is happening...'}</h1>
      <div className={`celebrate evolve-stage${done ? ' evolve-done' : ''}`}>
        <div className="evolve-rays" aria-hidden="true" />
        {done && <div className="evolve-flash" aria-hidden="true" />}
        {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`rise rise-${i}`} />)}
        <Sprite id={done ? view.artId : (previous ?? view.artId)} size={192} className={done ? 'evolve-reveal' : 'evolve-glow'} shiny={view.shiny && done} />
      </div>
      {done && previous && <p className="evolve-pair"><Sprite id={previous} size={48} shiny={view.shiny} /> <span aria-hidden="true">→</span> <Sprite id={view.artId} size={64} shiny={view.shiny} /></p>}
      {done && <p className="learn">HP {stats.maxHp} · Attack {stats.attack}{view.stage === 3 ? ' · Starts every battle with 1 charge' : ' · Stronger Special'}</p>}
      <button type="button" className="primary" onClick={finish}>Continue <Key k="Enter" /></button>
    </section>
  );
}
