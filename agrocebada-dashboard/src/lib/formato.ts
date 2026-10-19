/** Formateo numérico en español de México. Todas las pantallas pasan por aquí. */

const num = (opciones: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('es-MX', opciones);

export function formatearNumero(v: number, decimales = 1): string {
  return num({ minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
}

export function formatearTon(v: number): string {
  return `${formatearNumero(v, 2)} t/ha`;
}

export function formatearMoneda(v: number): string {
  return num({ style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
}

export function formatearPorcentaje(v: number, decimales = 1): string {
  return `${formatearNumero(v, decimales)} %`;
}

export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin dato';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(d);
}

/** Rango «2.61 – 3.94 t/ha» para intervalos. */
export function formatearRango(lo: number, hi: number): string {
  return `${formatearNumero(lo, 2)} – ${formatearNumero(hi, 2)} t/ha`;
}

export const TEXTO_SIN_DATO = 'Sin dato';
