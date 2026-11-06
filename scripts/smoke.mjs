// Plays real expeditions in a real browser. Expects `npm run dev` on :5199, or set SMOKE_URL.
// Usage: node scripts/smoke.mjs [screenshot-dir]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const shots = process.argv[2];
const BASE = process.env.SMOKE_URL ?? 'http://localhost:5199';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 820 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });

const readDb = (keyOf) => page.evaluate((body) => new Promise((resolve, reject) => {
  const open = indexedDB.open('atlaswild', 1);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const store = open.result.transaction('saves').objectStore('saves');
    const meta = store.get('meta');
    meta.onsuccess = () => {
      const key = new Function('meta', body)(meta.result);
      const get = store.get(key);
      get.onsuccess = () => { open.result.close(); resolve(get.result); };
    };
  };
}), keyOf);
const save = () => readDb('return `profile:${meta.activeProfileId}`');

const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const shotOnce = (() => { const done = new Set(); return async (name) => { if (!done.has(name)) { done.add(name); await shot(name); } }; })();
const button = (name) => page.getByRole('button', { name });

/** Waits until the saved game changes, so the next step sees the new state. */
async function settled(before) {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (JSON.stringify(await save()) !== before) { await page.waitForTimeout(40); return; }
    await page.waitForTimeout(15);
  }
  throw new Error('The game did not respond');
}
/** A creature met for the first time opens its Field Guide card once the VS intro ends. It holds the keys until closed. */
async function closeGuide() {
  if (await page.locator('.vs-intro').count()) await page.locator('.vs-intro').waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
  if (!(await page.locator('.guide-card').count())) return;
  stats.guides = (stats.guides ?? 0) + 1;
  if (stats.guides === 1) { await page.waitForTimeout(400); await shotOnce('field-guide'); }
  const before = JSON.stringify(await save());
  await page.keyboard.press('Enter');
  await settled(before);
}

async function press(key) {
  await closeGuide();
  const before = JSON.stringify(await save());
  await page.keyboard.press(key);
  await settled(before);
}

async function clickState(scope, featureId) {
  const dot = (await save()).expedition?.event?.question.options.find((o) => o.featureId === featureId && o.tiny);
  if (dot) {
    const was = JSON.stringify(await save());
    await page.locator(`${scope} .dot[data-place="${dot.id}"]`).dispatchEvent('click');
    await settled(was);
    return false;
  }
  const before = JSON.stringify(await save());
  const point = await page.evaluate(([where, id]) => {
    const shape = document.querySelector(`${where} path[data-feature="${id}"]`);
    const r = shape.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    return document.elementFromPoint(x, y) === shape ? [x, y] : null;
  }, [scope, featureId]);
  if (point) await page.mouse.click(point[0], point[1]);
  else await page.locator(`${scope} path[data-feature="${featureId}"]`).dispatchEvent('click');
  await settled(before);
  return !!point;
}

const stats = { guarded: 0, specials: 0, events: 0, befriends: 0, cards: 0, realClicks: 0, typed: 0, keypad: 0 };

/** Types an answer: on the on-screen number pad the first time, then with the keyboard. */
async function typeAnswer(q) {
  const before = JSON.stringify(await save());
  await page.locator('.typed-answer input').waitFor();
  await shotOnce(q.typed.kind === 'word' ? 'typed-word' : 'typed-number');
  stats.typed++;
  if (q.typed.kind !== 'word' && stats.keypad === 0) {
    for (const ch of q.acceptedId) {
      const label = ch === '-' ? 'minus' : ch === '/' ? 'fraction bar' : ch === ' ' ? 'space, for a mixed number' : ch;
      await page.getByRole('button', { name: label, exact: true }).click();
    }
    stats.keypad++;
    await shotOnce('keypad-filled');
    await button(/Check answer/).click();
  } else {
    await page.locator('.typed-answer input').fill(q.acceptedId);
    await page.locator('.typed-answer input').press('Enter');
  }
  await settled(before);
}

