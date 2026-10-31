# Atlaswild MVP Engineering Plan

Implements Creature Expedition Game PRD v0.3 (October 31, 2026). The PRD owns product behavior; this document owns how it gets built and in what order. Section references (§) point to the PRD.

## Status

| Milestone | State |
| --- | --- |
| 1. Prove the core loop | Done, awaiting a playtest with the children |
| 2. Complete the game mechanics | Not started |
| 3. Complete the educational experience | Not started |
| 4. Polish and playtest | Not started |

**Gate:** don't start Milestone 2 until a child has played Milestone 1. The PRD's central test is whether a full short expedition is fun, and the answer may change Milestone 2's priorities.

## Architecture

```
src/
  engine/       Pure TypeScript rules. No React, no storage, no clock, no Math.random.
    game.ts       reduce(save, command, pack, now): every state transition
    combat.ts     Turn resolution. Knows nothing about questions or subjects
    questions.ts  Selection, stable shuffling, evaluation
    rng.ts        Seeded RNG whose state is stored in the save
  content/      Pack data, types, validation. All geography lives here
  persistence/  SaveStore interface and its IndexedDB implementation
  ui/           React. Renders state and dispatches commands; holds no rules
public/art/     Accepted PixelLab exports
scripts/        Browser smoke test
```

The rules that carry the PRD's reliability requirements:

1. **One transition function.** Every change goes through `reduce`. An invalid or repeated command returns the same object, and an unchanged object is not saved. That is the whole double-click and duplicate-reward defense (§10, acceptance 4 and 16).
2. **Write before render.** `useGame` holds the latest state in a ref and updates it synchronously, then renders only after the IndexedDB write. A reload mid-animation can't replay a turn.
3. **One record, one transaction.** The save is a single record, so an answer, its slot status and its rewards commit atomically without multi-store transactions.
4. **Snapshots in battle state.** A battle stores its question with options in display order, so a content update can't change a saved turn (§10).
5. **Randomness is data.** RNG state lives in the save, so the same state and commands always give the same result.

Keep the single-record save for the MVP. Household data is small; the only pressure on it is unbounded `attempts`, handled in Milestone 3.

## Milestone 2: game mechanics

Do the first three in order; each depends on the previous one. The rest can run in any order.

| # | Work | Main files | Size |
| --- | --- | --- | --- |
| 1 | Schema v2: `{ profiles: Record<id, ProfileSave>, activeProfileId }`, with a real v1 migration and test | `game.ts`, `store.ts` | M |
| 2 | Profile select and quick switching, with display names and avatars for the children | `ui/` | S |
| 3 | Guard, Special (three templates), charge, block, per-action wrong-answer rules; restore the §5 enemy pattern | `combat.ts`, `Battle.tsx` | M |
| 4 | Six species and three starters, with Special templates and a starter choice | `pack.ts`, `Camp.tsx` | S |
| 5 | Deterministic rewards: creature/souvenir alternation, committed at start, advancing on completion | `game.ts` | S |
| 6 | Companion selection, bond XP per slot, bond levels, journal badges, nicknames | `game.ts`, `Camp.tsx` | M |
| 7 | Two outing offers from three route templates, replacing the single generated route | `game.ts`, `content/` | M |
| 8 | Temporary bonus choice after battle 1: Extra Charge or Sturdy Spirit | `game.ts`, `Route.tsx` | S |
| 9 | Fixed tutorial first session with a guaranteed unowned species | `game.ts` | S |

Tests to add: Section 5's balance table as a table-driven combat test, profile isolation (acceptance 1), slot XP that can't be farmed (16), bonus expiry (15), XP fallback after both pools empty (17).

**Exit:** each child completes several expeditions without affecting the other's save, and losses and interruptions preserve outing state.

## Milestone 3: educational experience

