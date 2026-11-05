#!/usr/bin/env node
/**
 * Turns a list of vocabulary words into a unit of practice questions for the game.
 *
 *   npm run vocab -- --id unit-03 --title "Unit 3" words.txt
 *   npm run vocab -- --id unit-03 --title "Unit 3" --words "benevolent, malevolent, audible"
 *
 * Words can be one per line or separated by commas. Claude writes a kid-friendly definition,
 * an example sentence, wrong choices, a synonym, an antonym and a root for each word, and the
 * result goes to src/content/vocab/<id>.json. Read that file before the kids play: it's what
 * they'll learn from.
 *
 * Credentials come from the environment (ANTHROPIC_API_KEY, or an `ant auth login` profile).
 * Nothing is ever written to the repo except the unit file.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const Choices = z.object({
  right: z.string().describe('The right answer: one word or a short phrase.'),
  wrong: z.array(z.string()).describe('Exactly three answers that are clearly wrong, not near-synonyms or debatable.'),
});

const Word = z.object({
  word: z.string().describe('The word exactly as given.'),
  partOfSpeech: z.string().describe('noun, verb, adjective or adverb, for the sense used in the definition.'),
  definition: z.string().describe('A kid-friendly definition of at most 14 words that does not use the word or its root form. No ending period.'),
  sentence: z.string().describe('A sentence of 10 to 22 words that a 10-year-old would enjoy, with ____ (four underscores) exactly once where the word goes, in exactly the form given.'),
  wrongDefinitions: z.array(z.string()).describe('Exactly three definitions in the same style that sound plausible but are wrong for this word.'),
  synonym: Choices.nullable().describe('A common, easier word that means almost the same, with three wrong choices. Null if there is no clear one.'),
  antonym: Choices.nullable().describe('A common word that means the opposite, with three wrong choices. Null if there is no clear opposite.'),
  root: z.object({
    part: z.string().describe('The Latin or Greek root as it appears in the word, like "bene".'),
    meaning: z.string().describe('What the root means, in one to four words.'),
    wrongMeanings: z.array(z.string()).describe('Exactly three wrong meanings in the same style.'),
  }).nullable().describe('Null unless the word has a clear, well-known Latin or Greek root.'),
});

const Unit = z.object({ words: z.array(Word) });
type UnitWords = z.infer<typeof Unit>['words'];

const SYSTEM = `You write vocabulary practice for a homeschool geography game played by kids aged about 9 to 12, who are studying middle school vocabulary with a focus on Latin and Greek roots.

For each word you are given, write one entry. Everything must be accurate, kind and suitable for children. Use plain words a 10-year-old knows in definitions, sentences and choices.

Wrong choices matter as much as right ones. A wrong definition must be clearly wrong to a child who knows the word, never partly right. A wrong synonym or antonym must not be a near-synonym or near-antonym. Never repeat the right answer among the wrong ones.

Sentences should be fun and concrete, often about animals, places, explorers or nature, and give enough context that the word is the only good fit.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    title: { type: 'string' },
    order: { type: 'string' },
    words: { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const OUT_DIR = 'src/content/vocab';

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!values.id || !/^[a-z0-9-]+$/.test(values.id)) fail('Give a unit id with --id, using lowercase letters, numbers and dashes, like --id unit-03.');
const source = values.words ?? (positionals[0] ? readFileSync(positionals[0], 'utf8') : '');
const words = [...new Set(source.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean))];
if (words.length === 0) fail('Give some words: a file with one word per line, or --words "one, two, three".');
if (words.length > 40) fail(`That's ${words.length} words. Split them into units of 40 or fewer.`);

const outFile = `${OUT_DIR}/${values.id}.json`;
if (existsSync(outFile) && !values.force) fail(`${outFile} already exists. Add --force to replace it.`);
const existingOrders = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith('.json') && f !== `${values.id}.json`).map((f) => JSON.parse(readFileSync(`${OUT_DIR}/${f}`, 'utf8')).order as number) : [];
const order = values.order ? Number(values.order) : Math.max(0, ...existingOrders) + 1;
const title = values.title ?? values.id;

if (values['dry-run']) {
  console.log(`Would ask ${values.model} for ${words.length} words and write ${outFile} (unit "${title}", order ${order}):\n\n${words.join(', ')}`);
  process.exit(0);
}

/** Problems that would make a bad question. Any of these stops the unit from being written. */
function check(entries: UnitWords): string[] {
  const problems: string[] = [];
  const asked = new Set(words.map((w) => w.toLowerCase()));
  const got = new Set(entries.map((e) => e.word.toLowerCase()));
  for (const w of asked) if (!got.has(w)) problems.push(`Missing an entry for "${w}".`);
  for (const e of entries) {
    const name = `"${e.word}"`;
    if (!asked.has(e.word.toLowerCase())) problems.push(`${name} wasn't on the list.`);
    if (e.sentence.split('____').length !== 2) problems.push(`${name}: the sentence needs ____ exactly once.`);
    if (e.definition.toLowerCase().includes(e.word.toLowerCase())) problems.push(`${name}: the definition uses the word itself.`);
    if (e.wrongDefinitions.length !== 3) problems.push(`${name}: needs exactly three wrong definitions.`);
    for (const [label, c] of [['synonym', e.synonym], ['antonym', e.antonym]] as const) {
      if (!c) continue;
      if (c.wrong.length !== 3) problems.push(`${name}: needs exactly three wrong ${label} choices.`);
      if (c.wrong.some((w) => w.toLowerCase() === c.right.toLowerCase())) problems.push(`${name}: a wrong ${label} repeats the right one.`);
    }
    if (e.root && e.root.wrongMeanings.length !== 3) problems.push(`${name}: needs exactly three wrong root meanings.`);
  }
  return problems;
}

