import { useCallback } from 'react';
import type { Command, MasteryTest as Test } from '../engine/game';
import { MASTERY_MISSES_ALLOWED, MEDAL_POINTS, MEDAL_TRACKS } from '../engine/medals';
import { region } from './content';
import { Key, useKeys } from './keys';
import { MedalIcon } from './Medals';
import { QuestionPanel } from './QuestionPanel';

export function MasteryTest({ test: t, dispatch }: { test: Test; dispatch: (c: Command) => void }) {
  const label = MEDAL_TRACKS.find((x) => x.id === t.track)?.label ?? t.track;
  const title = `${label} of ${region(t.regionId).label}`;
  const close = () => dispatch({ type: 'closeMastery' });
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'masteryAnswer', optionId }), [dispatch]);
  useKeys(t.outcome ? { enter: close, escape: close } : {});
  const q = t.questions[t.index];

  if (t.outcome) {
    const passed = t.outcome === 'passed';
    return (
      <section className={`panel mastery-end${passed ? ' mastery-passed' : ''}`}>
        {passed && <MedalIcon level="platinum" size={96} />}
        <h1>{passed ? 'Platinum!' : 'Not this time'}</h1>
        <p>{passed ? `You mastered the ${title}. +${MEDAL_POINTS.platinum} Trail Points for your next trail.` : `More than ${MASTERY_MISSES_ALLOWED} miss ends the test. The places you missed will come back in review, and you can try again tomorrow.`}</p>
        <button type="button" className="primary" onClick={close}>Back to camp <Key k="Enter" /></button>
      </section>
    );
  }
  if (!q) return null;
  return (
    <div className="stack">
      <section className="panel mastery-head">
        <h1>Mastery Test: {title}</h1>
        <p>Question {t.index + 1} of {t.questions.length} · {t.misses} of {MASTERY_MISSES_ALLOWED} miss allowed</p>
        <span className="xp-track"><span className="xp-fill" style={{ width: `${(t.index / t.questions.length) * 100}%` }} /></span>
        <button type="button" className="link" onClick={close}>Stop the test (counts as today's try)</button>
      </section>
      <QuestionPanel key={q.id} question={q} regionId={q.regionId} result={t.result} onAnswer={onAnswer} onContinue={() => dispatch({ type: 'masteryNext' })} />
    </div>
  );
}
