import { useEffect, useRef, useState } from 'react';
import { currentSlotIndex, type Expedition } from '../engine/game';
import { Fx } from './art';

/** Coins fly up into the counter, which ticks along to the new total. */
function Points({ points }: { points: number }) {
  const [shown, setShown] = useState(points);
  const [flying, setFlying] = useState({ key: 0, coins: 0 });
  const last = useRef(points);

  useEffect(() => {
    const gained = points - last.current;
    last.current = points;
    if (gained <= 0) {
      setShown(points);
      return;
    }
    setFlying((f) => ({ key: f.key + 1, coins: Math.min(gained, 4) }));
    const tick = setInterval(() => setShown((n) => (n < points ? n + 1 : n)), 90);
    const stop = setTimeout(() => clearInterval(tick), 90 * (gained + 1));
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
      setShown(points);
    };
  }, [points]);

  return (
    <span className="points" key={flying.key}>
      {Array.from({ length: flying.coins }, (_, i) => <Fx key={i} id="coin" className={`fly fly-${i}`} />)}
      <span className={flying.coins ? 'bump' : ''}>{shown} Trail Points</span>
    </span>
  );
}

export function TrailBar({ e }: { e: Expedition }) {
  const index = currentSlotIndex(e);
  const stop = index === -1 ? e.slots.length : index + 1;
  const streak = e.streak ?? 0;
  return (
    <div className="trailbar">
      <span className="stops" aria-label={`Stop ${stop} of ${e.slots.length}`}>
        {e.slots.map((s, i) => <span key={i} className={`stop ${s.status === 'won' ? 'done' : i === index ? 'now' : ''}`} />)}
      </span>
      <span>Stop {stop} of {e.slots.length}</span>
      <Points points={e.points} />
      {streak >= 2 && <span className="streak bump" key={streak}><Fx id="flame" />{streak} in a row!</span>}
      {e.snack && <span className="muted">Trail Snack packed</span>}
      <span className="muted">Hunting: {e.reward.kind === 'creature' ? 'a mystery creature' : 'a rival'}</span>
    </div>
  );
}
