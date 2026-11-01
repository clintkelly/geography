# Atlaswild MVP Engineering Plan

Implements `docs/PRD.md` v0.4. The PRD owns product behavior; this document owns how it gets built and in what order. Section references (§) point to the PRD.

## Status

| Milestone | State |
| --- | --- |
| 1. Core loop | Done; the children enjoyed it |
| 2. Foundations: backup, profiles, combat choices, US data, difficulty | Built; awaiting fact review and a playtest |
| 3. The Hunt: trails, points, Field Notes | Next |
| 4. Growth: full stable, levels, evolution | Not started |
| 5. Learning and parent tools | Not started |
| 6. Polish and playtest | Not started |

Keyboard shortcuts shipped after Milestone 1 through `useKeys` in `ui/keys.tsx`, and the smoke test plays a keyboard-only expedition. Every new screen must bind its keys and show hints (PRD acceptance 28).

**Gate:** each milestone ends with the children playing it, and their reaction may reorder the next one. Milestone 3 is the one to watch: it decides whether the Carmen Sandiego loop works.

**Why this order:** backup comes first to protect real saves. Profiles follow because every later feature writes per-child data, and each schema change after real play has to be migrated. The Hunt comes before the Stable because points and clues are the riskiest design idea, and evolution means little until expeditions are worth repeating.

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

1. **One transition function.** Every change goes through `reduce`. An invalid or repeated command returns the same object, and an unchanged object is not saved. This also protects purchases from double charging.
2. **Write before render.** `useGame` updates a ref synchronously and renders only after the IndexedDB write. A reload mid-animation can't replay a turn.
3. **One record, one transaction.** Each profile's save is a single record, so an answer, its stop status, and rewards commit atomically. Nothing in a turn crosses profiles.
4. **Snapshots in battle state.** A battle stores its question with options in display order, so a content update can't change a saved turn.
5. **Randomness is data.** RNG state lives in the save.

`game.ts` will outgrow one file. Split it in Milestone 3 into `expedition.ts`, `economy.ts`, and `progression.ts`, keeping one exported `reduce`.

## Content model

The largest design change is moving from hand-written questions to reviewed records plus templates. Fifty states across three difficulties and several question types is well over 500 questions, which is too many to review one by one.

```ts
interface StateRecord {
  id: string;                 // 'california'
  name: string;
  postal: string;
  fips: string;               // joins to us-atlas geometry
  capital: string;
  sameStateCities: string[];  // real, kid-familiar, never the capital
  largestCity: string;
  nickname: { text: string; status: 'official' | 'unverified'; others: string[] };
  facts: string[];
}
```

- `content/us/west.json` holds the first region; other regions follow as their own files, so review happens in batches.
- `content/us/templates.ts` turns records into `Question` objects at load time, with stable IDs such as `q-capital-california-ranger-1`.
- The existing `Question` shape and `pickQuestion` keep working, so combat and saves need no knowledge of templates.
- Distractors are chosen deterministically per template and difficulty, and the validator runs over every generated question.

Validator rules for §8: same-state cities exclude the capital, the largest city is offered, and every option list has one answer. Still to add with Field Notes in Milestone 3: per-fact sources, neighbor data for trail adjacency, and a `reviewed` gate. Nearby wrong answers currently come from the distance between states, which works without neighbor data.

## Milestone 2: Foundations

Task 1 ships first and on its own, so real saves are protected before any migration runs. Tasks 2 and 3 follow in order; the rest can run in any order.

| # | Work | Main files | Size |
| --- | --- | --- | --- |
| 1 | Backup: export the save to a JSON file, and restore one with a schema check and confirmation | `persistence/`, `ui/` | S |
| 2 | Schema v2: one IndexedDB record per profile plus a small household record, with a tested v1 migration. Keep souvenirs and counts; end any in-progress v1 expedition cleanly | `game.ts`, `store.ts` | M |
| 3 | Profile select and quick switching | `ui/` | S |
| 4 | Guard, Special templates, charge, and block; §6 enemy pattern restored; Slatepaw gets a Special | `combat.ts`, `Battle.tsx`, `pack.ts` | M |
| 5 | Generalize `WorldMap` to a map definition, and add a US map with `us-atlas` and AlbersUsa, including Alaska and Hawaii insets | `ui/`, new `content/maps` | M |
| 6 | `StateRecord`, templates, and validator | `content/us/` | M |
| 7 | State records for the West, as the first reviewed batch | `content/us/states/west.json` | M, mostly review |
| 8 | Difficulty on questions: Scout, Ranger, Expert, plus a choice on the outing card and a click-the-state input type | `questions.ts`, `Battle.tsx` | M |
| 9 | Parent difficulty limits, in a minimal settings screen | `ui/` | S |
| 10 | Sound: `playSound(id)` wrapper, mute and volume per profile, first effects, and a dev page that plays each one | new `ui/sound.ts`, `public/sfx` | S |

