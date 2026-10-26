# PullRadar

Precios de sets de Pokémon TCG (Cardmarket) y calculadora de aduanas para comprar desde España. Web en español (principal) e inglés.

## Estructura

- **Menú con desplegables:** expansiones (últimas, por serie y la más nueva destacada), Pokémon más buscados y herramientas de aduanas. En móvil, botón de menú con acordeones (`src/components/MegaNav.astro`).
- **Portada:** carrusel con las últimas expansiones, las cartas más caras ahora, las que más suben y bajan en la semana, y las 12 últimas expansiones con sobres (al pulsar una se despliegan sus cartas top).
- **Todas las expansiones** (`/expansiones/`): las internacionales desde Base Set (1999) y las japonesas desde Sol y Luna (2016), agrupadas por serie, con buscador. El menú tiene columna de últimas japonesas.
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
- Diseño sobrio de herramienta de datos (tipografía Rubik, un solo acento rojo). Las imágenes son los escaneos de cartas y logos de set de TCGdex.
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
- Series: todas las de cartas físicas desde Base Set (fuera TCG Pocket, kits de entrenador y jumbos). Los subsets que van en los mismos sobres (Trainer Gallery, Shiny Vault, Galarian Gallery...) se unen a su expansión, como en Cardmarket.
- Sets japoneses (series SM, S, SV y M de TCGdex, guardados como `ja-<id>`): TCGdex los da en japonés, así que el nombre de cada carta se toma de Cardmarket y el del set, de su sobre en Cardmarket ("Terastal Festival ex Booster" -> "Terastal Festival ex (JP)"). Se descartan barajas y sets de inicio sin sobre propio. Los que TCGdex tiene vacíos o mal enlazados (Eevee Heroes, Shiny Star V, 25th Anniversary, Heat Wave Arena...) se montan solo con el catálogo de Cardmarket (`JA_FROM_CARDMARKET` en el script y `cardsFromCardmarket`): sin número, rareza ni imagen, con las versiones alternativas como (V.1), (V.2) y el Pokédex tomado de otra versión de la misma carta. Las cartas sin rareza por encima del número oficial se marcan como secretas.
- TCGdex no trae id de Cardmarket en algunas cartas (Gym, sets recién salidos) y a veces repite el mismo id en la versión normal y la de arte completo. `matchByName` (`src/lib/market.ts`) las empareja por nombre dentro de la expansión de Cardmarket; si hay dudas, la carta se queda sin precio antes que con uno equivocado.
- `.github/workflows/market-data.yml` lo ejecuta cada día a las 04:37 UTC (Cardmarket publica la guía de madrugada) y sube los cambios. También se puede lanzar a mano desde la pestaña Actions.
- Valor esperado: `src/data/pull-rates.json` (tasas por rareza, con fuente y fecha). Solo se calcula para los sets que tienen tasas.
- Condiciones de Cardmarket para sus precios: decir claramente que son suyos (lo hacemos en cada página) y usar su marca solo desde su kit oficial. No tienen programa de afiliados.
- Primera ejecución: `node scripts/fetch-market.ts` (Node 22.18 o superior). Necesita acceso a `api.tcgdex.net` y `downloads.s3.cardmarket.com`.

## Precios de cartas gradeadas

