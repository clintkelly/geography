# Creature Expedition Game PRD

Version 0.4 • November 1, 2026 • Supersedes v0.3 after the first playtest

Atlaswild is a small browser game for regular practice. The children choose a companion from their stable, follow a fleeing creature from state to state, spend limited Trail Points on clues and preparation, win quiz-powered encounters, and bring new creatures home. Companions grow and evolve over many expeditions. US states are the first full content pack.

**Working title:** Atlaswild (provisional, not a checked commercial name).

## What changed in v0.4

The children liked Milestone 1. The owner asked for longer journeys, harder question options, US states first, fact cards after correct answers, a Carmen Sandiego metagame with spendable points, a stable of companions, and power-ups and evolution.

| Topic | v0.3 | v0.4 |
| --- | --- | --- |
| Content | World basics and six European countries | 50 US states first; Europe stays as a smaller second pack |
| Expedition | Find one place, then three battles | Follow a creature across 3, 5, or 7 stops, with a place to find at each stop |
| Length | 10–15 minutes | About 20–25 minutes by default, with a short option |
| Difficulty | Foundation or Challenge, set by the parent | Scout, Ranger, Expert, chosen per expedition within parent limits |
| Investigation | Free, no currency | Trail Points buy clues and preparation; the atlas stays free |
| Correct answers | Short explanation | Field Note, with collectible illustrated State Cards |
| Reward | A previewed creature or souvenir | Befriend the creature you hunted; souvenirs are stop finds |
| Companion growth | Bond XP, cosmetic only | Levels, bounded stat growth, and evolution in three stages |
| Mid-route bonus | Choose one of two | Replaced by the pre-departure Prep Shop and trail purchases |

## 1 Product direction

The children are explorers tracking curious creatures across real places. The tone is adventurous, warm, and suitable for children without feeling preschool-oriented.

- **Carmen Sandiego** supplies the core loop: read clues, research, decide where to go, and manage a limited budget. Clues are factual and reusable, so no authored mystery is needed per session.
- **Creature-collecting games** supply the stable, growth, and evolution. All creatures, names, lore, interface, sound, and recruitment effects are original.
- **Roguelites** supply repeatable outings, varied routes, and small build choices, without permadeath or loss of collected creatures.
- **Oregon Trail** supplies journey events along the way.

### Intellectual property rule

Do not use Pokémon names, characters, art, sounds, terminology, or recognizable imitations, including in PixelLab prompts. Do not use capture devices or screen layouts copied from those games. General mechanics such as collecting, leveling, and evolving are fine. The word "creature" or "companion" is used in the game and in code.

### The design test

Does a child enjoy a complete expedition and want to return on a later day? And do they later answer what they previously missed, without help? Elaborate systems cannot substitute for either.

## 2 Users and assumptions

- The children each have a persistent, independent profile. Progress, stable, points, and learning records never mix.
- The parent chooses content, sets difficulty limits, and reviews what each child finds easy or difficult.
- Age does not determine access or imply an ability level.
- The default expedition takes about 20–25 minutes and 20–28 answers. These are playtest targets, not timers. An expedition can be paused after any answer, and suspending is distinct from abandoning.
- There are no streaks, missed-day penalties, expiring rewards, daily lockouts, or midnight resets.
- Platform: desktop or laptop browser, with touch-friendly controls and a usable landscape tablet layout.
- Saves live in the current browser on the current device, with no accounts or sync. Export and import provide manual backup. Revisit this if the children must move between devices.

## 3 MVP scope

| Area | Include |
| --- | --- |
| Profiles | One per child, name/avatar, independent saves, quick switching |
| Content | All 50 US states in four regions, 44 European countries, and a question for every Field Note |
| Exploration | US map with all states; Europe map for the second pack |
| Expedition | Trails of 3, 5, or 7 stops following a target creature |
| Difficulty | Scout, Ranger, Expert, with parent limits per profile |
| Points | Per-expedition Trail Points, Prep Shop, paid clues, trail items |
| Stops | Find-the-place step, then a battle or a journey event; final showdown with a Befriend moment |
| Combat | One against one, Attack, Guard, charged Special, visible enemy intent |
| Stable | 15 species themed by region, including The Bark Knight, one companion per expedition |
| Growth | Levels, three evolution stages, bounded stat growth |
| Knowledge rewards | Field Notes on correct answers, 50 collectible State Cards |
| Collection | Journal of creatures, souvenirs, and State Cards |
| Learning | Review scheduling, per-difficulty familiarity, study cards |
| Parent view | Content and difficulty limits, accuracy, review needs, backups |
| Sound | About 15 short original effects, with mute and volume per profile |
| Persistence | Autosave, resume, schema migration, export and import |

