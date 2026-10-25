# PokeHub (nombre de trabajo)

Precios de sets de Pokémon TCG (Cardmarket) y calculadora de aduanas para comprar desde España. Web en español (principal) e inglés.

## Estructura

- **Portada:** carrusel con las últimas expansiones, las cartas más caras ahora, las que más suben y bajan en la semana, y la lista de precios por set (al pulsar un set se despliegan sus cartas top).
- **Página de cada set:** producto sellado, valor esperado por sobre y caja, simulador para abrir sobres virtuales (sets con tasas de aparición), cartas más caras y lista completa.
- **Ficha de carta:** panel lateral con imagen grande (efecto holográfico), tendencia, desde, medias de 1, 7 y 30 días, variación semanal y probabilidad de salir. Se abre desde cualquier carta y con enlaces `#c-<id>`.
- **Páginas por Pokémon** (`/pokemon/charizard/`): todas sus cartas de todos los sets, ordenadas por precio. Nombres en español e inglés de PokeAPI (`scripts/build-pokemon-names.mjs` genera `src/data/pokemon-names.json`).
- **Historial de precios:** cada ejecución diaria guarda la tendencia de las cartas de 1 € o más y del sellado en `src/data/market/history/<set>.json` (hasta 400 días). Empezó el 25-oct-2026; las gráficas aparecen al tener 3 días.
- **Buscador** de Pokémon, cartas y sets en la cabecera (`/search-index.json`, se carga al usarlo).
- **Calculadora de aduanas** (`/calculadora-aduanas/`): coste final de importar a España o a la UE (IVA, derecho de 3 €, tasa de 2 €, transportista), con guía y ejemplos.
- **Avisos de stock por correo** (`/avisos/`): busca un producto sellado de las tiendas revisadas y recibe un correo cuando vuelva el stock. Lo gestiona el worker de `worker/` (ver `worker/README.md`); hasta desplegarlo y poner `PUBLIC_ALERTS_API`, la página dice "muy pronto".
- Verificador de tiendas: pendiente (fase 2 del plan).

## Stack

- [Astro 5](https://astro.build) estático, i18n con español sin prefijo (`/`) e inglés en `/en/`, slugs traducidos y `hreflang`.
- Lógica en `src/lib/calc.ts` (TypeScript puro, probada con Vitest).
- Datos curados en `src/data/*.json`, con fecha de revisión, estado (`verified` / `secondary` / `pending`) y fuente en cada regla.
- Diseño sobrio de herramienta de datos (IBM Plex Sans y Plex Mono, un solo acento rojo). Las imágenes son los escaneos de cartas y logos de set de TCGdex.
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

## Expansiones y precios

- `scripts/fetch-market.ts` descarga cada día el catálogo de TCGdex (sets, cartas, rareza, imagen e id de Cardmarket) y la guía de precios y el catálogo públicos de Cardmarket. Escribe `src/data/market/` y la web se vuelve a construir.
- `.github/workflows/market-data.yml` lo ejecuta cada día a las 04:37 UTC (Cardmarket publica la guía de madrugada) y sube los cambios. También se puede lanzar a mano desde la pestaña Actions.
- Valor esperado: `src/data/pull-rates.json` (tasas por rareza, con fuente y fecha). Solo se calcula para los sets que tienen tasas.
- Condiciones de Cardmarket para sus precios: decir claramente que son suyos (lo hacemos en cada página) y usar su marca solo desde su kit oficial. No tienen programa de afiliados.
- Primera ejecución: `node scripts/fetch-market.ts` (Node 22.18 o superior). Necesita acceso a `api.tcgdex.net` y `downloads.s3.cardmarket.com`.

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
4. **Imágenes**: los escaneos de cartas (TCGdex) tienen copyright de The Pokémon Company. Las webs de precios los usan para identificar cada carta, pero si la web gana dinero conviene valorar el riesgo.
5. Contrastar los tipos de IVA de `vat-rates.json` con la base de datos oficial de la Comisión.
