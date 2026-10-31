import { useMemo, useState } from 'react';
import { PACK } from '../content/pack';
import type { Command, Expedition } from '../engine/game';
import { place } from './content';
import { Marker, WorldMap } from './WorldMap';

export function Discovery({ e, dispatch }: { e: Expedition; dispatch: (c: Command) => void }) {
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [atlasPlace, setAtlasPlace] = useState<string | null>(null);

  const clues = e.clueIds.slice(0, e.cluesShown).map((id) => PACK.clues.find((c) => c.id === id));
  const lastGuess = e.guesses.at(-1);

  const candidates = e.candidateIds.map((id, i) => ({ id, number: i + 1, place: place(id), ruledOut: e.guesses.includes(id) }));
  const highlights = useMemo(() => {
    const map: Record<string, 'candidate' | 'ruledOut' | 'atlas'> = {};
    for (const c of candidates) map[c.place.isoNumeric] = c.ruledOut ? 'ruledOut' : 'candidate';
    if (atlasPlace) map[place(atlasPlace).isoNumeric] = 'atlas';
    return map;
  }, [e.guesses, atlasPlace]); // eslint-disable-line

  const guess = (locationId: string) => dispatch({ type: 'guess', locationId });
  const onCountryClick = useMemo(() => (iso: string) => {
    const hit = e.candidateIds.find((id) => place(id).isoNumeric === iso);
    if (hit) dispatch({ type: 'guess', locationId: hit });
  }, [e.candidateIds, dispatch]);

  const openAtlas = () => {
    setAtlasOpen(true);
    dispatch({ type: 'useAtlas' });
  };

  return (
    <div className="discovery">
      <section className="panel clues">
        <h1>Where was it seen?</h1>
        {clues.map((c, i) => <p key={c?.id} className="clue"><span className="muted">Clue {i + 1}</span>{c?.text}</p>)}
        {lastGuess && <p className="correction" role="status">Not yet: that was {place(lastGuess).name}. Check the clues and try another place.</p>}
        <div className="row">
          {e.cluesShown < e.clueIds.length && <button type="button" onClick={() => dispatch({ type: 'revealClue' })}>Another clue</button>}
          <button type="button" onClick={openAtlas}>Open atlas</button>
        </div>
        {atlasOpen && (
          <div className="atlas">
            <h2>Atlas</h2>
            {candidates.map((c) => (
              <details key={c.id} onToggle={(ev) => { if (ev.currentTarget.open) setAtlasPlace(c.id); }}>
                <summary>{c.place.name}</summary>
                <ul>{c.place.atlas.map((line) => <li key={line}>{line}</li>)}</ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="discovery-map">
        <WorldMap label="World map with four numbered places to choose from" highlights={highlights} onCountryClick={onCountryClick}>
          {(scale) => candidates.filter((c) => !c.ruledOut).map((c) => (
            <Marker key={c.id} lonLat={c.place.lonLat} scale={scale} label={String(c.number)} onClick={() => guess(c.id)} />
          ))}
        </WorldMap>
        <div className="row choices">
          {candidates.map((c) => (
            <button key={c.id} type="button" disabled={c.ruledOut} onClick={() => guess(c.id)}>
              {c.ruledOut ? c.place.name : `Place ${c.number}`}
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="link leave" onClick={() => dispatch({ type: 'abandon' })}>Leave expedition</button>
    </div>
  );
}