**Outside MVP:** free walking, tile collisions, interiors, NPC dialogue trees, authored multi-stage mysteries, breeding, trading, type-effectiveness charts, multiple active creatures, equippable loot, permanent shops, live AI-generated questions, an in-app content editor, cloud accounts, multiplayer, co-op, leaderboards, and mobile packaging.

Do not implement deferred features as empty frameworks or disabled screens.

## 4 Expeditions

### A typical session

1. **Camp.** Select a profile, then resume an expedition or choose one of two sightings. Each shows the target's silhouette, trail length, region, and difficulty.
2. **Stable.** Choose a companion. It stays for the whole expedition.
3. **Prep Shop.** Receive the expedition's Trail Points and optionally spend some on preparation. Whatever remains funds clues on the trail.
4. **The trail.** At each stop, use clues to work out where the creature went, travel there, and resolve that stop.
5. **Final showdown.** Reach the target, wear it down in a slightly longer encounter, and befriend it.
6. **Return.** The creature joins the stable. See a brief summary and go back to camp.

Unlocked regions and trail lengths come from the profile's enabled content, not a linear unlock sequence. There is no limit on expeditions per day.

### Trail length

| Trail | Stops | Encounters | Approximate answers | Approximate time |
| --- | --- | --- | --- | --- |
| Short | 3 | 2 battles, final | 12–15 | 12–15 minutes |
| Standard (default) | 5 | 3 battles, 1 event, final | 20–28 | 20–25 minutes |
| Long | 7 | 4 battles, 2 events, final | 30–38 | 30–35 minutes |

Added length comes from more stops and more variety, never from longer battles. The expedition saves between stops. The child can leave at any time; finds and XP already earned stay earned, while the target creature requires finishing.

### Finding the next place

The hunt visibly moves: "It left Sacramento heading east." Each stop presents a clue about the next state, built from reviewed facts such as a nickname, capital, neighbor, landmark, or State Card fact.

The child may act on what they know, use the atlas, or buy another clue. Keep this step to one or two minutes in ordinary play.

| Difficulty | How the place is chosen |
| --- | --- |
| Scout | Four highlighted candidates |
| Ranger | Four candidates, close together, without highlighting neighbors of the answer as obvious outliers |
| Expert | Choose any state on an unlabeled map |

A wrong guess costs 1 Trail Point when the child has one, gives a useful correction, and allows another try. It never blocks progress. At 0 points the next clue after a wrong guess is free, so no child can get stuck.

Success counts as assisted when the child used the atlas, bought a clue, or saw correction first. Assisted success still earns everything, but it is not unaided evidence of mastery.

The target and route stay hidden until revealed. Rewards, illustrations, and accessibility labels must not disclose answers. Select the target state first, then choose clues and candidates from reviewed records. Save all selections with the expedition.

### Journey events

An event is a short non-combat stop, one screen and one or two answers. Examples: a washed-out bridge where a correct answer finds a shortcut worth Trail Points, a helpful ranger who offers a clue for a small fee, or a campfire that restores a little HP. A wrong answer never ends the expedition. Launch with about six reusable templates.

### Losing and retrying

If a battle is lost, the companion retreats safely. Route, Trail Points, purchased items, and earlier progress remain. The child can study and retry that stop; a retry may draw different questions. Companions never disappear or die.

## 5 Trail Points

Trail Points are the budget that makes each expedition a series of decisions. They are per-expedition: a new expedition starts fresh, so saving up isn't required and nothing can be hoarded or lost permanently.

