import { describe, expect, it } from 'vitest';
import {
  appendHistory, baseName, cardsFromCardmarket, cmCardName, inferRarity, expansionOf, japaneseSetName, expectedValue, matchByName, findPullRates, guideDate, pickSealed, priceFromGuide, sealedKind, topHits, weekChange,
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
    expect(s[0].price).toMatchObject({ trend: 7.38, low: 4, avg30: null });
    expect(s[2].price.trend).toBeNull();
  });
  it('sin expansión no devuelve nada', () => {
    expect(pickSealed(products, new Map(), null)).toEqual([]);
  });
});

describe('priceFromGuide', () => {
  it('usa la versión holo si la normal no tiene precio', () => {
    expect(priceFromGuide({ idProduct: 1, trend: 0, 'trend-holo': 3.456, low: 9, 'low-holo': 1, avg7: 5, 'avg7-holo': 3 }))
      .toEqual({ trend: 3.46, low: 1, avg30: null, avg7: 3, avg1: null });
  });
  it('variación semanal: media de 7 días frente a la de 30', () => {
    expect(weekChange({ trend: 1, low: 1, avg30: 10, avg7: 12 })).toBe(20);
    expect(weekChange({ trend: 1, low: 1, avg30: null, avg7: 12 })).toBeNull();
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

describe('matchByName', () => {
  const mk = (id: string, num: string, name: string, cmId: number | null = null) => ({ ...card(id, 'Rare', null), num, name, cmId });
  const singles: CmProduct[] = [
    { idProduct: 10, name: 'Dark Charizard [Nail Flick | Continuous Fireball]', idExpansion: 7 },
    { idProduct: 11, name: 'Dark Charizard [Nail Flick | Continuous Fireball]', idExpansion: 7 },
    { idProduct: 12, name: 'Pikachu [Thundershock]', idExpansion: 7 },
    { idProduct: 13, name: 'Pikachu [Thundershock]', idExpansion: 8 },
    { idProduct: 14, name: 'Mew [Psywave]', idExpansion: 7 },
    { idProduct: 15, name: 'Mew [Psywave]', idExpansion: 7 },
  ];
  it('quita los ataques y los acentos del nombre de Cardmarket', () => {
    expect(baseName('Pokémon Center [Heal]')).toBe('pokemon center');
  });
  it('empareja por nombre dentro de la expansión y, si se repite, por orden', () => {
    const cards = [mk('a', '21', 'Dark Charizard'), mk('b', '4', 'Dark Charizard'), mk('c', '50', 'Pikachu', 12), mk('d', '9', 'Mew')];
    expect(matchByName(cards, 7, singles)).toBe(7);
    expect(cards.map((c) => c.cmId)).toEqual([11, 10, 12, null]);
  });
  it('separa las cartas que TCGdex junta con el mismo id', () => {
    const cards = [mk('a', '4', 'Dark Charizard', 10), mk('b', '21', 'Dark Charizard', 10), mk('c', '9', 'Mew', 14), mk('d', '90', 'Mew', 14), mk('e', '1', 'Raro', 30), mk('f', '2', 'Raro', 30)];
    matchByName(cards, 7, singles);
    expect(cards.map((c) => c.cmId)).toEqual([10, 11, 14, 15, 30, null]);
  });
  it('averigua la expansión si ninguna carta tiene id', () => {
    const cards = ['Dark Charizard', 'Pikachu', 'Mew', 'Mew', 'Dark Charizard'].map((n, i) => mk(String(i), String(i + 1), n));
    const many = [...singles, ...['A', 'B', 'C'].map((n, i) => ({ idProduct: 20 + i, name: n, idExpansion: 7 }))];
    cards.push(...['A', 'B', 'C'].map((n, i) => mk(n, String(10 + i), n)));
    expect(matchByName(cards, null, many)).toBe(7);
    expect(cards[1].cmId).toBe(12);
    expect(matchByName([mk('x', '1', 'Nada')], null, singles)).toBeNull();
  });
});

describe('sets japoneses', () => {
  const sealed = (name: string) => [{ kind: 'pack' as const, idProduct: 1, name, price: { trend: 5, low: 4, avg30: 5 } }];
  it('saca el nombre en inglés del sobre de Cardmarket', () => {
    expect(japaneseSetName('SV8a', 'Scarlet & Violet', sealed('Terastal Festival ex Booster'))).toBe('Terastal Festival ex');
    expect(japaneseSetName('SV-P', 'Scarlet & Violet', sealed('Pokémon Card Gym Promo Booster'))).toBe('Scarlet & Violet Promos');
    expect(japaneseSetName('SV11B', 'Scarlet & Violet', sealed('Black Bolt JP Booster'))).toBe('Black Bolt');
    expect(japaneseSetName('SVLS', 'Scarlet & Violet', [])).toBeNull();
  });
  it('quita los ataques del nombre de la carta', () => {
    expect(cmCardName('Mega Dragonite ex [Hurricane Wing]')).toBe('Mega Dragonite ex');
  });
  it('marca como secretas las cartas sin rareza por encima del número oficial', () => {
    expect(inferRarity({ num: '217', rarity: 'None' }, 187)).toBe('Secret Rare');
    expect(inferRarity({ num: '100', rarity: null }, 187)).toBeNull();
    expect(inferRarity({ num: 'TG01', rarity: null }, 30)).toBeNull();
    expect(inferRarity({ num: '217', rarity: 'Hyper rare' }, 187)).toBe('Hyper rare');
  });
  it('monta un set solo con Cardmarket, con el Pokédex de otra versión de la carta', () => {
    const singles: CmProduct[] = [
      { idProduct: 9, name: 'Umbreon VMAX [Dark Signal | Max Darkness]', idExpansion: 4239, idMetacard: 77 },
      { idProduct: 5, name: 'Pinsir [Seismic Toss]', idExpansion: 4239, idMetacard: 78 },
      { idProduct: 6, name: 'Otra', idExpansion: 1 },
      { idProduct: 12, name: 'Umbreon VMAX [Dark Signal | Max Darkness]', idExpansion: 4239, idMetacard: 77 },
    ];
    const cards = cardsFromCardmarket('ja-S6a', 4239, singles, new Map([[9, { trend: 300, low: 250 }]]), new Map([[77, [197]]]));
    expect(cards.map((c) => [c.id, c.name, c.price.trend, c.dex])).toEqual([
      ['ja-S6a-cm5', 'Pinsir', null, null],
      ['ja-S6a-cm9', 'Umbreon VMAX (V.1)', 300, [197]],
      ['ja-S6a-cm12', 'Umbreon VMAX (V.2)', null, [197]],
    ]);
  });
  it('descarta el sellado coreano o chino', () => {
    expect(sealedKind({ name: 'Korean Terastal Festival ex Booster' })).toBeNull();
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

describe('appendHistory', () => {
  const set = (trend: number | null, pack: number | null) => ({
    cards: [card('a', 'Special illustration rare', trend), card('b', 'Common', 0.05)],
    sealed: pack == null ? [] : [{ kind: 'pack' as const, idProduct: 1, name: 'p', price: { trend: pack, low: null, avg30: null } }],
  });
  it('empieza el historial y sigue solo cartas de 1 € o más', () => {
    const h = appendHistory(null, '2026-10-25', set(10, 5));
    expect(h).toEqual({ dates: ['2026-10-25'], cards: { a: [10] }, sealed: { pack: [5] } });
  });
  it('añade días, rellena huecos y no duplica el mismo día', () => {
    let h = appendHistory(null, '2026-10-25', set(10, null));
    h = appendHistory(h, '2026-10-26', set(12, 5));
    h = appendHistory(h, '2026-10-26', set(13, 6));
    h = appendHistory(h, '2026-10-27', set(null, 6));
    expect(h.dates).toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
    expect(h.cards.a).toEqual([10, 13, null]);
    expect(h.sealed.pack).toEqual([null, 6, 6]);
  });
});
