import { formatRational, gcd, reduce, sameValue, type NumberAnswer, type Rational } from '../../engine/answers';
import { Rng } from '../../engine/rng';
import type { Difficulty, Question, QuestionOption } from '../types';

/**
 * Math practice in the spirit of a fourth-grade factors, fractions and integers unit.
 * Every problem is computed from its own numbers, so the answer is always right, and
 * wrong choices come from the mistakes children commonly make.
 */

export type MathSkill =
  | 'prime' | 'factor-of' | 'gcf' | 'lcm' | 'factor-count' | 'factorization'
  | 'equivalent' | 'simplify' | 'compare-fractions' | 'add-like' | 'fraction-of' | 'add-unlike' | 'mixed'
  | 'compare-integers' | 'add-integers' | 'subtract-integers' | 'integer-world';

export const MATH_TOPICS: Record<'factors' | 'fractions' | 'integers', { name: string; skills: MathSkill[] }> = {
  factors: { name: 'Factors', skills: ['prime', 'factor-of', 'gcf', 'lcm', 'factor-count', 'factorization'] },
  fractions: { name: 'Fractions', skills: ['equivalent', 'simplify', 'compare-fractions', 'add-like', 'fraction-of', 'add-unlike', 'mixed'] },
  integers: { name: 'Integers', skills: ['compare-integers', 'add-integers', 'subtract-integers', 'integer-world'] },
};
export type MathTopic = keyof typeof MATH_TOPICS;

export const SKILL_NAMES: Record<MathSkill, string> = {
  prime: 'Prime numbers',
  'factor-of': 'Factors',
  gcf: 'Greatest common factor',
  lcm: 'Least common multiple',
  'factor-count': 'Counting factors',
  factorization: 'Prime factorization',
  equivalent: 'Equivalent fractions',
  simplify: 'Simplest form',
  'compare-fractions': 'Comparing fractions',
  'add-like': 'Same denominators',
  'fraction-of': 'Fraction of a number',
  'add-unlike': 'Different denominators',
  mixed: 'Mixed numbers',
  'compare-integers': 'Comparing integers',
  'add-integers': 'Adding integers',
  'subtract-integers': 'Subtracting integers',
  'integer-world': 'Integers around the world',
};

const PER_SKILL = 24;
const MINUS = '−';
/** Shows a negative with a real minus sign, which reads better than a hyphen. */
const show = (n: number) => (n < 0 ? `${MINUS}${-n}` : String(n));
const showR = (r: Rational) => formatRational(r).replace('-', MINUS);
const paren = (n: number) => (n < 0 ? `(${show(n)})` : show(n));

const factorsOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
const isPrime = (n: number) => n > 1 && factorsOf(n).length === 2;
const lcmOf = (a: number, b: number) => (a * b) / gcd(a, b);
function primeFactors(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let p = 2; m > 1; p++) while (m % p === 0) { out.push(p); m /= p; }
  return out;
}

const between = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
const pick = <T,>(rng: Rng, items: readonly T[]) => items[Math.floor(rng.next() * items.length)] as T;

interface Draft {
  prompt: string;
  explanation: string;
  hint?: string;
  /** A choice question: the right label and the wrong ones. */
  right?: string;
  wrong?: string[];
  /** A typed question. */
  typed?: NumberAnswer;
  sourceUrl?: string;
}

/** Four choices: the right one and three different wrong ones. Null if there aren't enough distinct wrong ones. */
function choiceOptions(right: string, wrong: readonly string[]): QuestionOption[] | null {
  // A wrong choice worth the same as the right one, like 2/4 beside 1/2, would also be right.
  const plain = (t: string) => t.replaceAll(MINUS, '-');
  const distinct: string[] = [];
  for (const w of wrong) {
    if (w === right || sameValue(plain(w), plain(right))) continue;
    if (distinct.some((x) => x === w || sameValue(plain(x), plain(w)))) continue;
    distinct.push(w);
  }
  distinct.splice(3);
  if (distinct.length < 3) return null;
  return [right, ...distinct].map((label) => ({ id: `o-${label}`, label }));
}

