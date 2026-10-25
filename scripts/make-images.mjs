// Genera las imágenes Open Graph y el apple-touch-icon con el navegador de Playwright.
// Uso: node scripts/make-images.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const fav = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const og = {
  es: { title: 'Lo que pagas de verdad por tus cartas importadas', sub: 'Calculadora de IVA y aduanas 2026 para cartas Pokémon en España' },
  en: { title: 'What your imported cards really cost', sub: '2026 EU VAT and customs calculator for Pokémon cards' },
};
const page = (lang) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;background:#f6f6f4;font-family:'Geist','Inter',system-ui,sans-serif;color:#18181b;display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;box-sizing:border-box}
  .brand{display:flex;align-items:center;gap:18px;font-size:34px;font-weight:700;letter-spacing:-0.02em}
  .brand svg{width:60px;height:60px}
  h1{font-size:76px;line-height:1.04;letter-spacing:-0.04em;margin:0;max-width:960px}
  p{font-size:32px;color:#52525b;margin:0}
  .bar{height:10px;width:180px;background:#b9381b;border-radius:5px}
</style></head><body>
  <div class="brand">${fav}PokeHub</div>
  <div><h1>${og[lang].title}</h1></div>
  <p>${og[lang].sub}</p>
</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of ['es', 'en']) {
  await ctx.setContent(page(lang));
  await ctx.screenshot({ path: `public/og-${lang}.png` });
}
await ctx.setViewportSize({ width: 180, height: 180 });
await ctx.setContent(`<body style="margin:0">${fav.replace('<svg', '<svg width="180" height="180"').replace('rx="14"', 'rx="0"')}</body>`);
await ctx.screenshot({ path: 'public/apple-touch-icon.png' });
await browser.close();
