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
async function press(key) {
  const before = JSON.stringify(await save());
  await page.keyboard.press(key);
  await settled(before);
}

async function clickState(scope, featureId) {
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

const stats = { guarded: 0, specials: 0, events: 0, befriends: 0, cards: 0, realClicks: 0 };

/** One step of whatever screen is showing, by keyboard except pointing at a state. */
async function step(options = {}) {
  const s = await save();
  const e = s.expedition;
  if (!e.prepared) return press('Enter');

  if (e.event) {
    await shotOnce('event');
    if (e.event.result) return press('Enter');
    stats.events++;
    const q = e.event.question;
    if (q.inputType === 'map-click') return clickState('.question', q.options.find((o) => o.id === q.acceptedId).featureId);
    return press(String(q.options.findIndex((o) => o.id === q.acceptedId) + 1));
  }

  if (e.battle) {
    const b = e.battle;
    if (b.phase === 'choose') {
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
      await shotOnce(b.question.inputType === 'map-click' ? 'question-click' : b.question.inputType === 'map-marker' ? 'question-marker' : 'question');
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
      if (b.action === 'attack' && after.combat.outcome === 'active') {
        await page.locator('.actor.player[data-pose="attack"]').waitFor({ timeout: 1500 });
        await shotOnce('pose-attack');
        await page.locator('.actor.player[data-pose="hit"]').waitFor({ timeout: 2000 });
        await shotOnce('pose-hit');
      }
      if (after.result?.cardId) { stats.cards++; await shotOnce('card-award'); }
      await shotOnce('feedback');
      return;
    }
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
  return press('Enter');
}

const records = ['src/content/us/west.json', 'src/content/europe/countries.json'].flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
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

// A reload and a double click in the middle of a battle.
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
assert.equal(done.companions.length, 2, 'the hunted creature joined the stable');
assert.ok(done.stateCards.length > 0, 'State Cards were earned');
assert.ok(stats.befriends >= 1 && stats.events >= 1 && stats.specials >= 1 && stats.guarded >= 1, JSON.stringify(stats));

// A second trip with the new companion, entirely by keyboard.
await press('Enter');
await press('2');
assert.equal((await save()).expedition.companionId, done.companions[1].instanceId, 'the new companion was chosen');
await press('Enter');
await finishTrail({});
assert.equal((await save()).companions.length, 3, 'a second creature joined');

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
await button(/Expert/).click();
await button(/Short/).click();
await button('Start expedition').click();
await page.getByText('Prepare for the trail').waitFor();
await press('Enter');
await finishTrail({});
assert.ok(stats.realClicks >= 1 || (await save()).completedExpeditions === 2, 'Expert trail finished');

// Europe, as the test profile: all 44 countries, on a blank map.
await button(/Start expedition/).waitFor();
await page.keyboard.press('p');
await button(/Dad/).waitFor();
await page.keyboard.press('3');
await button('Start expedition').waitFor();
await button('Europe').click();
await button(/Expert/).click();
await button(/Long/).click();
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
assert.equal((await save()).completedExpeditions, 1, 'a long Expert trail through Europe finished');

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
await shot('stable-camp');

await page.setViewportSize({ width: 900, height: 620 });
await page.keyboard.press('Enter');
await page.getByText('Prepare for the trail').waitFor();
await shot('tablet');

await browser.close();
assert.deepEqual(errors, [], 'no browser errors');
console.log('Smoke OK', JSON.stringify(stats));
