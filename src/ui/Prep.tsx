import { ECONOMY, PREP_ITEMS, type PrepItem } from '../engine/economy';
import { teamOf, type Command, type Expedition, type SaveData } from '../engine/game';
import { MAX_TEAM } from '../engine/progression';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { Stable } from './Stable';
import { TypeGuide } from './TypeGuide';
import { PointsGuide } from './PointsGuide';
import { lodgeOf } from './Lodges';
import { TypeBadge } from './TypeGuide';
import { TYPE_INFO } from '../engine/types';

const KEYS: Record<PrepItem, string> = { sturdy: 's', charge: 'c', snack: 't' };
const owned = (e: Expedition, id: PrepItem) => (id === 'sturdy' ? e.sturdy : id === 'charge' ? e.extraCharge : e.snack);

export function Prep({ e, save, dispatch }: { e: Expedition; save: SaveData; dispatch: (c: Command) => void }) {
  const buy = (item: PrepItem) => {
    const def = PREP_ITEMS.find((i) => i.id === item);
    if (def && !owned(e, item) && e.points >= def.cost) playSound('spend');
    dispatch({ type: 'buy', item });
  };
  const pick = (instanceId: string) => dispatch({ type: 'toggleTeam', instanceId });
  const team = teamOf(e);
  const lodge = lodgeOf(e);

  useKeys({
    enter: () => dispatch({ type: 'depart' }),
    ...Object.fromEntries(PREP_ITEMS.map((i) => [KEYS[i.id], () => buy(i.id)])),
    ...Object.fromEntries(save.companions.slice(0, 9).map((c, i) => [String(i + 1), () => pick(c.instanceId)])),
  });

  return (
    <div className="stack">
      <section className="panel">
        <h1>{lodge ? `Get ready for ${lodge.name}` : 'Prepare for the trail'}</h1>
        {e.gateScore && <p className="gate-pass">✓ You passed the gate quiz: {e.gateScore.right} of {e.gateScore.of} right!</p>}
        {lodge?.gauntlet && <p>The Starfall League: four Elite Rangers (<TypeBadge type="flame" /> <TypeBadge type="tide" /> <TypeBadge type="frost" /> <TypeBadge type="gale" />) and then {lodge.leader.name}. Questions about <strong>everything</strong>. Bring a strong, mixed team of level {lodge.recommendedLevel}+ creatures!</p>}
        {lodge && !lodge.gauntlet && <p>{lodge.leader.name} uses <TypeBadge type={lodge.type} /> creatures, and every question is about <strong>{lodge.subjectName.toLowerCase()}</strong>. Bring creatures that are strong against {TYPE_INFO[lodge.type].name}! Best with a level {lodge.recommendedLevel}+ creature.</p>}
        <p>You have <strong className="points" title="Your money for this trip: spend it on the Prep Shop and on clues, or keep it. Leftover points become XP.">{e.points} Trail Points</strong> to spend. {lodge ? 'Buy something in the Prep Shop below, or keep them: every point left at the end becomes XP for your lead creature.' : 'Buy something in the Prep Shop below, save some for clues while you search, or keep them: every point left at the end becomes XP for your lead creature.'}</p>
        <PointsGuide open={save.completedExpeditions < 3} />
      </section>
      <section className="panel">
        <h2>Choose your team: {team.length} of {Math.min(MAX_TEAM, save.companions.length)}</h2>
        <p className="muted">Bring up to {MAX_TEAM}. The first one leads. Bigger teams face tougher opponents, and creatures get +1 Attack in their home landscapes.</p>
        <p className="muted">Mix your types! Each type is strong against one other type, so a mixed team has an answer to more opponents.</p>
        <TypeGuide open={save.completedExpeditions < 3} />
        <Stable companions={save.companions} activeId={e.companionId} teamIds={team} onPick={pick} />
      </section>
      <section className="panel">
        <h2>Prep Shop</h2>
        <div className="shop">
          {PREP_ITEMS.map((i) => {
            const has = owned(e, i.id);
            return (
              <button key={i.id} type="button" disabled={has || e.points < i.cost} onClick={() => buy(i.id)}>
                <strong>{i.name}</strong> <Key k={KEYS[i.id].toUpperCase()} />
                <small>{has ? 'Packed' : `${i.cost} points`}</small>
                <small>{i.text}</small>
              </button>
            );
          })}
        </div>
        {!lodge && <p className="muted">On the trail: extra clue {ECONOMY.extraClue} points, narrow the search {ECONOMY.narrowSearch} points. A wrong guess costs {ECONOMY.wrongGuessCost} point. The atlas is always free.</p>}
      </section>
      <div className="row">
        <button type="button" className="primary" onClick={() => dispatch({ type: 'depart' })}>{lodge ? (lodge.gauntlet ? 'Enter the League' : 'Enter the Lodge') : 'Set off'} <Key k="Enter" /></button>
        <button type="button" className="link" onClick={() => dispatch({ type: 'abandon' })}>Back to camp</button>
      </div>
    </div>
  );
}
