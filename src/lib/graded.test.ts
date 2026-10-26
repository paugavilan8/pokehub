import { describe, expect, it } from 'vitest';
import { gradedQueue, normNumber, parseGraded, pickMatch, type GradedEntry } from './graded';

describe('parseGraded', () => {
  it('toma el precio de mercado o la mediana de cada nota con ventas', () => {
    const out = parseGraded({
      salesByGrade: {
        psa10: { count: 45, medianPrice: 320, smartMarketPrice: { price: 318.5 } },
        psa9: { count: 120, medianPrice: 125 },
        cgc10: { count: 0, medianPrice: 200 },
        psa8: { count: 3, medianPrice: 60 },
      },
    });
    expect(out).toEqual({ psa10: { usd: 318.5, count: 45 }, psa9: { usd: 125, count: 120 } });
    expect(parseGraded(null)).toEqual({});
  });
});

describe('normNumber', () => {
  it('quita ceros y el total del set', () => {
    expect(normNumber('025/162')).toBe('25');
    expect(normNumber('SV049')).toBe('SV49');
    expect(normNumber('TG01')).toBe('TG1');
    expect(normNumber('217')).toBe('217');
    expect(normNumber('')).toBe('');
  });
});

describe('pickMatch', () => {
  const results = [
    { tcgPlayerId: '1', name: 'Umbreon ex', setName: 'SV: Prismatic Evolutions', cardNumber: '060/131' },
    { tcgPlayerId: '2', name: 'Umbreon ex - 161/131', setName: 'SV: Prismatic Evolutions', cardNumber: '161/131' },
    { tcgPlayerId: '3', name: 'Umbreon ex', setName: 'SV08a: Terastal Festival ex', cardNumber: '217/187' },
  ];
  it('elige por número, nombre y set', () => {
    expect(pickMatch(results, { name: 'Umbreon ex', num: '161' }, 'Prismatic Evolutions')?.tcgPlayerId).toBe('2');
    expect(pickMatch(results, { name: 'Umbreon ex', num: '217' }, 'Terastal Festival ex (JP)')?.tcgPlayerId).toBe('3');
  });
  it('no elige nada si el set no cuadra o falta el número', () => {
    expect(pickMatch(results, { name: 'Umbreon ex', num: '161' }, 'Evolving Skies')).toBeNull();
    expect(pickMatch(results, { name: 'Umbreon ex', num: '' })).toBeNull();
  });
});

describe('gradedQueue', () => {
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const store: Record<string, GradedEntry> = {
    b: { tcg: '9', checked: '2026-10-01' },
    c: { tcg: '8', checked: '2026-10-24' },
    d: { tcg: null, checked: '2026-10-10' },
  };
  it('primero las nuevas, luego las más antiguas; las no encontradas esperan 30 días', () => {
    expect(gradedQueue(cards, store, '2026-10-26').map((c) => c.id)).toEqual(['a', 'b']);
  });
});
