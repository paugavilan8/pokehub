import { describe, expect, it } from 'vitest';
import { amazonUrl, ebayUrl, isCommercial, kofiUrl, shopUrl, type AffiliateConfig } from './affiliates';

const empty: AffiliateConfig = { amazon: { tag: '' }, ebay: { campid: '' }, kofi: { user: '' }, shops: { pokemillon: '' } };
const full: AffiliateConfig = { amazon: { tag: 'pullradar-21' }, ebay: { campid: '5338' }, kofi: { user: 'pullradar' }, shops: { pokemillon: 'ref=pr&utm_source=pullradar' } };

describe('afiliados', () => {
  it('sin códigos no hay botones ni uso comercial', () => {
    expect(amazonUrl(empty, 'x')).toBeNull();
    expect(ebayUrl(empty, 'x', 'es')).toBeNull();
    expect(kofiUrl(empty)).toBeNull();
    expect(shopUrl(empty, 'pokemillon', 'https://www.pokemillon.com/p/1')).toBe('https://www.pokemillon.com/p/1');
    expect(isCommercial(empty)).toBe(false);
    expect(isCommercial({ ...empty, kofi: { user: 'a' } })).toBe(false);
  });
  it('construye los enlaces con los códigos', () => {
    expect(amazonUrl(full, 'Destined Rivals Booster Box')).toBe('https://www.amazon.es/s?k=Destined%20Rivals%20Booster%20Box&tag=pullradar-21');
    const e = new URL(ebayUrl(full, 'Umbreon VMAX PSA 10', 'es')!);
    expect(e.host).toBe('www.ebay.es');
    expect(e.searchParams.get('campid')).toBe('5338');
    expect(e.searchParams.get('_nkw')).toBe('Umbreon VMAX PSA 10');
    expect(shopUrl(full, 'pokemillon', 'https://www.pokemillon.com/p/1?v=2')).toBe('https://www.pokemillon.com/p/1?v=2&ref=pr&utm_source=pullradar');
    expect(kofiUrl(full)).toBe('https://ko-fi.com/pullradar');
    expect(isCommercial(full)).toBe(true);
  });
});
