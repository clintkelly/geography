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

A battle should take at least 3 correct answers at any stage. Growth may shorten a battle slightly but must not remove practice. Trail difficulty does not change combat numbers, because learning difficulty and combat difficulty stay independent. Harder trails pay off in access and treats instead: locked creatures, more Trail Points at the start, more shiny finds, and the existing XP, rare-chance and medal boosts.

### Feedback and timing

An answer is final for that turn. Show the correct answer and a short explanation, plus a Field Note when correct, in large text, then let the child continue. Each creature has attack, guard, special, and hit poses. A turn swaps poses with short lunges, shakes, and sounds, and lasts under two seconds. Hit and block sounds are deep, retro 8-bit punches. Hits show floating damage numbers, a brief freeze and flash, a screen shake, sparks, and HP bars that drain with a pale trail. Correct answers build a streak with a rising chime, a growing aura, and bigger-looking hits. Final showdowns open with a VS intro, a beaten opponent slides away, and befriending has its own celebration. Reduced motion removes the movement and flashing but keeps poses, numbers, and sounds. The result text appears at once, and Continue never waits for the animation. Do not slow-print text or require several acknowledgements for one result.

Persist the resolved turn before animating. Reloading must not submit an answer or resolve a turn twice.

## 7 The stable and evolution

### Stable

- Launch with up to 12 original species across habitats such as mountain, coast, forest, desert, and plains. Three are starters; the rest are found by hunting.
- A profile may hold every species it has befriended. Duplicates are not needed: a sighting offers species the profile doesn't own, and once all are owned, sightings become Rival Hunts that award XP and a badge. Never imply an unlimited supply of new creatures.
- Each owned companion has an instance ID, optional nickname, level, and XP.
- One unowned souvenir can be found on each trail, on the second battle win.
- Companions are chosen before an expedition.
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

Each region has a map at camp that fills in as places are found. A full map reveals a rare creature for that region. Rare creatures evolve twice, like regular ones; Continent Bosses don't evolve. Badges mark filled maps, groups of places such as New England, and other milestones.

### Teams

A trip takes up to 10 creatures, each with its own HP and charge. Switching uses the turn and the opponent hits the newcomer, except when replacing a fainted creature, which is free. The trip retreats only when the whole team is down. The finisher earns full XP and the rest half. Each extra member adds a turn. Members 2 to 5 add 2 opponent HP each and members 6 to 10 add 1 each. Teams of 4 to 7 face +1 enemy damage and teams of 8 or more face +2. A creature gets +1 Attack, not Special, in its home landscapes.

### Harder ways to win creatures

**Bold Befriend:** any creature in a regular battle, including one the child already has, at half HP or less can be won with 2 charge and two right answers in a row on questions one level harder than the trail. It keeps attacking, and a miss ends the attempt.

**Changing a move:** before answering, the child can go back and pick another move. The question stays dealt, including a Bold Befriend question if they return to that move, so changing moves can't swap a hard question for an easier one.

**Rare encounters:** a Trail Score from 0 to 100 reflects accuracy, streak, and difficulty, and sets the chance (2 to 25 percent) that a battle stop is a rare creature. The roll is made once per stop. A rare the child hasn't befriended comes first. Once they own every rare in a region, rare encounters keep happening with ones they already have, so the same rare can be befriended again, each time as a new creature with its own shiny roll. When a region has more than one rare, any of the eligible ones can appear, not just the first listed.

### Card levels

Cards rise from Bronze (one right answer) to Silver (three topics), Gold (unaided answers on two different days), and Shiny (three more on Expert). Levels come from learning records, so they can't be rushed in one sitting.

### Wrong answers

A wrong pick shows what that option really is, such as what the chosen city is the capital of.

### Streaks

Streaks pay out at milestones: 5 and 10 in a row earn Trail Points, 8 restores HP, and each brings a banner. Breaking a streak costs nothing.

### Arrival

Finding a place plays a sound, lights up its border, and bounces its shape on the map. Reduced motion keeps the highlight without the bounce.

### Regions

Trails follow one region: West, Midwest, South, Northeast, or Europe. Each region has its own sightings of creatures that live there, and its own zoomed map. The Bark Knight, based on the family's dog, is offered first in every region until a child befriends it. Each place has a biome that sets its battle backdrop. The parent can enable regions per profile. Trail routes use bordering or nearby states, and travel lines must not imply routes that make no sense. Alaska and Hawaii appear as insets, and routes to them are labeled as flights.

### Study and review

Offer optional study cards before an encounter for unfamiliar objectives. Use neutral feedback such as "Not yet—here is the location."

1. Prefer roughly half objectives local to the current region and half due or previously missed objectives.
2. Avoid exact repeats within an expedition when the pool allows. The same place shouldn't be the answer again within four questions. Space variants of an objective by at least two unrelated questions. Keep recent-question history between expeditions.
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

