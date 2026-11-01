import { useEffect, useRef, useState } from 'react';
import { currentSlotIndex, type Expedition } from '../engine/game';
import { PACK } from '../content/pack';
import { availableRare, rareChance, trailScore } from '../engine/luck';
import { streakReward } from '../engine/streak';
import { Fx } from './art';
import { playSound } from './sound';

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

/** How well the trip is going, and what that does for the odds of a rare encounter. */
function TrailScore({ e, owned }: { e: Expedition; owned: readonly string[] }) {
  const score = trailScore(e);
  const percent = Math.round(rareChance(score) * 100);
  const rare = availableRare(PACK, e.regionId, owned);
  const hot = score >= 70;
  return (
    <span className={`trail-score${hot ? ' hot' : ''}`} title="Answer well and keep your streak going to raise your chance of a rare encounter.">
      <span className="score-label">Trail Score {score}</span>
      <span className="score-track" role="img" aria-label={`Trail Score ${score} of 100`}><span className="score-fill" style={{ width: `${score}%` }} /></span>
      <span className="score-chance" key={percent}>{rare ? `${percent}% rare chance` : 'Rare creature found'}</span>
    </span>
  );
}

/** A milestone banner, shown when the streak reaches one. It never blocks input. */
function StreakBanner({ streak }: { streak: number }) {
  const reward = streakReward(streak);
  const last = useRef(streak);
  useEffect(() => {
    if (streak > last.current && reward) playSound('levelup');
    last.current = streak;
  }, [streak]); // eslint-disable-line
  if (!reward) return null;
  return (
    <div className="streak-banner" key={streak} aria-live="polite">
      {[0, 1, 2, 3, 4, 5].map((i) => <Fx key={i} id="spark" className={`burst burst-${i}`} />)}
      <Fx id="flame" /><strong>{streak} in a row! {reward.label}</strong>
    </div>
  );
}

export function TrailBar({ e, owned }: { e: Expedition; owned: readonly string[] }) {
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
      <TrailScore e={e} owned={owned} />
      <StreakBanner streak={streak} />
      {streak >= 2 && <span className={`streak bump${streak >= 10 ? ' streak-max' : streak >= 5 ? ' streak-big' : ''}`} key={streak}><Fx id="flame" />{streak} in a row!</span>}
      {e.snack && <span className="muted">Trail Snack packed</span>}
      <span className="muted">Hunting: {e.reward.kind === 'creature' ? 'a mystery creature' : 'a rival'}</span>
    </div>
  );
}
