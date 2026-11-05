import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Question } from '../content/types';
import { ECONOMY } from '../engine/economy';
import { CardArt } from './art';
import { cardFor, mapFor, place } from './content';
import { Key, useKeys } from './keys';
import { PlaceFlash } from './PlaceFlash';
import { flagUrl } from './TypeGuide';
import { useMapCursor } from './mapCursor';
import { playSound } from './sound';
import { Dot, Marker, WorldMap, type Highlight } from './WorldMap';

interface Result {
  optionId: string;
  correct: boolean;
  cardId?: string;
  cardUp?: { placeId: string; level: string };
}

interface Props {
  question: Question;
  regionId: string;
  result?: Result | undefined;
  onAnswer: (optionId: string) => void;
  onContinue: () => void;
  /** Extra lines under the feedback, such as what happened in the battle. */
  log?: ReactNode;
  /** Keeps Continue locked while a win plays out. */
  hold?: boolean;
  /** A label above the question. */
  tag?: string;
  /** The chosen move, with a way to pick another before answering. */
  move?: { name: string; onChange: () => void } | undefined;
}

const MINUS = '\u2212';

/**
 * Typing an answer: a number pad for math, so fractions like 3/8, mixed numbers like 1 1/2 and
 * negatives are easy on a touch screen, and a text box for spelling a word.
 */
function TypedAnswer({ question: q, onAnswer }: { question: Question; onAnswer: (text: string) => void }) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, [q.id]);
  const words = q.typed?.kind === 'word';
  const submit = () => { if (text.trim()) onAnswer(text.trim().replaceAll(MINUS, '-')); };
  const press = (key: string) => {
    setText((t) => (key === 'back' ? t.slice(0, -1) : `${t}${key}`).slice(0, 24));
    input.current?.focus({ preventScroll: true });
  };
  const pad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', MINUS, '0', '/'];
  return (
    <form className={`typed-answer${words ? ' typed-word' : ''}`} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input
        ref={input}
        aria-label={words ? 'Type the word' : 'Type your answer'}
        value={text}
        onChange={(e) => setText(words ? e.target.value.slice(0, 24) : e.target.value.replace(/[^0-9/\s\u2212-]/g, '').replace(/-/g, MINUS).slice(0, 24))}
        inputMode={words ? 'text' : 'none'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={words ? 'Type the word' : 'like 3/8, 1 1/2 or \u22124'}
      />
      {!words && (
        <div className="keypad" role="group" aria-label="Number pad">
          {pad.map((k) => <button key={k} type="button" onClick={() => press(k)} aria-label={k === MINUS ? 'minus' : k === '/' ? 'fraction bar' : k}>{k}</button>)}
          <button type="button" className="wide" onClick={() => press(' ')} aria-label="space, for a mixed number">space</button>
          <button type="button" onClick={() => press('back')} aria-label="delete">⌫</button>
        </div>
      )}
      <button type="submit" className="primary big" disabled={!text.trim()}>Check answer <kbd aria-hidden="true">Enter</kbd></button>
      {!words && <p className="muted key-hint">{q.typed?.kind === 'fraction' ? 'Fractions in simplest form. For a mixed number, put a space: 1 1/2.' : 'Use \u2212 for a negative number.'}</p>}
    </form>
  );
}

/** Focuses Continue without scrolling the page, which would hide the battle while its effects play. */
const focusWithoutScrolling = (button: HTMLButtonElement | null) => button?.focus({ preventScroll: true });

function CardAward({ placeId, level }: { placeId: string; level?: string }) {
  const card = cardFor(placeId);
  return (
    <div className={`card-award reveal card-${level ?? 'bronze'}`}>
      <CardArt id={card.artId} width={192} />
      <div>
        <p className="card-new">{level ? `Card upgraded to ${level[0]?.toUpperCase()}${level.slice(1)}!` : 'New card!'}</p>
        <h3>{card.name}</h3>
        <p>{card.subtitle}{card.capital ? ` · Capital: ${card.capital}` : ''}</p>
      </div>
      {card.flag && <img className="card-flag" src={flagUrl(card.flag)} alt={`Flag of ${card.name}`} />}
      <PlaceFlash placeId={placeId} />
    </div>
  );
}