| # | Work | Main files | Size |
| --- | --- | --- | --- |
| 1 | Content pipeline: move packs to JSON, add a `reviewed` flag, and refuse unreviewed items in the active pack | `content/` | S |
| 2 | Full pack: 24 objectives, about 72 questions, at least 2 clues per target, atlas entries | `content/` | M, mostly review time |
| 3 | Learning module: objective progress, 1/3/7-day schedule, familiarity rule, same-session retry of misses | new `engine/learning.ts` | M |
| 4 | Selection by need: half local, half due, per the §7 fallback order; replaces the coin flip in `pickQuestion` | `questions.ts` | S |
| 5 | Answer-reveal handling, so repeats shown after a reveal never count as evidence (acceptance 7) | `learning.ts` | S |
| 6 | Optional study cards before encounters | `ui/` | S |
| 7 | Parent view: objective groups, Foundation/Challenge, accuracy with sample size, due and missed objectives | new `ui/Parent.tsx` | M |
| 8 | Export, validated import with preview, confirmed reset | `persistence/` | M |
| 9 | Compact old attempts into per-objective totals so the save stays small | `game.ts` | S |

The clock enters the learning module only through the `now` argument, so scheduling tests need no fake timers. Dates for "two calendar days" use the device's local date.

**Exit:** content is accurate and legible, questions repeat usefully, and the parent can inspect each child's recent learning.

## Milestone 4: polish and playtest

- One more species set, using Slatepaw as a style reference for consistency. Six species total, plus opponent variety if wanted.
- Reduced-motion audit, tablet layout on the actual device, keyboard pass.
- Lazy-load the map so camp opens instantly; precompute Europe paths if the 50m geometry feels slow on the tablet.
- Observation across several days, then balance changes before any new content.

**Exit:** both children play independently, understand why answers were wrong, and find a reason to return.

## Testing

| Layer | Tool | Covers |
| --- | --- | --- |
| Rules | Vitest | Combat, expedition flow, idempotency, selection, content validation |
| Persistence | Vitest with fake-indexeddb | Resume, schema rejection; migrations from Milestone 2 |
| Whole loop | Playwright (`npm run smoke`) | One real expedition including reloads and double clicks |
| Visual | Screenshots, reviewed by eye | Map framing, layout. Milestone 1's map cropping passed the automated run and was only caught this way |
| Fun | The children | Everything else (§14) |

Before starting a milestone, add its acceptance items from §13 as named tests.

## Risks

| Risk | Mitigation |
| --- | --- |
| Clearing browser data destroys progress | Export is Milestone 3 task 8; move it earlier if the children start caring about their collection |
| Six places make clues guessable once memorized | Accepted by the PRD; assisted tracking keeps the data honest. Watch in playtest |
| Marker questions with neighbors (Spain and Portugal) are fiddly on touch | Numbered buttons always work; verify on the tablet |
| Question text is authored by AI | Fixture needs parent review now; the `reviewed` flag enforces it from Milestone 3 |
| Schema changes break a child's real save | Migrations with tests from v2 onward; unsupported versions are refused and left untouched |

## Decisions already made

- **Enemy pattern in Milestone 1 is 1, 2, 2**, not the PRD's 2, 2, 4. With Attack alone, the PRD's numbers make the guardian require a perfect run. Restore them with Guard and Special, then retune by playtest. Change it in `BALANCE` in `engine/game.ts`.
- **The project stays in this `geography` directory** and keeps the provisional Atlaswild name.
- **Geometry comes from the `world-atlas` npm package**, which packages Natural Earth 1:50m data.
- **Question sources use Wikipedia URLs** as a stable, checkable default.

## Milestone 1 differences from the PRD

Built early because they were cheap and made the prototype easier to judge: PixelLab art, map pan and zoom, marker questions, and a retry flow. Reduced to fit: one profile named Explorer, one starter, no tutorial, souvenir rewards only, and a one-button action step that exists so Guard and Special have a place to go. Question selection uses a simple local-question coin flip with spacing rules. Answers are recorded but don't yet drive review.
