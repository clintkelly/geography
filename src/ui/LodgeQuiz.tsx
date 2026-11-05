import { useCallback, useEffect } from 'react';
import { PACK } from '../content/pack';
import { quizNeed, type Command, type LodgeQuiz as Quiz } from '../engine/game';
import { lodgeById } from '../engine/lodges';
import { artUrl, Fx, Sprite } from './art';
import { species } from './content';
import { Key, useKeys } from './keys';
import { PatchIcon } from './Lodges';
import { QuestionPanel } from './QuestionPanel';
import { playSound } from './sound';

/** A Lodge quiz: the gate into a math or vocabulary Lodge, or the Mastery Test that earns Gold. */
export function LodgeQuiz({ quiz: t, dispatch }: { quiz: Quiz; dispatch: (c: Command) => void }) {
  const lodge = lodgeById(PACK, t.lodgeId);
  const need = quizNeed(t);
  const q = t.questions[t.index];
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'lodgeQuizAnswer', optionId }), [dispatch]);
  const close = () => dispatch({ type: 'closeLodgeQuiz' });
  const retry = () => {
    dispatch({ type: 'closeLodgeQuiz' });
    dispatch(t.kind === 'gate' ? { type: 'startLodge', lodgeId: t.lodgeId, tier: t.tier } : { type: 'startLodgeTest', lodgeId: t.lodgeId });
  };
  useKeys(t.outcome ? { enter: t.outcome === 'failed' ? retry : close, escape: close } : {});
  useEffect(() => {
    if (t.outcome === 'passed') {
      playSound('evolve');
      const id = setTimeout(() => playSound('levelup'), 800);
      return () => clearTimeout(id);
    }
    if (t.outcome === 'failed') playSound('retreat');
    return undefined;
  }, [t.outcome]);
  if (!lodge) return null;
  const mastery = t.kind === 'mastery';
  const title = mastery ? `${lodge.name} Mastery Test` : `${lodge.name} gate quiz`;
  const percent = Math.round((need / t.questions.length) * 100);

  if (t.outcome) {
    const passed = t.outcome === 'passed';
    const legend = species(lodge.legendaryId);
    const prize = species(lodge.prizeSpeciesId);
    return (
      <section className={`panel mastery-end${passed ? ' mastery-passed' : ''}`}>
        {passed && mastery && (
          <div className="celebrate">
            {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`rise rise-${i}`} />)}
            <PatchIcon lodge={lodge} earned tier="gold" size={96} />
            <Sprite id={legend.artId} size={160} className="hop-loop" />
          </div>
        )}
        <h1>{passed ? (mastery ? 'Gold patch!' : 'The gate is open!') : 'So close!'}</h1>
        <p className="learn">{t.right} of {t.questions.length} right. {passed ? '' : `You need ${need}.`}</p>
        {passed && mastery && <p>You mastered {lodge.name}! <strong>{legend.displayName}</strong>, a legendary creature, joins you, along with a <strong>shiny {prize.displayName}</strong>.</p>}
        {!passed && <p>{mastery ? 'Your Gold battles still count. Take the test again whenever you are ready, with new questions.' : 'Try again with new questions. Every question you answer helps your eggs hatch!'}</p>}
        <div className="row">
          {!passed && <button type="button" className="primary" onClick={retry}>Try again <Key k="Enter" /></button>}
          <button type="button" className={passed ? 'primary' : ''} onClick={close}>{passed ? 'Back to camp' : 'Not now'}{passed && <> <Key k="Enter" /></>}</button>
        </div>
      </section>
    );
  }
  if (!q) return null;
  const missed = t.index - t.right + (t.result && !t.result.correct ? 1 : 0);
  const room = t.questions.length - need;
  return (
    <div className="stack">
      <section className="panel mastery-head lodge-quiz-head">
        <img src={artUrl(lodge.leader.artId)} alt="" width={64} height={64} className="sprite" />
        <div>
          <h1>{title}</h1>
          <p>{mastery ? `Get ${need} of ${t.questions.length} right (${percent}%) for the Gold patch and ${species(lodge.legendaryId).displayName}.` : `${lodge.leader.name} only battles explorers who know their stuff: get ${need} of ${t.questions.length} right to go in.`}</p>
          <p className="muted">Question {t.index + 1} of {t.questions.length} · {t.right + (t.result?.correct ? 1 : 0)} right · {missed} of {room} {room === 1 ? 'miss' : 'misses'} used</p>
          <span className="xp-track"><span className="xp-fill" style={{ width: `${(t.index / t.questions.length) * 100}%` }} /></span>
        </div>
      </section>
      <QuestionPanel key={q.id} question={q} regionId={q.regionId === 'study' ? 'us-west' : q.regionId} result={t.result} onAnswer={onAnswer} onContinue={() => dispatch({ type: 'lodgeQuizNext' })} />
      <button type="button" className="link leave" onClick={close}>Leave the quiz</button>
    </div>
  );
}
