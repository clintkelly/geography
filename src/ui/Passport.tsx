import { PACK } from '../content/pack';
import { hasCardsAtLeast } from '../engine/cards';
import { isRegionComplete, bossUnlocked, type SaveData } from '../engine/game';
import { artUrl, Sprite } from './art';
import { Key, useKeys } from './keys';

type Level = 'none' | 'bronze' | 'silver' | 'gold';
const WORDS: Record<Level, string> = { none: 'Finish a trail here', bronze: 'Bronze: trail finished. Fill the map for silver.', silver: 'Silver: map filled. Raise every card to Gold.', gold: 'Gold: every card is Gold!' };

export function regionLevel(save: SaveData, regionId: string): Level {
  if (!save.stampedRegions?.includes(regionId)) return 'none';
  if (!isRegionComplete(save.foundPlaces, PACK, regionId)) return 'bronze';
  const gold = hasCardsAtLeast(save.stateCards, save.learning, 'gold');
  return PACK.cards.filter((c) => PACK.places.find((p) => p.id === c.placeId)?.regionId === regionId).every((c) => gold.includes(c.placeId)) ? 'gold' : 'silver';
}

export function Passport({ save, onClose }: { save: SaveData; onClose: () => void }) {
  useKeys({ v: onClose, escape: onClose });
  const stamped = PACK.regions.filter((r) => save.stampedRegions?.includes(r.id)).length;
  const continents = [...new Set(PACK.regions.map((r) => r.continent))];
  const owned = save.companions.map((c) => c.speciesId);
  return (
    <div className="stack passport">
      <section className="panel">
        <h1>Explorer's Passport</h1>
        <p>{stamped} of {PACK.regions.length} regions stamped.{stamped === PACK.regions.length ? ' You have explored the whole world!' : ' Finish a trail in a region to earn its stamp.'}</p>
        <div className="xp-track"><div className="xp-fill" style={{ width: `${(stamped / PACK.regions.length) * 100}%` }} /></div>
        <button type="button" onClick={onClose}>Back to camp <Key k="V" /></button>
      </section>
      {continents.map((continent) => {
        const regions = PACK.regions.filter((r) => r.continent === continent);
        const boss = PACK.species.find((s) => s.boss && s.homes.includes(regions[0]?.id ?? ''));
        const beaten = !!boss && owned.includes(boss.id);
        const ready = bossUnlocked(save, PACK, regions[0]?.id ?? '');
        return (
          <section key={continent} className="panel">
            <h2>{continent}</h2>
            <ul className="stamps">
              {regions.map((r) => {
                const level = regionLevel(save, r.id);
                return (
                  <li key={r.id} className={`stamp stamp-${level}`}>
                    <img src={artUrl(`stamp-${r.id}`)} alt="" width={64} height={64} />
                    <strong>{r.label}</strong>
                    <small>{WORDS[level]}</small>
                  </li>
                );
              })}
            </ul>
            {boss && (
              <div className="boss-crest">
                <Sprite id={boss.artId} size={64} className={beaten ? '' : 'silhouette'} />
                <div>
                  <strong>{beaten ? `${boss.displayName} befriended!` : 'Continent Boss'}</strong>
                  <small>{beaten ? boss.flavor : ready ? 'Ready! Look for it in this continent\'s sightings at Camp.' : `Stamp every region in ${continent} to track it down.`}</small>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