Tests: backup round trip and rejected bad files (13), migration from a real v1 save (14), profile isolation (1), §6 as a table-driven combat test (3), keyboard bindings for Guard and Special (28), same-state options (10), no two correct answers (11), nickname status (12), map click accuracy after zoom (8), and sound settings per profile with a failed sound not interrupting play (27).

Decision for the migration: both children get a full copy of the Milestone 1 save, because they played it together. The original v1 record stays in IndexedDB and is included in backups.

**Exit:** both children play on Western states at a difficulty of their choice, make real choices in combat, and have a backup of their saves.

## Milestone 3: The Hunt

| # | Work | Main files | Size |
| --- | --- | --- | --- |
| 1 | Replace `slots` with `stops`: trail generation over state adjacency within a region | `expedition.ts` | L |
| 2 | Clue generation from records, per target and difficulty, without leaks | `expedition.ts`, `content/` | M |
| 3 | Trail Points: balance, spend, earn, conversion, and an idempotent purchase ID | `economy.ts` | M |
| 4 | Prep Shop screen and effects | `ui/`, `game.ts` | M |
| 5 | Stop screens: paid clues, Narrow the search, Expert free-click | `Discovery.tsx` | M |
| 6 | Journey events: six templates | `content/`, `ui/` | M |
| 7 | Field Notes in the feedback panel | `Battle.tsx` | S |
| 8 | State Cards and album, with first-award idempotency | `game.ts`, `Camp.tsx` | M |
| 9 | Sighting targets as rewards; souvenirs move to stop finds | `expedition.ts` | S |
| 10 | Pass 1 art: about 10 card illustrations for the West | `public/art` | S |
| 11 | Befriend phase: when the target reaches 0 HP, a question loop with no enemy attacks or turn limit; adds the creature idempotently | `expedition.ts`, `Battle.tsx` | M |
| 12 | Simple stable: see owned creatures and choose one before departure | new `ui/Stable.tsx` | S |
| 13 | Art: sprites for about 4 huntable species | `public/art` | S |

Tests: trails stay adjacent, 0-point completion (19), purchases don't double charge (4), assisted recording (20), no purchase can answer a question (21), card awarded once (22), Befriend can't fail or duplicate (29), combat rules unchanged by Befriend.

**Exit:** a Standard trail is fun for its whole length, the children make real choices about points, and befriending a creature feels like a catch.

## Milestone 4: Growth

| # | Work | Main files | Size |
| --- | --- | --- | --- |
| 1 | Combat reads companion stats, and opponents scale by stage | `combat.ts`, `game.ts` | S |
| 2 | Full stable: creature details, nicknames, level and stage display | `ui/Stable.tsx` | M |
| 3 | XP, levels, and idempotent stop awards | `progression.ts` | M |
| 4 | Evolution: thresholds, stat changes, one-time celebration | `progression.ts`, `ui/` | M |
| 5 | Species data for 12 species; 3 starters | `content/` | S |
| 6 | Art: first 6 species, 3 stages each, using reference images | `public/art` | M |
| 7 | Rival Hunts when new species run out | `expedition.ts` | S |

Tests: minimum 3 correct answers at every stage (24), evolution once (23), XP can't be farmed (4), honest Rival Hunts (25).

**Exit:** the children care which companion they take, and they want to evolve one.

## Milestone 5: Learning and parent tools

| # | Work | Main files | Size |
| --- | --- | --- | --- |
| 1 | Records for Midwest, South, and Northeast, in reviewed batches | `content/us/states` | L, mostly review |
| 2 | Learning module: progress, schedule, per-difficulty familiarity, retry after misses | new `engine/learning.ts` | M |
| 3 | Selection by need, replacing the coin flip | `questions.ts` | S |
| 4 | Study cards | `ui/` | S |
| 5 | Parent view | new `ui/Parent.tsx` | M |
| 6 | Import preview of affected profiles, confirmed reset | `persistence/` | M |
| 7 | Compact old attempts | `game.ts` | S |

The clock enters learning only through the `now` argument. "Calendar days" use the device's local date.