**Europe regions:** Europe follows the UN's four subregions (Northern, Western, Southern, Eastern) so maps stay readable. Each has its own map, Explorer's Map, sightings and badge, and Grand Tour of Europe needs all four. Schema 6 moves old settings and redraws sightings; an unfinished trip in the old Europe region ends, and everything earned stays.

**Whole world:** 21 regions under eight headings: United States (4), Europe (4), Africa (5), Asia (3), North America (2), South America, Oceania and Antarctica. Countries are UN members plus Vatican City, Palestine and Taiwan. Oceania uses a Pacific-centered map, and Antarctica uses a polar map with 10 landmarks in place of countries. Each continent has two new regular creatures and one rare, shared across its regions. Fact reviews for the new content are in docs/fact-review/.

**Wolves and sea creatures:** Howlpup (evolves to Moonfang) and Toothling (evolves to the Megalodon) are regular creatures across several regions. Emberwolf and Inkraken are rare. Pebbletort (Stone, evolves to the Mount Tortoise) and Lilyhop (Leaf, evolves to the Lily Monarch) are regular creatures added later. A region with two rares offers the second after the first is befriended.

**Prehistoric sea creatures and dogs:** Plesiling (Tide plesiosaur, evolves to the Loch Legend) and Spiralite (Stone ammonite, evolves to the Ammonarch) are regular creatures. Mosaroar (Tide mosasaur) is rare in Western Europe and the US Midwest. The dogs are Spotspark (Flame Dalmatian), Corgust (Gale Corgi), Bernasnow (Frost Saint Bernard), Doxdig (Stone Dachshund) and Poodlebloom (Leaf poodle), each living in its breed's home region and a few others. Platybolt is a rare Volt platypus in Oceania. Each flavor line carries a real fact about the animal or breed's home.

**Moves:** every creature has its own Attack and Guard names, listed in src/content/moves.ts. Attacks are steady (+1 charge) or fierce (+1 damage, no charge, and a miss takes 1 extra damage). Guards are steady (1 damage, block 3), spiky (2 damage, block 2), wall (block 5) or focus (1 damage, block 2, +2 charge). A simulation across many opponents put every combination within a few points of steady. The battle team row shows each member's type.

**Type effects:** a hit sprays the attacker's type particles where it lands: water splashes, embers rise, leaves twirl, rocks drop, wind streaks or ice shatters. A Special fills the scene with its type: a wave, rising embers, a leaf storm, falling rocks, wind or snow. The effects are decorative only, and reduced-motion settings hide them.

**Mastery medals:** every region has Places, Capitals and Flags medals (Antarctica only Places), opened from Camp with M. A medal needs every place in the region: Bronze is right once, Silver is right on Ranger or harder, Gold is right on Expert on two different local days, and Platinum is a Mastery Test at least 7 days after Gold. The test has one non-map question per place and allows one miss. A failed or abandoned test can be retried the next day. Medals never go down and bank Trail Points for the next trail (1, 2, 3 and 5). Medals are checked when a trail ends or is abandoned. Gold Medalist and Platinum Master are badges.

**Music:** camp, a trail theme per continent, battle, final showdown, rare encounter, trail event and homecoming.

**Focus:** Camp offers Everything, Places and capitals, or Flags. Flags needs a region with countries, so US states and Antarctica don't offer it yet.

**Flags:** 196 accurate flags from the MIT-licensed flag-icons set, used in questions and on cards.

**Types:** seven types in a loop (plus Light and Spirit, below), each with a real-world reason: Tide beats Flame (water puts out fire), Flame beats Leaf, Leaf beats Gale (windbreaks), Gale beats Frost (warm wind melts it), Frost beats Stone (ice splits rock), Stone beats Volt (grounding, like a lightning rod), Volt beats Tide (electricity zaps through water). Volt creatures: Thunderhoof and Platybolt (rare), Zapeel, Glowbug, Sparkemur, Catatumboa (rare, South America), Zapwhisker, Krillume and Torpezap. A strong matchup adds 1 damage to Attack and strong Specials, and a weak one takes 1 away, never below 1. A creature traveling alone has no weak matchups, so right answers always win. Types never change the opponent's damage.

**Passport:** a stamp for each region. Bronze for a finished trail, silver for a full map, gold when every card there is Gold.

**Continent Bosses:** eight bosses, one per picker heading, appear as sightings once every region under that heading is stamped. They have 8 more HP, 4 more turns, a big hit every third turn that Guard softens, and questions from the whole continent.