- `scripts/fetch-graded.ts` pide a [PokemonPriceTracker](https://www.pokemonpricetracker.com/api-docs) los precios PSA 10, PSA 9, CGC 10 y BGS 10 (medianas de ventas en eBay y Fanatics Collect, en dólares) de las cartas más caras, y los guarda en `src/data/graded.json`. La web los muestra en euros (tipo del BCE del día de la descarga) en la ficha de carta y en las cartas top de cada set.
- Plan gratis: 100 créditos al día. Buscar una carta cuesta 1 crédito por resultado y sus datos gradeados, 2, así que entran unas 20-30 cartas nuevas al día, de la más cara a la más barata, y luego se refrescan por turnos cada 7 días (`gradedQueue` en `src/lib/graded.ts`). Con un plan de pago se sube la variable `PPT_DAILY_CREDITS` en GitHub (Settings → Secrets and variables → Actions → Variables).
- Para activarlo: crear la clave en pokemonpricetracker.com y guardarla como secreto `PPT_API_KEY` en GitHub (Settings → Secrets and variables → Actions → New repository secret). Sin ella el paso no hace nada.
- Ojo: el plan gratis solo da 3 días de historial de ventas, así que las medianas se basan en pocas ventas; el plan API (9,99 $/mes) da 6 meses y 20.000 créditos al día. Según sus condiciones, el uso comercial (anuncios, afiliados) necesita el plan Business.

## Afiliados y Ko-fi

Todo se configura en `src/data/affiliates.json`; un código vacío hace que su botón no aparezca:

- `amazon.tag`: etiqueta de Amazon Afiliados España (por ejemplo `pullradar-21`). Añade un botón "Amazon" a cada producto sellado de los sets.
- `ebay.campid`: id de campaña de eBay Partner Network. Añade "Buscar en eBay" en la ficha de cada carta (ebay.es en español, ebay.com en inglés).
- `shops.<tienda>`: parámetros que cada tienda te dé para sus enlaces (por ejemplo `ref=pullradar`). Se añaden a los enlaces de los avisos de stock (web y correos); hay que volver a desplegar el worker.
- `kofi.user`: tu usuario de Ko-fi. Añade el bloque "Apoya PullRadar" al pie de todas las páginas.

- `adsense.client` y `adsense.slots`: id de editor de AdSense (`ca-pub-...`) y el id de los tres bloques de anuncios (portada, página de set y página de Pokémon). Con el id de editor se carga el script de AdSense en todas las páginas (sirve también para que Google verifique la web), se publica `/ads.txt` y aparece "Preferencias de cookies" al pie. El aviso de consentimiento lo pone Google: en AdSense, Privacidad y mensajes, crea y publica el mensaje para la UE (RGPD).

Con cualquier código de Amazon, eBay, tiendas o AdSense la web pasa a ser comercial: las páginas de afiliados, privacidad y cookies cambian solas (con la frase obligatoria de Amazon), y los precios de gradeadas de PokemonPriceTracker se apagan, porque su plan gratis no permite uso comercial. Ko-fi no cuenta como afiliado.

## Comandos

```sh
npm install
npm run dev       # http://localhost:4321
npm test          # pruebas del cálculo
npm run build     # genera dist/
```

Para regenerar las imágenes sociales tras cambiar el nombre: `NODE_PATH=$(npm root -g) node scripts/make-images.mjs` (usa Playwright).

## Despliegue (Cloudflare)

- Publicada como Worker con archivos estáticos en https://pokehub.elpaueto8.workers.dev, conectado al repo: cada push a `main` (también los del robot de precios) vuelve a compilar y publicar.
- Compilación: `npm run build`, salida `dist`.
- Al pasar a un dominio propio, definir `SITE_URL` (por ejemplo `https://www.pullradar.es`) en las variables de compilación de Cloudflare, o cambiar el valor por defecto en `astro.config.mjs`. Se usa en canonical, `hreflang`, Open Graph, sitemap y robots.

## Antes de publicar (pendiente)

1. **Correo de contacto** en `src/data/owner.json` (el resto de datos del titular ya está).
2. **Dominio** para PullRadar (ver "Despliegue").
3. **Reglas de aduanas** revisadas el 26-oct-2026 con la guía oficial de la Comisión: tasa de 2 € por artículo (también por encima de 150 € y dentro de la base del IVA) desde el 1-nov-2026, arancel del 2,7 % para la subpartida 9504 40 00 y 0 % con origen preferencial (las cartas japonesas impresas en Japón). Sigue pendiente la gestión de los transportistas, que varía y la introduce el usuario.
4. **Imágenes**: los escaneos de cartas (TCGdex) tienen copyright de The Pokémon Company. Las webs de precios los usan para identificar cada carta, pero si la web gana dinero conviene valorar el riesgo.
5. Tipos de IVA de `vat-rates.json`: contrastados con varias tablas de 2026 (ningún tipo general cambió este año); falta la consulta en la base oficial de la Comisión.
