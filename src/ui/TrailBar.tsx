import { useEffect, useRef, useState } from 'react';
import type { Difficulty } from '../content/types';
import { currentSlotIndex, type Expedition, type SaveData, knownSpecies } from '../engine/game';
import type { StopKind } from '../engine/trail';
import { PACK } from '../content/pack';
import { availableRare, rareChance, trailScore } from '../engine/luck';
import { streakReward } from '../engine/streak';
import { Fx } from './art';
import { region } from './content';
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
    playSound('coin');
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
      <span className={flying.coins ? 'bump' : ''}>{shown}</span>
    </span>
  );
}

/** The next streak that pays out, so the bar can say how far away it is. */
export function nextMilestone(streak: number): { at: number; label: string } | null {
  for (let n = streak + 1; n <= streak + 20; n++) {
    const reward = streakReward(n);
    if (reward) return { at: n, label: reward.label };
  }
  return null;
}

/** The streak right now, and how many more right answers reach the next reward. */
function Streak({ streak }: { streak: number }) {
  const next = nextMilestone(streak);
  const left = next ? next.at - streak : 0;
  const last = useRef(streak);
  const [blaze, setBlaze] = useState(0);
  useEffect(() => {
    // A streak reward lands: a whoosh and a burst of flame on the counter.
    if (streak > last.current && streakReward(streak)) {
      playSound('streak');
      setBlaze((n) => n + 1);
    }
    last.current = streak;
  }, [streak]);
  return (
    <span key={`streak-${blaze}`} className={`hud-cell${blaze ? ' streak-blaze' : ''}${streak >= 10 ? ' streak-hot' : streak >= 5 ? ' streak-warm' : ''}`} title="Right answers in a row. Streaks raise your Trail Score and pay rewards.">
      <span className="hud-label">Streak</span>
      <span className={`streak${streak >= 2 ? ' bump' : ''}${streak >= 10 ? ' streak-max' : streak >= 5 ? ' streak-big' : ''}`} key={streak}>
        {streak >= 1 && <Fx id="flame" />}{streak} in a row
      </span>
      {next && <small>{left} more for {next.label.replace(/ \+.*$/, '')}</small>}
    </span>
  );
}

/** Both ways to meet a rare creature: a lucky battle on this trail, or a full map, which brings one to camp. */
function Rare({ e, save }: { e: Expedition; save: SaveData }) {
  const rare = availableRare(PACK, e.regionId, [...knownSpecies(save)]);
  const score = trailScore(e);
  const percent = Math.round(rareChance(score) * 100);
  const places = PACK.places.filter((p) => p.regionId === e.regionId);
  const found = places.filter((p) => save.foundPlaces.includes(p.id)).length;
  const hot = score >= 70;
  if (!rare) {
    return (
      <span className="hud-cell">
        <span className="hud-label">Rare creature</span>
        <strong>Found!</strong>
        <small>No rare left in {region(e.regionId).label}</small>
      </span>
    );
  }
  return (
    <span className={`hud-cell trail-score${hot ? ' hot' : ''}`} title="Answer well and keep your streak going to raise the chance that a battle is a rare creature. Find every place on the map to bring the rare creature to camp.">
      <span className="hud-label">Rare chance</span>
      <span className="score-row">
        <span className="score-track" role="img" aria-label={`Trail Score ${score} of 100`}><span className="score-fill" style={{ width: `${score}%` }} /></span>
        <span className="score-chance" key={percent}>{percent}%</span>
      </span>
      <small>{found === places.length ? 'Map full: a rare waits at camp' : `Map: ${found} of ${places.length} found`}</small>
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

const STOP_NAME: Record<StopKind, string> = { regular: 'Battle', event: 'Trail event', guardian: 'Final battle' };
const LEVEL_NAME: Record<Difficulty, string> = { scout: 'Scout', ranger: 'Ranger', expert: 'Expert' };

/** The trip at a glance, pinned to the top: where you are, points, streak and the road to a rare creature. */
export function TrailBar({ e, save }: { e: Expedition; save: SaveData }) {
  const index = currentSlotIndex(e);
  const stop = index === -1 ? e.slots.length : index + 1;
  const streak = e.streak ?? 0;
  const now = e.slots[index];
  return (
    <div className="trailbar" role="status">
      <span className="hud-cell">
        <span className="hud-label">{region(e.regionId).label} · {LEVEL_NAME[e.difficulty]}</span>
        <span className="stops" aria-label={`Stop ${stop} of ${e.slots.length}`}>
          {e.slots.map((s, i) => <span key={i} title={STOP_NAME[s.kind]} className={`stop stop-${s.kind} ${s.status === 'won' ? 'done' : i === index ? 'now' : ''}`} />)}
        </span>
        <small>Stop {stop} of {e.slots.length}{now ? `: ${STOP_NAME[now.kind]}` : ''}</small>
      </span>
      <span className="hud-cell">
        <span className="hud-label">Trail Points</span>
        <Points points={e.points} />
        {e.snack && <small>Trail Snack packed</small>}
      </span>
      <Streak streak={streak} />
      <Rare e={e} save={save} />
      <span className="hud-cell">
        <span className="hud-label">Hunting</span>
        <strong>{e.reward.kind === 'creature' ? 'A mystery creature' : 'A rival'}</strong>
      </span>
      <StreakBanner streak={streak} />
    </div>
  );
}
