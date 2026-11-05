import { useState } from 'react';
import type { CreatureType } from '../content/types';
import { FREE_POINTS, type Command, type Companion } from '../engine/game';
import { levelOf, levelProgress, MAX_LEVEL, PATH_INFO, PATH_ORDER, pathOf, STAGE_2_LEVEL } from '../engine/progression';
import { ALL_TYPES, TYPE_INFO, typesOf } from '../engine/types';
import { artUrl, ShinyImg, Sprite } from './art';
import { companionView } from './content';
import { Key } from './keys';
import { playSound } from './sound';
import { TypeBadge, TypeLine } from './TypeGuide';
import { GuideCard, KindTag } from './FieldGuide';
import { guideFor } from '../content/guide';
import { NAMES, SHINY_COLORS, SWATCH, shinyLook, shinyName, type ShinyColor, type ShinyLook } from './shiny';

export type Sort = 'newest' | 'oldest' | 'name' | 'level' | 'type';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'level', label: 'Highest level' },
  { id: 'name', label: 'Name A to Z' },
  { id: 'type', label: 'Type' },
];

/** Sorting and filtering for a big stable. Pure, so it can be tested. */
export function arrange(companions: readonly Companion[], sort: Sort, type: CreatureType | 'all' | 'shiny', search: string): Companion[] {
  const views = companions.map((c, i) => ({ c, i, v: companionView(c) }));
  const text = search.trim().toLowerCase();
  const shown = views.filter(({ v }) => (type === 'all' || (type === 'shiny' ? v.shiny : typesOf(v.species).includes(type))) && (!text || `${v.name} ${v.formName} ${v.species.displayName}`.toLowerCase().includes(text)));
  const by: Record<Sort, (a: (typeof views)[number], b: (typeof views)[number]) => number> = {
    newest: (a, b) => b.i - a.i,
    oldest: (a, b) => a.i - b.i,
    level: (a, b) => b.c.bondXp - a.c.bondXp || a.i - b.i,
    name: (a, b) => a.v.name.localeCompare(b.v.name),
    type: (a, b) => ALL_TYPES.indexOf(a.v.species.type) - ALL_TYPES.indexOf(b.v.species.type) || a.v.name.localeCompare(b.v.name),
  };
  return [...shown].sort(by[sort]).map(({ c }) => c);
}

/** A branching creature's raising so far, and the path it will take at level 5. */
function PathProgress({ c, level }: { c: Companion; level: number }) {
  const lead = pathOf(c);
  if (c.path || level >= STAGE_2_LEVEL) return <span className={`path-tag path-${lead}`}>{PATH_INFO[lead].name} path</span>;
  return (
    <span className="path-progress" title={`At level ${STAGE_2_LEVEL} it follows the path it was raised on most`}>
      <small>At level {STAGE_2_LEVEL} it takes the path it's raised on most:</small>
      {PATH_ORDER.map((p) => <span key={p} className={`path-chip path-${p}${p === lead ? ' path-lead' : ''}`} title={PATH_INFO[p].how}>{PATH_INFO[p].name} {c.raised?.[p] ?? 0}</span>)}
    </span>
  );
}

