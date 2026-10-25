export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];

/** Nombre de trabajo. Cambiar aquí cuando se decida el definitivo. */
export const SITE_NAME = 'PokeHub';

export const ROUTES = {
  home: { es: '/', en: '/en/' },
  calc: { es: '/calculadora-aduanas/', en: '/en/import-calculator/' },
  /** Prefijo de las páginas de cada set (la lista de sets es la portada). */
  sets: { es: '/expansiones/', en: '/en/sets/' },
  guide: { es: '/guia-aduanas-cartas-pokemon/', en: '/en/pokemon-card-import-tax-eu/' },
  sources: { es: '/reglas-y-fuentes/', en: '/en/rules-and-sources/' },
  legal: { es: '/aviso-legal/', en: '/en/legal-notice/' },
  privacy: { es: '/privacidad/', en: '/en/privacy/' },
  cookies: { es: '/cookies/', en: '/en/cookies/' },
  affiliates: { es: '/afiliados/', en: '/en/affiliate-disclosure/' },
} as const;
export type RouteKey = keyof typeof ROUTES;

export const LOCALE: Record<Lang, string> = { es: 'es-ES', en: 'en-IE' };
export const OG_LOCALE: Record<Lang, string> = { es: 'es_ES', en: 'en_IE' };

export function formatDate(iso: string, lang: Lang) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALE[lang], {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function countryName(code: string, lang: Lang) {
  return new Intl.DisplayNames([LOCALE[lang]], { type: 'region' }).of(code) ?? code;
}

export const ui = {
  es: {
    skip: 'Saltar al contenido',
    nav: { calculator: 'Calculadora de aduanas', sets: 'Precios de sets', guide: 'Guía de importación', sources: 'Reglas y fuentes' },
    langSwitch: 'English',
    langSwitchLabel: 'Read this page in English',
    footer: {
      tagline: 'Herramientas para comprar cartas Pokémon desde España sin sorpresas.',
      disclaimer:
        'Web independiente de fans. No está afiliada, patrocinada ni aprobada por Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos titulares.',
      notAdvice:
        'La información es orientativa y no sustituye el asesoramiento de la Agencia Tributaria ni de un agente de aduanas.',
      legal: 'Aviso legal', privacy: 'Privacidad', cookies: 'Cookies', affiliates: 'Afiliados',
    },
    reviewed: 'Reglas revisadas el',
    calc: {
      title: 'Calcula el precio final',
      origin: 'Compras desde',
      origins: { eu: 'Unión Europea', uk: 'Reino Unido', us: 'Estados Unidos', jp: 'Japón', ch: 'Suiza', other: 'Otro país fuera de la UE' },
      destination: 'Lo recibes en',
      destinationHelp: 'Península y Baleares. Canarias, Ceuta y Melilla tienen otro régimen.',
      goods: 'Precio del producto',
      goodsHelp: 'Sin envío. Es el valor que decide si superas los 150 €.',
      shipping: 'Envío',
      currency: 'Divisa',
      rate: 'Tipo de cambio',
      rateHelpLive: 'Tipo de referencia del BCE del {date}. Aduanas usa un tipo mensual, puede variar un poco.',
      rateHelpManual: 'No hemos podido cargar el tipo del BCE. Escríbelo a mano: unidades por 1 €.',
      rateLoading: 'Cargando tipo del BCE...',
      itemTypes: 'Tipos de producto distintos',
      itemTypesHelp: 'Cartas, sobres y cajas suelen contar como un solo tipo. Súmale uno por cada cosa diferente (fundas, figuras...).',
      ioss: 'La tienda me cobró el IVA al pagar (IOSS)',
      iossHelp: 'Lo verás como "IVA incluido" o "impuestos UE pagados" en el checkout. Solo hasta 150 €.',
      preferential: 'La factura incluye declaración de origen preferencial',
      preferentialHelp: 'Puede dejar el arancel en 0 % en compras de más de 150 € desde Japón, Reino Unido o Suiza.',
      dutyRate: 'Arancel para más de 150 €',
      carrierFee: 'Gestión del transportista',
      carrierFeeHelp: 'Lo que cobra Correos, DHL, FedEx o UPS por tramitar la aduana. Mira su tarifa: varía mucho.',
      advanced: 'Opciones avanzadas',
      compare: 'Precio en una tienda de la UE (opcional)',
      compareHelp: 'Para saber si te compensa importar.',
      result: 'Te cuesta en total',
      extras: 'sobre el precio con envío',
      breakdown: 'Desglose',
      lines: {
        goods: 'Producto', shipping: 'Envío', duty: 'Derecho de aduana', dutyFlat: 'Derecho fijo de aduana',
        handling: 'Tasa de gestión UE', vat: 'IVA de importación', vatIoss: 'IVA ya incluido en el precio (IOSS)',
        carrier: 'Gestión del transportista', total: 'Total',
      },
      regime: {
        'intra-eu': 'Compra dentro de la UE: el IVA ya va en el precio y no hay aduana.',
        'low-value': 'Envío de hasta 150 €: derecho fijo de 3 € por tipo de producto e IVA del {vat} %.',
        standard: 'Envío de más de 150 €: arancel normal sobre mercancía y envío, más IVA del {vat} %.',
      },
      iossIgnored: 'Por encima de 150 € la tienda no puede usar IOSS: pagarás el IVA en la entrega.',
      noHandlingYet: 'Desde el 1 de noviembre de 2026 se prevé una tasa de gestión de 2 € más.',
      compareCheaper: 'Importar te ahorra {amount} frente a la tienda de la UE.',
      compareMore: 'Importar te cuesta {amount} más que la tienda de la UE.',
      compareSame: 'Te sale prácticamente igual.',
      atDoor: 'Pagas al recibir',
      share: 'Copiar enlace',
      copied: 'Enlace copiado',
      errorNumber: 'Escribe un número igual o mayor que 0.',
      empty: 'Escribe el precio para ver el coste real.',
      disclaimer: 'Estimación con las reglas vigentes. Comprueba siempre la factura del transportista.',
    },
  },
  en: {
    skip: 'Skip to content',
    nav: { calculator: 'Import calculator', sets: 'Set prices', guide: 'Import guide', sources: 'Rules and sources' },
    langSwitch: 'Español',
    langSwitchLabel: 'Leer esta página en español',
    footer: {
      tagline: 'Tools for buying Pokémon cards into Spain and the EU without surprises.',
      disclaimer:
        'Independent fan site. Not affiliated with, sponsored or endorsed by Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and its names are trademarks of their respective owners.',
      notAdvice:
        'This information is a guide only and is not a substitute for advice from your tax authority or a customs broker.',
      legal: 'Legal notice', privacy: 'Privacy', cookies: 'Cookies', affiliates: 'Affiliates',
    },
    reviewed: 'Rules reviewed on',
    calc: {
      title: 'Work out the landed price',
      origin: 'Buying from',
      origins: { eu: 'European Union', uk: 'United Kingdom', us: 'United States', jp: 'Japan', ch: 'Switzerland', other: 'Another non-EU country' },
      destination: 'Delivered to',
      destinationHelp: 'Uses the standard VAT rate. Special territories (Canary Islands and similar) are not covered.',
      goods: 'Product price',
      goodsHelp: 'Without shipping. This is the value that decides whether you pass €150.',
      shipping: 'Shipping',
      currency: 'Currency',
      rate: 'Exchange rate',
      rateHelpLive: 'ECB reference rate from {date}. Customs uses a monthly rate, so it may differ slightly.',
      rateHelpManual: 'We could not load the ECB rate. Type it in: units per €1.',
      rateLoading: 'Loading ECB rate...',
      itemTypes: 'Different product types',
      itemTypesHelp: 'Cards, packs and boxes usually count as one type. Add one for each different thing (sleeves, figures...).',
      ioss: 'The shop charged me VAT at checkout (IOSS)',
      iossHelp: 'Shown as "VAT included" or "EU taxes paid" at checkout. Only up to €150.',
      preferential: 'The invoice has a preferential origin statement',
      preferentialHelp: 'Can bring duty to 0% on orders over €150 from Japan, the UK or Switzerland.',
      dutyRate: 'Duty rate over €150',
      carrierFee: 'Carrier clearance fee',
      carrierFeeHelp: 'What the post office, DHL, FedEx or UPS charge to clear customs. Check their price list: it varies a lot.',
      advanced: 'Advanced options',
      compare: 'Price at an EU shop (optional)',
      compareHelp: 'To see whether importing is worth it.',
      result: 'Your total cost',
      extras: 'on top of price plus shipping',
      breakdown: 'Breakdown',
      lines: {
        goods: 'Product', shipping: 'Shipping', duty: 'Customs duty', dutyFlat: 'Flat customs duty',
        handling: 'EU handling fee', vat: 'Import VAT', vatIoss: 'VAT already in the price (IOSS)',
        carrier: 'Carrier clearance fee', total: 'Total',
      },
      regime: {
        'intra-eu': 'Buying inside the EU: VAT is already in the price and there is no customs.',
        'low-value': 'Order up to €150: flat €3 duty per product type plus {vat}% VAT.',
        standard: 'Order over €150: normal duty on goods and shipping, plus {vat}% VAT.',
      },
      iossIgnored: 'Over €150 the shop cannot use IOSS: you will pay VAT on delivery.',
      noHandlingYet: 'From 1 November 2026 an extra €2 handling fee is expected.',
      compareCheaper: 'Importing saves you {amount} compared with the EU shop.',
      compareMore: 'Importing costs you {amount} more than the EU shop.',
      compareSame: 'It works out about the same.',
      atDoor: 'Paid on delivery',
      share: 'Copy link',
      copied: 'Link copied',
      errorNumber: 'Enter a number of 0 or more.',
      empty: 'Enter a price to see the real cost.',
      disclaimer: 'Estimate under current rules. Always check the carrier invoice.',
    },
  },
} as const;

export type CalcStrings = (typeof ui)['es']['calc'];
