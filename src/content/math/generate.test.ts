import { describe, expect, it } from 'vitest';
import { formatRational, parseTyped, sameValue, typedCorrect } from '../../engine/answers';
import { MATH_TOPICS, mathQuestions, type MathSkill } from './generate';

const BANK = mathQuestions();
const plain = (t: string) => t.replaceAll('−', '-');

describe('typed answers', () => {
  it('reads whole numbers, fractions, mixed numbers and negatives', () => {
    expect(parseTyped('-3')?.value).toEqual({ num: -3, den: 1 });
    expect(parseTyped('−3')?.value).toEqual({ num: -3, den: 1 });
    expect(parseTyped(' 3/8 ')?.value).toEqual({ num: 3, den: 8 });
    expect(parseTyped('1 1/2')?.value).toEqual({ num: 3, den: 2 });
    expect(parseTyped('-1 1/2')?.value).toEqual({ num: -3, den: 2 });
    for (const bad of ['', 'abc', '3/0', '1 3/2', '1/2/3', '--4', '1.5']) expect(parseTyped(bad), bad).toBeNull();
  });

  it('accepts equal values, but only lowest terms when asked, and the form asked for', () => {
    const half = { kind: 'fraction' as const, value: { num: 1, den: 2 } };
    expect(typedCorrect(half, '2/4')).toBe(true);
    expect(typedCorrect({ ...half, simplest: true }, '2/4')).toBe(false);
    expect(typedCorrect({ ...half, simplest: true }, '1/2')).toBe(true);
    const threeHalves = { kind: 'fraction' as const, value: { num: 3, den: 2 }, simplest: true };
    expect(typedCorrect(threeHalves, '1 1/2')).toBe(true);
    expect(typedCorrect(threeHalves, '3/2')).toBe(true);
    expect(typedCorrect({ ...threeHalves, form: 'improper' }, '1 1/2')).toBe(false);
    expect(typedCorrect({ ...threeHalves, form: 'mixed' }, '3/2')).toBe(false);
    expect(typedCorrect({ kind: 'integer', value: { num: -7, den: 1 } }, '7')).toBe(false);
    expect(formatRational({ num: -7, den: 2 })).toBe('-3 1/2');
    expect(formatRational({ num: 7, den: 2 }, false)).toBe('7/2');
  });
});

describe('math bank', () => {
  it('covers every skill, at the levels it belongs to, with enough questions', () => {
    const skills = Object.values(MATH_TOPICS).flatMap((t) => t.skills);
    for (const skill of skills) expect(BANK.filter((q) => q.objectiveId === `math-${skill}`).length, skill).toBeGreaterThanOrEqual(5);
    for (const d of ['scout', 'ranger', 'expert'] as const) expect(BANK.filter((q) => q.difficulty === d).length, d).toBeGreaterThan(100);
  });

  it('has unique ids and is the same every time', () => {
    expect(new Set(BANK.map((q) => q.id)).size).toBe(BANK.length);
    expect(mathQuestions().map((q) => q.prompt + q.acceptedId)).toEqual(BANK.map((q) => q.prompt + q.acceptedId));
  });

  it('typed questions accept their own answer, and harder trails type more', () => {
    for (const q of BANK.filter((x) => x.inputType === 'typed')) {
      expect(q.typed, q.id).toBeDefined();
      expect(typedCorrect(q.typed!, q.options[0]!.label), `${q.id}: ${q.options[0]!.label}`).toBe(true);
      expect(typedCorrect(q.typed!, plain(q.options[0]!.label)), q.id).toBe(true);
      expect(typedCorrect(q.typed!, q.acceptedId), `${q.id} accepted ${q.acceptedId}`).toBe(true);
    }
    const typedShare = (d: string) => BANK.filter((q) => q.difficulty === d && q.inputType === 'typed').length / BANK.filter((q) => q.difficulty === d).length;
    expect(typedShare('scout')).toBe(0);
    expect(typedShare('expert')).toBeGreaterThan(typedShare('ranger'));
    expect(typedShare('ranger')).toBeGreaterThan(0.3);
  });

  it('choice questions have four different options, one right, and no wrong one worth the same', () => {
    for (const q of BANK.filter((x) => x.inputType === 'choice')) {
      expect(q.options, q.id).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.label)).size, q.id).toBe(4);
      const right = q.options.find((o) => o.id === q.acceptedId)!;
      expect(right, q.id).toBeDefined();
      for (const o of q.options) for (const p of q.options) if (o !== p) expect(sameValue(plain(o.label), plain(p.label)), `${q.id}: ${o.label} vs ${p.label}`).toBe(false);
    }
  });

  it('checks the arithmetic of every choice answer it can', () => {
    const num = (t: string) => parseTyped(plain(t))!.value;
    const val = (t: string) => { const v = num(t); return v.num / v.den; };
    for (const q of BANK) {
      const skill = q.objectiveId.replace('math-', '') as MathSkill;
      const right = q.inputType === 'typed' ? q.options[0]!.label : q.options.find((o) => o.id === q.acceptedId)!.label;
      let m: RegExpExecArray | null;
      if ((m = /^(−?\d+)\/(\d+) ([+−]) (−?\d+)\/(\d+) = \?$/.exec(q.prompt))) {
        const a = Number(plain(m[1]!)) / Number(m[2]);
        const b = Number(plain(m[4]!)) / Number(m[5]);
        expect(val(right), q.prompt).toBeCloseTo(m[3] === '+' ? a + b : a - b);
      } else if ((m = /^\(?(−?\d+)\)? ([+−]) \(?(−?\d+)\)? = \?$/.exec(q.prompt))) {
        const a = Number(plain(m[1]!));
        const b = Number(plain(m[3]!));
        expect(val(right), q.prompt).toBe(m[2] === '+' ? a + b : a - b);
      } else if ((m = /^What is (\d+)\/(\d+) of (\d+)\?$/.exec(q.prompt))) {
        expect(val(right), q.prompt).toBe((Number(m[1]) / Number(m[2])) * Number(m[3]));
      } else if ((m = /greatest common factor of (\d+) and (\d+)/.exec(q.prompt))) {
        const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
        expect(val(right), q.prompt).toBe(g(Number(m[1]), Number(m[2])));
      } else if ((m = /least common multiple of (\d+) and (\d+)/.exec(q.prompt))) {
        const a = Number(m[1]); const b = Number(m[2]);
        const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
        expect(val(right), q.prompt).toBe((a * b) / g(a, b));
      } else if ((m = /prime factorization of (\d+)/.exec(q.prompt))) {
        expect(right.split(' × ').reduce((p, f) => p * Number(f), 1), q.prompt).toBe(Number(m[1]));
        for (const o of q.options.filter((x) => x.id !== q.acceptedId)) {
          const fs = o.label.split(' × ').map(Number);
          const allPrime = fs.every((f) => f > 1 && Array.from({ length: f - 2 }, (_, i) => i + 2).every((d) => f % d !== 0));
          expect(allPrime && fs.reduce((p, f) => p * f, 1) === Number(m[1]), `${q.prompt}: ${o.label}`).toBe(false);
        }
      } else if (skill === 'prime') {
        const n = Number(right);
        expect(Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0) && n > 1, q.id).toBe(true);
      }
    }
  });
});
