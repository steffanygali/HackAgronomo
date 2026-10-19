import type { ZodType } from 'zod';
import type { DataSource, FiltrosParcelas } from './types';
import {
  errorApiSchema,
  metaSchema,
  modelosSchema,
  municipiosSchema,
  parcelaSchema,
  parcelasSchema,
} from './schemas';

const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * fetch con timeout de 10 s mediante Promise.race: funciona en el navegador
 * y en entornos de prueba sin depender de AbortSignal.timeout.
 */
async function fetchConTimeout(url: string): Promise<Response> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vencimiento = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(
      () => rechazar(new ApiError('timeout', `El servidor no respondió en 10 s (${url}).`)),
      TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([fetch(url), vencimiento]);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('red', `No se pudo conectar con el servidor (${url}).`);
  } finally {
    clearTimeout(reloj);
  }
}

async function pedir<T>(ruta: string, base: string, esquema: ZodType<T>): Promise<T> {
  const url = `${base.replace(/\/$/, '')}${ruta}`;
  const respuesta = await fetchConTimeout(url);

  const texto = await respuesta.text();
  let cuerpo: unknown = null;
  if (texto !== '') {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = null;
    }
  }

  if (!respuesta.ok) {
    const err = errorApiSchema.safeParse(cuerpo);
    if (err.success) {
      throw new ApiError(err.data.error.code, err.data.error.message, respuesta.status);
    }
    throw new ApiError(
      `http_${respuesta.status}`,
      `El servidor respondió ${respuesta.status} sin formato de error válido (${ruta}).`,
      respuesta.status,
    );
  }

  const resultado = esquema.safeParse(cuerpo);
  if (!resultado.success) {
    throw new ApiError(
      'formato_invalido',
      `La respuesta de ${ruta} no cumple el contrato: ${resultado.error.issues
        .map((i) => `${i.path.join('.')} (${i.message})`)
        .join('; ')}`,
      respuesta.status,
    );
  }
  return resultado.data;
}

/**
 * Implementación HTTP: consume el backend en VITE_API_BASE_URL siguiendo
 * docs/openapi.yaml (base /api/v1). Timeout de 10 s por petición; el
 * reintento automático lo configura TanStack Query en src/api/index.ts.
 */
export function httpSource(baseUrl: string): DataSource {
  if (!baseUrl) {
    throw new ApiError(
      'config',
      'VITE_DATA_MODE=api requiere VITE_API_BASE_URL. Copia .env.example a .env.local.',
    );
  }
  const base = `${baseUrl.replace(/\/$/, '')}/api/v1`;
  return {
    getMeta: () => pedir('/meta', base, metaSchema),
    getParcelas: (filtros?: FiltrosParcelas) => {
      const params = new URLSearchParams();
      if (filtros?.municipio) params.set('municipio', filtros.municipio);
      if (filtros?.q) params.set('q', filtros.q);
      const qs = params.toString();
      return pedir(`/parcelas${qs ? `?${qs}` : ''}`, base, parcelasSchema);
    },
    getParcela: (id: string) =>
      pedir(`/parcelas/${encodeURIComponent(id)}`, base, parcelaSchema),
    getMunicipios: () => pedir('/municipios', base, municipiosSchema),
    getModelos: () => pedir('/modelos', base, modelosSchema),
    getAnexoCsv: async () => {
      const url = `${base}/export/anexo.csv`;
      const respuesta = await fetchConTimeout(url);
      const texto = await respuesta.text();
      if (!respuesta.ok) {
        let cuerpo: unknown = null;
        try {
          cuerpo = JSON.parse(texto);
        } catch {
          cuerpo = null;
        }
        const err = errorApiSchema.safeParse(cuerpo);
        if (err.success) {
          throw new ApiError(err.data.error.code, err.data.error.message, respuesta.status);
        }
        throw new ApiError(
          `http_${respuesta.status}`,
          `Error ${respuesta.status} al descargar el Anexo.`,
          respuesta.status,
        );
      }
      return texto;
    },
  };
}
