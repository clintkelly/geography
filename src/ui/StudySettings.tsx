import { MATH_TOPICS, SKILL_NAMES, type MathSkill, type MathTopic } from '../content/math/generate';
import { PACK } from '../content/pack';
import type { Command, SaveData } from '../engine/game';
import { DEFAULT_STUDY, MIX_CHOICES, type StudySettings as Study } from '../engine/study';

const TOPICS = Object.keys(MATH_TOPICS) as MathTopic[];
const UNITS = PACK.wordUnits ?? [];

const mixLabel = (m: number) => (m === 0 ? 'Off' : `${Math.round(m * 100)}%`);

/** How a child is doing on each math skill and vocabulary unit, from recent answers. */
function progress(save: SaveData) {
  const rows = new Map<string, { right: number; total: number }>();
  for (const a of save.attempts) {
    if (!a.objectiveId.startsWith('math-') && !a.objectiveId.startsWith('word-')) continue;
    const key = a.objectiveId.startsWith('math-') ? a.objectiveId : `word:${UNITS.find((u) => a.objectiveId.startsWith(`word-${u.id}-`))?.id ?? ''}`;
    const row = rows.get(key) ?? { right: 0, total: 0 };
    rows.set(key, { right: row.right + (a.correct ? 1 : 0), total: row.total + 1 });
  }
  return rows;
}

/** Words this child has missed and not yet gotten right since. */
function missedWords(save: SaveData): string[] {
  return Object.entries(save.learning)
    .filter(([id, p]) => id.startsWith('word-') && p.missed)
    .map(([id]) => {
      const unit = UNITS.find((u) => id.startsWith(`word-${u.id}-`));
      return unit ? id.slice(`word-${unit.id}-`.length).replace(/-/g, ' ') : id;
    });
}

/** The parent's math and vocabulary choices for one child. */
export function StudySettings({ save, dispatch }: { save: SaveData; dispatch: (c: Command) => void }) {
  const study: Study = { ...DEFAULT_STUDY, ...save.settings.study };
  const set = (patch: Partial<Study>) => dispatch({ type: 'updateSettings', patch: { study: { ...study, ...patch } } });
  const topics = study.mathTopics?.length ? study.mathTopics : TOPICS;
  const units = study.wordUnits?.length ? study.wordUnits : UNITS.map((u) => u.id);
  const toggle = <T,>(list: readonly T[], item: T, on: boolean) => (on ? [...list, item] : list.filter((x) => x !== item));
  const rows = progress(save);
  const missed = missedWords(save);

  return (
    <section className="panel study-settings">
      <h2>Math and vocabulary (parent)</h2>
      <p className="muted">Math and Words trails can always be picked at camp. You can also mix some into ordinary geography trails.</p>

      <div className="field">Mix into geography trails
        <span className="row">
          {MIX_CHOICES.map((m) => <button key={m} type="button" aria-pressed={study.mix === m} onClick={() => set({ mix: m })}>{mixLabel(m)}</button>)}
        </span>
      </div>
      <label className="field"><input type="checkbox" checked={study.math} onChange={(e) => set({ math: e.target.checked })} /> Mix in math</label>
      <label className="field"><input type="checkbox" checked={study.words} onChange={(e) => set({ words: e.target.checked })} /> Mix in vocabulary</label>

      <h3>Math topics</h3>
      {TOPICS.map((t) => (
        <label key={t} className="field">
          <input type="checkbox" checked={topics.includes(t)} disabled={topics.length === 1 && topics.includes(t)} onChange={(e) => set({ mathTopics: toggle(topics, t, e.target.checked) })} /> {MATH_TOPICS[t].name}
        </label>
      ))}
      <p className="muted">Scout uses multiple choice. Ranger and Expert ask for typed answers, like 3/8 or 1 1/2.</p>

      <h3>Vocabulary units</h3>
      {UNITS.length === 0 && <p className="muted">No word lists yet. Add one with <code>npm run vocab</code>.</p>}
      {UNITS.map((u) => (
        <label key={u.id} className="field">
          <input type="checkbox" checked={units.includes(u.id)} disabled={units.length === 1 && units.includes(u.id)} onChange={(e) => set({ wordUnits: toggle(units, u.id, e.target.checked) })} /> {u.title} <span className="muted">({u.words} words)</span>
        </label>
      ))}

      {rows.size > 0 && (
        <>
          <h3>How it's going</h3>
          <ul className="study-progress">
            {[...rows.entries()].sort().map(([key, r]) => {
              const name = key.startsWith('math-') ? SKILL_NAMES[key.slice(5) as MathSkill] : `Words: ${UNITS.find((u) => `word:${u.id}` === key)?.title ?? 'other'}`;
              return <li key={key}><span>{name}</span><span className={r.right / r.total >= 0.8 ? 'good' : r.right / r.total < 0.5 ? 'weak' : ''}>{r.right} of {r.total} right</span></li>;
            })}
          </ul>
          {missed.length > 0 && <p className="muted">Words to practice: {missed.join(', ')}</p>}
        </>
      )}
    </section>
  );
}
