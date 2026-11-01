# Atlaswild: next version ideas

The current game covers the whole world, so the next step is giving kids long-term goals and more reasons to learn the map. All of this fits the current design: no backend, saved in the browser, and quiz answers still drive everything.

Suggested order: Passport, then Look-alike Drills, Flags, Type Matchups, Continent Bosses, World Tour, Daily Expedition. The early ones are small and feed the later ones.

## 1. Passport

A book with one page per region, always available from Camp.

- **Stamps:** finishing a trail in a region earns its stamp. Bronze for any trail, silver for filling its map, gold for raising every card there to Gold.
- **Whole-world goal:** a progress line such as "9 of 21 regions stamped". All 21 unlocks a title and a golden Passport cover.
- **Art:** 21 stamps at 64x64, about 21 generations.
- **Engine:** derived from `foundPlaces`, `stateCards` and `learning`, plus a new `stampedRegions` list for finished trails.
- **Size:** small.

## 2. Look-alike Drills

Short practice rounds on names kids mix up. These target the real weak spot of a whole-world game.

- **Sets:** Niger and Nigeria; Guinea, Guinea-Bissau, Equatorial Guinea and Guyana; Dominica and Dominican Republic; Slovakia and Slovenia; Austria and Australia; Sweden and Switzerland; Iran and Iraq; Congo and DR Congo; Mali and Malawi; Kingston and Kingstown.
- **Round:** 8 fast questions with no battle, shown on the map where it helps, and each right answer pays 1 Trail Point.
- **Automatic help:** when a child picks one twin instead of the other in play, Camp suggests that drill.
- **Engine:** a `TWINS` content list, and a `drill` mode that reuses `QuestionPanel`. Wrong picks already record `submitted`, so mix-ups can be detected.
- **Size:** small to medium.

## 3. Flags

- **Questions:** "Which country has this flag?" with lookalikes as wrong answers on Ranger and Expert, such as Chad and Romania, or Indonesia and Monaco.
- **Cards:** each country card shows its flag beside the postcard.
- **Art:** use accurate flag images, not generated art, because generated flags would be wrong. An open-licensed SVG set is the likely source. Check its license before adding it.
- **US states:** state flags later, as a separate set.
- **Size:** medium, mostly content.

## 4. Type Matchups

Today, home turf is the only reason to choose a creature. Types make the team of five a real choice.

- **Six types, from existing habitats:** Stone (mountain, canyon), Flame (desert), Tide (coast, harbor, lake), Leaf (forest, swamp, tropical), Frost (snow, fjord) and Gale (plains).
- **Rule:** a loop where each type beats one other: Tide beats Flame, Flame beats Leaf, Leaf beats Stone, Stone beats Gale, Gale beats Frost, Frost beats Tide. A strong hit does +1 damage. A weak one does -1, never below 1.
- **Screen:** "Strong against Flame!" on the move button, so kids see it before choosing. Switching gains a new purpose.
- **Balance:** +1 keeps a right answer more important than the matchup. Check it after the current team balance has been played for a while.
- **Size:** small in code, because `combat.ts` already handles bonuses like `turf`.

## 5. Continent Bosses

A big fight at the end of the World Tour, or unlocked when a continent's maps are full.

- **Eight bosses:** one per heading in the region picker, each a large original creature with the `boss` music.
- **Boss move:** each has one telegraphed attack every third turn, shown like "Next attack". Guarding on that turn matters. Examples are a sandstorm that blocks one charge or a tide that heals the boss.
- **Questions:** drawn from the whole continent, so boss fights test everything learned there.
- **Reward:** a befriendable boss, and a crest in the Passport.
- **Art:** about 8 creatures with 7 sprites each, around 60 to 80 generations with retries.
- **Size:** medium.

## 6. World Tour

A long expedition that crosses regions instead of staying in one.

- **Shape:** 8 to 12 stops across three or more regions, picked at Camp, with a world map route. Moving between continents shows a short flight.
- **Unlock:** after stamping regions on three continents.
- **Finale:** a Continent Boss.
- **Engine:** the biggest change here. `Expedition.regionId` would become a list of regions per stop, and questions, candidates and maps would follow the current stop. Saves need a migration.
- **Size:** medium to large.

## 7. Daily Expedition

One short trail a day, shared by every profile on this computer.

- **Rules:** the date picks the region, route and questions, so the kids play the same trail. Three stops, Ranger difficulty.
- **Scores:** a family board in Camp with correct answers, streak and Trail Score. A daily streak pays a small bonus, and missing a day never takes anything away.
- **Engine:** a date-derived seed for the existing `Rng`. No backend needed.
- **Later:** sharing across devices has to wait for server hosting.
- **Size:** small to medium.

## Also worth considering

- **Listening:** a parent-checked pronunciation button for hard names, using ElevenLabs.
- **Print a map:** a printable map from the parent view showing what a child has found.
- **Loop polish:** new takes of the boss music, plus a short crossfade between tracks.
- **Trip recap:** the three facts learned on the trail, shown at Camp and reviewed the next day.
