import { describe, expect, it } from 'vitest';
import { SHOPS, validProducts } from './shops.ts';

const shop = SHOPS.find((s) => s.id === 'pokemillon')!;
const ok = { id: 'pokemillon:1', shop: 'pokemillon', name: 'Destined Rivals Booster Box', url: 'https://www.pokemillon.com/products/dr-box', image: 'https://cdn.shopify.com/a.jpg', price: 160, available: true, kind: 'box', lang: 'en' };

describe('validProducts', () => {
  it('acepta productos de la tienda y limpia los campos', () => {
    expect(validProducts(shop, [ok, { ...ok, id: 'pokemillon:2', image: 'javascript:x', lang: 'xx', price: null }])).toEqual([
      ok, { ...ok, id: 'pokemillon:2', image: null, lang: null, price: null },
    ]);
  });
  it('rechaza la lista entera si algo no cuadra', () => {
    expect(validProducts(shop, [{ ...ok, id: 'surcollect:1' }])).toBeNull();
    expect(validProducts(shop, [{ ...ok, url: 'https://otra-web.com/p' }])).toBeNull();
    expect(validProducts(shop, [{ ...ok, url: 'http://www.pokemillon.com/p' }])).toBeNull();
    expect(validProducts(shop, [{ ...ok, kind: 'figura' }])).toBeNull();
    expect(validProducts(shop, [{ ...ok, price: -1 }])).toBeNull();
    expect(validProducts(shop, 'nada')).toBeNull();
  });
});
