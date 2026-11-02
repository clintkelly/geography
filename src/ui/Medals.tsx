import { PACK } from '../content/pack';
import type { Command, SaveData } from '../engine/game';
import { MASTERY_MISSES_ALLOWED, MEDAL_POINTS, medalView, PLATINUM_WAIT_DAYS, regionTracks, type MedalLevel, type MedalView } from '../engine/medals';
import { artUrl } from './art';
import { Key, useKeys } from './keys';

export const LEVEL_NAME: Record<MedalLevel, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

export function MedalIcon({ level, size = 32 }: { level?: MedalLevel | undefined; size?: number }) {
  return level
    ? <img className="medal-icon" src={artUrl(`medal-${level}`)} alt={`${LEVEL_NAME[level]} medal`} width={size} height={size} />
    : <span className="medal-icon medal-empty" style={{ width: size, height: size }} aria-label="No medal yet" />;
}

function Track({ v, onTest }: { v: MedalView; onTest: () => void }) {
  return (
    <div className={`medal-track${v.level ? ` medal-${v.level}` : ''}`}>
      <MedalIcon level={v.level} />
      <div>
        <strong>{v.label}{v.level ? `: ${LEVEL_NAME[v.level]}` : ''}</strong>
        <small>{v.next}</small>
        {v.level !== 'platinum' && v.level !== 'gold' && <span className="xp-track"><span className="xp-fill" style={{ width: `${(v.done / Math.max(1, v.total)) * 100}%` }} /></span>}
        {v.testReady && <button type="button" className="primary" onClick={onTest}>Mastery Test</button>}
      </div>
    </div>
  );
}

export function Medals({ save, dispatch, onClose }: { save: SaveData; dispatch: (c: Command) => void; onClose: () => void }) {
  useKeys({ m: onClose, escape: onClose });
  const now = Date.now();
  const continents = [...new Set(PACK.regions.map((r) => r.continent))];
  const views = PACK.regions.flatMap((r) => regionTracks(PACK, r.id).map((t) => medalView(save.medals ?? {}, save.learning, PACK, r.id, t.id, now)));
  const count = (level: MedalLevel) => views.filter((v) => v.level && ['bronze', 'silver', 'gold', 'platinum'].indexOf(v.level) >= ['bronze', 'silver', 'gold', 'platinum'].indexOf(level)).length;
  return (
    <div className="stack medals">
      <section className="panel">
        <h1>Mastery Medals</h1>
        <p>Each region has medals for Places, Capitals and Flags. A medal needs every place in the region.</p>
        <ul className="medal-key">
          <li><MedalIcon level="bronze" /> <span><strong>Bronze:</strong> right at least once</span></li>
          <li><MedalIcon level="silver" /> <span><strong>Silver:</strong> right on Ranger</span></li>
          <li><MedalIcon level="gold" /> <span><strong>Gold:</strong> right on Expert on two different days</span></li>
          <li><MedalIcon level="platinum" /> <span><strong>Platinum:</strong> a Mastery Test {PLATINUM_WAIT_DAYS} days after Gold, with at most {MASTERY_MISSES_ALLOWED} miss</span></li>
        </ul>
        <p className="muted">Medals bank Trail Points for your next trail: Bronze {MEDAL_POINTS.bronze}, Silver {MEDAL_POINTS.silver}, Gold {MEDAL_POINTS.gold}, Platinum {MEDAL_POINTS.platinum}. You have {count('bronze')} Bronze or better, {count('gold')} Gold or better and {count('platinum')} Platinum of {views.length}.</p>
        <button type="button" onClick={onClose}>Back to camp <Key k="M" /></button>
      </section>
      {continents.map((continent) => (
        <section key={continent} className="panel">
          <h2>{continent}</h2>
          <div className="medal-regions">
            {PACK.regions.filter((r) => r.continent === continent).map((r) => (
              <div key={r.id} className="medal-region">
                <h3>{r.label}</h3>
                {regionTracks(PACK, r.id).map((t) => {
                  const v = medalView(save.medals ?? {}, save.learning, PACK, r.id, t.id, now);
                  return <Track key={t.id} v={v} onTest={() => dispatch({ type: 'startMastery', regionId: r.id, track: t.id })} />;
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
