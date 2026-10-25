import { describe, expect, it } from 'vitest';
import { calculate, type CalcInput } from './calc';

const base: CalcInput = {
  origin: 'jp', destination: 'ES', goods: 90, shipping: 25, currency: 'EUR', rate: 1,
  itemTypes: 1, ioss: false, preferential: false, dutyRatePct: 2.7, carrierFee: 0,
  date: '2026-11-15',
};

describe('calculate', () => {
  it('compra dentro de la UE: sin extras', () => {
    const r = calculate({ ...base, origin: 'eu', carrierFee: 5 });
    expect(r.regime).toBe('intra-eu');
    expect(r.extras).toBe(0);
    expect(r.total).toBe(115);
  });

  it('bajo valor desde Japón: 3 € + 2 € + IVA 21 % sobre todo', () => {
    const r = calculate(base);
    expect(r.regime).toBe('low-value');
    expect(r.duty).toBe(3);
    expect(r.handlingFee).toBe(2);
    expect(r.vatBase).toBe(120); // 90 + 25 + 3 + 2
    expect(r.vat).toBe(25.2);
    expect(r.total).toBe(145.2);
  });

  it('antes del 1-nov-2026 no hay tasa de gestión', () => {
    const r = calculate({ ...base, date: '2026-10-25' });
    expect(r.handlingFee).toBe(0);
    expect(r.vat).toBe(24.78); // (90 + 25 + 3) * 21 %
    expect(r.total).toBe(142.78);
  });

  it('antes del 1-jul-2026 no hay derecho fijo', () => {
    const r = calculate({ ...base, date: '2026-06-30' });
    expect(r.duty).toBe(0);
    expect(r.flatDutyActive).toBe(false);
  });

  it('el derecho fijo cuenta tipos de artículo, no unidades', () => {
    const r = calculate({ ...base, itemTypes: 2 });
    expect(r.duty).toBe(6);
    expect(r.handlingFee).toBe(4);
  });

  it('el umbral de 150 € ignora el transporte', () => {
    expect(calculate({ ...base, goods: 150, shipping: 60 }).regime).toBe('low-value');
    expect(calculate({ ...base, goods: 150.01, shipping: 0 }).regime).toBe('standard');
  });

  it('más de 150 €: arancel sobre mercancía + transporte', () => {
    const r = calculate({ ...base, origin: 'us', goods: 200, shipping: 30 });
    expect(r.regime).toBe('standard');
    expect(r.duty).toBe(6.21); // 230 * 2,7 %
    expect(r.vat).toBe(50.02); // (230 + 6,21 + 2) * 21 %
  });

  it('origen preferencial: 0 % solo para países con acuerdo', () => {
    expect(calculate({ ...base, goods: 200, preferential: true }).duty).toBe(0);
    expect(calculate({ ...base, origin: 'us', goods: 200, preferential: true }).duty).toBeGreaterThan(0);
  });

  it('IOSS: el IVA va dentro del precio y no se paga en la entrega', () => {
    const r = calculate({ ...base, ioss: true, goods: 121, shipping: 0 });
    expect(r.vat).toBe(0);
    expect(r.vatPaidAtCheckout).toBe(21);
    expect(r.total).toBe(126); // 121 + 3 + 2
  });

  it('IOSS no aplica por encima de 150 €', () => {
    const r = calculate({ ...base, ioss: true, goods: 300 });
    expect(r.iossIgnored).toBe(true);
    expect(r.vat).toBeGreaterThan(0);
  });

  it('convierte divisas con el tipo del BCE (unidades por euro)', () => {
    const r = calculate({ ...base, currency: 'JPY', rate: 160, goods: 16000, shipping: 3200 });
    expect(r.goodsEur).toBe(100);
    expect(r.shippingEur).toBe(20);
  });

  it('usa el IVA del país de destino', () => {
    expect(calculate({ ...base, destination: 'DE' }).vatRate).toBe(19);
    expect(calculate({ ...base, destination: 'XX' }).vatRate).toBe(21);
  });

  it('suma la gestión del transportista', () => {
    const r = calculate({ ...base, carrierFee: 4.5 });
    expect(r.total).toBe(149.7);
  });
});