type Maker = (rng: Rng, d: Difficulty) => Draft | null;

const MAKERS: Record<MathSkill, Maker> = {
  prime: (rng, d) => {
    const top = d === 'scout' ? 30 : d === 'ranger' ? 60 : 100;
    const primes = Array.from({ length: top }, (_, i) => i + 2).filter(isPrime);
    // Odd composites look prime, so they make the best wrong choices.
    const tricky = Array.from({ length: top }, (_, i) => i + 4).filter((n) => !isPrime(n) && (d === 'scout' ? true : n % 2 === 1));
    const right = pick(rng, primes);
    const wrong = rng.shuffle([...tricky, 1]).slice(0, 3);
    return {
      prompt: 'Which of these numbers is prime?',
      right: String(right),
      wrong: wrong.map(String),
      explanation: `${right} has exactly two factors, 1 and ${right}, so it's prime.`,
      hint: 'A prime number has exactly two factors: 1 and itself. 1 is not prime, because it has only one factor.',
    };
  },
  'factor-of': (rng, d) => {
    const n = d === 'scout' ? between(rng, 12, 40) : between(rng, 40, 96);
    const fs = factorsOf(n).filter((f) => f > 1 && f < n);
    if (fs.length < 2) return null;
    const right = pick(rng, fs);
    const non = rng.shuffle(Array.from({ length: 13 }, (_, i) => i + 2).filter((x) => n % x !== 0)).slice(0, 3);
    return {
      prompt: `Which number is a factor of ${n}?`,
      right: String(right),
      wrong: non.map(String),
      explanation: `${right} × ${n / right} = ${n}, so ${right} is a factor of ${n}.`,
      hint: 'A factor divides a number with nothing left over.',
    };
  },
  gcf: (rng, d) => {
    const g = between(rng, 2, d === 'scout' ? 6 : 9);
    // Two different numbers that share no factor, so g is the greatest common one.
    const x = pick(rng, [1, 2, 3, 4, 5, 7]);
    const y = pick(rng, [2, 3, 4, 5, 7]);
    if (x === y || gcd(x, y) !== 1) return null;
    const a = g * x;
    const b = g * y;
    const common = factorsOf(g).filter((f) => f < g);
    const draft: Draft = {
      prompt: `What is the greatest common factor of ${a} and ${b}?`,
      explanation: `${a} = ${g} × ${x} and ${b} = ${g} × ${y}. No bigger number divides both, so the GCF is ${g}.`,
      hint: 'List the factors of each number, then find the biggest one they share.',
    };
    if (d === 'expert') return { ...draft, typed: { value: { num: g, den: 1 }, kind: 'integer' } };
    return { ...draft, right: String(g), wrong: [...common.filter((c) => c > 1), lcmOf(a, b), Math.min(a, b), 1].map(String) };
  },
  lcm: (rng, d) => {
    const a = between(rng, 2, d === 'scout' ? 8 : 12);
    const b = between(rng, 2, d === 'scout' ? 8 : 12);
    if (a === b || a % b === 0 || b % a === 0) return null;
    const l = lcmOf(a, b);
    const draft: Draft = {
      prompt: `What is the least common multiple of ${a} and ${b}?`,
      explanation: `Counting by ${a}s and by ${b}s, the first number both lists share is ${l}.`,
      hint: 'Count up by each number. The first number both lists reach is the LCM.',
    };
    if (d === 'expert') return { ...draft, typed: { value: { num: l, den: 1 }, kind: 'integer' } };
    return { ...draft, right: String(l), wrong: [a * b, gcd(a, b), Math.max(a, b), l * 2].map(String) };
  },
  'factor-count': (rng, d) => {
    const n = pick(rng, d === 'expert' ? [24, 30, 36, 40, 48, 60, 64, 72, 81, 84, 90, 96, 100] : [6, 8, 10, 12, 15, 16, 18, 20, 21, 25, 28]);
    const count = factorsOf(n).length;
    const draft: Draft = {
      prompt: `How many factors does ${n} have?`,
      explanation: `The factors of ${n} are ${factorsOf(n).join(', ')}. That's ${count}.`,
      hint: 'Find factors in pairs that multiply to the number, so you don\'t miss any.',
    };
    if (d === 'scout') return { ...draft, right: String(count), wrong: [count - 1, count + 1, count + 2, count - 2].filter((c) => c > 0).map(String) };
    return { ...draft, typed: { value: { num: count, den: 1 }, kind: 'integer' } };
  },
  factorization: (rng) => {
    const n = pick(rng, [12, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48, 50, 54, 60, 63, 72, 75, 84, 90]);
    const ps = primeFactors(n);
    const right = ps.join(' × ');
    // Wrong choices multiply to the same number but use a factor that isn't prime, or multiply to something else.
    const notPrime = [`${ps[0]} × ${n / (ps[0] as number)}`, `${ps.slice(0, -2).concat([(ps.at(-1) as number) * (ps.at(-2) as number)]).join(' × ')}`];
    const offByOne = [...ps.slice(0, -1), (ps.at(-1) as number) + 2].filter(isPrime).join(' × ');
    return {
      prompt: `Which is the prime factorization of ${n}?`,
      right,
      wrong: [...notPrime, offByOne, [...ps, 2].join(' × ')],
      explanation: `${right} = ${n}, and every number in it is prime.`,
      hint: 'Keep splitting into factors until every piece is prime.',
    };
  },
  equivalent: (rng) => {
    const den = between(rng, 3, 9);
    const num = between(rng, 1, den - 1);
    if (gcd(num, den) !== 1) return null;
    const k = between(rng, 2, 4);
    const right = `${num * k}/${den * k}`;
    return {
      prompt: `Which fraction is equal to ${num}/${den}?`,
      right,
      wrong: [`${num + k}/${den + k}`, `${num * k}/${den}`, `${num}/${den * k}`, `${num * k + 1}/${den * k}`],
      explanation: `Multiply the top and bottom of ${num}/${den} by ${k} to get ${right}.`,
      hint: 'Multiply (or divide) the top and the bottom by the same number.',
    };
  },
  simplify: (rng, d) => {
    const den = between(rng, 2, 9);
    const num = between(rng, 1, den - 1);
    if (gcd(num, den) !== 1) return null;
    const k = between(rng, 2, d === 'scout' ? 4 : 6);
    const draft: Draft = {
      prompt: `Write ${num * k}/${den * k} in simplest form.`,
      explanation: `Divide the top and bottom by ${k}: ${num * k}/${den * k} = ${num}/${den}.`,
      hint: 'Divide the top and bottom by the greatest number that goes into both.',
    };
    if (d !== 'scout') return { ...draft, typed: { value: { num, den }, kind: 'fraction', simplest: true } };
    return { ...draft, right: `${num}/${den}`, wrong: [`${num * k}/${den}`, `${num}/${den * k}`, `${den}/${num}`, `${num + 1}/${den}`] };
  },
  'compare-fractions': (rng, d) => {
    const a: Rational = { num: between(rng, 1, 7), den: between(rng, 2, 9) };
    const b: Rational = { num: between(rng, 1, 7), den: between(rng, 2, 9) };
    if (a.num >= a.den || b.num >= b.den || a.num * b.den === b.num * a.den) return null;
    if (gcd(a.num, a.den) !== 1 || gcd(b.num, b.den) !== 1) return null;
    if (d === 'scout' && a.num !== b.num && a.den !== b.den) return null;
    const bigger = a.num * b.den > b.num * a.den ? a : b;
    const smaller = bigger === a ? b : a;
    const label = (r: Rational) => `${r.num}/${r.den}`;
    const half = { num: 1, den: 2 };
    const extra = [half, { num: 1, den: 3 }, { num: 3, den: 4 }].filter((r) => label(r) !== label(a) && label(r) !== label(b) && r.num * bigger.den < bigger.num * r.den);
    if (extra.length < 2) return null;
    return {
      prompt: 'Which fraction is the biggest?',
      right: label(bigger),
      wrong: [label(smaller), ...extra.map(label)],
      explanation: `With a common denominator of ${a.den * b.den}: ${label(bigger)} = ${bigger.num * smaller.den}/${a.den * b.den} and ${label(smaller)} = ${smaller.num * bigger.den}/${a.den * b.den}.`,
      hint: 'Same bottoms: the bigger top wins. Same tops: the smaller bottom wins (bigger pieces).',
    };
  },
  'add-like': (rng, d) => {
    const den = between(rng, 3, 12);
    const a = between(rng, 1, den - 1);
    const b = between(rng, 1, den - 1);
    if (gcd(a, den) !== 1 || gcd(b, den) !== 1) return null;
    const subtract = rng.next() < 0.4 && a !== b;
    const [x, y] = subtract ? [Math.max(a, b), Math.min(a, b)] : [a, b];
    const value = reduce({ num: subtract ? x - y : x + y, den });
    const op = subtract ? MINUS : '+';
    const draft: Draft = {
      prompt: `${x}/${den} ${op} ${y}/${den} = ?`,
      explanation: `Same bottoms, so ${subtract ? 'subtract' : 'add'} the tops: ${subtract ? x - y : x + y}/${den}${formatRational(value) !== `${subtract ? x - y : x + y}/${den}` ? ` = ${showR(value)}` : ''}.`,
      hint: 'When the bottoms match, add or subtract only the tops. The bottom stays the same.',
    };
    if (d !== 'scout') return { ...draft, typed: { value, kind: 'fraction', simplest: true } };
    const wrongBottom = `${subtract ? x - y : x + y}/${subtract ? 0 : den * 2}`;
    return { ...draft, right: showR(value), wrong: [wrongBottom, `${subtract ? x - y + 1 : x + y + 1}/${den}`, `${subtract ? x + y : Math.abs(x - y)}/${den}`, `${x * y}/${den}`].filter((w) => !w.endsWith('/0') && !w.startsWith('0/')) };
  },
  'fraction-of': (rng, d) => {
    const den = between(rng, 2, d === 'scout' ? 5 : 10);
    const num = between(rng, 1, den - 1);
    const total = den * between(rng, 2, d === 'scout' ? 6 : 12);
    const answer = (total / den) * num;
    const draft: Draft = {
      prompt: `What is ${num}/${den} of ${total}?`,
      explanation: `${total} ÷ ${den} = ${total / den}, and ${num} × ${total / den} = ${answer}.`,
      hint: 'Divide by the bottom to find one piece, then multiply by the top.',
    };
    if (d === 'scout') return { ...draft, right: String(answer), wrong: [total / den, total - answer, answer + total / den, total * num].filter((w) => w !== answer).map(String) };
    return { ...draft, typed: { value: { num: answer, den: 1 }, kind: 'integer' } };
  },
  'add-unlike': (rng, d) => {
    const d1 = between(rng, 2, d === 'expert' ? 10 : 6);
    const d2 = between(rng, 2, d === 'expert' ? 10 : 6);
    if (d1 === d2) return null;
    const n1 = between(rng, 1, d1 - 1);
    const n2 = between(rng, 1, d2 - 1);
    if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) return null;
    const subtract = rng.next() < 0.4 && n1 * d2 !== n2 * d1;
    const big = n1 * d2 >= n2 * d1;
    const [a, b] = subtract && !big ? [{ num: n2, den: d2 }, { num: n1, den: d1 }] : [{ num: n1, den: d1 }, { num: n2, den: d2 }];
    const common = lcmOf(a.den, b.den);
    const top = subtract ? a.num * (common / a.den) - b.num * (common / b.den) : a.num * (common / a.den) + b.num * (common / b.den);
    const value = reduce({ num: top, den: common });
    const op = subtract ? MINUS : '+';
    const draft: Draft = {
      prompt: `${a.num}/${a.den} ${op} ${b.num}/${b.den} = ?`,
      explanation: `Use a common denominator of ${common}: ${a.num * (common / a.den)}/${common} ${op} ${b.num * (common / b.den)}/${common} = ${top}/${common}${formatRational(value) !== `${top}/${common}` ? ` = ${showR(value)}` : ''}.`,
      hint: 'Rewrite both fractions with the same bottom first. Adding the tops and the bottoms (like 1/2 + 1/3 = 2/5) doesn\'t work!',
    };
    if (d === 'scout') return null;
    return { ...draft, typed: { value, kind: 'fraction', simplest: true } };
  },
  mixed: (rng, d) => {
    const den = between(rng, 2, 8);
    const whole = between(rng, 1, 4);
    const num = between(rng, 1, den - 1);
    if (gcd(num, den) !== 1) return null;
    const improper = whole * den + num;
    if (rng.next() < 0.5) {
      const draft: Draft = {
        prompt: `Write ${whole} ${num}/${den} as an improper fraction.`,
        explanation: `${whole} × ${den} = ${whole * den}, plus ${num} makes ${improper}. So ${whole} ${num}/${den} = ${improper}/${den}.`,
        hint: 'Multiply the whole number by the bottom, then add the top.',
      };
      if (d === 'scout') return { ...draft, right: `${improper}/${den}`, wrong: [`${whole + num}/${den}`, `${whole * num}/${den}`, `${improper}/${den * whole}`, `${whole * den}/${den}`] };
      return { ...draft, typed: { value: { num: improper, den }, kind: 'fraction', form: 'improper' } };
    }
    const draft: Draft = {
      prompt: `Write ${improper}/${den} as a mixed number.`,
      explanation: `${improper} ÷ ${den} = ${whole} with ${num} left over, so ${improper}/${den} = ${whole} ${num}/${den}.`,
      hint: 'Divide the top by the bottom. The answer is the whole number, and the remainder goes on top.',
    };
    if (d === 'scout') return { ...draft, right: `${whole} ${num}/${den}`, wrong: [`${whole + 1} ${num}/${den}`, `${whole} ${den - num}/${den}`, `${num} ${whole}/${den}`] };
    return { ...draft, typed: { value: { num: improper, den }, kind: 'fraction', simplest: true, form: 'mixed' } };
  },
  'compare-integers': (rng, d) => {
    const nums = rng.shuffle(Array.from({ length: d === 'scout' ? 21 : 61 }, (_, i) => i - (d === 'scout' ? 10 : 30))).slice(0, 4);
    const asksLowest = rng.next() < 0.5;
    const right = asksLowest ? Math.min(...nums) : Math.max(...nums);
    return {
      prompt: asksLowest ? 'Which number is the smallest?' : 'Which number is the biggest?',
      right: show(right),
      wrong: nums.filter((n) => n !== right).map(show),
      explanation: `On a number line, ${show(right)} is farthest to the ${asksLowest ? 'left' : 'right'}.`,
      hint: 'Negative numbers get smaller the farther they are from zero: −9 is less than −2.',
    };
  },
  'add-integers': (rng, d) => {
    const span = d === 'scout' ? 10 : d === 'ranger' ? 20 : 50;
    const a = between(rng, -span, span);
    const b = between(rng, -span, span);
    if (a >= 0 && b >= 0) return null;
    const sum = a + b;
    const draft: Draft = {
      prompt: `${show(a)} + ${paren(b)} = ?`,
      explanation: b < 0 ? `Adding ${show(b)} moves ${-b} to the left from ${show(a)}, landing on ${show(sum)}.` : `Adding ${b} moves ${b} to the right from ${show(a)}, landing on ${show(sum)}.`,
      hint: 'Adding a negative number moves left on the number line.',
    };
    if (d === 'scout') return { ...draft, right: show(sum), wrong: [-sum, a - b, sum + 1, sum - 1].map(show) };
    return { ...draft, typed: { value: { num: sum, den: 1 }, kind: 'integer' } };
  },
  'subtract-integers': (rng, d) => {
    const span = d === 'scout' ? 10 : d === 'ranger' ? 20 : 40;
    const a = between(rng, -span, span);
    const b = between(rng, d === 'expert' ? -span : 1, span);
    if (b === 0 || (d === 'scout' && a - b >= 0)) return null;
    const diff = a - b;
    const draft: Draft = {
      prompt: `${show(a)} ${MINUS} ${paren(b)} = ?`,
      explanation: b < 0 ? `Subtracting ${show(b)} is the same as adding ${-b}: ${show(a)} + ${-b} = ${show(diff)}.` : `Start at ${show(a)} and move ${b} to the left, landing on ${show(diff)}.`,
      hint: 'Subtracting a negative is the same as adding a positive: 3 − (−4) = 3 + 4.',
    };
    if (d === 'scout') return { ...draft, right: show(diff), wrong: [-diff, a + b, diff + 1, diff - 1].map(show) };
    return { ...draft, typed: { value: { num: diff, den: 1 }, kind: 'integer' } };
  },
  'integer-world': () => null,
};

