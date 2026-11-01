import { ECONOMY, PREP_ITEMS, type PrepItem } from '../engine/economy';
import type { Command, Expedition, SaveData } from '../engine/game';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { Stable } from './Stable';

const KEYS: Record<PrepItem, string> = { sturdy: 's', charge: 'c', snack: 't' };
const owned = (e: Expedition, id: PrepItem) => (id === 'sturdy' ? e.sturdy : id === 'charge' ? e.extraCharge : e.snack);

export function Prep({ e, save, dispatch }: { e: Expedition; save: SaveData; dispatch: (c: Command) => void }) {
  const buy = (item: PrepItem) => {
    const def = PREP_ITEMS.find((i) => i.id === item);
    if (def && !owned(e, item) && e.points >= def.cost) playSound('spend');
    dispatch({ type: 'buy', item });
  };
  const pick = (instanceId: string) => dispatch({ type: 'selectCompanion', instanceId });

  useKeys({
    enter: () => dispatch({ type: 'depart' }),
    ...Object.fromEntries(PREP_ITEMS.map((i) => [KEYS[i.id], () => buy(i.id)])),
    ...Object.fromEntries(save.companions.slice(0, 9).map((c, i) => [String(i + 1), () => pick(c.instanceId)])),
  });

  return (
    <div className="stack">
      <section className="panel">
        <h1>Prepare for the trail</h1>
        <p>You have <strong className="points">{e.points} Trail Points</strong>. Spend some now, or keep them for clues on the trail. Leftover points become XP.</p>
      </section>
      <section className="panel">
        <h2>Choose your companion</h2>
        <Stable companions={save.companions} activeId={e.companionId} onPick={pick} />
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
        <p className="muted">On the trail: extra clue {ECONOMY.extraClue} points, narrow the search {ECONOMY.narrowSearch} points. A wrong guess costs {ECONOMY.wrongGuessCost} point. The atlas is always free.</p>
      </section>
      <div className="row">
        <button type="button" className="primary" onClick={() => dispatch({ type: 'depart' })}>Set off <Key k="Enter" /></button>
        <button type="button" className="link" onClick={() => dispatch({ type: 'abandon' })}>Back to camp</button>
      </div>
    </div>
  );
}