These values are starting points for playtesting.

| Setting | Default |
| --- | --- |
| Starting points | 10 |
| Earned per stop won | 1 |
| Field Note check bonus | 1 |
| Leftover at the end | Converts to 1 companion XP per point |

| Purchase | Cost | When | Effect |
| --- | --- | --- | --- |
| Sturdy Spirit | 4 | Prep Shop | +2 maximum HP this expedition |
| Extra Charge | 4 | Prep Shop | Start each battle with 1 charge |
| Trail Snack | 2 | Prep Shop, carried | Restore 4 HP once during a battle, as a free action |
| Extra clue | 2 | At a stop | Reveals another clue |
| Narrow the search | 3 | At a stop, Scout and Ranger | Removes two wrong places |

**Fairness rules.** These rules prevent the points system from taxing the children who need the most help.

- The atlas is always free. Research is the skill being taught.
- Every stop gives its first clue free.
- No purchase can answer a battle question.
- Points never affect learning records, other than marking help as assisted.
- Rewards never depend on how many points remain, beyond the small XP conversion.
- The child can always finish at 0 points.

## 6 Battles

### Presentation

A simple scene shows the companion, opponent, HP, charge, and the opponent's next attack, with large action buttons and a question panel beneath. The child chooses an action, then sees the question. A correct answer activates it. A wrong answer gives a concise explanation, and the opponent still acts. There is no response timer and no speed reward.

### Balance defaults

| Setting | Default |
| --- | --- |
| Enemy attack sequence | 2, 2, 4, repeating; shown before the player chooses |
| Attack, correct | Companion Attack damage; gain 1 charge |
| Guard, correct | 1 damage; block up to 3; gain 1 charge |
| Guard, wrong | No damage; block 1 |
| Attack, wrong | No damage or charge |
| Charge | Starts at 0; maximum 2; Special needs 2 |
| Offensive Special, correct | Attack + 2 damage |
| Healing Special, correct | 2 damage; restore 4 HP, capped at maximum |
| Protective Special, correct | 2 damage; block up to 4 |
| Special cost | 2 charge on a correct answer; earns no charge |
| Special, wrong | No effect; retain charge |
| Length limit | 8 questions; 10 for the final showdown |

Resolve the player's action first. If it defeats the opponent, the opponent does not attack. Otherwise resolve the enemy action, then check HP and the length limit. Blocks expire after the enemy turn. HP cannot fall below zero. A successful final allowed turn counts as victory.

HP and charge reset at each encounter, then Prep Shop effects apply.

### Befriending

The catch is its own moment. When the hunted creature's HP reaches 0 in the final showdown, it stops attacking and the only action becomes **Befriend**.

- A correct answer befriends the creature, and it joins the stable.
- A wrong answer shows the correct answer and offers a new question. Nothing is lost, and the child can keep trying.
- There is no random failure, no capture device, and no turn limit in this phase.
- Befriend questions count as normal learning attempts.
- Rival Hunts have no Befriend step, because the creature is already owned.

### Opponent scaling

Opponents scale with the companion's evolution stage, so growth feels good without removing the questions.

| Companion stage | Max HP | Attack | Regular HP | Final HP |
| --- | --- | --- | --- | --- |
| 1 | 12 | 3 | 10 | 14 |
| 2 | 14 | 4 | 12 | 16 |
| 3 | 16 | 5 | 15 | 20 |

A battle should take at least 3 correct answers at any stage. Growth may shorten a battle slightly but must not remove practice. Trail difficulty does not change combat numbers, because learning difficulty and combat difficulty stay independent.

### Feedback and timing

An answer is final for that turn. Show the correct answer and a short explanation, plus a Field Note when correct, in large text, then let the child continue. Each creature has attack, guard, special, and hit poses. A turn swaps poses with short lunges, shakes, and sounds, and lasts under two seconds. Hit and block sounds are deep, retro 8-bit punches. Hits show floating damage numbers, a brief freeze and flash, a screen shake, sparks, and HP bars that drain with a pale trail. Correct answers build a streak with a rising chime and bigger-looking hits; a streak is for show and changes no numbers. Final showdowns open with a VS intro, a beaten opponent slides away, and befriending has its own celebration. Reduced motion removes the movement and flashing but keeps poses, numbers, and sounds. The result text appears at once, and Continue never waits for the animation. Do not slow-print text or require several acknowledgements for one result.

