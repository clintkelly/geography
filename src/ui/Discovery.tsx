import { useMemo, useState } from 'react';
import { PACK } from '../content/pack';
import type { Command, Expedition } from '../engine/game';
import { mapFor, place } from './content';
import { Key, useKeys } from './keys';
import { Marker, WorldMap, type Highlight } from './WorldMap';

export function Discovery({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasPlace, setAtlasPlace] = useState<string | null>(null);

  const clues = e.clueIds.slice(0, e.cluesShown).map((id) => PACK.clues.find((c) => c.id === id));
  const lastGuess = e.guesses.at(-1);
  const map_ = mapFor(e.regionId);

  const candidates = e.candidateIds.map((id, i) => ({ id, number: i + 1, place: place(id), ruledOut: e.guesses.includes(id) }));
  const highlights = useMemo(() => {
    const map: Record<string, Highlight> = {};
    for (const c of candidates) map[c.place.featureId] = c.ruledOut ? 'ruledOut' : 'candidate';
    if (atlasPlace) map[place(atlasPlace).featureId] = 'atlas';
    return map;
  }, [e.guesses, atlasPlace]); // eslint-disable-line

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

  // While the atlas is open, numbers look places up instead of guessing, so research can't submit a guess by accident.
  const atlasEntries = [...candidates].sort((a, b) => a.place.name.localeCompare(b.place.name));
  const keys: Record<string, () => void> = { a: toggleAtlas };
  if (e.cluesShown < e.clueIds.length) keys.c = () => dispatch({ type: 'revealClue' });
  if (atlasOpen) atlasEntries.forEach((c, i) => { keys[String(i + 1)] = () => setAtlasPlace(c.id); });
  else candidates.forEach((c) => { if (!c.ruledOut) keys[String(c.number)] = () => guess(c.id); });
  useKeys(keys);

  return (
    <div className="discovery">
      <section className="panel clues">
        <h1>Where was it seen?</h1>
        {clues.map((c, i) => <p key={c?.id} className="clue"><span className="muted">Clue {i + 1}</span>{c?.text}</p>)}
        {lastGuess && <p className="correction" role="status">Not yet: that was {place(lastGuess).name}. Check the clues and try another place.</p>}
        <div className="row">
          {e.cluesShown < e.clueIds.length && <button type="button" onClick={() => dispatch({ type: 'revealClue' })}>Another clue <Key k="C" /></button>}
          <button type="button" onClick={toggleAtlas}>{atlasOpen ? 'Close atlas' : 'Open atlas'} <Key k="A" /></button>
        </div>
        {atlasOpen && (
          <div className="atlas">
            <h2>Atlas</h2>
            <p className="muted key-hint">Press 1–4 to look up a place. Close the atlas to choose one.</p>
            {atlasEntries.map((c, i) => (
              <details key={c.id} open={atlasPlace === c.id}>
                <summary onClick={(ev) => { ev.preventDefault(); setAtlasPlace(c.id); }}><Key k={i + 1} /> {c.place.name}</summary>
                <ul>{c.place.atlas.map((line) => <li key={line}>{line}</li>)}</ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="discovery-map">
        <WorldMap map={map_} label="Map with four numbered places to choose from" highlights={highlights} onFeatureClick={onFeatureClick}>
          {(scale) => candidates.filter((c) => !c.ruledOut).map((c) => (
            <Marker key={c.id} at={map_.project(c.place.lonLat)} scale={scale} label={String(c.number)} onClick={() => guess(c.id)} />
          ))}
        </WorldMap>
        <div className="row choices">
          {candidates.map((c) => (
            <button key={c.id} type="button" disabled={c.ruledOut} onClick={() => guess(c.id)}>
              {c.ruledOut ? c.place.name : <>{`Place ${c.number}`} <Key k={c.number} /></>}
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
