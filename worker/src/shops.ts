// Tiendas que se consultan y cómo leer su catálogo público (Shopify y WooCommerce).
import { classify, detectLang, type ProductKind, type ProductLang } from './classify.ts';

export type Platform = 'shopify' | 'woocommerce';

export interface Shop {
  id: string;
  name: string;
  url: string;
  platform: Platform;
  country: string;
}

/**
 * Tiendas con catálogo público y robots.txt que no lo prohíbe (revisado el 25-oct-2026). Flashstore y Panda
 * Collecting bloquean su API de productos, así que no se consultan.
 */
export const SHOPS: Shop[] = [
  { id: 'pokemillon', name: 'Pokemillon', url: 'https://www.pokemillon.com', platform: 'shopify', country: 'ES' },
  { id: 'surcollect', name: 'Surcollect', url: 'https://surcollect.com', platform: 'shopify', country: 'ES' },
  { id: 'metamorph', name: 'Metamorph Center', url: 'https://metamorphcenter.com', platform: 'shopify', country: 'ES' },
  { id: 'iberian', name: 'Iberian Collect', url: 'https://iberiancollect.com', platform: 'shopify', country: 'ES' },
  { id: 'pokeadiccion', name: 'Pokeadicción TCG', url: 'https://pokeadicciontcg.com', platform: 'woocommerce', country: 'ES' },
];

export interface ShopProduct {
  /** "<tienda>:<id en la tienda>" */
  id: string;
  shop: string;
  name: string;
  url: string;
  image: string | null;
  /** Precio en euros. */
  price: number | null;
  available: boolean;
  kind: ProductKind;
  lang: ProductLang;
}

export const USER_AGENT = 'PokeHubStockBot/0.1 (+avisos de stock para coleccionistas; contacto en la web)';
const MAX_PAGES = 12;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

interface ShopifyProduct {
  id: number; title: string; handle: string; product_type?: string; tags?: string[] | string;
  variants: { price: string; available: boolean }[];
  images?: { src: string }[];
}

export function parseShopify(shop: Shop, products: ShopifyProduct[]): ShopProduct[] {
  const out: ShopProduct[] = [];
  for (const p of products) {
    const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(',').map((t) => t.trim());
    const extra = [p.product_type ?? '', ...tags];
    const kind = classify(p.title, extra);
    if (!kind) continue;
    const prices = p.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
    out.push({
      id: `${shop.id}:${p.id}`, shop: shop.id, name: p.title.trim(), url: `${shop.url}/products/${p.handle}`,
      image: p.images?.[0]?.src ?? null, price: prices.length ? Math.min(...prices) : null,
      available: p.variants.some((v) => v.available), kind, lang: detectLang(p.title, extra),
    });
  }
  return out;
}

interface WooProduct {
  id: number; name: string; permalink: string; is_in_stock: boolean; is_purchasable?: boolean;
  prices?: { price: string; currency_minor_unit: number };
  images?: { src: string }[]; categories?: { name: string }[]; tags?: { name: string }[];
}

const decode = (s: string) => s.replace(/&#8211;|&ndash;/g, '-').replace(/&#038;|&amp;/g, '&').replace(/&#8217;/g, "'").replace(/<[^>]+>/g, '');

export function parseWoo(shop: Shop, products: WooProduct[]): ShopProduct[] {
  const out: ShopProduct[] = [];
  for (const p of products) {
    const name = decode(p.name);
    const extra = [...(p.categories ?? []).map((c) => c.name), ...(p.tags ?? []).map((t) => t.name)];
    const kind = classify(name, extra);
    if (!kind) continue;
    const minor = p.prices?.currency_minor_unit ?? 2;
    const price = p.prices?.price ? Number(p.prices.price) / 10 ** minor : null;
    out.push({
      id: `${shop.id}:${p.id}`, shop: shop.id, name, url: p.permalink, image: p.images?.[0]?.src ?? null,
      price: price && price > 0 ? price : null, available: p.is_in_stock && p.is_purchasable !== false,
      kind, lang: detectLang(name, extra),
    });
  }
  return out;
}

/** Descarga el catálogo completo de una tienda, página a página, con una pausa entre peticiones. */
export async function fetchShop(shop: Shop, fetchFn: Fetch = fetch, pauseMs = 800): Promise<ShopProduct[]> {
  const out: ShopProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = shop.platform === 'shopify'
      ? `${shop.url}/products.json?limit=250&page=${page}`
      : `${shop.url}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!res.ok) {
      if (page > 1 && (res.status === 400 || res.status === 404)) break;
      throw new Error(`${shop.id}: HTTP ${res.status}`);
    }
    const body = await res.json() as { products?: ShopifyProduct[] } | WooProduct[];
    const items = shop.platform === 'shopify' ? (body as { products?: ShopifyProduct[] }).products ?? [] : (body as WooProduct[]);
    if (!items.length) break;
    out.push(...(shop.platform === 'shopify' ? parseShopify(shop, items as ShopifyProduct[]) : parseWoo(shop, items as WooProduct[])));
    if (items.length < (shop.platform === 'shopify' ? 250 : 100)) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }
  return out;
}

/** Productos que pasan de agotados a disponibles. */
export function restocked(previous: Map<string, boolean>, current: ShopProduct[]): ShopProduct[] {
  return current.filter((p) => p.available && previous.get(p.id) === false);
}