Persist the resolved turn before animating. Reloading must not submit an answer or resolve a turn twice.

## 7 The stable and evolution

### Stable

- Launch with up to 12 original species across habitats such as mountain, coast, forest, desert, and plains. Three are starters; the rest are found by hunting.
- A profile may hold every species it has befriended. Duplicates are not needed: a sighting offers species the profile doesn't own, and once all are owned, sightings become Rival Hunts that award XP and a badge. Never imply an unlimited supply of new creatures.
- Each owned companion has an instance ID, optional nickname, level, and XP.
- One unowned souvenir can be found on each trail, on the second battle win.
- Companions are chosen before an expedition. In-battle switching is deferred.
- A companion left in the stable gains no XP, which makes choosing meaningful. A companion's level never falls.

### XP and levels

| Event | XP |
| --- | --- |
| First win of each battle stop | 10 |
| Finishing an expedition | 20 |
| Leftover Trail Point | 2 |

Expert trails give 1.5 times XP and Ranger 1.25 times, so harder choices pay off without being required. Reaching level N takes 20 × (N − 1) more XP after level N − 1. Maximum level is 10. A Standard trail gives roughly 60 XP, so stage 2 takes about 3–4 expeditions and stage 3 about 15 on one companion.

An already-won stop can't give XP again, and neither can a reload or a retry.

### Evolution

Evolved forms use a single sprite, moved by the battle animations, rather than a full set of poses.

- Stage 2 at level 5, stage 3 at level 10.
- Evolution is automatic, celebrated once, and never fails.
- Each stage has its own art and name, and changes stats per the table in Section 6.
- Stage 2 upgrades the Special. Stage 3 adds one small passive, such as starting with 1 charge.
- Some species may have only two stages if art or balance calls for it.

## 8 Learning content

### State record

Every state has one reviewed record, and questions are generated from it by templates. The parent reviews the records rather than hundreds of individual questions.

| Field | Example |
| --- | --- |
| Name, postal code | California, CA |
| Capital | Sacramento |
| Same-state cities | Los Angeles, San Francisco, San Diego |
| Largest city | Los Angeles |
| Nickname and status | The Golden State, official |
| Neighbors, region | Oregon, Nevada, Arizona; West |
| Field Note facts | 3 or more kid-friendly facts |
| Source URLs | One for each fact |

The game calls these "nicknames." Most state nicknames aren't official: Florida's "Sunshine State" is, while New York's "Empire State" is customary. Record the status, or mark it unverified, and never claim a nickname is official unless a source says so. Nicknames are separate from state mottos. Where several nicknames exist, use the best-known one as the answer, and never offer another nickname of the same state as a wrong option.

Other interesting facts, such as state birds and flowers, are candidates for later templates.

### Difficulty

Difficulty is about how close the wrong answers are.

| Question | Scout | Ranger | Expert |
| --- | --- | --- | --- |
| Capital of California? | Sacramento plus capitals of faraway states | Sacramento plus three real California cities | Same, including the largest city, on the states where that is the common mistake |
| Sacramento is in which state? | Faraway states | Neighboring states | Neighboring states, plus reversed prompts |
| Which state is the Golden State? | Name from four distant states | Name from four states in one region | Answer on an unlabeled map |
| Where is California? | Four distant markers | Four nearby markers | Click the state on the map |

Rules for plausible wrong answers:

- A same-state option must really be in that state and must not be its capital.
- Same-state lists use cities a child may have heard of, so hard questions test knowledge rather than obscure trivia.
- Where the capital is also the largest city, such as Phoenix, Boston, or Honolulu, the other options are the next most familiar cities in that state.
- Handle shared names carefully. Kansas City is mostly in Missouri, Charleston is both a West Virginia capital and a South Carolina city, Portland is in Oregon and Maine, Columbus and Columbia differ, and Washington the state differs from Washington, D.C.
- Every option list has one unambiguous answer, and validation enforces it.

