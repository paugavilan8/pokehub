// Genera las imágenes Open Graph y el apple-touch-icon con el navegador de Playwright.
// Uso: node scripts/make-images.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const fav = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const art = (name) => `data:image/png;base64,${readFileSync(new URL(`../src/assets/pokemon/${name}.png`, import.meta.url)).toString('base64')}`;
const og = {
  es: { title: 'Lo que pagas <span>de verdad</span> por tus cartas importadas', sub: 'Calculadora de IVA y aduanas 2026 para cartas Pokémon en España' },
  en: { title: 'What your imported cards <span>really</span> cost', sub: '2026 EU VAT and customs calculator for Pokémon cards' },
};
const page = (lang) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;color:#f4f6ff;
    background:radial-gradient(700px 420px at 82% 30%,rgba(255,201,60,.35),transparent 60%),radial-gradient(600px 400px at 0% 100%,rgba(70,110,255,.4),transparent 60%),linear-gradient(180deg,#16205e,#0e1546);
    padding:64px 72px;box-sizing:border-box}
  .brand{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:800;letter-spacing:-0.02em}
  .brand svg{width:56px;height:56px}
  h1{font-size:72px;line-height:1.02;letter-spacing:-0.04em;margin:70px 0 22px;max-width:640px;font-weight:800}
  h1 span{color:#ffc93c}
  p{font-size:28px;color:#b9c2ef;margin:0;max-width:600px;font-family:system-ui,sans-serif}
  img{position:absolute;filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))}
</style></head><body>
  <div class="brand">${fav}PokeHub</div>
  <h1>${og[lang].title}</h1>
  <p>${og[lang].sub}</p>
  <img src="${art('umbreon')}" style="width:250px;right:30px;top:60px">
  <img src="${art('charizard')}" style="width:420px;right:150px;top:70px">
  <img src="${art('pikachu')}" style="width:210px;right:330px;bottom:-14px">
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
