# PokeHub (nombre de trabajo)

Herramientas para comprar cartas Pokémon TCG desde España sin sorpresas. Web en español (principal) e inglés.

## Temática principal: calculadora de precio final (aduanas + IVA)

De las cuatro herramientas del plan, la calculadora es la principal y ocupa la portada:

- **Sin datos externos ni riesgo legal**: se puede publicar ya (Fase 1).
- **Demanda de búsqueda nueva y alta**: el derecho de 3 € (1-jul-2026) y la tasa de 2 € (1-nov-2026) afectan a cualquier compra de fuera de la UE. Casi todo lo que hay está pensado para EE. UU.
- **Escala en inglés**: la versión en inglés deja elegir cualquier país de la UE (cambia solo el IVA), así sirve a compradores de toda Europa sin perder el enfoque en España.
- Es la base de las demás: el verificador de tiendas, las alertas y el EV reutilizan el "precio puesto en casa".

Las otras tres herramientas aparecen como "Lo próximo" en la portada, sin páginas propias hasta tener datos revisados (para no publicar contenido flojo).

## Stack

- [Astro 5](https://astro.build) estático, i18n con español sin prefijo (`/`) e inglés en `/en/`, slugs traducidos y `hreflang`.
- Lógica en `src/lib/calc.ts` (TypeScript puro, probada con Vitest).
- Datos curados en `src/data/*.json`, con fecha de revisión, estado (`verified` / `secondary` / `pending`) y fuente en cada regla.
- Sin cookies, sin analítica, sin backend. Tipos de cambio en vivo desde la API pública del BCE (Frankfurter) con entrada manual de respaldo.
- Pensado para Cloudflare Pages (gratis). Inversión inicial: solo el dominio.

```
src/
  data/import-rules.json   reglas fiscales y aduaneras + fuentes
  data/vat-rates.json      IVA general por país de la UE
  data/examples.json       ejemplos de la guía (precios ilustrativos)
  data/stores.json         Fase 2: esqueleto del verificador (no se publica)
  data/owner.json          datos del titular para el aviso legal (RELLENAR)
  lib/calc.ts              cálculo
  i18n/ui.ts               textos ES/EN, rutas, nombre del sitio
  views/                   páginas compartidas por idioma
  pages/                   rutas (finas) de cada idioma
scripts/make-images.mjs    genera og-es.png, og-en.png y apple-touch-icon.png
```

## Comandos

```sh
npm install
npm run dev       # http://localhost:4321
npm test          # pruebas del cálculo
npm run build     # genera dist/
```

Para regenerar las imágenes sociales tras cambiar el nombre: `NODE_PATH=$(npm root -g) node scripts/make-images.mjs` (usa Playwright).

## Despliegue (Cloudflare Pages)

- Build command: `npm run build` · Output: `dist`
- Variable de entorno `SITE_URL` con el dominio definitivo (por ejemplo `https://www.tudominio.es`). Se usa en canonical, `hreflang`, Open Graph, sitemap y robots.

## Antes de publicar (pendiente)

1. **Rellenar `src/data/owner.json`** (nombre, NIF, domicilio, correo): obligatorio por la LSSI.
2. **Elegir nombre y dominio**. "Poké" es marca protegida de The Pokémon Company: mejor un nombre que no la incluya. Se cambia en `SITE_NAME` (`src/i18n/ui.ts`) y en `scripts/make-images.mjs`.
3. **Revisar las reglas marcadas como no verificadas** en `src/data/import-rules.json`:
   - Tasa de gestión de 2 €: pendiente de publicación en el DOUE; confirmar si es por paquete o por tipo de artículo y si lleva IVA.
   - Arancel 2,7 % de la partida 9504 40 00 y el 0 % con origen preferencial: confirmar en TARIC.
   - Tarifas de gestión aduanera de Correos/DHL/FedEx: no hay valor por defecto.
4. Contrastar los tipos de IVA de `vat-rates.json` con la base de datos oficial de la Comisión.