The child picks a difficulty on the sighting card. The parent can set the lowest and highest difficulty allowed for each profile. Do not give a child harder questions merely because of age.

### Field Notes and State Cards

After a correct answer, the feedback panel shows a **Field Note**: one or two sentences of something interesting about what the child just answered. It appears in the existing feedback panel and needs no extra click.

The first correct answer about a state also awards its **State Card**, with a pixel-art illustration, nickname, capital, and facts. Facts meant to be remembered use larger text than the rest of the interface. Cards fill a journal album with 50 slots, a second collection that rewards knowledge rather than battles. Wrong answers show the correct answer and a brief explanation, with no card.

Keep creature lore separate from factual content. Fictional creatures appear on cards only as clearly illustrative decoration.

### Field Note recall

Every fact has a question whose answer is that state or country. A child never sees one until they have read its Field Note after a correct answer. About two in five questions then test a note they have seen, labeled as a Field Note check and worth a bonus Trail Point. A right answer is a critical hit that also adds a charge. The note itself says it may come back. This rewards reading the facts without ever blocking progress.

### Explorer's Map

Each region has a map at camp that fills in as places are found. A full map reveals a rare creature for that region. Rare creatures don't evolve. Badges mark filled maps, groups of places such as New England, and other milestones.

### Arrival

Finding a place plays a sound, lights up its border, and bounces its shape on the map. Reduced motion keeps the highlight without the bounce.

### Regions

Trails follow one region: West, Midwest, South, Northeast, or Europe. Each region has its own sightings of creatures that live there, and its own zoomed map. The Bark Knight, based on the family's dog, is offered first in every region until a child befriends it. Each place has a biome that sets its battle backdrop. The parent can enable regions per profile. Trail routes use bordering or nearby states, and travel lines must not imply routes that make no sense. Alaska and Hawaii appear as insets, and routes to them are labeled as flights.

### Study and review

Offer optional study cards before an encounter for unfamiliar objectives. Use neutral feedback such as "Not yet—here is the location."

1. Prefer roughly half objectives local to the current region and half due or previously missed objectives.
2. Avoid exact repeats within an expedition when the pool allows. Space variants of an objective by at least two unrelated questions. Keep recent-question history between expeditions.
3. After a miss, schedule a different variant later in the expedition if spacing allows, otherwise next session.
4. After an unaided correct response, schedule review about 1, 3, then 7 days later.
5. Treat an objective as familiar only after three unaided correct responses across at least two calendar days and two variants, at that difficulty or higher. This is a game heuristic, not an assessment.
6. If the due pool is empty, use new or seen material. If it is too small, allow tracked repeats rather than failing to start.

A repeated item right after its answer was shown never counts as independent evidence. Learning state stays separate from XP, stable, and victories. There is no perfect-score gate.

### Second pack

Europe is a second pack of 44 countries, the UN's list for the region, plus a few world-basics questions. Kosovo, Cyprus, and countries that straddle Asia, such as Turkey, are left out for now. It demonstrates that a new subject needs content and configuration rather than a new engine.

## 9 Profiles and parent controls

Provide two default profiles with editable names and avatars. Use stable generated IDs and never key records by name. Reloads and updates must never recreate profiles over existing data.

The parent view shows:

- Enabled regions and packs, plus the difficulty range, for each profile.
- Recent first-attempt accuracy and number of questions, with sample size and difficulty visible.
- Objectives recently missed and due for review.
- Stable, State Cards, completed expeditions, and any unfinished outing.
- Export, import, and explicitly confirmed reset.

Avoid sibling rankings or combined scores. The parent view is a convenience, not a security boundary.

## 10 Art and PixelLab

Use original pixel-art creatures with clear silhouettes, expressive faces, and consistent lighting. Keep accepted art, and match new creatures to Slatepaw.

| Asset | Quantity | Format |
| --- | --- | --- |
| Creature sprites | Up to 36 (12 species, 3 stages) | Transparent 128 × 128 PNG |
| State Card illustrations | 50 | About 128 × 96 PNG |
| Battle backdrops | 4–6, by habitat | Reused across encounters |
| Souvenirs | 6 now, more as needed | Transparent 64 × 64 PNG |
| Event illustrations | About 6 | Small PNG |
| Maps | US, Europe | SVG from public-domain geography |