const client = new Anthropic();
/** Words go in batches, so each answer stays well inside one request's limits. */
const BATCH = 15;

async function writeBatch(batch: string[]): Promise<{ entries: UnitWords; inputTokens: number; outputTokens: number }> {
  const ask = `Write one entry for each of these ${batch.length} words, in this order:\n\n${batch.map((w, i) => `${i + 1}. ${w}`).join('\n')}`;
  let message;
  try {
    message = await client.beta.messages.parse({
      model: values.model,
      max_tokens: 16000,
      // A declined request is retried on another model, so one odd word doesn't stop the unit.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(Unit) },
      system: SYSTEM,
      messages: [{ role: 'user', content: ask }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) fail('Claude rejected the credentials. Set ANTHROPIC_API_KEY, or run `ant auth login`.');
    if (error instanceof Anthropic.RateLimitError) fail('Rate limited. Wait a minute and try again.');
    if (error instanceof Anthropic.APIError) fail(`Claude API error ${error.status}: ${error.message}`);
    if (error instanceof Error && /credentials|api key|apiKey/i.test(error.message)) fail('No Claude credentials found. Set ANTHROPIC_API_KEY, or run `ant auth login`.');
    throw error;
  }
  if (message.stop_reason === 'refusal') fail(`Claude declined to write: ${batch.join(', ')}. Check those words for anything unusual.`);
  if (message.stop_reason === 'max_tokens') fail('The answer was cut off. Try fewer words at a time.');
  if (!message.parsed_output) fail('Claude\'s answer didn\'t match the expected format. Try again.');
  return { entries: message.parsed_output.words, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
}

console.log(`Asking ${values.model} to write ${words.length} words for "${title}"...`);
const batches = Array.from({ length: Math.ceil(words.length / BATCH) }, (_, i) => words.slice(i * BATCH, (i + 1) * BATCH));
const results = await Promise.all(batches.map(writeBatch));
const parsed = { words: results.flatMap((r) => r.entries) };
const usage = { input_tokens: results.reduce((n, r) => n + r.inputTokens, 0), output_tokens: results.reduce((n, r) => n + r.outputTokens, 0) };

const problems = check(parsed.words);
if (problems.length > 0) fail(`The unit wasn't written, because of these problems:\n- ${problems.join('\n- ')}\n\nRun it again, or fix the words and retry.`);

// Keep the order the words were given in.
const byWord = new Map(parsed.words.map((e) => [e.word.toLowerCase(), e]));
const unit = { id: values.id, title, order, words: words.map((w) => ({ ...byWord.get(w.toLowerCase())!, word: w })) };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(unit, null, 2)}\n`);

console.log(`\nWrote ${outFile}: ${unit.words.length} words, unit "${title}" (order ${order}).`);
console.log(`Used ${usage.input_tokens} input and ${usage.output_tokens} output tokens.\n`);
for (const e of unit.words) {
  console.log(`  ${e.word} (${e.partOfSpeech}): ${e.definition}`);
  console.log(`    "${e.sentence}"`);
}
console.log('\nRead the definitions and sentences above before the kids play. Edit the JSON file to fix anything.');