/** Real places with numbers to work with. Each fact is rounded the way it's stated. */
const WORLD: { prompt: string; answer: number; explanation: string; sourceUrl: string; difficulty: Difficulty }[] = [
  {
    prompt: 'The coldest temperature ever measured on Earth was about −89 °C, at Vostok Station in Antarctica. Death Valley, California, once reached about 57 °C. How many degrees apart are they?',
    answer: 146, explanation: '57 − (−89) = 57 + 89 = 146 degrees.', sourceUrl: 'https://en.wikipedia.org/wiki/Highest_temperature_recorded_on_Earth', difficulty: 'expert',
  },
  {
    prompt: 'Badwater Basin in Death Valley is 86 m below sea level (−86 m). Mount Whitney, less than 150 km away, is 4,421 m high. How much higher is Mount Whitney?',
    answer: 4507, explanation: '4,421 − (−86) = 4,421 + 86 = 4,507 m.', sourceUrl: 'https://en.wikipedia.org/wiki/Badwater_Basin', difficulty: 'expert',
  },
  {
    prompt: 'The shore of the Dead Sea is about 430 m below sea level (−430 m). Mount Everest is 8,849 m high. How far apart are their heights?',
    answer: 9279, explanation: '8,849 − (−430) = 8,849 + 430 = 9,279 m.', sourceUrl: 'https://en.wikipedia.org/wiki/Dead_Sea', difficulty: 'expert',
  },
  {
    prompt: 'A diver at sea level (0 m) swims down 18 m, then comes up 7 m. Where is the diver now?',
    answer: -11, explanation: '0 − 18 + 7 = −11, so the diver is 11 m below the surface.', sourceUrl: '', difficulty: 'ranger',
  },
  {
    prompt: 'On a winter morning in Fairbanks, Alaska, it was −25 °C. By afternoon it warmed up 9 degrees. What was the afternoon temperature?',
    answer: -16, explanation: '−25 + 9 = −16 °C.', sourceUrl: '', difficulty: 'ranger',
  },
  {
    prompt: 'At the South Pole it was −45 °C. That night it dropped another 12 degrees. What was the temperature then?',
    answer: -57, explanation: '−45 − 12 = −57 °C.', sourceUrl: '', difficulty: 'ranger',
  },
];

