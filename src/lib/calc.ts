import rules from '../data/import-rules.json';
import vat from '../data/vat-rates.json';

export type Origin = 'eu' | 'uk' | 'us' | 'jp' | 'ch' | 'other';
export type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CHF';

export const ORIGINS: Origin[] = ['jp', 'us', 'uk', 'ch', 'other', 'eu'];
export const CURRENCIES: Currency[] = ['EUR', 'JPY', 'USD', 'GBP', 'CHF'];
export const DEFAULT_CURRENCY: Record<Origin, Currency> = {
  eu: 'EUR', uk: 'GBP', us: 'USD', jp: 'JPY', ch: 'CHF', other: 'EUR',
};
export const VAT_RATES: Record<string, number> = vat.rates;
/** Orígenes con acuerdo comercial que permite arancel 0 % con prueba de origen. */
export const PREFERENTIAL_ORIGINS = Object.keys(rules.preferentialOrigin.agreements) as Origin[];

export interface CalcInput {
  origin: Origin;
  /** Código ISO del país de destino dentro de la UE. */
  destination: string;
  /** Precio de la mercancía en la divisa indicada. */
  goods: number;
  /** Envío en la divisa indicada. */
  shipping: number;
  currency: Currency;
  /** Unidades de la divisa por 1 EUR (como publica el BCE). */
  rate: number;
  /** Tipos distintos de artículo (subpartidas arancelarias). Cartas y sobres suelen ser 1. */
  itemTypes: number;
  /** La tienda cobró el IVA al pagar (IOSS). Solo válido hasta 150 €. */
  ioss: boolean;
  /** Prueba de origen preferencial (arancel 0 % en envíos de más de 150 €). */
  preferential: boolean;
  /** Arancel en % para envíos de más de 150 €. */
  dutyRatePct: number;
  /** Gestión del transportista en EUR, IVA incluido. */
  carrierFee: number;
  /** Fecha de la importación (YYYY-MM-DD): decide qué reglas están en vigor. */
  date: string;
}

export type Regime = 'intra-eu' | 'low-value' | 'standard';

export interface CalcResult {
  regime: Regime;
  goodsEur: number;
  shippingEur: number;
  duty: number;
  handlingFee: number;
  vatRate: number;
  vatBase: number;
  /** IVA a pagar en la importación (0 si va por IOSS o es compra dentro de la UE). */
  vat: number;
  /** IVA ya pagado al comprar (IOSS). Informativo, ya está dentro del precio. */
  vatPaidAtCheckout: number;
  carrierFee: number;
  /** Lo que se paga además de mercancía + envío. */
  extras: number;
  total: number;
  /** Porcentaje que suben los extras sobre mercancía + envío. */
  extrasPct: number;
  /** El usuario pidió IOSS pero el envío supera 150 € y no puede ir por IOSS. */
  iossIgnored: boolean;
  flatDutyActive: boolean;
  handlingFeeActive: boolean;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const inForce = (date: string, from: string, until?: string) =>
  date >= from && (!until || date < until);

export function isFlatDutyActive(date: string) {
  return inForce(date, rules.flatDuty.validFrom, rules.flatDuty.validUntil);
}

export function isHandlingFeeActive(date: string) {
  return inForce(date, rules.handlingFee.validFrom);
}

export function calculate(input: CalcInput): CalcResult {
  const rate = input.currency === 'EUR' || !(input.rate > 0) ? 1 : input.rate;
  const goodsEur = round2(Math.max(0, input.goods) / rate);
  const shippingEur = round2(Math.max(0, input.shipping) / rate);
  const base = goodsEur + shippingEur;
  const vatRate = VAT_RATES[input.destination] ?? VAT_RATES.ES;
  const itemTypes = Math.max(1, Math.floor(input.itemTypes || 1));
  const carrierFee = input.origin === 'eu' ? 0 : round2(Math.max(0, input.carrierFee));
  const flatDutyActive = isFlatDutyActive(input.date);
  const handlingFeeActive = isHandlingFeeActive(input.date);

  if (input.origin === 'eu') {
    return {
      regime: 'intra-eu', goodsEur, shippingEur, duty: 0, handlingFee: 0, vatRate,
      vatBase: 0, vat: 0, vatPaidAtCheckout: 0, carrierFee: 0, extras: 0,
      total: round2(base), extrasPct: 0, iossIgnored: false, flatDutyActive, handlingFeeActive,
    };
  }

  // El umbral de 150 € se mide sobre el valor intrínseco: la mercancía sin transporte.
  const lowValue = goodsEur <= rules.lowValueThresholdEur.value;
  const regime: Regime = lowValue ? 'low-value' : 'standard';

  let duty = 0;
  if (lowValue) {
    duty = flatDutyActive ? rules.flatDuty.amountEur * itemTypes : 0;
  } else if (!(input.preferential && PREFERENTIAL_ORIGINS.includes(input.origin))) {
    duty = round2((base * Math.max(0, input.dutyRatePct)) / 100);
  }

  const handlingFee = handlingFeeActive ? rules.handlingFee.amountEur * itemTypes : 0;
  const vatBase = round2(base + duty + (rules.handlingFee.inVatBase ? handlingFee : 0));
  const ioss = input.ioss && lowValue;

  let vat = 0;
  let vatPaidAtCheckout = 0;
  if (ioss) {
    // Con IOSS el precio que ve el comprador ya lleva el IVA dentro.
    vatPaidAtCheckout = round2(base - base / (1 + vatRate / 100));
  } else {
    vat = round2((vatBase * vatRate) / 100);
  }

  const extras = round2(duty + handlingFee + vat + carrierFee);
  const total = round2(base + extras);

  return {
    regime, goodsEur, shippingEur, duty, handlingFee, vatRate, vatBase: ioss ? 0 : vatBase,
    vat, vatPaidAtCheckout, carrierFee, extras, total,
    extrasPct: base > 0 ? round2((extras / base) * 100) : 0,
    iossIgnored: input.ioss && !lowValue, flatDutyActive, handlingFeeActive,
  };
}

export function todayIso(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
