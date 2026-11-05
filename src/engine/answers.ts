/** A number a child types: a whole number, a fraction like 3/8, a mixed number like 1 1/2, or a negative. */
export interface Rational {
  num: number;
  den: number;
}

export interface NumberAnswer {
  kind: 'integer' | 'fraction';
  /** The right value. */
  value: Rational;
  /** The answer must be in lowest terms, like 1/2 rather than 2/4. */
  simplest?: boolean;
  /** The answer must be written this way: "improper" wants 7/2, "mixed" wants 3 1/2. */
  form?: 'improper' | 'mixed';
}

/** A word to type, which practices spelling. Capital letters and spaces at the ends don't matter. */
export interface WordAnswer {
  kind: 'word';
  text: string;
}

export type TypedAnswer = NumberAnswer | WordAnswer;

export type Form = 'whole' | 'fraction' | 'mixed';

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export const reduce = ({ num, den }: Rational): Rational => {
  const g = gcd(num, den) || 1;
  const sign = den < 0 ? -1 : 1;
  return { num: (sign * num) / g, den: (sign * den) / g };
};

/** Reads what was typed. Accepts "-3", "3/8", "-3/8", "1 1/2" and "-1 1/2", with a real minus sign too. Null if it isn't a number. */
export function parseTyped(text: string): { value: Rational; lowest: boolean; form: Form } | null {
  const t = text.trim().replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const whole = /^(-?)(\d+)$/.exec(t);
  if (whole) return { value: { num: Number(`${whole[1]}${whole[2]}`), den: 1 }, lowest: true, form: 'whole' };
  const frac = /^(-?)(\d+)\/(\d+)$/.exec(t);
  if (frac) {
    const n = Number(frac[2]);
    const d = Number(frac[3]);
    if (d === 0) return null;
    return { value: { num: (frac[1] ? -1 : 1) * n, den: d }, lowest: gcd(n, d) === 1, form: 'fraction' };
  }
  const mixed = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(t);
  if (mixed) {
    const w = Number(mixed[2]);
    const n = Number(mixed[3]);
    const d = Number(mixed[4]);
    // A mixed number's fraction part is less than one: 1 3/2 isn't a proper way to write it.
    if (d === 0 || n === 0 || n >= d) return null;
    return { value: { num: (mixed[1] ? -1 : 1) * (w * d + n), den: d }, lowest: gcd(n, d) === 1, form: 'mixed' };
  }
  return null;
}

/** Whether what was typed is the right answer. Equal values match, so 3/2 and 1 1/2 are both right unless a form is asked for. */
export function typedCorrect(answer: TypedAnswer, text: string): boolean {
  if (answer.kind === 'word') return text.trim().toLowerCase() === answer.text.trim().toLowerCase();
  const got = parseTyped(text);
  if (!got) return false;
  if (answer.simplest && !got.lowest) return false;
  if (answer.form === 'improper' && got.form === 'mixed') return false;
  if (answer.form === 'mixed' && got.form === 'fraction') return false;
  return got.value.num * answer.value.den === answer.value.num * got.value.den;
}

/** Whether two typed numbers have the same value, such as 1/2 and 2/4. */
export function sameValue(a: string, b: string): boolean {
  const x = parseTyped(a);
  const y = parseTyped(b);
  return !!x && !!y && x.value.num * y.value.den === y.value.num * x.value.den;
}

/** How the game writes a number: "-3", "3/8", or "1 1/2" for a fraction bigger than one (or "3/2" with mixed off). */
export function formatRational(r: Rational, mixed = true): string {
  const { num, den } = reduce(r);
  if (den === 1) return String(num);
  const sign = num < 0 ? '-' : '';
  const a = Math.abs(num);
  if (!mixed || a < den) return `${sign}${a}/${den}`;
  return `${sign}${Math.floor(a / den)} ${a % den}/${den}`;
}