function build(skill: MathSkill, d: Difficulty, i: number, draft: Draft): Question {
  const base = {
    id: `math-${skill}-${d}-${i}`,
    version: 1,
    objectiveId: `math-${skill}`,
    prompt: draft.prompt,
    explanation: draft.explanation,
    difficulty: d,
    regionId: 'study',
    sourceUrl: draft.sourceUrl ?? '',
    topic: 'math' as const,
    ...(draft.hint ? { hint: draft.hint } : {}),
  };
  if (draft.typed) {
    const label = formatRational(draft.typed.value, draft.typed.form !== 'improper').replace('-', MINUS);
    // The stored answer is written the way the question asks, so it always checks as right.
    const answer = formatRational(draft.typed.value, draft.typed.form !== 'improper');
    return { ...base, inputType: 'typed', typed: draft.typed, options: [{ id: answer, label }], acceptedId: answer };
  }
  const options = choiceOptions(draft.right as string, draft.wrong ?? []) as QuestionOption[];
  return { ...base, inputType: 'choice', options, acceptedId: `o-${draft.right}` };
}

const DIFFICULTIES: Difficulty[] = ['scout', 'ranger', 'expert'];

/** Which skills each difficulty practices. Harder trails add the harder skills. */
const LEVELS: Record<MathSkill, Difficulty[]> = {
  prime: ['scout', 'ranger', 'expert'],
  'factor-of': ['scout', 'ranger'],
  gcf: ['ranger', 'expert'],
  lcm: ['ranger', 'expert'],
  'factor-count': ['scout', 'ranger', 'expert'],
  factorization: ['ranger', 'expert'],
  equivalent: ['scout', 'ranger'],
  simplify: ['scout', 'ranger', 'expert'],
  'compare-fractions': ['scout', 'ranger', 'expert'],
  'add-like': ['scout', 'ranger', 'expert'],
  'fraction-of': ['scout', 'ranger', 'expert'],
  'add-unlike': ['ranger', 'expert'],
  mixed: ['scout', 'ranger', 'expert'],
  'compare-integers': ['scout', 'ranger'],
  'add-integers': ['scout', 'ranger', 'expert'],
  'subtract-integers': ['scout', 'ranger', 'expert'],
  'integer-world': ['ranger', 'expert'],
};

