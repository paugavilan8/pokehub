// Enlaces de afiliado (Amazon, eBay, tiendas) y Ko-fi, configurados en src/data/affiliates.json.
// Un código vacío significa que ese botón no se muestra.

export interface AffiliateConfig {
  amazon: { tag: string };
  ebay: { campid: string };
  kofi: { user: string };
  /** Id de tienda (el de worker/src/shops.ts) -> parámetros que se añaden a sus enlaces ("ref=pullradar"). */
  shops: Record<string, string>;
  /** Google AdSense: id de editor ("ca-pub-...") y id de cada bloque de anuncios. Vacíos = sin anuncios. */
  adsense: { client: string; slots: Record<AdPlace, string> };
}

/** Sitios con hueco de anuncio: portada, página de set y página de Pokémon. */
export type AdPlace = 'home' | 'set' | 'pokemon';

/** Bloque de anuncio de un sitio, o null si AdSense no está configurado o ese hueco no tiene id. */
export function adSlot(cfg: AffiliateConfig, place: AdPlace): { client: string; slot: string } | null {
  const client = cfg.adsense?.client;
  const slot = cfg.adsense?.slots?.[place];
  return client && slot ? { client, slot } : null;
}

/** Línea de ads.txt para AdSense ("ca-pub-123" -> "google.com, pub-123, DIRECT, f08c47fec0942fa0"). */
export function adsTxt(cfg: AffiliateConfig): string {
  const client = cfg.adsense?.client;
  if (!client) return '# Esta web todavía no muestra anuncios.\n';
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

/** Hay anuncios o algún programa de afiliados activo: la web cuenta como comercial. Ko-fi (donaciones) no cuenta. */
export function isCommercial(cfg: AffiliateConfig) {
  return !!(cfg.amazon.tag || cfg.ebay.campid || Object.values(cfg.shops).some(Boolean) || cfg.adsense?.client);
}

/** Búsqueda en Amazon España con la etiqueta de afiliado, o null si no hay etiqueta. */
export function amazonUrl(cfg: AffiliateConfig, query: string): string | null {
  if (!cfg.amazon.tag) return null;
  return `https://www.amazon.es/s?k=${encodeURIComponent(query)}&tag=${encodeURIComponent(cfg.amazon.tag)}`;
}

/** Ids de "rotación" de eBay Partner Network por web de eBay. */
const EBAY = {
  es: { host: 'www.ebay.es', rotation: '1185-53479-19255-0', site: '186' },
  en: { host: 'www.ebay.com', rotation: '711-53200-19255-0', site: '0' },
};

/** Búsqueda en eBay con el enlace de eBay Partner Network (ebay.es en español, ebay.com en inglés). */
export function ebayUrl(cfg: AffiliateConfig, query: string, lang: 'es' | 'en'): string | null {
  if (!cfg.ebay.campid) return null;
  const e = EBAY[lang];
  const p = new URLSearchParams({
    _nkw: query, mkcid: '1', mkrid: e.rotation, siteid: e.site, campid: cfg.ebay.campid, toolid: '10001', mkevt: '1',
  });
  return `https://${e.host}/sch/i.html?${p}`;
}

/** Añade los parámetros de afiliado de una tienda a un enlace suyo (si los hay). */
export function shopUrl(cfg: AffiliateConfig, shopId: string, url: string): string {
  const extra = cfg.shops[shopId];
  if (!extra) return url;
  const u = new URL(url);
  for (const [k, v] of new URLSearchParams(extra)) u.searchParams.set(k, v);
  return u.toString();
}

export const kofiUrl = (cfg: AffiliateConfig) => (cfg.kofi.user ? `https://ko-fi.com/${encodeURIComponent(cfg.kofi.user)}` : null);