/** One step of whatever screen is showing, by keyboard except pointing at a state. */
async function step(options = {}) {
  await closeGuide();
  const s = await save();
  const e = s.expedition;
  if (!e.prepared) return press('Enter');

  if (e.event) {
    await shotOnce('event');
    if (e.event.result) return press('Enter');
    stats.events++;
    const q = e.event.question;
    if (q.inputType === 'typed') return typeAnswer(q);
    if (q.inputType === 'map-click') return clickState('.question', q.options.find((o) => o.id === q.acceptedId).featureId);
    return press(String(q.options.findIndex((o) => o.id === q.acceptedId) + 1));
  }

  if (e.battle) {
    const b = e.battle;
    if (b.phase === 'choose') {
      if (b.mustSwitch) {
        const next = e.teamIds.findIndex((id) => id !== e.companionId && b.bench[id].hp > 0);
        return press(String(next + 1));
      }
      if (b.befriending) {
        await shotOnce('befriend');
        stats.befriends++;
        return press('b');
      }
      if (b.combat.charge >= 2) { stats.specials++; return press('s'); }
      if (options.guard && b.combat.turn === 1) { stats.guarded++; return press('g'); }
      return press('a');
    }
    if (b.phase === 'question') {
      if (!stats.moveChanged && !b.befriending) {
        stats.moveChanged = true;
        await shotOnce('move-bar');
        await press('c');
        const back = (await save()).expedition.battle;
        assert.equal(back.phase, 'choose', 'C goes back to the moves');
        assert.equal(back.question.id, b.question.id, 'changing moves keeps the question');
        return;
      }
      if (b.question.flag) await shotOnce('flag-question');
      if (b.question.options[0].flag) await shotOnce('flag-options');
      await shotOnce(b.question.inputType === 'map-click' ? 'question-click' : b.question.inputType === 'map-marker' ? 'question-marker' : 'question');
      if (b.question.inputType === 'typed') {
        await typeAnswer(b.question);
        assert.equal((await save()).expedition.battle.result.correct, true, `typing ${b.question.acceptedId} is right`);
        return;
      }
      const accepted = b.question.options.find((o) => o.id === b.question.acceptedId);
      if (b.question.inputType === 'map-click') {
        if (accepted.tiny) {
          const before = JSON.stringify(s);
          await page.locator(`.question .dot[data-place="${accepted.id}"]`).dispatchEvent('click');
          await settled(before);
          assert.equal((await save()).expedition.battle.result.correct, true, `the dot for ${accepted.label} answers`);
          return;
        }
        if (await clickState('.question', accepted.featureId)) {
          stats.realClicks++;
          assert.equal((await save()).expedition.battle.result.correct, true, `clicking ${accepted.label} lands on it`);
        }
        return;
      }
      await press(String(b.question.options.indexOf(accepted) + 1));
      const after = (await save()).expedition.battle;
      if (b.action === 'special' && after.result?.correct) {
        await page.locator('.type-special').waitFor({ state: 'attached', timeout: 1500 });
        stats.typeStorms = (stats.typeStorms ?? 0) + 1;
        await page.waitForTimeout(300);
        await shotOnce('type-special');
      }
      if (b.action === 'attack' && after.combat.outcome === 'active') {
        // These animations are brief, so a busy machine can miss one. Count them, and check the totals at the end.
        const seen = (locator, timeout, state = 'visible') => locator.waitFor({ state, timeout }).then(() => true, () => false);
        if (await seen(page.locator('.actor.player[data-pose="attack"]'), 1500)) await shotOnce('pose-attack');
        if (await seen(page.locator('.actor-slot .type-hit').first(), 1500, 'attached')) {
          stats.typeHits = (stats.typeHits ?? 0) + 1;
          await page.waitForTimeout(180);
          await shotOnce('type-hit');
        } else stats.missedAnimations = (stats.missedAnimations ?? 0) + 1;
        if (await seen(page.locator('.actor.player[data-pose="hit"]'), 2000)) await shotOnce('pose-hit');
        else stats.missedAnimations = (stats.missedAnimations ?? 0) + 1;
      }
      if (after.result?.cardId) { stats.cards++; await page.locator('.card-award .place-flash').waitFor({ timeout: 2000 }); await page.waitForTimeout(350); await shotOnce('card-award'); }
      else if (b.question.inputType === 'choice' && b.question.locationId) { await page.locator('.feedback .place-flash').waitFor({ timeout: 2000 }); stats.placeFlashes = (stats.placeFlashes ?? 0) + 1; await page.waitForTimeout(350); await shotOnce('place-flash'); }
      await shotOnce('feedback');
      return;
    }
    if (b.combat.outcome === 'victory' && e.slots[b.slotIndex].status === 'won' && !b.befriended) {
      await page.locator('.victory-banner').waitFor({ timeout: 6000 }).catch(() => undefined);
      if (await page.locator('.victory-banner').count()) { stats.victoryBanners = (stats.victoryBanners ?? 0) + 1; await shotOnce('victory'); }
    }
    // A win holds Continue for a moment, so the child sees it.
    await page.locator('.feedback button.primary:enabled').waitFor({ timeout: 8000 });
    return press('Enter');
  }

  if (e.discovery === 'searching') {
    await shotOnce(e.difficulty === 'expert' ? 'discovery-expert' : 'discovery');
    if (e.difficulty === 'expert') {
      const target = records.find((r) => r.id === e.targetId);
      if (target.tiny) {
        const before = JSON.stringify(s);
        await page.locator(`.dot[data-place="${e.targetId}"]`).dispatchEvent('click');
        return settled(before);
      }
      return clickState('.discovery-map', target.fips);
    }
    return press(String(e.candidateIds.indexOf(e.targetId) + 1));
  }
  // A new kind of creature joining gets the big reveal.
  if (await page.locator('.new-creature').count()) {
    stats.newCreatureReveals = (stats.newCreatureReveals ?? 0) + 1;
    await page.waitForTimeout(1600);
    await shotOnce('new-creature');
  }
  return press('Enter');
}

