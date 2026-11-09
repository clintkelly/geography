import { useCallback, useEffect, useRef } from 'react';
import type { Command, EventState, Expedition, SaveData } from '../engine/game';
import { TRAIL_EVENTS } from '../engine/events';
import { artUrl, backdropId, Sprite } from './art';
import { streakRate } from './battleAnimation';
import { place } from './content';
import { QuestionPanel } from './QuestionPanel';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';

export function Event({ e, event, save, dispatch }: { e: Expedition; event: EventState; save: SaveData; dispatch: (c: Command) => void }) {
  const def = TRAIL_EVENTS.find((t) => t.id === event.eventId);
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'answer', optionId }), [dispatch]);
  const { result } = event;
  const answered = useRef(!!result);
  useEffect(() => {
    if (!result || answered.current) return;
    answered.current = true;
    playSound(result.correct ? 'correct' : 'not-yet', false, streakRate(e.streak));
  }, [result]); // eslint-disable-line
  return (
    <div className="stack">
      <TrailBar e={e} save={save} />
      <section className="event-banner" style={{ backgroundImage: `url(${artUrl(backdropId(e.slots[event.slotIndex]?.locationId ?? '', place(e.slots[event.slotIndex]?.locationId ?? '').biome, { night: e.night }))})` }}>
        <Sprite id={`event-${event.eventId}`} size={160} />
        <div>
          <h1>{def?.title}</h1>
          <p>{def?.text}</p>
        </div>
      </section>
      <QuestionPanel
        question={event.question}
        regionId={e.regionId}
        result={result}
        onAnswer={onAnswer}
        onContinue={() => dispatch({ type: 'continue' })}
        log={result ? (result.correct ? def?.success : 'No harm done. The trail goes on.') : undefined}
      />
    </div>
  );
}