/** Lets a child pick a shiny's colors: a main color, and an accent for its other parts. */
function ShinyPicker({ c, look, artId, dispatch }: { c: Companion; look: ShinyLook; artId: string; dispatch: (cmd: Command) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="link" onClick={() => setOpen(true)}>Change colors</button>;
  const main = look.a;
  const accent = c.shinyColors ? (look.parts?.[1] ?? null) : null;
  // The colors it was born with, so a child can always get them back.
  const original = shinyLook(c.instanceId);
  const set = (colors: string[]) => { playSound('card'); dispatch({ type: 'setShinyColors', instanceId: c.instanceId, colors }); };
  const row = (label: string, value: ShinyColor | null, pick: (x: ShinyColor | null) => void, none?: string) => (
    <div className="swatch-row" role="group" aria-label={label}>
      <span className="muted">{label}</span>
      {none && <button type="button" className="swatch swatch-none" aria-pressed={value === null} aria-label={none} title={none} onClick={() => pick(null)}>✕</button>}
      {SHINY_COLORS.map((x) => <button key={x} type="button" className="swatch" style={{ background: SWATCH[x] }} aria-pressed={value === x} aria-label={NAMES[x]} title={NAMES[x]} onClick={() => pick(x)} />)}
    </div>
  );
  return (
    <div className="shiny-picker">
      {row('Main color', main, (x) => x && set(accent && accent !== x ? [x, accent] : [x]))}
      {row('Accent color', accent, (x) => set(x && x !== main ? [main, x] : [main]), 'No accent')}
      <button type="button" className="shiny-original" aria-pressed={!c.shinyColors} onClick={() => set([])}>
        <ShinyImg src={artUrl(artId)} look={original} className="sprite" width={32} height={32} />
        <span><strong>Original colors</strong><small>{shinyName(original)}{c.shinyColors ? '' : ' (now)'}</small></span>
      </button>
      <span className="row">
        <button type="button" className="link" onClick={() => setOpen(false)}>Done</button>
      </span>
    </div>
  );
}

/** The creatures a child has befriended. Pass onPick to choose one, or dispatch to allow nicknames and freeing. */
export function Stable({ companions, activeId, teamIds, onPick, dispatch }: {
  companions: readonly Companion[];
  activeId: string;
  /** Everyone chosen for the trip, when choosing a team. */
  teamIds?: readonly string[];
  onPick?: (instanceId: string) => void;
  dispatch?: (c: Command) => void;
}) {
  const [sort, setSort] = useState<Sort>('newest');
  const [type, setType] = useState<CreatureType | 'all' | 'shiny'>('all');
  const [search, setSearch] = useState('');
  const [freeing, setFreeing] = useState<string | null>(null);
  const [guide, setGuide] = useState<Companion | null>(null);
  const list = arrange(companions, sort, type, search);
  const present = new Set(companions.flatMap((c) => typesOf(companionView(c).species)));
  return (
    <div className="stable-wrap">
      {guide && <GuideCard speciesId={guide.speciesId} artId={companionView(guide).artId} onClose={() => setGuide(null)} />}
      {companions.length > 4 && (
        <div className="stable-tools" role="group" aria-label="Sort and filter">
          <input type="search" aria-label="Find a creature by name" placeholder="Find by name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label>Sort <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
          <span className="type-filter">
            <button type="button" aria-pressed={type === 'all'} onClick={() => setType('all')}>All</button>
            {ALL_TYPES.filter((t) => present.has(t)).map((t) => (
              <button key={t} type="button" aria-pressed={type === t} aria-label={`Only ${TYPE_INFO[t].name}`} onClick={() => setType(type === t ? 'all' : t)}><TypeBadge type={t} plain /></button>
            ))}
            {companions.some((c) => c.shiny) && <button type="button" className="shiny-filter" aria-pressed={type === 'shiny'} onClick={() => setType(type === 'shiny' ? 'all' : 'shiny')}>✦ Shiny</button>}
          </span>
          <span className="muted">{list.length === companions.length ? `${companions.length} creatures` : `Showing ${list.length} of ${companions.length}`}</span>
        </div>
      )}
      <ul className="stable">
        {list.map((c, i) => {
          const v = companionView(c);
          const level = levelOf(c.bondXp);
          const body = (
            <>
              <Sprite id={v.artId} size={96} className="idle-sprite" shiny={v.shiny} />
              <strong>{v.name}</strong>{c.bondXp === 0 && !c.freedOnce && <span className="new-tag">NEW!</span>}{v.species.legendary && <span className="legend-tag">★ Legendary</span>}{v.species.egg && <span className="egg-tag">🥚 Egg-only</span>}{v.shiny && <span className="shiny-tag">Shiny: {shinyName(v.shiny)}</span>}
              {c.nickname && <span className="muted">{v.formName}</span>}
              <KindTag speciesId={c.speciesId} />
              <TypeLine species={v.species} />
              <span className="muted">Level {level}</span>
              {v.species.paths && <PathProgress c={c} level={level} />}
              <span className="move-list"><span>{v.species.moves.attack}</span><span>{v.species.moves.guard}</span><span className="move-special">{v.species.special.name}</span></span>
              <span className="xp-track" role="img" aria-label={level >= MAX_LEVEL ? 'Maximum level' : `${Math.round(levelProgress(c.bondXp) * 100)} percent to the next level`}><span className="xp-fill" style={{ width: `${levelProgress(c.bondXp) * 100}%` }} /></span>
            </>
          );
          const active = teamIds ? teamIds.includes(c.instanceId) : c.instanceId === activeId;
          return (
            <li key={c.instanceId}>
              {onPick
                ? <button type="button" className="stable-card" aria-pressed={active} onClick={() => onPick(c.instanceId)}>{i < 9 && <Key k={i + 1} />}{body}</button>
                : (
                  <div className={`stable-card${active ? ' active' : ''}`}>
                    {body}
                    {guideFor(c.speciesId) && <button type="button" className="link guide-link" onClick={() => setGuide(c)}>📖 Field Guide</button>}
                    {dispatch && v.shiny && <ShinyPicker c={c} look={v.shiny} artId={v.artId} dispatch={dispatch} />}
                    {dispatch && <input aria-label={`Nickname for ${v.formName}`} placeholder="Add a nickname" maxLength={20} value={c.nickname ?? ''} onChange={(e) => dispatch({ type: 'renameCompanion', instanceId: c.instanceId, nickname: e.target.value })} />}
                    {dispatch && companions.length > 1 && (freeing === c.instanceId
                      ? (
                        <div className="free-confirm">
                          <p>Set {v.name} free? It goes back to the wild, keeps its level, and you can call it back any time.{c.freedOnce ? '' : ` You get +${FREE_POINTS} Trail Points for your next trail.`}</p>
                          <button type="button" className="primary" onClick={() => { setFreeing(null); playSound('free'); dispatch({ type: 'freeCompanion', instanceId: c.instanceId }); }}>Set free</button>
                          <button type="button" onClick={() => setFreeing(null)}>Keep</button>
                        </div>
                      )
                      : <button type="button" className="link" onClick={() => setFreeing(c.instanceId)}>Set free</button>)}
                  </div>
                )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Creatures set free. Calling one back is always free. */
export function Wild({ wild, dispatch }: { wild: readonly Companion[]; dispatch: (c: Command) => void }) {
  if (wild.length === 0) return null;
  return (
    <section className="panel">
      <h2>In the wild: {wild.length}</h2>
      <p className="muted">Creatures you set free. They still count as found, and they come back whenever you call.</p>
      <ul className="stable wild">
        {wild.map((c) => {
          const v = companionView(c);
          return (
            <li key={c.instanceId}>
              <div className="stable-card">
                <Sprite id={v.artId} size={64} className="idle-sprite" shiny={v.shiny} />
                <strong>{v.name}</strong>
                <span className="muted">Level {levelOf(c.bondXp)}</span>
                <button type="button" onClick={() => { playSound('recall'); dispatch({ type: 'recallCompanion', instanceId: c.instanceId }); }}>Call back</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