Use real geometry for maps. Decorative art must never change coastlines or marker positions.

Evolved forms should start from the previous stage as a reference image, so they read as the same creature. Set a generation budget per batch, record prompts and IDs in `docs/art-manifest.json`, and reuse accepted art. Generate assets during development only, never in the browser, and keep credentials out of source control. Placeholders must never block a playable loop.

State Card illustrations must show general subjects such as landscapes, animals, or industries. Avoid real logos, state seals, and copyrighted characters, and check that any depicted landmark looks reasonably right.

### Keyboard

The whole game is playable from the keyboard. No screen requires the mouse. Buttons show their key, and hints are hidden on touch devices.

| Screen | Keys |
| --- | --- |
| Anywhere | Enter or Space for the main action; Tab moves between buttons |
| Battle | A to Attack, 1–4 to answer; Guard and Special get G and S when added |
| Finding a place | 1–4 to choose, C for another clue, A to open or close the atlas |
| Atlas open | 1–4 to look up a place; close the atlas to choose |
| Map | + and − to zoom, arrow keys to pan; on blank maps the arrow keys move a highlight between places and Enter chooses |

Held keys never repeat an action. Leaving an expedition has no single-key shortcut, because a stray key must not end a trip; it stays reachable with Tab.

### Sound

Use short original sound effects, generated with ElevenLabs during development and stored in the repo as small audio files. The game plays them locally, with no network call or API key in the browser.

| Group | Sounds |
| --- | --- |
| Answers | Correct, not yet |
| Battle | Attack, Guard, Special, hit, block, win, retreat |
| Rewards | State Card earned, creature befriended, evolution, level up |
| Interface | Button click, spending points, travel |

- Keep most effects under about one second, because a Standard trail plays them many times. Rewards can run a little longer.
- The wrong-answer sound is soft and neutral, never a buzzer.
- Provide mute and volume, saved per profile. Sound starts only after a user interaction, and no information is conveyed by sound alone.
- Do not imitate Pokémon sounds. Record prompts and accepted files in `docs/sound-manifest.json`.
- Background music is deferred until the children ask for it.
- Sound never affects game logic, and a missing or blocked audio file must not interrupt play.

## 11 Implementation direction

Use TypeScript, React, Vite, plain HTML/CSS and SVG, and IndexedDB behind a small save interface. No backend, game engine, or live AI service.

| Module | Responsibility |
| --- | --- |
| Content | Load and validate packs, state records, question templates, clues, cards, creatures, events |
| Expeditions | Offers, trails, stops, purchases, and resume |
| Learning | Selection, progress, scheduling |
| Combat | Actions, HP, charge, intent, outcomes |
| Progression | XP, levels, evolution, stable, cards, rewards |
| Persistence | Save and load, migrations, backups |
| UI | Rendering only |

Combat receives an evaluated answer and never knows what the question was about. Battle resolution stays a pure function. Random choices stay in saved state. Animations and React effects never determine outcomes.

Save immediately after each state change. Commit an answer, its learning update, battle state, stop status, and rewards atomically. Use stable IDs to make repeated submissions and rewards idempotent. Reject unsupported future save versions clearly, and preserve the existing save on any failure. Store a battle's selected questions with the battle, so app updates can't change a turn in progress.

Avoid names such as `countryQuizScore` in shared engine code.

## 12 Expansion without building it now

- **More subjects:** new content packs, then new input types only when a subject needs them.
- **Deeper systems:** two-creature teams, habitat advantages, branching routes. Add one at a time and measure whether it creates decisions or just clicks.
- **Hosting:** a later milestone moves saves to a server, so the children can play from any device. It needs accounts, sync, and a real database. None of this belongs in the MVP.
- **Cooperative play:** each child brings a companion to a shared hunt, with separate question levels, rewards, and learning records. This requires shared authority and sync; MVP preparation is limited to stable IDs and serializable state.

