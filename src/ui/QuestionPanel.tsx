import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Question } from '../content/types';
import { ECONOMY } from '../engine/economy';
import { CardArt } from './art';
import { cardFor, mapFor } from './content';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { Dot, Marker, WorldMap, type Highlight } from './WorldMap';

interface Result {
  optionId: string;
  correct: boolean;
  cardId?: string;
}

interface Props {
  question: Question;
  regionId: string;
  result?: Result | undefined;
  onAnswer: (optionId: string) => void;
  onContinue: () => void;
  /** Extra lines under the feedback, such as what happened in the battle. */
  log?: ReactNode;
}

function CardAward({ placeId }: { placeId: string }) {
  const card = cardFor(placeId);
  return (
    <div className="card-award">
      <CardArt id={card.artId} width={192} />
      <div>
        <p className="card-new">New State Card!</p>
        <h3>{card.name}</h3>
        <p>{card.subtitle} · Capital: {card.capital}</p>
      </div>
    </div>
  );
}

export function QuestionPanel({ question: q, regionId, result, onAnswer, onContinue, log }: Props) {
  const map = mapFor(regionId);
  const accepted = q.options.find((o) => o.id === q.acceptedId)?.label;
  const clickable = q.inputType === 'map-click';

  const onFeatureClick = useMemo(() => (featureId: string) => {
    const hit = q.options.find((o) => o.featureId === featureId);
    if (hit && !result) onAnswer(hit.id);
  }, [q, result, onAnswer]);

  const highlights = useMemo(() => {
    const shown: Record<string, Highlight> = {};
    if (!clickable) return shown;
    for (const o of q.options) if (o.featureId) shown[o.featureId] = 'selectable';
    if (result) {
      const feature = (id: string) => q.options.find((o) => o.id === id)?.featureId ?? '';
      shown[feature(result.optionId)] = 'wrong';
      shown[feature(q.acceptedId)] = 'correct';
    }
    return shown;
  }, [q, result, clickable]);

  const keys: Record<string, () => void> = {};
  if (result) keys.enter = onContinue;
  else if (!clickable) q.options.forEach((o, i) => { keys[String(i + 1)] = () => onAnswer(o.id); });
  useKeys(keys);

  const cardId = result?.cardId;
  const announced = useRef(false);
  useEffect(() => {
    if (cardId && !announced.current) playSound('card');
    announced.current = !!cardId;
  }, [cardId]);

  return (
    <section className="panel question">
      {q.recallOf && <p className="recall-tag">Field Note check! A right answer earns {ECONOMY.recallBonus} bonus points.</p>}
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
              {...(result ? {} : { onClick: () => onAnswer(o.id) })}
            />
          ))}
        </WorldMap>
      )}
      {clickable && (
        <WorldMap key={q.id} map={map} label="Blank map. Click a place." highlights={highlights} onFeatureClick={onFeatureClick}>
          {(scale) => q.options.filter((o) => o.tiny).map((o) => (
            <Dot
              key={o.id}
              id={o.id}
              at={map.project(o.lonLat ?? [0, 0])}
              scale={scale}
              tone={result ? (o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'default') : 'default'}
              {...(result ? {} : { onClick: () => onAnswer(o.id) })}
            />
          ))}
        </WorldMap>
      )}
      {!clickable && (
        <div className="options">
          {q.options.map((o, i) => {
            const marker = q.inputType === 'map-marker';
            const state = !result ? '' : o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'dim';
            return (
              <button key={o.id} type="button" className={`option ${state}`} disabled={!!result} onClick={() => onAnswer(o.id)}>
                <Key k={i + 1} /><span className="option-label">{marker && !result ? `Marker ${i + 1}` : marker ? `${i + 1}: ${o.label}` : o.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div className={`feedback ${result.correct ? 'good' : 'notyet'}`} role="status">
          <p className="learn"><strong>{result.correct ? 'Correct!' : `Not yet. The answer is ${accepted}.`}</strong> {q.explanation}</p>
          {result.correct && q.fieldNote && <p className="field-note"><span>Field Note: remember this!</span>{q.fieldNote}<small>It may come back as a bonus question.</small></p>}
          {cardId && <CardAward placeId={cardId} />}
          {log && <p className="muted">{log}</p>}
          <button type="button" className="primary" autoFocus onClick={onContinue}>Continue <Key k="Enter" /></button>
        </div>
      )}
    </section>
  );
}