/** The whole bank. The same seed always makes the same questions, so saves and reviews stay stable. */
export function mathQuestions(seed = 4242): Question[] {
  const out: Question[] = [];
  for (const skill of Object.keys(MAKERS) as MathSkill[]) {
    for (const d of DIFFICULTIES) {
      if (!LEVELS[skill].includes(d)) continue;
      if (skill === 'integer-world') {
        WORLD.filter((w) => w.difficulty === d || (d === 'expert' && w.difficulty === 'ranger')).forEach((w, i) => {
          out.push(build(skill, d, i, { prompt: w.prompt, explanation: w.explanation, sourceUrl: w.sourceUrl, typed: { value: { num: w.answer, den: 1 }, kind: 'integer' } }));
        });
        continue;
      }
      const rng = new Rng(seed + skill.length * 977 + DIFFICULTIES.indexOf(d) * 131 + skill.charCodeAt(0));
      const prompts = new Set<string>();
      for (let tries = 0; prompts.size < PER_SKILL && tries < PER_SKILL * 40; tries++) {
        const draft = MAKERS[skill](rng, d);
        if (!draft) continue;
        // Some prompts repeat with different numbers to choose from, so the key includes the choices.
        const key = `${draft.prompt}|${draft.right ?? ''}|${[...(draft.wrong ?? [])].sort().join(',')}`;
        if (prompts.has(key)) continue;
        if (!draft.typed && !choiceOptions(draft.right as string, draft.wrong ?? [])) continue;
        prompts.add(key);
        out.push(build(skill, d, prompts.size, draft));
      }
    }
  }
  return out;
}

export const skillOf = (q: Pick<Question, 'objectiveId'>) => q.objectiveId.replace(/^math-/, '') as MathSkill;
export const topicOfSkill = (skill: MathSkill): MathTopic => (Object.keys(MATH_TOPICS) as MathTopic[]).find((t) => MATH_TOPICS[t].skills.includes(skill)) as MathTopic;
