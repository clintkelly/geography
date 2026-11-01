import { useEffect, useState } from 'react';
import { enemyIntent } from '../engine/combat';
import type { Battle as BattleState, Command, Expedition, SaveData } from '../engine/game';
import { Sprite } from './art';
import { place, species } from './content';
import { Key, useKeys } from './keys';
import { Marker, WorldMap } from './WorldMap';

function Hp({ label, hp, max }: { label: string; hp: number; max: number }) {
  return (
    <div className="hp" role="img" aria-label={`${label}: ${hp} of ${max} HP`}>
      <div className="hp-label"><span>{label}</span><span>{hp}/{max}</span></div>
      <div className="hp-track"><div className="hp-fill" style={{ width: `${(hp / max) * 100}%` }} /></div>
    </div>
  );
}

export function Battle({ e, battle, save, dispatch }: { e: Expedition; battle: BattleState; save: SaveData; dispatch: (c: Command) => void }) {
  const slot = e.slots[battle.slotIndex];
  const [fx, setFx] = useState(false);
  const turnKey = `${battle.combat.turn}-${battle.phase}`;
  const attack = () => dispatch({ type: 'chooseAction', action: 'attack' });
  // Bound per phase: answers exist only while a question is open, so a stale key can't reach the next one.
  const keys: Record<string, () => void> = {};
  if (battle.phase === 'choose') Object.assign(keys, { a: attack, enter: attack });
  if (battle.phase === 'question') battle.question.options.forEach((o, i) => { keys[String(i + 1)] = () => dispatch({ type: 'answer', optionId: o.id }); });
  if (battle.phase === 'feedback') keys.enter = () => dispatch({ type: 'continue' });
  useKeys(keys);
  useEffect(() => {
    if (battle.phase !== 'feedback') return;
    setFx(true);
    const t = setTimeout(() => setFx(false), 300);
    return () => clearTimeout(t);
  }, [turnKey]); // eslint-disable-line
  if (!slot) return null;

  const companion = species(save.companion.speciesId);
  const opponent = species(slot.opponentId);
  const { combat, question: q, result } = battle;
  const backdrop = slot.kind === 'guardian' ? 'backdrop-mountain' : 'backdrop-coast';

  return (
    <div className="battle">
      <section className={`scene ${backdrop}`}>
        <div className="scene-hud">
          <Hp label={companion.displayName} hp={combat.playerHp} max={combat.playerMaxHp} />
          <div className="turn">Turn {combat.turn} of {combat.maxTurns}</div>
          <Hp label={opponent.displayName} hp={combat.opponentHp} max={combat.opponentMaxHp} />
        </div>
        <div className="scene-floor">
          <Sprite id={companion.artId} size={128} className={fx && (result?.events.damageTaken ?? 0) > 0 ? 'hit' : fx && result?.correct ? 'lunge-right' : ''} />
          {battle.phase !== 'feedback' && <div className="intent">Next attack: {enemyIntent(combat)} damage</div>}
          <Sprite id={opponent.artId} size={128} className={fx && result?.correct ? 'hit' : ''} />
        </div>
      </section>

      <section className="panel question">
        {battle.phase === 'choose' && (
          <div className="actions">
            <p className="muted">{place(slot.locationId).name} · Local questions and expedition review</p>
            <button type="button" className="primary big" onClick={attack}>Attack <Key k="A" /></button>
          </div>
        )}

        {battle.phase !== 'choose' && (
          <>
            <h2>{q.prompt}</h2>
            {q.inputType === 'map-marker' && (
              <WorldMap
                key={q.id}
                label="Map with four numbered markers"
                interactive={false}
              >
                {(scale) => q.options.map((o, i) => (
                  <Marker
                    key={o.id}
                    lonLat={o.lonLat ?? [0, 0]}
                    scale={scale}
                    label={String(i + 1)}
                    tone={result ? (o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'default') : 'default'}
                    {...(result ? {} : { onClick: () => dispatch({ type: 'answer', optionId: o.id }) })}
                  />
                ))}
              </WorldMap>
            )}
            <div className="options">
              {q.options.map((o, i) => {
                const marker = q.inputType === 'map-marker';
                const state = !result ? '' : o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'dim';
                return (
                  <button key={o.id} type="button" className={`option ${state}`} disabled={!!result} onClick={() => dispatch({ type: 'answer', optionId: o.id })}>
                    <Key k={i + 1} /><span className="option-label">{marker && !result ? `Marker ${i + 1}` : marker ? `${i + 1}: ${o.label}` : o.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {result && (
          <div className={`feedback ${result.correct ? 'good' : 'notyet'}`} role="status">
            <p><strong>{result.correct ? 'Correct!' : 'Not yet.'}</strong> {q.explanation}</p>
            <p className="muted">
              {result.events.damageDealt > 0 ? `${companion.displayName} dealt ${result.events.damageDealt} damage. ` : ''}
              {result.events.damageTaken > 0 ? `${opponent.displayName} dealt ${result.events.damageTaken} damage.` : ''}
              {combat.outcome === 'victory' ? ` ${opponent.displayName} is impressed and steps aside!` : ''}
              {combat.outcome === 'retreat' ? ` ${companion.displayName} retreats safely to the trail.` : ''}
            </p>
            <button type="button" className="primary" autoFocus onClick={() => dispatch({ type: 'continue' })}>Continue <Key k="Enter" /></button>
          </div>
        )}
      </section>
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
