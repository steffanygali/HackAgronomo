/**
 * Cálculos del simulador de ingreso y crédito.
 * Funciones puras: sin React, sin formato, sin estado. Cubiertas por
 * src/lib/calculos.test.ts.
 */

export interface EntradaSimulador {
  /** Hectáreas sembradas. */
  hectareas: number;
  /** Precio por tonelada en MXN. */
  precioPorTonelada: number;
  /** Costo de producción por hectárea en MXN. */
  costoPorHa: number;
  /** Monto del crédito en MXN. */
  creditoMonto: number;
}

export interface ResultadoEscenario {
  /** rendimiento × hectáreas × precio */
  ingreso: number;
  /** costoPorHa × hectáreas */
  costo: number;
  /** ingreso − costo */
  neto: number;
  /** neto ≥ monto del crédito */
  cubreCredito: boolean;
}

export interface Simulacion {
  esperado: ResultadoEscenario;
  pesimista: ResultadoEscenario;
  optimista: ResultadoEscenario;
}

export type CampoSimulador = keyof EntradaSimulador;

export const ETIQUETAS_CAMPOS: Record<CampoSimulador, string> = {
  hectareas: 'Hectáreas',
  precioPorTonelada: 'Precio por tonelada',
  costoPorHa: 'Costo por hectárea',
  creditoMonto: 'Monto del crédito',
};

/** Un valor es inválido si está vacío, no es número finito o es negativo. */
export function valorInvalido(valor: string): boolean {
  const t = valor.trim();
  if (t === '') return true;
  const n = Number(t);
  return !Number.isFinite(n) || n < 0;
}

/** Devuelve los nombres de los campos inválidos (vacíos, no numéricos o negativos). */
export function validarEntradas(entradas: Record<CampoSimulador, string>): string[] {
  const malos: string[] = [];
  for (const campo of Object.keys(ETIQUETAS_CAMPOS) as CampoSimulador[]) {
    if (valorInvalido(entradas[campo])) malos.push(ETIQUETAS_CAMPOS[campo]);
  }
  return malos;
}

export function parsearEntradas(
  entradas: Record<CampoSimulador, string>,
): EntradaSimulador {
  return {
    hectareas: Number(entradas.hectareas.trim()),
    precioPorTonelada: Number(entradas.precioPorTonelada.trim()),
    costoPorHa: Number(entradas.costoPorHa.trim()),
    creditoMonto: Number(entradas.creditoMonto.trim()),
  };
}

/** Escenario para un rendimiento dado (t/ha). */
export function calcularEscenario(
  entrada: EntradaSimulador,
  rendimientoTonHa: number,
): ResultadoEscenario {
  const ingreso = rendimientoTonHa * entrada.hectareas * entrada.precioPorTonelada;
  const costo = entrada.costoPorHa * entrada.hectareas;
  const neto = ingreso - costo;
  return {
    ingreso,
    costo,
    neto,
    cubreCredito: neto >= entrada.creditoMonto,
  };
}

/**
 * Tres escenarios de la parcela: rendimiento predicho (esperado), límite
 * inferior del 90 % (pesimista) y límite superior (optimista).
 */
export function calcularSimulacion(
  entrada: EntradaSimulador,
  limiteInferior: number,
  prediccion: number,
  limiteSuperior: number,
): Simulacion {
  return {
    esperado: calcularEscenario(entrada, prediccion),
    pesimista: calcularEscenario(entrada, limiteInferior),
    optimista: calcularEscenario(entrada, limiteSuperior),
  };
}