**Exit:** the content is accurate across all 50 states, and the parent can see what each child needs.

## Milestone 6: Polish and playtest

- Remaining State Card and creature art.
- Lazy-load maps so camp opens instantly. The bundle is already over 500 kB because of the 50m world geometry.
- Reduced-motion audit, the real tablet, keyboard pass.
- Observation across several days, then balance changes before any new content.

**Exit:** both children play independently, understand their mistakes, and find a reason to return.

## Art budget

| Batch | Approximate generations |
| --- | --- |
| Creatures, 12 species × 3 stages | 36–70, allowing for rejects |
| State Cards, 50 | 50–80 |
| Backdrops and events | 15–25 |
| Total | About 100–175 of the 2,000 monthly allowance |

Generation cost isn't a constraint. Jobs are limited to 8 concurrent, so batches need waiting. Evolved forms are the riskiest art, so try one full species before generating the set.

## Sound budget

First set: five effects in `public/sfx`, listed in `docs/sound-manifest.json`, about 0.3 cents per take (4 takes per request). ElevenLabs ignores length requests and often pads silence, so measure each take's waveform and set its stop point in `ui/sound.ts`. Some takes are nearly silent. A person approves them at `?sounds`.

Connect the ElevenLabs hosted MCP server, then confirm that it offers a sound effects tool. If not, fall back to the older local server. Generate one or two effects first and check the credit cost before making the full set of about 15. Sound IDs live in the UI layer, triggered from state changes after the save, so effects never touch engine rules. Claude can't hear the results, so a person approves them on the dev page.

## Testing

| Layer | Tool | Covers |
| --- | --- | --- |
| Rules | Vitest | Combat, trails, economy, progression, idempotency, selection |
| Content | Vitest | Every generated question and clue, for all difficulties |
| Persistence | Vitest with fake-indexeddb | Resume, migrations, schema rejection |
| Whole loop | Playwright (`npm run smoke`) | One real trail, including reloads and double clicks |
| Visual | Screenshots, reviewed by eye | Map framing and layout. Milestone 1's map cropping passed the automated run and was only caught this way |
| Fun | The children | Everything else (§15) |

Before starting a milestone, add its §14 acceptance items as named tests. Automated checks can prove that a record is consistent, not that a fact is true, so facts need human review.

## Risks

| Risk | Mitigation |
| --- | --- |
| 50 state records are a large fact-checking job | Regional batches, source URLs on each fact, and a `reviewed` gate; playable after the first region |
| Points punish the children who need the most help | §5 fairness rules; free atlas; watch this in playtest |
| Field Notes add reading that slows play | No extra click; can be skipped by pressing Continue |
| Standard trail feels too long | Short trail stays available; expeditions pause between stops |
| Stat growth makes questions unnecessary | Stage-scaled opponents and a tested minimum of 3 correct answers |
| Economy has a dominant strategy | Numbers live in one config; watch what they buy |
| Clearing browser data destroys progress | Backup and restore ship first in Milestone 2; remind the parent to export now and then |
| Pokémon-derived names or art slip in | §1 rule; check prompts and names at review |
| Schema changes break a child's real save | Tested migrations from v2 onward; unsupported versions refused and left untouched |

## Later: hosting

The children will eventually play from several devices on a hosted server. This is a future milestone, roughly the tenth, and nothing is built for it now. A server-side `SaveStore`, accounts, sync, and a real database such as SQLite or Postgres come then.

What already helps, at no extra cost: storage sits behind `SaveStore`, game rules are a pure function, IDs are generated rather than name-based, and saves are versioned and migrated. Per-profile records let each child's save move independently.

## Decisions already made

- **Hosting is refactored later.** The only concession now is per-profile save records in schema v2.
- **Befriending is a question loop, not a chance roll.** It sits in the expedition layer, so `combat.ts` stays subject-agnostic and unchanged.
- **Sound effects are pre-generated files**, not live API calls. Background music is deferred.
- **Creatures stay original** (§1).
- **Trail Points are per-expedition**, not a persistent currency, so a bad run can't hurt the next one.
- **Reward is the creature you hunted**, so every expedition has one clear goal.
- **Questions come from reviewed records plus templates**, not hand-written lists.
- **The US map uses `us-atlas`**, alongside `world-atlas` for Europe.
- **Enemy pattern stays 1, 2, 2 until Guard and Special ship** in Milestone 2, then moves to the PRD's values.
- **Backup comes before the schema migration**, and includes a restore, because a backup can't be used without one.