**Light and Spirit types:** two more types, asked for by a player. They sit outside the seven-type loop in a small triangle with Stone: Light beats Spirit (light chases away the shadows Spirits hide in), Spirit beats Stone (Spirits float through Stone walls), and Stone beats Light (Stone blocks Light and makes shade). Every type still has as many strengths as weaknesses; Stone, in both groups, has two of each. Light creatures: Sunbeary (sun bear, East and Southeast Asia), Jellume (crystal jelly, US West), Cavestar (Waitomo glowworm, Oceania) and Lumangler (Light and Tide anglerfish, Expert only, Caribbean and West Africa). Spirit creatures: Kermoon (Kermode spirit bear, North and Central America), Hushowl (barn owl, Western Europe), Spectrab (ghost crab, East Africa) and Tarspook (tarsier, Ranger and up, East and Southeast Asia). Spirit creatures are ghostly but friendly, never scary.

**Sound, Metal and Burrow types:** three more types, asked for by a player, in a triangle of their own: Sound beats Metal (a loud, high note makes Metal shake and rattle), Metal beats Burrow (Metal drills dig through tunnels) and Burrow beats Sound (deep underground, Sound can't reach). They are even against every other type. Burrow is an underground type, separate from Stone. Metal: Armorfin (Dunkleosteus, Midwest), Clubclank (Ankylosaurus, Metal and Stone, Expert, US West), Ferrosnail (scaly-foot snail, Metal and Tide, Expert, East Africa), Hornclank (Hercules beetle, North and Central America), Goldgriff (griffin, Metal and Gale, rare, East and Southeast Asia), Domeplod (glyptodont, Ranger, South America) and Sabrefang (saber-toothed cat, Ranger, US West). Sound: Howlero (howler monkey), Songfluke (humpback whale, Sound and Tide), Trumpasaur (Parasaurolophus, Sound and Leaf, Expert), Echobat (free-tailed bat, Sound and Burrow), Mimilyre (lyrebird, Sound and Gale, Expert), Coquito (coquí frog, Caribbean), Rumbelph (African elephant, Sound and Stone, Expert) and Rexroar (T. rex, Stone and Sound, Expert, Midwest). Burrow: Starnoze (star-nosed mole), Nudig (naked mole-rat), Aardig (aardvark), Prairiepup (prairie dog), Spiralbore (Palaeocastor, Burrow and Stone), Cavewyrm (Welsh red dragon, Burrow and Flame, rare), Olmling (olm, Burrow and Tide) and Gophshell (gopher tortoise). The same batch added Glimmerhorn (unicorn, Light, rare, Northern Europe), Krakling (kraken, Tide and Spirit, Expert, Northern Europe), Seaneck (Elasmosaurus, Tide, Midwest), Tuskfrost (woolly mammoth, Frost, North and Central America) and, by request, Coatimundi (white-nosed coati, Leaf, North and Central America) and Spinosail (Spinosaurus, Tide and Stone, North Africa). Mythical creatures' facts say plainly that they are made up and tie them to the real place their story comes from.

**History creatures:** animals and legends of ancient cultures, each fact tied to the real place: Athenowl (Athena's owl on Athens' coins) and Pegawing (Pegasus, rare) for Greece; Lupina (the bronze she-wolf of Romulus and Remus) and Honkonius (Juno's geese) for Rome; Maukit (Bastet's cats), Ibiscribe (Thoth's ibis), Nilesnap (Sobek's crocodiles) and Bennuflare (the bennu, rare) for Egypt; Lamassling (lamassu) and Tiledrake (the Ishtar Gate dragons) for Mesopotamia; Simurling (the Simurgh, rare) and Dashpurr (Asiatic cheetah) for Persia; Peacrest (the Peacock Throne) for India; Longlet (Chinese rain dragon, rare), Terracolt (Terracotta Army horse) and Kitsulit (kitsune) for China and Japan; Huginnet (Odin's raven), Boltgoat (Thor's goats) and Chalkpony (Uffington White Horse) for Scandinavia and Britain; Wawelet (Wawel Dragon) for Poland; Balamcub (Maya jaguar) for Mexico and Central America; Pumastone (Cusco) and Llamble (Inca llamas) for Peru. Native American sacred beings are deliberately left out. Legends are always worded as stories ("legend says", "in Norse myths").

**Field Guide:** every creature has a card about the real animal, prehistoric animal, legend or historical animal behind it (src/content/guide/creatures.json): what it is based on, its scientific name, when (prehistoric only), where, a size comparison a child can picture, the story behind a legend, and two or three sourced facts. Kinds show as a small tag (🐾 real, 🦴 prehistoric, ✨ myth or legend, 🏛️ history) in the stable. The card opens by itself the first time a child meets a creature in battle, after the VS intro (remembered in the save as guideSeen), and any time from the battle screen, the stable, the passport, or the "Read about the real..." link after befriending. While open it holds the keyboard, and Enter or Escape closes it.

**History questions:** a History trail focus and history questions mixed into Everything trails (src/content/history/*.json), built like the animal questions: the ask names a famous person, building or event, and the answer is the place. About 300 facts across every US state and most countries, each checked against its cited page. Topics a parent might want to see first are listed in docs/FACT_REVIEW.md.

**Twenty more creatures:** each is based on a real animal, and its flavor text gives a true fact about where it lives. Emberhead is a rare Flame hammerhead shark from the Galápagos (South America). It is not a great white. The regulars are Humpyre (camel), Ostrigust (ostrich), Zapwhisker (electric catfish), Gorilith (mountain gorilla), Monarflit (monarch butterfly), Flaminglow (flamingo), Rockguana (rock iguana), Albasoar (albatross), Krillume (krill), Snowmonk (snow monkey), Embertig (Bengal tiger), Peakprowl (snow leopard), Pangoroll (pangolin), Puffgust (puffin), Torpezap (electric ray), Roozoom (red kangaroo), Scorchdevil (Tasmanian devil), Toucanopy (toucan) and Burrowbark (prairie dog). They fill the regions that had the fewest creatures, and add Flame, Gale, Stone and Volt, the types that had the fewest. Each one evolves twice.

## Reasons to play harder trails

The owner may set difficulty limits per profile but chose not to cap anyone. These rewards pull children toward Ranger and Expert without forcing them.

- **Locked creatures.** Every region has a Ranger creature, met only on Ranger or Expert trails. Ten Expert creatures are met only on Expert trails, and all of them have two types. Each is based on a real animal with a true fact about where it lives.
- **Hints everywhere.**
  - At Camp, one of each region's two sightings is a locked creature when one is left, marked with a lock tag. Choosing it raises the trail to its difficulty, and easier difficulty buttons are disabled.
  - Camp lists the region's locked creatures as dark shapes.
  - The Passport's creature log shows every creature by region, with locked ones marked R or E.
  - After a trail with 80% or more right on Scout or Ranger, Camp suggests the next difficulty up.
- **Trail Points.** Ranger trails start with +2 and Expert trails with +4.
- **Shiny creatures.** A newly befriended creature may be shiny: 3% on Scout, 8% on Ranger, 20% on Expert. The roll comes from the creature's id, so a reload never changes it. Shiny creatures have a different color, a golden glow and twinkling stars. They get a reveal at Camp, a banner in battle, and the Sparkle Finder badge.
- **Badges:** Ranger Tracker, Expert Tracker, Double Trouble (a dual-type creature), Sparkle Finder and Friend of the Wild.

## Dual types

A dual-type creature attacks with whichever of its types works best. When it is hit, both of its types count and are added together, limited to plus or minus 1. So a matchup that is strong against one type and weak against the other is even. Strikewing, a peregrine falcon (Gale and Volt, Western Asia), is a dual-type creature open to every difficulty.

## Stable management

- **Sort and filter.** The stable can be sorted (newest, oldest, highest level, name, type), filtered by type (counting both types) or by shiny, and searched by name or nickname.
- **Setting creatures free.** At Camp, a creature can be set free. It moves to "In the wild", keeps its level, and can be called back for free at any time.
  - The first time a creature is freed banks 3 Trail Points for the next trail. Freeing it again pays nothing, so the reward can't be farmed.
  - A freed creature still counts as found: it is not offered again, and badges are never taken away.
  - A creature that just joined can be sent home from the trip summary, for the same reward.
  - The last creature can't be freed, and nothing can be freed mid-trip.

## Animal questions

Each place can have animal questions, stored in `src/content/animals/*.json` with a source link for each. They are asked at all three difficulties, like fact questions, but don't wait for a Field Note. Camp has an "Animals" focus. Each claim must be true of its place and of no other place in the same region, because the wrong answers come from that region.

## Juice and sound

- **Map zoom.** Arriving at a place, the route map swoops in on it.
- **Evolution scene.** The old form glows white, then a flash, then the new form springs out over spinning rays.
- **Sound effects.** Coins clink into the Trail Points counter, and the streak counter blazes at each streak reward.
  - Specials have type-themed sounds, and strong hits have their own sting.
  - Freeing, calling back and locked sightings each have a sound.
- **Variety.** Common sounds have three takes, and every music track has a second take (camp and battle have three). One take is picked at random.


## Math and vocabulary

Math and Words are two more Camp focus choices. They work in every region: the trail still travels the region's map and finds its places, but battles and trail events ask math or vocabulary instead of geography. Battles on these trails are against study creatures, which live nowhere else.

**Per-child settings.** In Settings, a parent picks which math topics and vocabulary units each child practices, and can mix math or vocabulary into ordinary geography trails at 15, 30 or 50 percent of questions (off by default). A "How it's going" list shows right answers per math skill and vocabulary unit, and the words a child has missed.

**Math** follows a fourth-grade factors, fractions and integers unit. Problems are generated from their own numbers, so every answer is computed, and wrong choices come from common mistakes (adding the bottoms of fractions, flipping a sign). The bank is about 950 problems from 17 skills, made the same way every time so reviews and saves stay stable. Scout is multiple choice. Ranger and Expert ask for typed answers on most skills, using an on-screen pad with a fraction bar, a minus sign and a space for mixed numbers. Fractions must be in simplest form; 3/2 and 1 1/2 both count unless the question asks for one form. A few word problems use real places, like the temperature gap between Vostok Station and Death Valley.

**Vocabulary** comes from word lists a parent adds with `npm run vocab -- --id unit-03 --title "Unit 3" words.txt`. The command asks Claude (`claude-opus-5-5`) for a kid-friendly definition, an example sentence, wrong definitions, a synonym, an antonym and a Latin or Greek root for each word. It checks the result (every word present, one blank per sentence, three wrong choices each) and writes `src/content/vocab/<id>.json`, which a parent reads before the kids play. Credentials come from the environment and never go in the repo. Scout asks what a word means. Ranger adds sentences, synonyms, antonyms and roots. Expert asks the child to type the word, which practices spelling. Missed words come back through the same review schedule as geography.

**Study creatures** are original creatures based on real animals with a link to math or words: Primecada (periodical cicadas emerge every 13 or 17 years, both prime), Hexhive (honeybee hexagons), Octofract (an octopus's eight arms), Minusfox (Arctic foxes far below zero), Parrolex (Alex the African grey parrot), Whistlefin (dolphin signature whistles) and Pagegrub (bookworms). Camp shows who lives on each kind of trail, and the Passport has a Study creatures row. They join through Bold Befriend like any regular creature.

## Ranger Lodges

Ranger Lodges are this game's version of gym battles.

**The ladder.** There are eight Lodges. Each child beats them in a fixed order, and each Lodge is harder than the one before. The first Lodge is always open. Beating one opens the next. Each child's progress is saved separately, in `lodgesBeaten` in their own save.

| Rank | Lodge | Type | Subject | Leader | Prize creature (real animal) | Recommended level |
|---|---|---|---|---|---|---|
| 1 | Wildwood | Leaf | Animals | Ranger Hazel | Rustlepaw (red panda) | 1 |
| 2 | Banner | Gale | Flags | Captain Soren | Aquilift (golden eagle) | 2 |
| 3 | Compass | Stone | Places | Ranger Marisol | Screepip (American pika) | 3 |
| 4 | Echo | Sound | Vocabulary | Maestro Kofi | Chucklebeak (laughing kookaburra) | 5 |
| 5 | Gearworks | Metal | Math | Engineer Priya | Rivethorn (Indian rhinoceros) | 6 |
| 6 | Lantern | Light | Capitals | Ranger Aurelio | Gleamarin (golden lion tamarin) | 7 |
| 7 | Ancient | Spirit | History | Keeper Noor | Lazarine (coelacanth) | 8 |
| 8 | Summit | Frost | A mix of everything | Grand Ranger Tova | Floecub (polar bear) | 10 |

**Each Lodge.**
- Every Lodge has its own primary type. Its junior rangers, its leader's team and its prize creature are all that type.
- A visit has five or six battles in a row. First come two junior rangers with one creature each. Then the leader sends out three or four creatures. The last one is the ace.
- From the third Lodge on, the ace makes a big boss-style hit every third turn.
- Higher Lodges use evolved creatures. The art and names match each creature's stage.
- There is a Prep Shop, but no map search.
- Every question is about the Lodge's subject, drawn from every region the parent has turned on. No math or vocabulary is mixed in.
- Question difficulty rises from Scout to Ranger to Expert as the ladder climbs. The parent's minimum and maximum difficulty still apply.

**Fixed opponent strength.** On trails, opponents scale with your lead creature. In a Lodge, opponent strength is fixed by the Lodge's rank (`lodgeFoeStats`). That is what makes higher Lodges feel higher level: a creature below the recommended level has a hard time. Bigger teams still face tougher opponents, as on trails.

**Tuning target.** A lone creature at the recommended level that gets about 80% of answers right should:
- beat the junior rangers almost every time
- usually beat the leader
- beat the ace more often than not

A simulation in `lodges.test.ts` checks this.

**Losing and rewards.**
- Losing a battle keeps your place in the Lodge. You can try that battle again right away.
- Lodge creatures can't be befriended, and no rare creatures appear in Lodges.
- The first win earns:
  - the Lodge's patch, shown on the sash
  - its prize creature, which lives nowhere else
  - double the trail-finish XP, plus leftover Trail Points as XP
- A rematch earns XP only.
- There are three badges: First Patch, Halfway Up and Grand Ranger.

**Lodge music.** The hall between battles plays a calm training-hall theme. Junior rangers use the regular battle music. The leader's creatures get their own heroic leader theme, and the Summit leader gets an epic snowy-summit theme. The win screen plays the victory tune. Each theme has two takes.

## Study motivation: eggs, ranks, Lodge tiers and mastery (wave 2)

**Why.** Save data showed the main player:
- is a shiny hunter who frees almost everything that isn't shiny
- loves platypuses, coatis and kiwis
- plays only on Expert
- never chose a Math or Words trail

So math and vocabulary now pay out in the things he already chases: shinies, new versions of his favorite animals, and legendaries.

**Study eggs** (`engine/eggs.ts`).
- **Getting eggs:**
  - Finishing a Math or Words trail lays an egg of that subject.
  - An Expert study trail with at least 90% right lays a Rare Egg instead.
  - The Gearworks and Echo Lodges lay eggs, and a new Silver patch lays a Rare Egg.
  - The nest holds 3 eggs.
- **Hatching:** only right math or vocabulary answers warm an egg: Scout +1, Ranger +2, Expert +3. Math and Word Eggs need 20 points, Rare Eggs 30. Eggs hatch at camp.
- **What hatches:**
  - A Math Egg hatches the math scholar creatures, plus Frostbill, Emberbill, Glowbill (platypus variants) and Gearbill (shoebill).
  - A Word Egg hatches the vocabulary scholar creatures, plus Digbill (platypus), Pebblenose and Breezenose (coatis) and Sparkiwi (kiwi).
  - A Rare Egg hatches anything from either pool.
  - Unmet creatures are favored.
  - The shiny chance is 15%, or 50% from a Rare Egg.

**Other study rewards.**
- **Double shiny chance:** Math and Words trails double the shiny chance for anything befriended there.
- **Brain Blast:** a right *typed* math or vocabulary answer in battle gives +1 charge.
- **Ranks:** Math and Words each have a rank, earned from study points: Apprentice at 30, Adept at 150, Wizard at 400, Archmage at 1000.

**Lodge tiers.**
- **Order:** each Lodge has Bronze, Silver and Gold. Silver opens after Bronze, and Gold after Silver.
- **Strength:**
  - Silver fights at the Lodge's rank + 2, on Ranger or harder, with creatures one stage more evolved.
  - Gold fights at rank + 4, on Expert, with fully evolved creatures.
- **Silver reward:** the Silver patch and a Rare Egg.
- **Gold reward:**
  - Winning the Gold battles leads to a **Mastery Test**: 10 Expert questions on the Lodge's subject, with 9 right (90%) needed.
  - Passing gives the Gold patch, the Lodge's legendary creature and a shiny of its prize creature.
  - A failed test can be retaken any time with new questions, and the battles still count.

**Gate quiz and Brain Shield.**
- **Gate quiz:** the Echo (vocabulary) and Gearworks (math) Lodges start with a gate quiz of 8 questions, with 6 right needed. Failing it means trying again with new questions.
- **Brain Shield:**
  - In those two Lodges, the leader's creatures carry a Brain Shield of 3.
  - A right answer cracks it instead of doing damage, and the opponent can't hit back that turn.
  - Shielded creatures have 1 less HP per point of shield.
  - The balance simulation keeps them fair at the recommended level.
- **The Summit** needs a Gold patch from Gearworks.

**Legendaries** (myths, the Gold rewards):

| Lodge | Legendary | Based on |
|---|---|---|
| Wildwood | Qiloom | Qilin |
| Banner | Rocquill | Roc |
| Compass | Gargrim | Gargoyle |
| Echo | Sirenade | Siren |
| Gearworks | Talosteel | Talos |
| Lantern | Glowplume | Firebird |
| Ancient | Bakumist | Baku |
| Summit | Yetitan | Yeti |

**Juice.**
- **In battle:** a combo counter from 3 in a row, Brain Shield crack and Brain Blast pops with their own sounds.
- **Eggs:** eggs wobble faster as they warm, and hatching has its own reveal and sound.
- **Collection:** a "Creatures found" counter at camp, with a celebration every 10, plus NEW! and Legendary tags in the stable.
- **Music:** a thinking theme for Math and Words trails, and a quiz theme for gate quizzes and Mastery Tests.

## Kung Fu type, Wild Paths and idle animations

**Kung Fu type.**
- **Triangle:** Kung Fu, Stone and Gale form a triangle. Kung Fu beats Stone, Stone beats Gale, and Gale beats Kung Fu.
- **Creatures:** four in East Asia, each a real animal with a kung fu style named after it: Mantido (mantis), Cranekick (red-crowned crane), Monkido (golden snub-nosed monkey) and Tigrifu (South China tiger).

**Voltewe.**
- A Volt and Metal Merino sheep in Oceania. It evolves into Sparkram, then Ironfleece Ram.

**Wild Paths: branching evolution** (`Species.paths`, `progression.companionSpecies`).
- **The creatures:** Paddlet (platypus, Oceania), Coatikit (coati, Central America) and Kiwikin (kiwi, Oceania).
- **How the path is earned:** each baby counts how it is raised.
  - **Scholar:** right math and vocabulary answers while it leads.
  - **Ranger:** battles its team wins on Ranger or Expert trails.
  - **Banner:** right flag answers while it leads.
- **Evolving:**
  - At level 5 it follows the highest count, with ties going Scholar, then Ranger, then Banner.
  - Its path is fixed once the evolution has been shown.
  - From stage 2 on it takes the path's type (Scholar is Light, Ranger is Kung Fu, Banner is Gale), plus that path's art and Special.
- **On screen:** the stable shows the three counts before level 5. The evolution screen says which path it took and why.
- **Art direction:** each path is a very different design (silhouette, palette and accessories), not a recolor.

**Idle animations.**
- **The sprites:** an art id in `content/animations.ts` has 4 frames, `<artId>-f1..f4.png` (128x128, lined up with the still).
- **Where they play:** in the stable, at camp and in battle while standing.
- **How they run:** on one shared 220 ms clock. Reduced-motion users see the still.
- **Cost:** a 4-frame 128x128 animation costs 1 PixelLab generation.

## Night creatures, the Starfall League and creature cries

**Night creatures** (`Species.night`, `engine/night.ts`).
- **When:** from 5 PM until 6 AM by the player's own clock. Camp checks the clock every minute and sends `setNight`, which redraws the sightings (never mid-trail).
- **Where:** ten real nocturnal animals, one each in a thin region. In Possumoon (opossum, US South), Lunaflit (luna moth, US Northeast), Aardshade (aardwolf, Southern Africa), Galagleam (galago, West Africa), Honkabat (hammer-headed bat, Central Africa), Quillnight (hedgehog, Eastern Europe), Solenox (solenodon, Caribbean), Lorishade (slow loris, South Asia), Hootmonk (night monkey, South America) and Glidewisp (sugar glider, Oceania).
- **Finding them:** at night an unmet night creature takes the first sighting in its region. On a night trail, the region's night creature is always the first battle, even one already befriended, so Bold Befriend can win duplicates (more shiny chances). Trails started at night have a darker battle backdrop.
- **On screen:** a Camp strip says when night creatures come out, and at night lists the unmet ones with buttons to their regions.

**The Starfall League** (a `Lodge` with a `gauntlet`, rank 9).
- **Opens** once all eight Lodges are beaten. It has no Silver or Gold tier and is not on the Lodge ladder.
- **The run:** four Elite Rangers (Flame, Tide, Frost, Gale) with two creatures each, then Champion Celeste with three: 11 battles in a row, questions about everything. A lost battle can be retried.
- **Strength:** Elite Rangers fight at Lodge power 9 and 10, the Champion at 11 (the balance test: Elite aces about 65% at 80% right; the Champion about 40% at 80% and 65% at 90%).
- **Rewards:** each Elite Ranger's ace is a star creature that joins the first time it's beaten (Solarion, Delphinova, Ursastar, Dracostar: the Leo, Delphinus, Ursa Major and Draco constellations). The Champion gives Cosmobill, a galaxy platypus. Every win adds the team to the Hall of Fame (`SaveData.hallOfFame`).

**Creature cries** (`content/cries.ts`, `playCry` in `ui/sound.ts`).
- **Sounds:** 24 recorded animal calls (`public/sfx/cry-<family>.mp3`, made with ElevenLabs text-to-sound). Every creature maps to one family by what it's based on.
- **Each creature sounds different:** the call plays at the creature's own pitch, from a hash of its id (0.86 to 1.22), and lower as it evolves (stage 2 ×0.9, stage 3 ×0.8).
- **When:** a creature steps into battle, the wild creature answers, a creature is befriended or hatches, after an evolution, and when its picture is clicked in the stable.

## Wave 3: more creatures

- **38 regular creatures** for the thinnest regions and types: Americas and Antarctica (horned lizard, raccoon, chipmunk, porcupine, bald eagle, Cuban crocodile, giant armadillo, hyacinth macaw, poison dart frog, maned wolf, chinstrap penguin, elephant seal, barracuda, Antarctic toothfish, wild turkey, blue crab, snowshoe hare), Europe and Africa (badger, red squirrel, Atlantic salmon, beluga sturgeon, great bustard, mole, Iberian lynx, monk seal, ball python, hammerkop, African golden cat, Goliath beetle, honey badger, secretary bird, African wild dog, Barbary macaque) and Asia (caracal, sand cat, gharial, sloth bear, Pallas's cat). Kung Fu grows with the honey badger, secretary bird and caracal.
- **Three more Wild Paths lines:** Otterkit (sea otter, American West), Quokkit (quokka, Oceania) and Fenneckit (fennec fox, North Africa), each with Scholar, Ranger and Banner forms.
- **Idle animations** for the older creatures' base forms.
- All new creatures are `fresh`: sighted first in their region until befriended. The Camp "New in the wild" strip shows the six regions with the most unmet new creatures.

## Wave 4: animals from the kids' favorite nature shows, and new-creature juice

- **20 more real animals** the game was missing: orca, great white shark, giant squid, fossa, Parson's chameleon, tardigrade, black-footed ferret, North American beaver, wolverine, Bornean orangutan, pronghorn, thylacine, dodo, sperm whale, Amazon river dolphin, Goliath birdeater, dhole, swordfish, harpy eagle and superb bird-of-paradise. The thylacine and dodo are extinct; their Field Guide "When" says so.
- **The first time a child gets a kind of creature** (`ui/NewCreature.tsx`):
  - **In battle:** a creature they've never seen gets a pulsing NEW! tag and a sparkle sound. Befriending a new kind turns "New friend!" into "NEW CREATURE!" with confetti, a fanfare and its number in the collection.
  - **At the end of a trail:** a new creature joining gets a full reveal: ribbon, spin-in over light rays, confetti, types, home, a ticking "Creature N of total found" count and its cry.
  - **Duplicates** keep the smaller "New friend!" banner, so the big moment stays special.
- **Camp:** picking a sighting plays that creature's cry, and each region button shows found/total, with a gold ★ when complete.

## More juice: Region Master, daily visitor, shiny chains, level-ups

- **Region Master** (`engine/juice.ts`): finding every creature that lives in a region (day and night, not bosses or rares) celebrates at camp with confetti and lays a Rare Egg. Region buttons show found/total and a gold ★.
- **Today's visitor:** one regular creature per day (the same for the whole household, by the player's clock) is sighted first in its home region, can be befriended again even when owned, and is 3× as likely to be shiny. Camp sends `newDay` when the date changes.
- **Shiny chain:** each creature of the same kind befriended in a row raises the next one's shiny chance by half, up to 4×. A different kind starts a new chain. Camp and the befriend banner show the chain.
- **Level-ups:** a creature that levels up mid-trail gets a popup and sound in battle; camp shows a card per creature with its new level and how many levels until it evolves.
- **Sparkles:** region buttons with something new to find right now (a new creature, a night creature after dark, or today's visitor) get a ✨.
- **Fix:** a creature that faints during a Bold Befriend can now be switched out; the attempt carries on with the next creature.

## Kaiju Alerts

- **What:** six ORIGINAL kaiju (giant monsters based on real animals and dinosaurs, not any existing film monster) each threaten a real city: Quakeback (triceratops-armadillo) → San Francisco, Tidalorn (marine iguana) → Tokyo, Stormcrab (steel crab) → Rio de Janeiro, Magmantis (lava mantis) → Naples, Krakenmaw (lightning squid) → Sydney, Glacierhorn (ice woolly rhino) → Reykjavík.
- **The alert:** after two trails, camp shows a flashing KAIJU ALERT for the easiest kaiju not yet beaten; once all are beaten, a different one each day. A Kaiju Lab row shows all six, silhouetted until beaten.
- **The battle:** a `Lodge` with `kaiju` (not on the ladder, no Silver or Gold): three phases against the giant stage-3 form with the whole team, at Lodge power 4 to 9 (recommended level 5 to 10). Questions come from the city's region. The giant is drawn 1.6× with a red glow and screen quakes on big hits; its own music plays (`kaiju`, 2 takes).
- **Reward:** the first win gives the baby kaiju (`Species.kaiju`, lives nowhere in the wild), which grows into the giant by stage 3, plus the Kaiju patch. Rematches give XP.

## Science

- **Questions:** 223 multiple-choice questions in `src/content/science/ch-01.json` … `ch-10.json`, written in our own words from the ideas of the middle-school science study guide the kids use (chapters 1–10: scientific inquiry, experiments, lab reports, SI units, lab safety, matter, the periodic table, solutions, motion, and forces and Newton's first law). The book itself is never committed (`.gitignore`). Scout asks facts and vocabulary, Ranger understanding, Expert application and easy calculations. Each has a short explanation shown after answering.
- **In the game:** Science is a third study subject beside Math and Words: a Science trail under "Ask about", a Science Egg meter (8 right answers lay a Science Egg), a Science rank, Scholar-path points, and a parent setting to mix science into ordinary trails and pick chapters. Science Eggs hatch the existing egg creatures until science creatures are drawn.