const records = ['src/content/us/west.json', 'src/content/europe/countries.json', 'src/content/world/antarctica.json', 'src/content/world/oceania.json'].flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const featureOf = async (id) => records.find((r) => r.id === id).fips;

async function finishTrail(options) {
  for (let i = 0; i < 300; i++) {
    if (!(await save()).expedition) return;
    await step(options);
  }
  throw new Error('The trail never finished');
}

// Upgrade: an old save, written before the app first opens, reaches both children.
await page.goto(`${BASE}/art/slatepaw.png`);
await page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('atlaswild', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('saves');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction('saves', 'readwrite');
    tx.objectStore('saves').put({
      schemaVersion: 1, contentVersion: 'old',
      profile: { id: 'old', displayName: 'Explorer', avatarId: 'explorer' },
      companion: { instanceId: 'old-1', speciesId: 'slatepaw', bondXp: 0 },
      souvenirIds: ['compass'], completedExpeditions: 1, nextId: 30, rngState: 77,
      offer: { id: 'o', reward: { kind: 'souvenir', souvenirId: 'shell' } },
      expedition: null, attempts: [], recentQuestionIds: [], appliedRewardIds: ['e1'], lastSummary: null,
    }, 'household');
    tx.oncomplete = () => { open.result.close(); resolve(); };
  };
}));
await page.goto(`${BASE}/`);
await button(/Explorer 1/).waitFor();
assert.equal(await page.getByText('1 expeditions').count(), 2, 'both children received the old save');
await shot('profiles');

// Explorer 1: a full Standard trail, with shopping, help, reloads and a double click.
await button(/Explorer 1/).click();
await button('Start expedition').waitFor();
await shot('camp');
await button('Start expedition').click();
await page.getByText('Prepare for the trail').waitFor();
await press('s');
await press('t');
assert.deepEqual([(await save()).expedition.points], [4], 'the Prep Shop charged for both items');
await shot('prep');
await press('Enter');