## 13 Build order

1. **Milestone 1:** core loop. Done and enjoyed by the children.
2. **Milestone 2, Foundations:** backup and restore, two profiles, migration, Guard and Special, state records for one region, US map, difficulty tiers.
3. **Milestone 3, The Hunt:** multi-stop trails, Trail Points, Prep Shop, clues, events, Field Notes, State Cards, Befriend, and a simple stable.
4. **Milestone 4, Growth:** full stable, XP, evolution, more species.
5. **Milestone 5, Learning and parent tools:** all 50 states, review scheduling, parent view, import preview.
6. **Milestone 6, Polish and playtest:** full art, tablet, tuning across several days.

Each milestone ends with the children playing it. Their reaction may reorder the rest.

## 14 Acceptance criteria

1. Switching profiles never transfers stable, points, answers, cards, or an active expedition.
2. A full Standard trail works from profile selection through final showdown, and another can start immediately.
3. All three actions and enemy intent match Section 6, including a win on the last allowed turn.
4. A rapid double click or refresh cannot submit twice, charge a purchase twice, or award duplicate XP or rewards.
5. A saved encounter resumes with the same question, option order, HP, charge, and points.
6. A wrong answer shows the correct answer and an explanation, then enters later review.
7. Repeated exposure to a just-revealed answer does not mark an objective familiar.
8. Markers, map clicks, and accepted answers remain correct after zooming and shuffling.
9. Every active pack validates: valid IDs, exactly one accepted answer, sources present, no broken art references.
10. At Ranger and Expert, every capital question offers only real cities in the named state.
11. No option list contains two correct answers, including other nicknames of the same state or a capital as a same-state wrong option.
12. Nicknames are never described as official without a recorded source.
13. Export and import preserve all progress; invalid imports leave saves intact.
14. Existing Milestone 1 saves upgrade without losing souvenirs or completed expeditions.
15. Reduced-motion mode removes shaking and flashing without removing feedback.
16. A second pack runs with no changes to combat.
17. No network call is required to answer questions.
18. Route, target, prices, and purchases stay stable after refresh.
19. A child at 0 Trail Points can always finish the expedition.
20. Bought clues, atlas use, and correction are recorded as assisted and never credited as unaided recall.
21. No purchase can answer a battle question.
22. Field Notes add no extra click, and a State Card is awarded only once.
23. Evolution happens exactly once at each threshold and survives refresh.
24. A battle takes at least 3 correct answers at every companion stage.
25. Exhausting new species produces honestly labeled Rival Hunts.
26. Clues identify one valid answer, and nothing in the interface leaks the target.
27. Mute and volume persist per profile, and a missing or blocked sound never interrupts play.
28. A full expedition can be completed with the keyboard alone, excluding questions that require pointing at a map, and a held key never repeats an action.
29. Befriending cannot fail by chance, a wrong answer only offers a new question, and a double click or refresh cannot add a creature twice.
30. Every creature has idle, attack, guard, special, and hit art, and an animation never decides an outcome.

## 15 Playtest questions

- Do the children spend points thoughtfully, or does one choice dominate?
- Does a struggling child run out of points and feel punished?
- Does the Standard trail feel exciting or long? Do they stop midway?
- Do they read Field Notes, and do they remember them later?
- Is Expert fair or frustrating? Do they choose harder trails without being asked?
- Does evolution make them replay a favorite companion or try new ones?
- Do they answer previously missed questions, unaided, on later days?

Keep these adjustable: trail lengths, prices, starting points, XP curve, whether a wrong guess costs a point, and opponent scaling.

## 16 References

- [Natural Earth terms of use](https://www.naturalearthdata.com/about/terms-of-use/): public-domain map data.
- [us-atlas](https://github.com/topojson/us-atlas): US state geometry derived from Census boundaries.
- [List of US state and territory nicknames](https://en.wikipedia.org/wiki/List_of_U.S._state_and_territory_nicknames): a starting point; check official status against state sources.
- [PixelLab MCP guide](https://api.pixellab.ai/mcp/docs): development-time art generation.
- [IndexedDB on MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API): local persistence.
