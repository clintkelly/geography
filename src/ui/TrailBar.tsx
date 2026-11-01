import { currentSlotIndex, type Expedition } from '../engine/game';

export function TrailBar({ e }: { e: Expedition }) {
  const index = currentSlotIndex(e);
  const stop = index === -1 ? e.slots.length : index + 1;
  return (
    <div className="trailbar">
      <span className="stops" aria-label={`Stop ${stop} of ${e.slots.length}`}>
        {e.slots.map((s, i) => <span key={i} className={`stop ${s.status === 'won' ? 'done' : i === index ? 'now' : ''}`} />)}
      </span>
      <span>Stop {stop} of {e.slots.length}</span>
      <span className="points">{e.points} Trail Points</span>
      {e.snack && <span className="muted">Trail Snack packed</span>}
      <span className="muted">Hunting: {e.reward.kind === 'creature' ? 'a mystery creature' : 'a rival'}</span>
    </div>
  );
}
