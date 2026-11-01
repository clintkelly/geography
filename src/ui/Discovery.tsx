import { useMemo, useState } from 'react';
import { PACK } from '../content/pack';
import { ECONOMY } from '../engine/economy';
import { currentSlotIndex, type Command, type Expedition } from '../engine/game';
import { mapFor, place } from './content';
import { Key, useKeys } from './keys';
import { playSound } from './sound';
import { TrailBar } from './TrailBar';
import { Dot, Marker, WorldMap, type Highlight } from './WorldMap';

export function Discovery({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasPlace, setAtlasPlace] = useState<string | null>(null);

  const expert = e.difficulty === 'expert';
  const map = mapFor(e.regionId);
  const clues = e.clueIds.slice(0, e.cluesShown).map((id) => PACK.clues.find((c) => c.id === id));
  const lastGuess = e.guesses.at(-1);
  const stopIndex = currentSlotIndex(e);
  const previous = stopIndex > 0 ? e.slots[stopIndex - 1] : undefined;

  const candidates = e.candidateIds.map((id, i) => ({ id, number: i + 1, place: place(id), ruledOut: e.guesses.includes(id) || e.removedIds.includes(id) }));
  const highlights = useMemo(() => {
    const shown: Record<string, Highlight> = {};
    for (const c of candidates) shown[c.place.featureId] = c.ruledOut ? 'ruledOut' : expert ? 'selectable' : 'candidate';
    if (atlasPlace) shown[place(atlasPlace).featureId] = 'atlas';
    return shown;
  }, [e.guesses, e.removedIds, atlasPlace]); // eslint-disable-line

  const guess = (locationId: string) => dispatch({ type: 'guess', locationId });
  const onFeatureClick = useMemo(() => (id: string) => {
    const hit = e.candidateIds.find((c) => place(c).featureId === id);
    if (hit) dispatch({ type: 'guess', locationId: hit });
  }, [e.candidateIds, dispatch]);

  const toggleAtlas = () => {
    if (atlasOpen) setAtlasPlace(null);
    else dispatch({ type: 'useAtlas' });
    setAtlasOpen(!atlasOpen);
  };

  const canBuyClue = e.cluesShown < e.clueIds.length && e.points >= ECONOMY.extraClue;
  const canNarrow = !expert && !e.narrowed && e.points >= ECONOMY.narrowSearch;
  const buyClue = () => { playSound('spend'); dispatch({ type: 'revealClue', shown: e.cluesShown }); };
  const narrow = () => { playSound('spend'); dispatch({ type: 'narrowSearch' }); };

  // While the atlas is open, numbers look places up instead of guessing, so research can't submit a guess by accident.
  const atlasEntries = [...candidates].sort((a, b) => a.place.name.localeCompare(b.place.name));
  const keys: Record<string, () => void> = { a: toggleAtlas };
  if (canBuyClue) keys.c = buyClue;
  if (canNarrow) keys.n = narrow;
  if (atlasOpen) atlasEntries.slice(0, 9).forEach((c, i) => { keys[String(i + 1)] = () => setAtlasPlace(c.id); });
  else if (!expert) candidates.forEach((c) => { if (!c.ruledOut) keys[String(c.number)] = () => guess(c.id); });
  useKeys(keys);

  return (
    <div className="stack">
      <TrailBar e={e} />
      <div className="discovery">
        <section className="panel clues">
          <h1>{previous ? 'Where did it go next?' : 'Where was it seen?'}</h1>
          {previous && <p className="muted">It left {place(previous.locationId).name}.</p>}
          {clues.map((c, i) => <p key={c?.id} className="clue"><span className="muted">Clue {i + 1}</span>{c?.text}</p>)}
          {lastGuess && <p className="correction" role="status">Not yet: that was {place(lastGuess).name}. Check the clues and try another place.</p>}
          {expert && <p className="muted">Expert: click the place on the map. Very small countries have a dot.</p>}
          <div className="row">
            {e.cluesShown < e.clueIds.length && <button type="button" disabled={!canBuyClue} onClick={buyClue}>Another clue ({ECONOMY.extraClue}) <Key k="C" /></button>}
            {!expert && !e.narrowed && <button type="button" disabled={!canNarrow} onClick={narrow}>Narrow search ({ECONOMY.narrowSearch}) <Key k="N" /></button>}
            <button type="button" onClick={toggleAtlas}>{atlasOpen ? 'Close atlas' : 'Open atlas'} (free) <Key k="A" /></button>
          </div>
          {atlasOpen && (
            <div className="atlas">
              <h2>Atlas</h2>
              <p className="muted key-hint">Press a number to look up a place. Close the atlas to choose one.</p>
              {atlasEntries.map((c, i) => (
                <details key={c.id} open={atlasPlace === c.id}>
                  <summary onClick={(ev) => { ev.preventDefault(); setAtlasPlace(c.id); }}>{i < 9 && <Key k={i + 1} />} {c.place.name}</summary>
                  <ul>{c.place.atlas.map((line) => <li key={line}>{line}</li>)}</ul>
                </details>
              ))}
            </div>
          )}
        </section>

        <section className="discovery-map">
          <WorldMap map={map} label={expert ? 'Blank map. Click a place.' : 'Map with numbered places to choose from'} highlights={highlights} onFeatureClick={onFeatureClick}>
            {(scale) => (expert
              ? candidates.filter((c) => c.place.tiny && !c.ruledOut).map((c) => <Dot key={c.id} id={c.id} at={map.project(c.place.lonLat)} scale={scale} onClick={() => guess(c.id)} />)
              : candidates.filter((c) => !c.ruledOut).map((c) => (
                <Marker key={c.id} at={map.project(c.place.lonLat)} scale={scale} label={String(c.number)} onClick={() => guess(c.id)} />
              )))}
          </WorldMap>
          {!expert && (
            <div className="row choices">
              {candidates.map((c) => (
                <button key={c.id} type="button" disabled={c.ruledOut} onClick={() => guess(c.id)}>
                  {c.ruledOut ? (e.guesses.includes(c.id) ? c.place.name : 'Ruled out') : <>{`Place ${c.number}`} <Key k={c.number} /></>}
                </button>
              ))}
            </div>
          )}
        </section>
        <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
      </div>
    </div>
  );
}
