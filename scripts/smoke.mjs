// Plays one full expedition in a real browser. Expects `npm run dev` on :5199.
// Usage: node scripts/smoke.mjs [screenshot-dir]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const shots = process.argv[2];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 820 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });

const save = () => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('atlaswild', 1);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const get = open.result.transaction('saves').objectStore('saves').get('household');
    get.onsuccess = () => { open.result.close(); resolve(get.result); };
  };
}));
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const click = (name) => page.getByRole('button', { name, exact: true }).click();

await page.goto('http://localhost:5199/');
await page.getByRole('button', { name: 'Start expedition' }).waitFor();
await shot('1-camp');
await click('Start expedition');
await page.getByText('Where was it seen?').waitFor();

// A wrong guess, then the atlas, then the correct place by its numbered button.
let e = (await save()).expedition;
const wrong = e.candidateIds.findIndex((id) => id !== e.targetId);
await click(`Place ${wrong + 1}`);
await page.getByText('Not yet: that was').waitFor();
await click('Open atlas');
await page.locator('.atlas details summary').first().click();
await shot('2-discovery');
await page.reload();
await page.getByText('Clue 2').waitFor();
e = (await save()).expedition;
assert.equal(e.guesses.length, 1, 'guesses survive refresh');
await click(`Place ${e.candidateIds.indexOf(e.targetId) + 1}`);
await page.getByRole('button', { name: 'Begin encounter' }).waitFor();
await shot('3-route');
const attempts = (await save()).attempts;
assert.equal(attempts.at(-1).assisted, true, 'correction-assisted guess is recorded as assisted');

let doubleClicked = false;
let reloaded = false;
for (let encounter = 0; encounter < 3; encounter++) {
  await click('Begin encounter');
  while (true) {
    await click('Attack');
    await page.locator('.option').first().waitFor();
    const before = await save();
    const b = before.expedition.battle;
    if (!reloaded) {
      await shot('4-question');
      await page.reload();
      await page.locator('.option').first().waitFor();
      const labels = await page.locator('.option-label').allTextContents();
      const expected = b.question.inputType === 'choice' ? b.question.options.map((o) => o.label) : labels;
      assert.deepEqual(labels, expected, 'option order survives refresh');
      reloaded = true;
    }
    if (b.question.inputType === 'map-marker') await shot('5-marker');
    const index = b.question.options.findIndex((o) => o.id === b.question.acceptedId);
    const option = page.locator('.option').nth(index);
    if (!doubleClicked) {
      await option.dblclick({ force: true });
      doubleClicked = true;
    } else await option.click();
    await page.getByRole('button', { name: 'Continue' }).waitFor();
    const after = await save();
    assert.equal(after.attempts.length, before.attempts.length + 1, 'one attempt per answer');
    await page.reload();
    await page.getByRole('button', { name: 'Continue' }).waitFor();
    assert.deepEqual((await save()).expedition.battle.combat, after.expedition.battle.combat, 'refresh does not resolve the turn twice');
    await shot('6-feedback');
    await click('Continue');
    await page.waitForFunction(() => document.querySelector('.leave, .complete'));
    if (await page.getByRole('button', { name: 'Attack' }).isVisible()) continue;
    await page.waitForTimeout(50);
    if (await page.getByRole('button', { name: 'Attack' }).isVisible()) continue;
    break;
  }
}

await page.getByText('Expedition complete!').waitFor();
await shot('7-complete');
await page.getByRole('button', { name: /Claim reward/ }).dblclick();
await page.getByText('Welcome back to camp!').waitFor();
await shot('8-camp-after');
await page.reload();
await page.getByRole('button', { name: 'Start expedition' }).waitFor();
const final = await save();
assert.equal(final.completedExpeditions, 1);
assert.equal(final.souvenirIds.length, 1);

// Second expedition, keyboard only.
const key = (k) => page.keyboard.press(k);
await key('Enter');
await page.getByText('Where was it seen?').waitFor();
await key('c');
await page.getByText('Clue 2').waitFor();
await key('a');
await page.getByText('Press 1–4 to look up').waitFor();
await key('1');
await page.locator('.atlas details[open]').waitFor();
assert.equal((await save()).expedition.guesses.length, 0, 'numbers look up rather than guess while the atlas is open');
await key('a');
await page.locator('.atlas').waitFor({ state: 'detached' });
e = (await save()).expedition;
await key(String(e.candidateIds.indexOf(e.targetId) + 1));
await page.getByRole('button', { name: 'Begin encounter' }).waitFor();

await key('=');
await key('ArrowLeft');
for (let done = 0; done < 3; done++) {
  await key('Enter');
  await page.getByRole('button', { name: 'Attack' }).waitFor();
  while (true) {
    await key('a');
    await page.locator('.option').first().waitFor();
    const b = (await save()).expedition.battle;
    await key(String(b.question.options.findIndex((o) => o.id === b.question.acceptedId) + 1));
    await page.getByRole('button', { name: 'Continue' }).waitFor();
    await key('Enter');
    await page.getByRole('button', { name: 'Continue' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /Attack|Begin encounter|Claim reward/ }).waitFor();
    if (!(await page.getByRole('button', { name: 'Attack' }).isVisible())) break;
  }
}
await page.getByText('Expedition complete!').waitFor();
await key('Enter');
await page.getByText('Welcome back to camp!').waitFor();
assert.equal((await save()).completedExpeditions, 2, 'keyboard-only expedition completes');

await key('Enter');
await page.getByText('Where was it seen?').waitFor();

await page.setViewportSize({ width: 900, height: 620 });
await shot('9-tablet');

await browser.close();
assert.deepEqual(errors, [], 'no browser errors');
console.log(`Smoke OK: ${final.attempts.length} attempts, souvenir ${final.souvenirIds[0]}`);