await page.getByText('Where was it seen?').waitFor();
let e = (await save()).expedition;
const wrong = e.candidateIds.find((id) => id !== e.targetId);
await press(String(e.candidateIds.indexOf(wrong) + 1));
await page.getByText('Not yet: that was').waitFor();
assert.equal((await save()).expedition.points, 3, 'a wrong guess costs a point');
await press('a');
await page.getByText('Press a number to look up').waitFor();
await page.keyboard.press('1');
await page.locator('.atlas details[open]').waitFor();
assert.equal((await save()).expedition.guesses.length, 1, 'numbers look up rather than guess while the atlas is open');
await page.keyboard.press('a');
await page.locator('.atlas').waitFor({ state: 'detached' });
await page.reload();
await page.getByText('Clue 2').waitFor();
assert.equal((await save()).expedition.guesses.length, 1, 'guesses survive refresh');
await step();
assert.equal((await save()).attempts.at(-1).assisted, true, 'a corrected guess is recorded as assisted');

// A reload and a double click in the middle of a battle. A first meeting opens a Field Guide card first.
await press('Enter');
await press('a');
const before = await save();
await page.reload();
await page.locator('.option').first().waitFor();
const labels = await page.locator('.option-label').allTextContents();
const q = before.expedition.battle.question;
if (q.inputType === 'choice') assert.deepEqual(labels, q.options.map((o) => o.label), 'option order survives refresh');
await page.locator('.option').nth(q.options.findIndex((o) => o.id === q.acceptedId)).dblclick({ force: true });
await button(/Continue/).waitFor();
const after = await save();
assert.equal(after.attempts.length, before.attempts.length + 1, 'one attempt per answer');
await page.reload();
await button(/Continue/).waitFor();
assert.deepEqual((await save()).expedition.battle.combat, after.expedition.battle.combat, 'refresh does not resolve the turn twice');

await finishTrail({ guard: true });
await page.getByText('Welcome back to camp!').waitFor();
await shot('camp-after');
await page.reload();
await button('Start expedition').waitFor();
const done = await save();
assert.equal(done.completedExpeditions, 2);
console.log('Stable after trip 1:', done.companions.map((c) => c.speciesId).join(', '));
// A rare encounter can add one more, and the seed is random.
assert.ok(done.companions.length >= 2, 'the hunted creature joined the stable');
assert.ok(done.stateCards.length > 0, 'State Cards were earned');
assert.ok((stats.guides ?? 0) >= 1 && stats.befriends >= 1 && stats.events >= 1 && stats.specials >= 1 && stats.guarded >= 1, JSON.stringify(stats));

// A second trip with the new companion, entirely by keyboard.
await press('Enter');
await press('2');
assert.deepEqual((await save()).expedition.teamIds, [done.companions[0].instanceId, done.companions[1].instanceId], 'the new companion joined the team');
await press('Enter');
// Find the first place, then switch creatures by keyboard.
await step();
await press('Enter');
await page.getByRole('button', { name: /Switch creature/ }).waitFor();
await shotOnce('team');
await closeGuide();
await page.keyboard.press('w');
await page.getByText('Switch to who?').waitFor();
await press('2');
assert.equal((await save()).expedition.companionId, done.companions[1].instanceId, 'switching changes the active creature');
await finishTrail({});
assert.ok((await save()).companions.length > done.companions.length, 'a second creature joined');

// Isolation: the other child sees none of that progress.
await button(/Start expedition/).waitFor();
await page.keyboard.press('p');
await button(/Explorer 2/).waitFor();
await page.keyboard.press('2');
await button('Start expedition').waitFor();
const second = await save();
assert.equal(second.completedExpeditions, 1, 'each profile keeps its own count');
assert.equal(second.companions.length, 1);

// Expert: clicking states on a blank map, for finding places and answering.
await page.getByRole('button', { name: 'Expert', exact: true }).click();
await button(/Short/).click();
await button('Start expedition').click();
await page.getByText('Prepare for the trail').waitFor();
await press('Enter');
await finishTrail({});
assert.ok(stats.realClicks >= 1 || (await save()).completedExpeditions === 2, 'Expert trail finished');

