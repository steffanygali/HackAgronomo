import type { DataSource, FiltrosParcelas, Parcela } from './types';
import {
  metaSchema,
  modelosSchema,
  municipiosSchema,
  parcelasSchema,
} from './schemas';

import metaCrudo from '../../public/data/meta.json';
import parcelasCrudas from '../../public/data/parcelas.json';
import municipiosCrudos from '../../public/data/municipios.json';
import modelosCrudos from '../../public/data/modelos.json';
import anexoCsv from '../../public/data/anexo.csv?raw';

/**
 * Implementación mock: lee los JSON generados por scripts/build-seed.mjs.
 * Están embebidos en el bundle, por lo que la app funciona sin ninguna
 * petición de red (incluso abriendo dist/index.html desde file://).
 * Cada respuesta se valida con zod: si el formato no coincide, lanza un
 * error claro en lugar de entregar datos a medias.
 */
function validar<T>(schema: { parse(v: unknown): T }, dato: unknown, origen: string): T {
  try {
    return schema.parse(dato);
  } catch (e) {
    throw new Error(
      `Datos semilla inválidos en ${origen}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

const parcelasBase: Parcela[] = validar(
  parcelasSchema,
  parcelasCrudas,
  'parcelas.json',
).slice();

function aplicarFiltros(lista: Parcela[], filtros?: FiltrosParcelas): Parcela[] {
  const municipio = filtros?.municipio?.trim();
  const q = filtros?.q?.trim().toLowerCase();
  return lista.filter((p) => {
    if (municipio && p.municipio !== municipio) return false;
    if (q && !p.id.toLowerCase().includes(q) && !p.municipio.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

export function mockSource(): DataSource {
  return {
    async getMeta() {
      return validar(metaSchema, metaCrudo, 'meta.json');
    },
    async getParcelas(filtros) {
      return aplicarFiltros(parcelasBase, filtros);
    },
    async getParcela(id) {
      const p = parcelasBase.find((x) => x.id === id);
      if (!p) throw new Error(`No existe la parcela ${id}.`);
      return p;
    },
    async getMunicipios() {
      return validar(municipiosSchema, municipiosCrudos, 'municipios.json');
    },
    async getModelos() {
      return validar(modelosSchema, modelosCrudos, 'modelos.json');
    },
    async getAnexoCsv() {
      return anexoCsv;
    },
  };
}
