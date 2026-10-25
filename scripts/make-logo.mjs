// Prepara el logo a partir del original (fondo blanco, sin transparencia).
// Uso: node scripts/make-logo.mjs
//
//   public/brand/logo.webp        fondo transparente, para tema claro
//   public/brand/logo-dark.webp   igual, con "PULL" en blanco para tema oscuro
//   assets/brand/logo*-large.png  400 px de alto, para las imágenes sociales
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = new URL('../assets/brand/pullradar-source.webp', import.meta.url).pathname;
const OUT = new URL('../public/brand/', import.meta.url).pathname;
/** Zona de las letras "PULL" en el original (2000 x 705). */
const PULL = { x0: 300, x1: 905, y0: 425, y1: 600 };
const HEIGHT = 168;

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = 255;
}

// 1. Fondo: blancos conectados con el borde (el blanco de dentro de la Poké Ball queda, está rodeado de negro).
const light = (i) => Math.min(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]) >= 236;
const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || !light(i)) continue;
  bg[i] = 1;
  const x = i % W;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (i >= W) stack.push(i - W);
  if (i < W * (H - 1)) stack.push(i + W);
}

// 2. Bordes suavizados: a los píxeles junto al fondo se les quita el blanco ("color a alfa").
const nearBg = (i) => {
  const x = i % W, y = (i / W) | 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) return true;
  }
  return false;
};
for (let i = 0; i < W * H; i++) {
  const p = i * 4;
  if (bg[i]) { rgba[p + 3] = 0; continue; }
  if (!nearBg(i)) continue;
  const a = Math.max(255 - rgba[p], 255 - rgba[p + 1], 255 - rgba[p + 2]) / 255;
  if (a <= 0) { rgba[p + 3] = 0; continue; }
  for (let c = 0; c < 3; c++) rgba[p + c] = Math.round(Math.max(0, Math.min(255, (rgba[p + c] - 255 * (1 - a)) / a)));
  rgba[p + 3] = Math.round(a * 255);
}

// 3. Recorte al contenido.
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (rgba[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
}
const crop = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };

// 4. Variante oscura: los grises de "PULL" se invierten (negro -> blanco, el suavizado se mantiene).
const dark = Buffer.from(rgba);
for (let y = PULL.y0; y < PULL.y1; y++) for (let x = PULL.x0; x < PULL.x1; x++) {
  const p = (y * W + x) * 4;
  const r = dark[p], g = dark[p + 1], b = dark[p + 2];
  if (Math.max(r, g, b) - Math.min(r, g, b) < 40) { dark[p] = 255 - r; dark[p + 1] = 255 - g; dark[p + 2] = 255 - b; }
}

await mkdir(OUT, { recursive: true });
const raw = { raw: { width: W, height: H, channels: 4 } };
for (const [name, buf] of [['logo', rgba], ['logo-dark', dark]]) {
  await sharp(buf, raw).extract(crop).resize({ height: HEIGHT }).webp({ quality: 90, alphaQuality: 100 }).toFile(`${OUT}${name}.webp`);
  await sharp(buf, raw).extract(crop).resize({ height: 400 }).png().toFile(new URL(`../assets/brand/${name}-large.png`, import.meta.url).pathname);
}
const meta = await sharp(`${OUT}logo.webp`).metadata();
console.log(`logo ${meta.width}x${meta.height} (recorte ${crop.width}x${crop.height})`);