// Southern Europe, as the test profile: 15 countries, on a blank map.
await button(/Start expedition/).waitFor();
await page.keyboard.press('p');
await button(/Dad/).waitFor();
await page.keyboard.press('3');
await button('Start expedition').waitFor();
await button('Southern Europe').click();
await page.getByRole('button', { name: 'Expert', exact: true }).click();
await page.getByRole('button', { name: 'Long', exact: true }).click();
await button('Start expedition').click();
await page.getByText('Prepare for the trail').waitFor();
await press('Enter');
await shotOnce('europe-expert');
// Choosing on a blank map with only the keyboard.
await page.keyboard.press('ArrowRight');
await page.locator('.discovery-map .land-cursor').waitFor();
await page.keyboard.press('ArrowLeft');
await shotOnce('map-cursor');
const beforeKeys = (await save()).attempts.length;
await press('Enter');
assert.equal((await save()).attempts.length, beforeKeys + 1, 'arrow keys and Enter choose a place');
await finishTrail({});
assert.equal((await save()).completedExpeditions, 1, 'a long Expert trail through Southern Europe finished');

// The Passport.
await button(/Start expedition/).waitFor();
await page.keyboard.press('v');
await page.getByText("Explorer's Passport").waitFor();
await shotOnce('passport');
await page.keyboard.press('v');
await button(/Start expedition/).waitFor();

