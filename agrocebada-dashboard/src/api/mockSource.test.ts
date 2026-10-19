import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockSource } from './mockSource';

const DATA_RAW = join(process.cwd(), 'data-raw');

function parseCsvSimple(texto: string): Record<string, string>[] {
  const lineas = texto.trim().split('\n');
  const header = lineas[0]?.split(',') ?? [];
  return lineas.slice(1).map((l) => {
    const vals = l.split(',');
    return Object.fromEntries(header.map((h, i) => [h, vals[i] ?? '']));
  });
}

const predsCsv = parseCsvSimple(readFileSync(join(DATA_RAW, 'predicciones_PREDICCION.csv'), 'utf8'));
const compCsv = parseCsvSimple(readFileSync(join(DATA_RAW, 'comparacion_modelos_cv.csv'), 'utf8'));

describe('mockSource (datos semilla)', () => {
  it('devuelve exactamente 59 parcelas con IDs únicos', async () => {
    const parcelas = await mockSource().getParcelas();
    expect(parcelas).toHaveLength(59);
    expect(new Set(parcelas.map((p) => p.id)).size).toBe(59);
  });

  it('los IDs coinciden con el CSV de entrada (conjunto completo)', async () => {
    const parcelas = await mockSource().getParcelas();
    const idsCsv = predsCsv.map((p) => p.ID_parcela).sort();
    const idsApp = parcelas.map((p) => p.id).sort();
    expect(idsApp).toEqual(idsCsv);
  });

  it('los valores de 5 parcelas al azar coinciden con el CSV', async () => {
    const parcelas = await mockSource().getParcelas();
    const porId = new Map(parcelas.map((p) => [p.id, p]));
    // Selección fija (reproducible) que cubre los 6 municipios presentes.
    const muestra = ['AGC_003', 'AGC_052', 'AGC_065', 'AGC_120', 'AGC_192'];
    for (const id of muestra) {
      const fila = predsCsv.find((p) => p.ID_parcela === id);
      expect(fila, `fila ${id} del CSV`).toBeDefined();
      const parcela = porId.get(id);
      expect(parcela, `parcela ${id} del mock`).toBeDefined();
      expect(parcela?.prediccion_ton_ha).toBeCloseTo(Number(fila?.rendimiento_predicho_ton_ha), 3);
      expect(parcela?.limite_inferior_90).toBeCloseTo(Number(fila?.limite_inferior_90), 3);
      expect(parcela?.limite_superior_90).toBeCloseTo(Number(fila?.limite_superior_90), 3);
      expect(parcela?.municipio).toBe(fila?.municipio ?? '');
    }
  });

  it('TODAS las predicciones e intervalos coinciden con el CSV', async () => {
    const parcelas = await mockSource().getParcelas();
    const porId = new Map(parcelas.map((p) => [p.id, p]));
    for (const fila of predsCsv) {
      const p = porId.get(String(fila.ID_parcela));
      expect(p?.prediccion_ton_ha).toBeCloseTo(Number(fila.rendimiento_predicho_ton_ha), 3);
      expect(p?.limite_inferior_90).toBeCloseTo(Number(fila.limite_inferior_90), 3);
      expect(p?.limite_superior_90).toBeCloseTo(Number(fila.limite_superior_90), 3);
      expect(p?.municipio).toBe(fila.municipio ?? '');
    }
  });

  it('el Anexo CSV tiene 59 filas con ID_parcela y rendimiento en t/ha', async () => {
    const csv = await mockSource().getAnexoCsv();
    const lineas = csv.trim().split('\n');
    expect(lineas[0]).toBe('ID_parcela,rendimiento_predicho_ton_ha');
    expect(lineas).toHaveLength(60); // encabezado + 59
    const ids = lineas.slice(1).map((l) => l.split(',')[0]);
    expect(ids.sort()).toEqual(predsCsv.map((p) => p.ID_parcela).sort());
  });

  it('meta coincide con la comparación de modelos del CSV (modelo elegido)', async () => {
    const meta = await mockSource().getMeta();
    const filaHibrido = compCsv.find((c) => c.modelo === 'Híbrido (candidato)');
    expect(meta.metricas.rmse).toBeCloseTo(Number(filaHibrido?.rmse), 4);
    expect(meta.metricas.mae).toBeCloseTo(Number(filaHibrido?.mae), 4);
    expect(meta.metricas.r2).toBeCloseTo(Number(filaHibrido?.r2), 4);
    expect(meta.n_parcelas_total).toBe(197);
    expect(meta.n_entrenamiento).toBe(138);
    expect(meta.n_prediccion).toBe(59);
  });

  it('el desglose híbrido reconstruido cuadra con la predicción (± redondeo)', async () => {
    const parcelas = await mockSource().getParcelas();
    for (const p of parcelas) {
      if (p.metodo !== 'hibrido') continue;
      expect(p.desglose).not.toBeNull();
      const suma = (p.desglose?.mediana_municipal ?? 0) + (p.desglose?.ajuste_ridge ?? 0);
      expect(Math.abs(suma - p.prediccion_ton_ha)).toBeLessThanOrEqual(0.001);
    }
  });

  it('los municipios «Otros» (menos de 9 entrenamientos) usan KNN y sin desglose', async () => {
    const parcelas = await mockSource().getParcelas();
    for (const p of parcelas) {
      if (p.n_entrenamiento_municipio < 9) {
        expect(p.metodo).toBe('knn_otros');
        expect(p.desglose).toBeNull();
        expect(p.confianza === 'media' || p.confianza === 'baja').toBe(true);
      } else {
        expect(p.metodo).toBe('hibrido');
        expect(p.confianza).toBe('alta');
      }
    }
  });

  it('filtra por municipio y búsqueda', async () => {
    const source = mockSource();
    const chignahuapan = await source.getParcelas({ municipio: 'Chignahuapan' });
    expect(chignahuapan.length).toBeGreaterThan(0);
    expect(chignahuapan.every((p) => p.municipio === 'Chignahuapan')).toBe(true);
    const porId = await source.getParcelas({ q: 'AGC_003' });
    expect(porId.map((p) => p.id)).toContain('AGC_003');
  });
});
