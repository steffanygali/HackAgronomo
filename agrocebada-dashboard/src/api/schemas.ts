import { z } from 'zod';

/** Forma del cuerpo de error del contrato: { error: { code, message } }. */
export const errorApiSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export const confianzaSchema = z.enum(['alta', 'media', 'baja']);
export const metodoSchema = z.enum(['hibrido', 'knn_otros']);

export const desgloseSchema = z.object({
  mediana_municipal: z.number(),
  ajuste_ridge: z.number(),
});

export const parcelaSchema = z.object({
  id: z.string().min(1),
  municipio: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  prediccion_ton_ha: z.number(),
  limite_inferior_90: z.number(),
  limite_superior_90: z.number(),
  n_entrenamiento_municipio: z.number().int().nonnegative(),
  confianza: confianzaSchema,
  metodo: metodoSchema,
  desglose: desgloseSchema.nullable(),
});

export const municipioSchema = z.object({
  municipio: z.string().min(1),
  n_prediccion: z.number().int().nonnegative(),
  n_entrenamiento: z.number().int().nonnegative(),
  rendimiento_medio_predicho: z.number(),
  semiancho_90: z.number(),
  confianza: confianzaSchema,
});

export const modeloSchema = z.object({
  modelo: z.string().min(1),
  rmse: z.number(),
  rmse_sd: z.number(),
  mae: z.number(),
  r2: z.number(),
  elegido: z.boolean(),
});

export const notaPermutacionesSchema = z.object({
  max_correlacion: z.number(),
  umbral: z.number(),
  fuente: z.string(),
});

export const metaSchema = z.object({
  n_parcelas_total: z.number().int().positive(),
  n_entrenamiento: z.number().int().positive(),
  n_prediccion: z.number().int().positive(),
  metricas: z.object({ rmse: z.number(), mae: z.number(), r2: z.number() }),
  semiancho_global_90: z.number().positive(),
  modelo: z.string().min(1),
  generado_en: z.string().min(1),
  nota_permutaciones: notaPermutacionesSchema.optional(),
  versiones: z.record(z.unknown()).optional(),
});

export const parcelasSchema = z.array(parcelaSchema);
export const municipiosSchema = z.array(municipioSchema);
export const modelosSchema = z.array(modeloSchema);
