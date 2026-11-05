import { ECONOMY, PREP_ITEMS } from '../engine/economy';
import { DIFFICULTY_POINTS } from '../engine/game';

/** What Trail Points are for, in three short lists a child can scan: get them, spend them, keep them. */
export function PointsGuide({ open }: { open?: boolean }) {
  const shop = PREP_ITEMS.map((i) => `${i.name} ${i.cost}`).join(', ');
  return (
    <details className="points-guide" open={open}>
      <summary>What are Trail Points?</summary>
      <p>Trail Points are your money for one trail. Spend them to make the trail easier. Anything left over at the end turns into XP, so saving them is good too!</p>
      <div className="points-cols">
        <div>
          <h3>🪙 Get points</h3>
          <ul>
            <li>Start every trail with {ECONOMY.startingPoints} (+{DIFFICULTY_POINTS.ranger} on Ranger, +{DIFFICULTY_POINTS.expert} on Expert)</li>
            <li>+{ECONOMY.perStopWon} for each battle you win</li>
            <li>+{ECONOMY.recallBonus} for remembering a Field Note</li>
            <li>Bonus points for a streak of 5 or 10 right answers in a row</li>
            <li>Medals, and setting a creature free, save points for your next trail</li>
          </ul>
        </div>
        <div>
          <h3>🛒 Spend points</h3>
          <ul>
            <li>Prep Shop before you leave: {shop}</li>
            <li>An extra clue: {ECONOMY.extraClue}</li>
            <li>Narrow the search: {ECONOMY.narrowSearch}</li>
            <li>A wrong guess on the map costs {ECONOMY.wrongGuessCost}</li>
          </ul>
        </div>
        <div>
          <h3>⭐ Keep points</h3>
          <ul>
            <li>Every point left at the end of the trail becomes {ECONOMY.xpPerLeftoverPoint} XP for your lead creature, to help it level up and evolve</li>
          </ul>
        </div>
      </div>
    </details>
  );
}
