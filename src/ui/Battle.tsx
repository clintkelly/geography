import { useEffect, useMemo, useRef, useState } from 'react';
import { canUse, enemyIntent, MAX_CHARGE, type CombatAction, type CombatState } from '../engine/combat';
import type { Battle as BattleState, Command, Expedition, SaveData } from '../engine/game';
import { Sprite } from './art';
import { mapFor, place, species } from './content';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { Marker, WorldMap, type Highlight } from './WorldMap';

function Hp({ label, hp, max }: { label: string; hp: number; max: number }) {
  return (
    <div className="hp" role="img" aria-label={`${label}: ${hp} of ${max} HP`}>
      <div className="hp-label"><span>{label}</span><span>{hp}/{max}</span></div>
      <div className="hp-track"><div className="hp-fill" style={{ width: `${(hp / max) * 100}%` }} /></div>
    </div>
  );
}

function specialText(c: CombatState): string {
  if (c.special === 'strong') return `${c.playerAttack + 2} damage`;
  if (c.special === 'heal') return '2 damage, heal 4';
  return '2 damage, block 4';
}

export function Battle({ e, battle, save, dispatch }: { e: Expedition; battle: BattleState; save: SaveData; dispatch: (c: Command) => void }) {
  const slot = e.slots[battle.slotIndex];
  const [fx, setFx] = useState(false);
  const turnKey = `${battle.combat.turn}-${battle.phase}`;
  const lastTurn = useRef(turnKey);

  useEffect(() => {
    if (lastTurn.current === turnKey) return;
    lastTurn.current = turnKey;
    if (battle.phase !== 'feedback') return;
    const { outcome } = battle.combat;
    playSound(outcome === 'victory' ? 'win' : outcome === 'retreat' ? 'retreat' : battle.result?.correct ? 'correct' : 'not-yet');
    setFx(true);
    const t = setTimeout(() => setFx(false), 300);
    return () => clearTimeout(t);
  }, [turnKey]); // eslint-disable-line

  const { combat, question: q, result } = battle;
  const choose = (action: CombatAction) => dispatch({ type: 'chooseAction', action });
  const answerWith = (optionId: string) => dispatch({ type: 'answer', optionId });
  const special = canUse(combat, 'special');

  const onFeatureClick = useMemo(() => (featureId: string) => {
    const hit = q.options.find((o) => o.featureId === featureId);
    if (hit && !result) answerWith(hit.id);
  }, [q, result]); // eslint-disable-line

  const clickHighlights = useMemo(() => {
    const map: Record<string, Highlight> = {};
    if (q.inputType !== 'map-click') return map;
    for (const o of q.options) if (o.featureId) map[o.featureId] = 'selectable';
    if (result) {
      const feature = (id: string) => q.options.find((o) => o.id === id)?.featureId ?? '';
      map[feature(result.optionId)] = 'wrong';
      map[feature(q.acceptedId)] = 'correct';
    }
    return map;
  }, [q, result]);

  // Bound per phase: answers exist only while a question is open, so a stale key can't reach the next one.
  const keys: Record<string, () => void> = {};
  if (battle.phase === 'choose') {
    Object.assign(keys, { a: () => choose('attack'), enter: () => choose('attack'), g: () => choose('guard') });
    if (special) keys.s = () => choose('special');
  }
  if (battle.phase === 'question' && q.inputType !== 'map-click') q.options.forEach((o, i) => { keys[String(i + 1)] = () => answerWith(o.id); });
  if (battle.phase === 'feedback') keys.enter = () => dispatch({ type: 'continue' });
  useKeys(keys);

  if (!slot) return null;

  const companion = species(save.companion.speciesId);
  const opponent = species(slot.opponentId);
  const backdrop = slot.kind === 'guardian' ? 'backdrop-mountain' : 'backdrop-coast';
  const map = mapFor(e.regionId);
  const accepted = q.options.find((o) => o.id === q.acceptedId)?.label;

  const events = result?.events;
  const log = events && [
    events.damageDealt > 0 && `${companion.displayName} dealt ${events.damageDealt} damage.`,
    events.healed > 0 && `${companion.displayName} healed ${events.healed}.`,
    events.blocked > 0 && `Blocked ${events.blocked} damage.`,
    events.damageTaken > 0 && `${opponent.displayName} dealt ${events.damageTaken} damage.`,
    combat.outcome === 'victory' && `${opponent.displayName} is impressed and steps aside!`,
    combat.outcome === 'retreat' && `${companion.displayName} retreats safely to the trail.`,
  ].filter(Boolean).join(' ');

  return (
    <div className="battle">
      <section className={`scene ${backdrop}`}>
        <div className="scene-hud">
          <div>
            <Hp label={companion.displayName} hp={combat.playerHp} max={combat.playerMaxHp} />
            <div className="charge" role="img" aria-label={`Charge: ${combat.charge} of ${MAX_CHARGE}`}>
              Charge {Array.from({ length: MAX_CHARGE }, (_, i) => <span key={i} className={i < combat.charge ? 'pip on' : 'pip'} />)}
            </div>
          </div>
          <div className="turn">Turn {combat.turn} of {combat.maxTurns}</div>
          <Hp label={opponent.displayName} hp={combat.opponentHp} max={combat.opponentMaxHp} />
        </div>
        <div className="scene-floor">
          <Sprite id={companion.artId} size={128} className={fx && (events?.damageTaken ?? 0) > 0 ? 'hit' : fx && result?.correct ? 'lunge-right' : ''} />
          {battle.phase !== 'feedback' && <div className="intent">Next attack: {enemyIntent(combat)} damage</div>}
          <Sprite id={opponent.artId} size={128} className={fx && result?.correct ? 'hit' : ''} />
        </div>
      </section>

      <section className="panel question">
        {battle.phase === 'choose' && (
          <div className="actions">
            <p className="muted">{place(slot.locationId).name} · Local questions and expedition review</p>
            <div className="action-row">
              <button type="button" className="primary big" onClick={() => choose('attack')}>Attack <Key k="A" /><small>{combat.playerAttack} damage, +1 charge</small></button>
              <button type="button" className="big" onClick={() => choose('guard')}>Guard <Key k="G" /><small>1 damage, block 3, +1 charge</small></button>
              <button type="button" className="big" disabled={!special} onClick={() => choose('special')}>{companion.special?.name ?? 'Special'} <Key k="S" /><small>{special ? specialText(combat) : 'Needs 2 charge'}</small></button>
            </div>
          </div>
        )}

        {battle.phase !== 'choose' && (
          <>
            <h2>{q.prompt}</h2>
            {q.inputType === 'map-marker' && (
              <WorldMap key={q.id} map={map} label="Map with four numbered markers" interactive={false}>
                {(scale) => q.options.map((o, i) => (
                  <Marker
                    key={o.id}
                    at={map.project(o.lonLat ?? [0, 0])}
                    scale={scale}
                    label={String(i + 1)}
                    tone={result ? (o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'default') : 'default'}
                    {...(result ? {} : { onClick: () => answerWith(o.id) })}
                  />
                ))}
              </WorldMap>
            )}
            {q.inputType === 'map-click' && (
              <WorldMap key={q.id} map={map} label="Blank map. Click a state." highlights={clickHighlights} onFeatureClick={onFeatureClick} />
            )}
            {q.inputType !== 'map-click' && (
              <div className="options">
                {q.options.map((o, i) => {
                  const marker = q.inputType === 'map-marker';
                  const state = !result ? '' : o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'dim';
                  return (
                    <button key={o.id} type="button" className={`option ${state}`} disabled={!!result} onClick={() => answerWith(o.id)}>
                      <Key k={i + 1} /><span className="option-label">{marker && !result ? `Marker ${i + 1}` : marker ? `${i + 1}: ${o.label}` : o.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {result && (
          <div className={`feedback ${result.correct ? 'good' : 'notyet'}`} role="status">
            <p><strong>{result.correct ? 'Correct!' : `Not yet. The answer is ${accepted}.`}</strong> {q.explanation}</p>
            <p className="muted">{log}</p>
            <button type="button" className="primary" autoFocus onClick={() => dispatch({ type: 'continue' })}>Continue <Key k="Enter" /></button>
          </div>
        )}
      </section>
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