export function QuestionPanel({ question: q, regionId, result, onAnswer, onContinue, hold, log, tag, move }: Props) {
  const map = mapFor(regionId);
  const accepted = q.options.find((o) => o.id === q.acceptedId)?.label;
  const picked = result && !result.correct ? q.options.find((o) => o.id === result.optionId) : undefined;
  const clickable = q.inputType === 'map-click';
  const typed = q.inputType === 'typed';

  const onFeatureClick = useMemo(() => (featureId: string) => {
    const hit = q.options.find((o) => o.featureId === featureId);
    if (hit && !result) onAnswer(hit.id);
  }, [q, result, onAnswer]);

  const cursorItems = useMemo(() => (clickable ? q.options.map((o) => {
    const [x, y] = map.project(place(o.id).lonLat);
    return { id: o.id, x, y };
  }) : []), [q, clickable, map]);
  const cursor = useMapCursor(cursorItems, onAnswer, clickable && !result);

  const highlights = useMemo(() => {
    const shown: Record<string, Highlight> = {};
    if (!clickable) return shown;
    for (const o of q.options) if (o.featureId) shown[o.featureId] = 'selectable';
    if (result) {
      const feature = (id: string) => q.options.find((o) => o.id === id)?.featureId ?? '';
      shown[feature(result.optionId)] = 'wrong';
      shown[feature(q.acceptedId)] = 'correct';
    }
    const pointed = q.options.find((o) => o.id === cursor)?.featureId;
    if (pointed) shown[pointed] = 'cursor';
    return shown;
  }, [q, result, clickable, cursor]);

  const keys: Record<string, () => void> = {};
  if (result) { if (!hold) keys.enter = onContinue; }
  else if (!clickable && !typed) q.options.forEach((o, i) => { keys[String(i + 1)] = () => onAnswer(o.id); });
  useKeys(keys);

  const cardId = result?.cardId ?? result?.cardUp?.placeId;
  const announced = useRef(false);
  useEffect(() => {
    if (cardId && !announced.current) playSound('card');
    announced.current = !!cardId;
  }, [cardId]);

  return (
    <section className="panel question">
      {move && !result && <div className="move-bar"><span>Your move: <strong>{move.name}</strong></span><button type="button" onClick={move.onChange}>Change move <Key k="C" /></button></div>}
      {tag && <p className="recall-tag">{tag}</p>}
      {q.recallOf && <p className="recall-tag">Field Note check! A right answer is a critical: +{ECONOMY.recallBonus} point and a charge.</p>}
      <h2>{q.prompt}</h2>
      {q.flag && <img key={q.id} className="quiz-flag" src={flagUrl(q.flag)} alt="The flag in question" />}
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
        <WorldMap key={q.id} map={map} label="Blank map. Click a place." highlights={highlights} onFeatureClick={onFeatureClick} arrowPan={false}>
          {(scale) => q.options.filter((o) => o.tiny).map((o) => (
            <Dot
              key={o.id}
              id={o.id}
              at={map.project(o.lonLat ?? [0, 0])}
              scale={scale}
              tone={result ? (o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'default') : o.id === cursor ? 'cursor' : 'default'}
              {...(result ? {} : { onClick: () => onAnswer(o.id) })}
            />
          ))}
        </WorldMap>
      )}
      {clickable && !result && <p className="muted key-hint">Click the place, or use the arrow keys and press Enter.</p>}
      {typed && !result && <TypedAnswer key={q.id} question={q} onAnswer={onAnswer} />}
      {typed && result && <p className={`typed-result ${result.correct ? 'correct' : 'wrong'}`}>You typed <strong>{result.optionId.replaceAll('-', MINUS)}</strong></p>}
      {!clickable && !typed && (
        <div className="options">
          {q.options.map((o, i) => {
            const marker = q.inputType === 'map-marker';
            const state = !result ? '' : o.id === q.acceptedId ? 'correct' : o.id === result.optionId ? 'wrong' : 'dim';
            return (
              <button key={o.id} type="button" className={`option ${state}`} disabled={!!result} onClick={() => onAnswer(o.id)}>
                <Key k={i + 1} />{o.flag && <img className="option-flag" src={flagUrl(o.flag)} alt={result ? '' : `Flag ${i + 1}`} />}{(!o.flag || result) && <span className="option-label">{marker && !result ? `Marker ${i + 1}` : marker ? `${i + 1}: ${o.label}` : o.label}</span>}
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div className={`feedback ${result.correct ? 'good' : 'notyet'}`} role="status">
          <p className="learn"><strong>{result.correct ? 'Correct!' : `Not yet. The answer is ${accepted}.`}</strong> {q.explanation}</p>
          {picked?.about && <p className="picked-note"><span>Your pick</span>{picked.about}</p>}
          {!result.correct && q.hint && <p className="picked-note"><span>{q.topic === 'word' ? 'In a sentence' : 'Trick'}</span>{q.hint}</p>}
          {result.correct && q.fieldNote && !q.recallOf && <p className="field-note"><span>Field Note: remember this!</span>{q.fieldNote}<small>It may come back as a bonus question.</small></p>}
          {!clickable && q.inputType !== 'map-marker' && !cardId && q.locationId && <PlaceFlash placeId={q.locationId} />}
          {result.cardId && <CardAward placeId={result.cardId} />}
          {result.cardUp && <CardAward placeId={result.cardUp.placeId} level={result.cardUp.level} />}
          {log && <p className="muted">{log}</p>}
          <button ref={focusWithoutScrolling} type="button" className="primary" disabled={!!hold} onClick={onContinue}>Continue <Key k="Enter" /></button>
        </div>
      )}
    </section>
  );
}
