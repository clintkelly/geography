import { useCallback } from 'react';
import type { Command, EventState, Expedition } from '../engine/game';
import { TRAIL_EVENTS } from '../engine/events';
import { artUrl, Sprite } from './art';
import { place } from './content';
import { QuestionPanel } from './QuestionPanel';
import { TrailBar } from './TrailBar';

export function Event({ e, event, dispatch }: { e: Expedition; event: EventState; dispatch: (c: Command) => void }) {
  const def = TRAIL_EVENTS.find((t) => t.id === event.eventId);
  const onAnswer = useCallback((optionId: string) => dispatch({ type: 'answer', optionId }), [dispatch]);
  const { result } = event;
  return (
    <div className="stack">
      <TrailBar e={e} />
      <section className="event-banner" style={{ backgroundImage: `url(${artUrl(`backdrop-${place(e.slots[event.slotIndex]?.locationId ?? '').biome}`)})` }}>
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