// The two regions with their own maps, on Expert: landmarks in Antarctica, tiny islands in Oceania.
for (const [i, name] of ['Antarctica', 'Oceania'].entries()) {
  // A strong trail can end in an evolution, which waits for a key press.
  for (let tries = 0; tries < 5 && !(await button(/Start expedition/).count()); tries++) {
    await shot(`after-${name}-${tries}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
  }
  await button(/Start expedition/).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name, exact: true }).click();
  if (name === 'Oceania') { await button('Flags').click(); await shotOnce('camp-focus'); }
  await button('Start expedition').click();
  await page.getByText('Prepare for the trail').waitFor();
  await press('Enter');
  await shotOnce(`expert-${name}`);
  await finishTrail({});
  assert.equal((await save()).completedExpeditions, 2 + i, `an Expert trail through ${name} finished`);
}

// Oceania is one region, so its stamp unlocks the boss. Meet it, then see its big attack coming.
for (let tries = 0; tries < 5 && !(await button(/Start expedition/).count()); tries++) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
}
await page.getByText('Continent Boss!').first().waitFor();
await button('Short').click();
await button('Scout').click();
await button('Everything').click();
await button('Start expedition').click();
await page.getByText('Prepare for the trail').waitFor();
await shotOnce('prep-types');
await press('Enter');
for (let i = 0; i < 200; i++) {
  const b = (await save()).expedition?.battle;
  if (b?.combat.bossPower && b.combat.turn === 3 && b.phase === 'choose' && !b.mustSwitch) break;
  await step({ guard: true });
}
const bossFight = (await save()).expedition.battle;
assert.equal(bossFight.combat.bossPower, 3, 'the boss winds up a big hit');
await page.locator('.boss-warning').waitFor();
await page.waitForTimeout(400);
await shotOnce('boss-turn');
await button('Leave expedition').click();
await button(/Start expedition/).waitFor();

// A Math trail on Ranger types answers, and a Words trail on Expert spells words.
for (const [focus, level] of [['Math', 'Ranger'], ['Words', 'Expert']]) {
  for (let tries = 0; tries < 5 && !(await button(/Start expedition/).count()); tries++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
  }
  await page.getByRole('button', { name: 'American West', exact: true }).click();
  await button(focus).click();
  await page.locator('.study-creatures').waitFor();
  await shotOnce(`camp-${focus.toLowerCase()}`);
  await page.getByRole('button', { name: level, exact: true }).click();
  await button('Short').click();
  const done = (await save()).completedExpeditions;
  await button('Start expedition').click();
  await page.getByText('Prepare for the trail').waitFor();
  await press('Enter');
  await finishTrail({});
  const after = await save();
  assert.equal(after.completedExpeditions, done + 1, `a ${focus} trail finished`);
  const study = after.attempts.filter((a) => a.objectiveId.startsWith(focus === 'Math' ? 'math-' : 'word-'));
  assert.ok(study.length >= 3, `the ${focus} trail asked ${focus.toLowerCase()} questions`);
}
assert.ok(stats.typed >= 2 && stats.keypad === 1, `typed answers worked (${stats.typed})`);

await page.keyboard.press('p');
await button(/Explorer 2/).waitFor();
await page.keyboard.press('2');

// A camp summary saved by an older version, with none of the newer fields.
await page.evaluate(() => new Promise((resolve) => {
  const open = indexedDB.open('atlaswild', 1);
  open.onsuccess = () => {
    const tx = open.result.transaction('saves', 'readwrite');
    const store = tx.objectStore('saves');
    const meta = store.get('meta');
    meta.onsuccess = () => {
      const key = `profile:${meta.result.activeProfileId}`;
      const get = store.get(key);
      get.onsuccess = () => {
        store.put({ ...get.result, lastSummary: { expeditionId: 'old', reward: { kind: 'creature', speciesId: 'cragmaw' }, answered: 9, correct: 8, discoveryAssisted: false, souvenirId: null, cardsEarned: 2 } }, key);
      };
    };
    tx.oncomplete = () => { open.result.close(); resolve(); };
  };
}));
await page.reload();
await page.getByText('Welcome back to camp!').waitFor();

// Backup and restore.
await button(/Start expedition/).waitFor();
await page.keyboard.press('o');
await page.getByRole('heading', { name: /Settings for Explorer 2/ }).waitFor();
const [download] = await Promise.all([page.waitForEvent('download'), button('Download backup').click()]);
const backupPath = await download.path();
await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
await page.getByText(/Nothing changed/).waitFor();
await page.getByLabel('Name').fill('Renamed');
await page.waitForTimeout(100);
page.once('dialog', (d) => d.accept());
await page.locator('input[type=file]').setInputFiles(backupPath);
await button(/Explorer 2/).waitFor();
assert.equal(await button(/Renamed/).count(), 0, 'restore replaced the rename');
await page.keyboard.press('1');
await button('Start expedition').waitFor();
await page.keyboard.press('m');
await page.getByRole('heading', { name: 'Mastery Medals' }).waitFor({ timeout: 3000 });
stats.medalTracks = await page.locator('.medal-track').count();
assert.ok(stats.medalTracks >= 60, `every region shows its medal tracks (${stats.medalTracks})`);
await shot('medals');
await page.keyboard.press('m');
await page.getByRole('heading', { name: 'Base Camp' }).waitFor({ timeout: 3000 });
await shot('stable-camp');

// A Ranger Lodge: the ladder, the hall between battles, the leader, and the prize.
await page.keyboard.press('g');
await page.getByRole('heading', { name: 'Ranger Lodges' }).waitFor({ timeout: 3000 });
assert.equal(await page.locator('.lodge-card').count(), 8, 'eight Lodges on the ladder');
assert.equal(await page.locator('.lodge-locked').count(), 7, 'only the first Lodge is open');
await shot('lodges');
await page.keyboard.press('Enter');
await page.getByText('Get ready for Wildwood Lodge').waitFor();
await shot('lodge-prep');
await page.keyboard.press('Enter');
await page.locator('.lodge-hall').waitFor();
await page.waitForTimeout(900);
await shot('lodge-hall');
for (let i = 0; i < 400 && (await save()).expedition; i++) {
  if (await page.locator('.lodge-complete').count()) { await page.waitForTimeout(900); await shotOnce('lodge-complete'); }
  await step();
}
const lodged = await save();
assert.ok(!lodged.expedition, 'the Lodge finished');
assert.deepEqual(lodged.lodgesBeaten, ['wildwood'], 'Wildwood Lodge is beaten');
assert.ok(lodged.companions.some((c) => c.speciesId === 'rustlepaw'), 'the prize creature joined');
// The big Lodge XP bonus can evolve a creature first.
for (let i = 0; i < 5 && !(await page.getByText(/New patch/).count()); i++) {
  if (await page.locator('.evolving').count()) { stats.lodgeEvolutions = (stats.lodgeEvolutions ?? 0) + 1; await shotOnce('lodge-evolve'); await page.waitForTimeout(2500); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(800);
}
await page.getByText(/New patch/).waitFor({ timeout: 3000 });
await shot('lodge-summary');

// Wave 2: a ready egg hatches, and a Silver Lodge's Mastery Test earns Gold and a legendary.
await page.evaluate(() => new Promise((resolve) => {
  const open = indexedDB.open('atlaswild', 1);
  open.onsuccess = () => {
    const tx = open.result.transaction('saves', 'readwrite');
    const store = tx.objectStore('saves');
    store.get('meta').onsuccess = (m) => {
      const key = `profile:${m.target.result.activeProfileId}`;
      store.get(key).onsuccess = (g) => store.put({ ...g.target.result, lastSummary: null, eggs: [{ id: 'egg-smoke', kind: 'math', progress: 20 }, { id: 'egg-warm', kind: 'words', progress: 9 }], lodgeTiers: { wildwood: 'silver' }, lodgeTestReady: ['wildwood'], eggMeter: { math: 5, words: 2, laid: 2 } }, key);
    };
    tx.oncomplete = () => { open.result.close(); resolve(); };
  };
}));
await page.reload();
await page.locator('.egg-nest').waitFor();
await page.locator('.egg-nest').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.locator('.egg-nest').screenshot({ path: `${shots ?? '/tmp'}/egg-nest-panel.png` }).catch(() => undefined);
await shot('egg-nest');
await button('Hatch it!').click();
await page.getByRole('heading', { name: /hatched/ }).waitFor({ timeout: 4000 });
await page.waitForTimeout(500);
await shot('hatch');
const hatched = await save();
assert.equal(hatched.eggs.length, 1, 'the ready egg hatched');
assert.equal(hatched.hatchedCount, 1);
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'Base Camp' }).waitFor({ timeout: 3000 });
await page.keyboard.press('g');
await button('Take the Mastery Test').click();
await page.locator('.lodge-quiz-head').waitFor();
await page.waitForTimeout(700);
await shot('mastery-quiz');
for (let i = 0; i < 40; i++) {
  const t = (await save()).lodgeQuiz;
  if (!t || t.outcome) break;
  if (t.result) {
    await page.locator('.feedback button.primary:enabled').waitFor({ timeout: 8000 });
    const was = JSON.stringify(t);
    await page.keyboard.press('Enter');
    for (let w = 0; w < 50 && JSON.stringify((await save()).lodgeQuiz) === was; w++) await page.waitForTimeout(50);
    continue;
  }
  const q = t.questions[t.index];
  if (q.inputType === 'typed') await typeAnswer(q);
  else if (q.inputType === 'map-click') {
    const o = q.options.find((x) => x.id === q.acceptedId);
    const before = JSON.stringify(await save());
    if (o.tiny) await page.locator(`.question .dot[data-place="${o.id}"]`).dispatchEvent('click');
    else await page.locator(`.question path[data-feature="${o.featureId}"]`).dispatchEvent('click');
    await settled(before);
  } else {
    const before = JSON.stringify(await save());
    await page.keyboard.press(String(q.options.findIndex((o) => o.id === q.acceptedId) + 1));
    await settled(before);
  }
}
const gold = await save();
assert.equal(gold.lodgeQuiz?.outcome, 'passed', 'the Mastery Test passed');
assert.equal(gold.lodgeTiers.wildwood, 'gold', 'Gold patch earned');
assert.ok(gold.companions.some((c) => c.speciesId === 'qiloom'), 'the legendary joined');
await page.getByRole('heading', { name: 'Gold patch!' }).waitFor();
await page.waitForTimeout(600);
await shot('gold');
await page.keyboard.press('Enter');
await page.getByRole('heading', { name: 'Base Camp' }).waitFor({ timeout: 3000 });
await page.keyboard.press('g');
await page.locator('.lodge-gold').waitFor();
await shot('lodges-gold');
await page.keyboard.press('g');
await page.getByRole('heading', { name: 'Base Camp' }).waitFor({ timeout: 3000 });

await page.setViewportSize({ width: 900, height: 620 });
await page.keyboard.press('Enter');
await page.getByText('Prepare for the trail').waitFor();
await shot('tablet');

await browser.close();
assert.deepEqual(errors, [], 'no browser errors');
assert.ok((stats.typeHits ?? 0) >= 10 && (stats.missedAnimations ?? 0) <= (stats.typeHits ?? 0) / 3, `attack animations should show almost every time: ${JSON.stringify(stats)}`);
console.log('Smoke OK', JSON.stringify(stats));
