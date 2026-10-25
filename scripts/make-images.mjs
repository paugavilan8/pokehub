// Genera las imágenes Open Graph y el apple-touch-icon con el navegador de Playwright.
// Uso: NODE_PATH=$(npm root -g) node scripts/make-images.mjs (después de scripts/make-logo.mjs)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const fav = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const logo = `data:image/png;base64,${readFileSync(new URL('../assets/brand/logo-large.png', import.meta.url)).toString('base64')}`;
const og = {
  es: { title: 'Precios de sets Pokémon TCG', sub: 'Sobres, cajas y cartas top con precios de Cardmarket cada día. Y calculadora de aduanas para comprar desde España.' },
  en: { title: 'Pokémon TCG set prices', sub: 'Packs, boxes and chase cards with daily Cardmarket prices. Plus an EU import tax calculator.' },
};
const page = (lang) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;background:#f6f7f9;color:#15171c;
    font-family:'Rubik','Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;border-top:10px solid #d0262b}
  .brand{height:150px;width:auto;align-self:flex-start}
  h1{font-size:76px;line-height:1.05;letter-spacing:-0.03em;margin:0 0 20px;font-weight:700}
  p{font-size:30px;line-height:1.35;color:#5f6672;margin:0;max-width:980px}
</style></head><body>
  <img class="brand" src="${logo}" alt="">
  <div><h1>${og[lang].title}</h1><p>${og[lang].sub}</p></div>
</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of ['es', 'en']) {
  await ctx.setContent(page(lang));
  await ctx.screenshot({ path: `public/og-${lang}.png` });
}
await ctx.setViewportSize({ width: 180, height: 180 });
await ctx.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:180px">${fav.replace('<svg', '<svg width="150" height="150"')}</body>`);
await ctx.screenshot({ path: 'public/apple-touch-icon.png' });
await browser.close();
