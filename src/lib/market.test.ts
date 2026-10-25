import { describe, expect, it } from 'vitest';
import {
  expansionOf, expectedValue, findPullRates, guideDate, pickSealed, priceFromGuide, sealedKind, topHits,
  type CmProduct, type MarketCard, type SetPullRates,
} from './market';

// Nombres reales del catálogo de Cardmarket (Destined Rivals, expansión 6096).
const products: CmProduct[] = [
  { idProduct: 818570, name: 'Destined Rivals Booster', categoryName: 'Pokémon Booster', idExpansion: 6096 },
  { idProduct: 818571, name: 'Destined Rivals Booster (6 Cards)', categoryName: 'Pokémon Booster', idExpansion: 6096 },
  { idProduct: 818573, name: 'Destined Rivals Sleeved Booster', categoryName: 'Pokémon Booster', idExpansion: 6096 },
  { idProduct: 818574, name: 'Destined Rivals Booster Box', categoryName: 'Pokémon Display', idExpansion: 6096 },
  { idProduct: 818575, name: 'Destined Rivals Booster Box (18 Boosters)', categoryName: 'Pokémon Display', idExpansion: 6096 },
  { idProduct: 818576, name: 'Destined Rivals 6 Booster Box Case', categoryName: 'Pokémon Display', idExpansion: 6096 },
  { idProduct: 818578, name: 'Destined Rivals Booster Bundle', categoryName: 'Pokémon Display', idExpansion: 6096 },
  { idProduct: 818585, name: 'Destined Rivals Elite Trainer Box', categoryName: 'Pokémon Elite Trainer Boxes', idExpansion: 6096 },
  { idProduct: 818586, name: 'Destined Rivals Pokémon Center Elite Trainer Box', categoryName: 'Pokémon Elite Trainer Boxes', idExpansion: 6096 },
  { idProduct: 873607, name: 'Ascended Heroes Booster Bundle Display', categoryName: 'Pokémon Display', idExpansion: 6395 },
  { idProduct: 846729, name: 'Phantasmal Flames Booster', categoryName: 'Pokémon Booster', idExpansion: 6299 },
];

const card = (id: string, rarity: string, trend: number | null, low: number | null = null): MarketCard => ({
  id, num: id, name: id, rarity, image: null, cmId: null, price: { trend, low, avg30: null },
});

describe('sealedKind', () => {
  it('reconoce sobre, caja, bundle y ETB y descarta variantes', () => {
    const kinds = products.map((p) => sealedKind(p));
    expect(kinds).toEqual(['pack', null, null, 'box', null, null, 'bundle', 'etb', null, null, 'pack']);
  });
});

describe('pickSealed', () => {
  it('elige un producto por tipo de la expansión, en orden', () => {
    const guide = new Map([[818570, { idProduct: 818570, trend: 7.38, low: 4 }], [818574, { idProduct: 818574, trend: 294.14, low: 175 }]]);
    const s = pickSealed(products, guide, 6096);
    expect(s.map((x) => x.kind)).toEqual(['pack', 'box', 'etb', 'bundle']);
    expect(s[0].price).toEqual({ trend: 7.38, low: 4, avg30: null });
    expect(s[2].price.trend).toBeNull();
  });
  it('sin expansión no devuelve nada', () => {
    expect(pickSealed(products, new Map(), null)).toEqual([]);
  });
});

describe('priceFromGuide', () => {
  it('usa la versión holo si la normal no tiene precio', () => {
    expect(priceFromGuide({ idProduct: 1, trend: 0, 'trend-holo': 3.456, low: null, 'low-holo': 1 })).toEqual({ trend: 3.46, low: 1, avg30: null });
  });
});

describe('guideDate', () => {
  it('convierte la fecha de Cardmarket a ISO', () => {
    expect(guideDate('2026-10-07T02:49:47+0200')).toBe('2026-10-07T00:49:47.000Z');
    expect(guideDate('basura')).toBeNull();
  });
});

describe('expansionOf', () => {
  it('toma la expansión más repetida', () => {
    const singles = new Map<number, CmProduct>([
      [1, { idProduct: 1, name: 'a', idExpansion: 6096 }],
      [2, { idProduct: 2, name: 'b', idExpansion: 6096 }],
      [3, { idProduct: 3, name: 'c', idExpansion: 1 }],
    ]);
    expect(expansionOf([1, 2, 3, null, 99], singles)).toBe(6096);
    expect(expansionOf([], singles)).toBeNull();
  });
});

describe('topHits', () => {
  it('ordena por tendencia e ignora cartas sin precio', () => {
    const hits = topHits([card('a', 'Rare', 1), card('b', 'Hyper rare', 50), card('c', 'Ultra Rare', null)], 2);
    expect(hits.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('expectedValue', () => {
  const rates: SetPullRates = {
    set: 'Destined Rivals', packsPerBox: 36,
    rates: [{ rarity: 'Special illustration rare', perPack: 0.01 }, { rarity: 'Hyper rare', perPack: 0.005 }, { rarity: 'Mega Hyper Rare', perPack: 0.001 }],
    source: { title: 't', url: 'u', packs: 8000, kind: 'study' }, reviewed: '2026-10-25',
  };
  it('suma probabilidad por precio medio de cada rareza', () => {
    const ev = expectedValue([card('a', 'Special illustration rare', 100, 80), card('b', 'Special Illustration Rare', 200, 150), card('c', 'Hyper rare', 20)], rates);
    expect(ev.lines[0]).toMatchObject({ cards: 2, avgTrend: 150, avgLow: 115, evTrend: 1.5, evLow: 1.15 });
    expect(ev.lines[1]).toMatchObject({ evTrend: 0.1, evLow: 0.1 });
    expect(ev.missing).toEqual(['Mega Hyper Rare']);
    expect(ev.perPack).toEqual({ low: 1.25, trend: 1.6 });
    expect(ev.perBox).toEqual({ low: 45, trend: 57.6 });
  });
  it('encuentra las tasas por nombre de set sin importar mayúsculas ni signos', () => {
    expect(findPullRates('destined rivals', [rates])).toBe(rates);
    expect(findPullRates('Otro', [rates])).toBeNull();
  });
});
