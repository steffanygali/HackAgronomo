import { describe, expect, it } from 'vitest';
import {
  calcularEscenario,
  calcularSimulacion,
  parsearEntradas,
  validarEntradas,
  type CampoSimulador,
} from './calculos';

const campos = (
  hectareas: string,
  precioPorTonelada: string,
  costoPorHa: string,
  creditoMonto: string,
): Record<CampoSimulador, string> => ({
  hectareas,
  precioPorTonelada,
  costoPorHa,
  creditoMonto,
});

describe('calcularEscenario', () => {
  it('caso base: ingreso = rendimiento × ha × precio; neto = ingreso − costo', () => {
    // 4 t/ha × 10 ha × $1,000/t = $40,000; costo $2,000/ha × 10 = $20,000; neto $20,000
    const r = calcularEscenario(
      { hectareas: 10, precioPorTonelada: 1000, costoPorHa: 2000, creditoMonto: 15000 },
      4,
    );
    expect(r.ingreso).toBe(40000);
    expect(r.costo).toBe(20000);
    expect(r.neto).toBe(20000);
    expect(r.cubreCredito).toBe(true); // 20,000 ≥ 15,000
  });

  it('no cubre el crédito cuando el neto es menor al monto', () => {
    const r = calcularEscenario(
      { hectareas: 10, precioPorTonelada: 1000, costoPorHa: 2000, creditoMonto: 20001 },
      4,
    );
    expect(r.neto).toBe(20000);
    expect(r.cubreCredito).toBe(false);
  });

  it('cero hectáreas: ingreso, costo y neto en cero', () => {
    const r = calcularEscenario(
      { hectareas: 0, precioPorTonelada: 1000, costoPorHa: 2000, creditoMonto: 15000 },
      4,
    );
    expect(r.ingreso).toBe(0);
    expect(r.costo).toBe(0);
    expect(r.neto).toBe(0);
    expect(r.cubreCredito).toBe(false);
  });
});

describe('calcularSimulacion', () => {
  it('límite inferior produce el escenario pesimista y el superior el optimista', () => {
    const entrada = { hectareas: 10, precioPorTonelada: 1000, costoPorHa: 2000, creditoMonto: 5000 };
    const s = calcularSimulacion(entrada, 2.5, 4, 5.5);
    expect(s.pesimista.ingreso).toBe(25000);
    expect(s.pesimista.neto).toBe(5000);
    expect(s.esperado.neto).toBe(20000);
    expect(s.optimista.ingreso).toBe(55000);
    expect(s.optimista.neto).toBe(35000);
    expect(s.pesimista.neto).toBeLessThanOrEqual(s.esperado.neto);
    expect(s.optimista.neto).toBeGreaterThanOrEqual(s.esperado.neto);
  });
});

describe('validarEntradas', () => {
  it('acepta valores válidos', () => {
    expect(validarEntradas(campos('10', '3000', '12000', '80000'))).toEqual([]);
  });

  it('rechaza vacíos', () => {
    expect(validarEntradas(campos('', '3000', '12000', '80000'))).toEqual(['Hectáreas']);
  });

  it('rechaza negativos', () => {
    expect(validarEntradas(campos('10', '-3000', '12000', '80000'))).toEqual([
      'Precio por tonelada',
    ]);
  });

  it('rechaza textos no numéricos', () => {
    expect(validarEntradas(campos('diez', '3000', '12000', '80000'))).toEqual(['Hectáreas']);
  });

  it('rechaza varios campos a la vez', () => {
    expect(validarEntradas(campos('', '', '12000', '80000'))).toEqual([
      'Hectáreas',
      'Precio por tonelada',
    ]);
  });
});

describe('parsearEntradas', () => {
  it('convierte los textos a números (con espacios)', () => {
    expect(parsearEntradas(campos(' 10 ', '3000', '12000', '80000'))).toEqual({
      hectareas: 10,
      precioPorTonelada: 3000,
      costoPorHa: 12000,
      creditoMonto: 80000,
    });
  });
});
