/**
 * Tipos de dominio. Son la única representación de datos que ve la UI;
 * el origen (mock o API) se oculta detrás de DataSource.
 */

export type Confianza = 'alta' | 'media' | 'baja';
export type Metodo = 'hibrido' | 'knn_otros';

export interface Desglose {
  mediana_municipal: number;
  ajuste_ridge: number;
}

export interface Parcela {
  id: string;
  municipio: string;
  lat: number;
  lon: number;
  prediccion_ton_ha: number;
  limite_inferior_90: number;
  limite_superior_90: number;
  n_entrenamiento_municipio: number;
  confianza: Confianza;
  metodo: Metodo;
  /** null = sin dato; la UI muestra «Sin dato» y no inventa valores. */
  desglose: Desglose | null;
}

export interface Municipio {
  municipio: string;
  n_prediccion: number;
  n_entrenamiento: number;
  rendimiento_medio_predicho: number;
  semiancho_90: number;
  confianza: Confianza;
}

export interface Modelo {
  modelo: string;
  rmse: number;
  rmse_sd: number;
  mae: number;
  r2: number;
  elegido: boolean;
}

export interface NotaPermutaciones {
  max_correlacion: number;
  umbral: number;
  fuente: string;
}

export interface Meta {
  n_parcelas_total: number;
  n_entrenamiento: number;
  n_prediccion: number;
  metricas: { rmse: number; mae: number; r2: number };
  semiancho_global_90: number;
  modelo: string;
  generado_en: string;
  /** Extensión documentada del mock; el backend puede omitirla. */
  nota_permutaciones?: NotaPermutaciones | undefined;
  /** Extensión documentada del mock (reproducibilidad). */
  versiones?: Record<string, unknown> | undefined;
}

export interface FiltrosParcelas {
  municipio?: string;
  q?: string;
}

/**
 * Única puerta de entrada a los datos. Ni componentes ni hooks conocen el
 * origen: mockSource (JSON embebidos) o httpSource (fetch al backend).
 */
export interface DataSource {
  getMeta(): Promise<Meta>;
  getParcelas(filtros?: FiltrosParcelas): Promise<Parcela[]>;
  getParcela(id: string): Promise<Parcela>;
  getMunicipios(): Promise<Municipio[]>;
  getModelos(): Promise<Modelo[]>;
  /** Devuelve el texto CSV del Anexo (ID_parcela, rendimiento_predicho_ton_ha). */
  getAnexoCsv(): Promise<string>;
}
