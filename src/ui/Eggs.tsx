import { useEffect, useState } from 'react';
import { PACK } from '../content/pack';
import { EGG_METER, EGG_NEED, EGG_POINTS, eggName, eggPool, eggReady, MAX_EGGS, RARE_EVERY, studyRank, type EggKind } from '../engine/eggs';
import type { Command, SaveData } from '../engine/game';
import { artUrl, Fx, Sprite } from './art';
import { companionView, species } from './content';
import { Key, useKeys } from './keys';
import { shinyName } from './shiny';
import { playCry, playSound } from './sound';

const HOW: Record<EggKind, string> = {
  math: 'Answer math questions to warm it',
  words: 'Answer vocabulary questions to warm it',
  rare: 'Answer math or vocabulary questions to warm it',
};

/** The egg nest at camp: how warm each egg is, and a Hatch button when one is ready. */
export function EggNest({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const eggs = save.eggs ?? [];
  const known = new Set([...save.companions, ...(save.wild ?? [])].map((c) => c.speciesId));
  const kinds = ['math', 'words'] as const;
  return (
    <section className="panel egg-nest">
      <h2>Egg Nest: {eggs.length} of {MAX_EGGS}</h2>
      <div className="egg-how">
        <h3>🥚 How to get an egg</h3>
        <p>Get <strong>{EGG_METER} math answers right</strong> for a Math Egg, or <strong>{EGG_METER} vocabulary answers right</strong> for a Word Egg. It's laid right away, even in the middle of a trail. Every {RARE_EVERY === 4 ? 'fourth' : `${RARE_EVERY}th`} egg is a <strong>Rare Egg</strong>!</p>
        <EggMeters save={save} />
        <p className="muted">Pick <strong>Math</strong> or <strong>Words</strong> under "Ask about" to get these questions. Finishing a Math or Words trail lays a bonus egg, and the Gearworks and Echo Lodges do too.</p>
        {eggs.length >= MAX_EGGS && <p className="nest-full">Your nest is full! Hatch an egg to make room for the next one.</p>}
      </div>
      {eggs.length > 0 && <p className="muted"><strong>To hatch an egg</strong>, keep answering math or vocabulary questions. Harder questions warm it faster: Scout +{EGG_POINTS.scout}, Ranger +{EGG_POINTS.ranger}, Expert +{EGG_POINTS.expert}.</p>}
      <ul className="eggs">
        {eggs.map((egg) => {
          const ready = eggReady(egg);
          const warmth = egg.progress / EGG_NEED[egg.kind];
          return (
            <li key={egg.id} className={`egg-slot${ready ? ' egg-ready' : ''}`}>
              <img src={artUrl(`egg-${egg.kind}`)} alt="" width={72} height={72} className={`sprite egg-wobble${warmth >= 0.75 ? ' egg-hot' : warmth >= 0.4 ? ' egg-warm' : ''}`} />
              <strong>{eggName[egg.kind]}</strong>
              {ready
                ? <button type="button" className="primary" onClick={() => dispatch({ type: 'hatchEgg', eggId: egg.id })}>Hatch it!</button>
                : <>
                    <span className="xp-track" role="img" aria-label={`${egg.progress} of ${EGG_NEED[egg.kind]}`}><span className="xp-fill egg-fill" style={{ width: `${warmth * 100}%` }} /></span>
                    <small>{egg.progress} / {EGG_NEED[egg.kind]} · {HOW[egg.kind]}</small>
                  </>}
            </li>
          );
        })}
      </ul>
      <div className="egg-pools">
        {kinds.map((k) => {
          const pool = eggPool(PACK, k);
          const met = pool.filter((id) => known.has(id)).length;
          return (
            <div key={k} className="egg-pool">
              <span><strong>{eggName[k]}s</strong> hatch {pool.length} creatures you can't find anywhere else ({met} found):</span>
              <span className="egg-pool-row">{pool.map((id) => <Sprite key={id} id={species(id).artId} size={36} className={known.has(id) ? '' : 'silhouette'} />)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** How close the next Math and Word Eggs are. */
export function EggMeters({ save, compact }: { save: SaveData; compact?: boolean }) {
  const m = save.eggMeter ?? { math: 0, words: 0, laid: 0 };
  const rareNext = (m.laid + 1) % RARE_EVERY === 0;
  return (
    <div className={`egg-meters${compact ? ' compact' : ''}`}>
      {(['math', 'words'] as const).map((k) => (
        <div key={k} className="egg-meter">
          <img src={artUrl(rareNext ? 'egg-rare' : `egg-${k}`)} alt="" width={compact ? 24 : 32} height={compact ? 24 : 32} className="sprite" />
          <span className="xp-track" role="img" aria-label={`${eggName[k]} meter: ${m[k]} of ${EGG_METER} right answers`}><span className="xp-fill egg-fill" style={{ width: `${(m[k] / EGG_METER) * 100}%` }} /></span>
          <small>{k === 'math' ? 'Math' : 'Words'}: {m[k]} / {EGG_METER} right{rareNext ? ' · next egg is Rare!' : ''}</small>
        </div>
      ))}
    </div>
  );
}

/** The big moment: the egg shakes, cracks, and the new friend pops out. */
export function HatchReveal({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const h = save.hatched;
  const c = save.companions.find((o) => o.instanceId === h?.instanceId);
  const [open, setOpen] = useState(false);
  const done = () => dispatch({ type: 'dismissHatch' });
  useKeys(open ? { enter: done, escape: done } : {});
  useEffect(() => {
    playSound('egg');
    const a = setTimeout(() => playSound('egg'), 600);
    const b = setTimeout(() => { setOpen(true); playSound('hatch'); if (c) setTimeout(() => playCry(c.speciesId), 800); }, 1400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  useEffect(() => {
    if (open && c?.shiny) {
      const t = setTimeout(() => playSound('levelup'), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]); // eslint-disable-line
  if (!h || !c) return null;
  const v = companionView(c);
  return (
    <section className="panel complete hatch-reveal" role="dialog" aria-label="An egg is hatching">
      <h1>{open ? (v.shiny ? '✦ A SHINY hatched! ✦' : 'It hatched!') : 'Something is happening...'}</h1>
      <div className="celebrate">
        {open && [0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id={v.shiny ? 'spark' : 'heart'} className={`rise rise-${i}`} />)}
        {open
          ? <Sprite id={v.artId} size={192} shiny={v.shiny} className="evolve-reveal" />
          : <img src={artUrl(`egg-${h.kind}`)} alt="" width={160} height={160} className="sprite egg-shake" />}
      </div>
      {open && (
        <>
          <p className="learn"><strong>{v.species.displayName}</strong> joined your stable!{v.shiny ? ` It's ${shinyName(v.shiny)}!` : ''}</p>
          <p className="muted">{v.species.flavor}</p>
          <button type="button" className="primary" onClick={done}>Welcome it home <Key k="Enter" /></button>
        </>
      )}
    </section>
  );
}

/** Math and Words ranks, earned by right answers. */
export function StudyRanks({ save }: { save: SaveData }) {
  const points = save.studyPoints ?? { math: 0, words: 0 };
  return (
    <div className="study-ranks">
      {(['math', 'words'] as const).map((k) => {
        const r = studyRank(points[k]);
        return (
          <span key={k} className={`rank-chip rank-${r.name.toLowerCase()}`} title={r.next ? `${r.next.left} more points to ${r.next.name}` : 'The highest rank!'}>
            {k === 'math' ? '🧮 Math' : '📚 Words'} {r.name}
            {r.next && <small>{r.next.left} to {r.next.name}</small>}
          </span>
        );
      })}
    </div>
  );
}
