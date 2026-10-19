#!/usr/bin/env node
/**
 * build-seed.mjs — Genera los JSON de /public/data a partir de los archivos
 * crudos del modelo en /data-raw, respetando el contrato de docs/openapi.yaml.
 *
 * Entradas (data-raw/):
 *   - predicciones_PREDICCION.csv   (59 parcelas: predicción + intervalo 90 %)
 *   - features_modelado.csv         (197 parcelas: lat, lon, municipio, conjunto,
 *                                    rendimiento observado)
 *   - comparacion_modelos_cv.csv    (métricas de CV por modelo)
 *   - versiones.json                (versiones y semilla)
 *   - resumen_modelo.md             (semiancho global del intervalo 90 %)
 *
 * Salidas (public/data/):
 *   meta.json, parcelas.json, municipios.json, modelos.json, anexo.csv
 *
 * Nota sobre "desglose": predicciones_PREDICCION.csv NO exporta la mediana
 * municipal ni el ajuste del Ridge. Este script los reconstruye de forma
 * EXACTA y determinista desde features_modelado.csv usando las mismas
 * fórmulas de entrenar_final.py:
 *   mediana_municipal = mediana(RENDIMIENTO_T_HA) de las parcelas de
 *                       ENTRENAMIENTO del mismo municipio (el híbrido usa el
 *                       grupo mun_g; para los municipios con >= 9 parcelas el
 *                       grupo coincide con el municipio);
 *   ajuste_ridge      = rendimiento_predicho − mediana_municipal
 *                       (en entrenar_final.py: ajuste = final − A);
 *   metodo            = "hibrido" si el municipio tiene >= 9 parcelas de
 *                       entrenamiento, si no "knn_otros".
 * Para los municipios "knn_otros" el desglose se deja en null (la predicción
 * viene del KNN espacial, no de la cascada mediana + Ridge).
 * Idealmente el script de Python debe exportar estas columnas; ver README.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const PROYECTO = join(RAIZ, '..');
const DATA_RAW = join(PROYECTO, 'data-raw');
const SALIDA = join(PROYECTO, 'public', 'data');

const MIN_PARCELAS_MUNICIPIO = 9; // mismo umbral que entrenar_final.py
const CONF_BAJA_DESDE = 2; // regla de confianza del contrato

// Nota de la prueba de permutaciones del análisis de minería del equipo.
// No la exporta entrenar_final.py; se documenta como constante verificable.
const NOTA_PERMUTACIONES = {
  max_correlacion: 0.238,
  umbral: 0.281,
  fuente: 'Pruebas de permutaciones del análisis de minería (variables satelitales dentro de cada municipio).',
};

/** Parser CSV mínimo pero correcto con comillas y comillas dobles. */
function parseCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      campo = '';
      filas.push(fila);
      fila = [];
    } else if (c !== '\r') {
      campo += c;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  const encabezado = filas[0];
  return filas
    .slice(1)
    .filter((f) => f.length === encabezado.length && f.some((v) => v !== ''))
    .map((f) => Object.fromEntries(encabezado.map((h, i) => [h, f[i]])));
}

function mediana(valores) {
  const s = [...valores].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return null;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

const r3 = (x) => Math.round(x * 1000) / 1000;

function fallar(msg) {
  console.error(`[build-seed] ERROR: ${msg}`);
  process.exit(1);
}

function leer(nombre) {
  try {
    return readFileSync(join(DATA_RAW, nombre), 'utf8');
  } catch {
    return fallar(`No se encontró data-raw/${nombre}. Coloca ahí los archivos del modelo.`);
  }
}

// --------------------------------------------------------------------------- #
// 1. Lectura de entradas
// --------------------------------------------------------------------------- #
const preds = parseCsv(leer('predicciones_PREDICCION.csv'));
const feats = parseCsv(leer('features_modelado.csv'));
const comps = parseCsv(leer('comparacion_modelos_cv.csv'));
const versiones = JSON.parse(leer('versiones.json'));
const resumen = leer('resumen_modelo.md');

// --------------------------------------------------------------------------- #
// 2. Verificaciones de integridad (nada se publica si algo no cuadra)
// --------------------------------------------------------------------------- #
if (preds.length !== 59) fallar(`Se esperaban 59 predicciones; hay ${preds.length}.`);
const idsPred = preds.map((p) => p.ID_parcela);
if (new Set(idsPred).size !== 59) fallar('Hay IDs de parcela duplicados en las predicciones.');

const featPorId = new Map(feats.map((f) => [f.ID_POLIGONO, f]));
const nEntrenamiento = feats.filter((f) => f.CONJUNTO === 'ENTRENAMIENTO').length;
const nPrediccionConjunto = feats.filter((f) => f.CONJUNTO === 'PREDICCION').length;
if (feats.length !== 197 || nEntrenamiento !== 138 || nPrediccionConjunto !== 59) {
  fallar(
    `features_modelado.csv inesperado: ${feats.length} filas, ` +
      `${nEntrenamiento} entrenamiento, ${nPrediccionConjunto} predicción.`,
  );
}

// Conteos y medianas de entrenamiento por municipio (misma base que el modelo)
const conteoMun = new Map();
const rendPorMun = new Map();
for (const f of feats) {
  if (f.CONJUNTO !== 'ENTRENAMIENTO') continue;
  const m = f.municipio;
  conteoMun.set(m, (conteoMun.get(m) ?? 0) + 1);
  const y = Number(f.RENDIMIENTO_T_HA);
  if (!Number.isNaN(y)) {
    if (!rendPorMun.has(m)) rendPorMun.set(m, []);
    rendPorMun.get(m).push(y);
  }
}

function confianzaDe(n) {
  if (n >= MIN_PARCELAS_MUNICIPIO) return 'alta';
  if (n >= CONF_BAJA_DESDE) return 'media';
  return 'baja';
}

// --------------------------------------------------------------------------- #
// 3. parcelas.json
// --------------------------------------------------------------------------- #
const parcelas = preds.map((p) => {
  const feat = featPorId.get(p.ID_parcela);
  if (!feat) fallar(`La parcela ${p.ID_parcela} no existe en features_modelado.csv.`);
  const lat = Number(feat.lat);
  const lon = Number(feat.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    fallar(`La parcela ${p.ID_parcela} no tiene lat/lon válidos.`);
  }
  const pred = Number(p.rendimiento_predicho_ton_ha);
  const lo = Number(p.limite_inferior_90);
  const hi = Number(p.limite_superior_90);
  if (!(lo < pred && pred < hi)) fallar(`Intervalo inválido en ${p.ID_parcela}.`);

  const nEnt = conteoMun.get(p.municipio) ?? 0;
  const metodo = nEnt >= MIN_PARCELAS_MUNICIPIO ? 'hibrido' : 'knn_otros';
  let desglose = null;
  if (metodo === 'hibrido') {
    const vals = rendPorMun.get(p.municipio);
    if (!vals || vals.length === 0) {
      fallar(`Sin rendimientos de entrenamiento para ${p.municipio}.`);
    }
    const medianaMunicipal = mediana(vals);
    desglose = {
      mediana_municipal: r3(medianaMunicipal),
      ajuste_ridge: r3(pred - medianaMunicipal),
    };
  }
  return {
    id: p.ID_parcela,
    municipio: p.municipio,
    lat,
    lon,
    prediccion_ton_ha: pred,
    limite_inferior_90: lo,
    limite_superior_90: hi,
    n_entrenamiento_municipio: nEnt,
    confianza: confianzaDe(nEnt),
    metodo,
    desglose,
  };
});

// El ajuste reconstruido debe caer dentro del rango reportado por el modelo
// (-0.0927 a +0.0776 t/ha); si no, algo se reconstruyó mal.
const ajustes = parcelas.filter((q) => q.desglose).map((q) => q.desglose.ajuste_ridge);
const minAjuste = Math.min(...ajustes);
const maxAjuste = Math.max(...ajustes);
if (minAjuste < -0.095 || maxAjuste > 0.081) {
  fallar(`Ajuste Ridge reconstruido fuera de rango: ${minAjuste} a ${maxAjuste}.`);
}

// --------------------------------------------------------------------------- #
// 4. municipios.json
// --------------------------------------------------------------------------- #
const porMun = new Map();
for (const p of parcelas) {
  if (!porMun.has(p.municipio)) porMun.set(p.municipio, []);
  porMun.get(p.municipio).push(p);
}
const municipios = [...porMun.entries()]
  .map(([municipio, lista]) => {
    const nEnt = conteoMun.get(municipio) ?? 0;
    const media = lista.reduce((a, p) => a + p.prediccion_ton_ha, 0) / lista.length;
    const semi = lista.reduce(
      (a, p) => a + (p.limite_superior_90 - p.prediccion_ton_ha),
      0,
    ) / lista.length;
    return {
      municipio,
      n_prediccion: lista.length,
      n_entrenamiento: nEnt,
      rendimiento_medio_predicho: r3(media),
      semiancho_90: r3(semi),
      confianza: confianzaDe(nEnt),
    };
  })
  .sort((a, b) => b.rendimiento_medio_predicho - a.rendimiento_medio_predicho);

// --------------------------------------------------------------------------- #
// 5. modelos.json (elegido = el de menor RMSE marcado como candidato en la CV)
// --------------------------------------------------------------------------- #
const modelos = comps.map((c) => ({
  modelo: c.modelo.replace(/^"|"$/g, ''),
  rmse: Number(c.rmse),
  rmse_sd: Number(c.rmse_sd),
  mae: Number(c.mae),
  r2: Number(c.r2),
  elegido: c.modelo.replace(/^"|"$/g, '') === 'Híbrido (candidato)',
}));
const elegido = modelos.find((m) => m.elegido);
if (!elegido) fallar('No se encontró el modelo elegido "Híbrido (candidato)" en la comparación.');

// --------------------------------------------------------------------------- #
// 6. meta.json
// --------------------------------------------------------------------------- #
const mSemi = resumen.match(/Semiancho del intervalo 90 % \(global\):\*\* ([0-9.]+)/);
if (!mSemi) fallar('No se pudo leer el semiancho global del intervalo en resumen_modelo.md.');
const semianchoGlobal90 = Number(mSemi[1]);

const generadoEn = statSync(join(DATA_RAW, 'predicciones_PREDICCION.csv'))
  .mtime.toISOString();

const meta = {
  n_parcelas_total: feats.length,
  n_entrenamiento: nEntrenamiento,
  n_prediccion: preds.length,
  metricas: { rmse: elegido.rmse, mae: elegido.mae, r2: elegido.r2 },
  semiancho_global_90: semianchoGlobal90,
  modelo: elegido.modelo,
  generado_en: generadoEn,
  nota_permutaciones: NOTA_PERMUTACIONES,
  versiones,
};

// --------------------------------------------------------------------------- #
// 7. anexo.csv
// --------------------------------------------------------------------------- #
const anexo = [
  'ID_parcela,rendimiento_predicho_ton_ha',
  ...parcelas.map((p) => `${p.id},${p.prediccion_ton_ha.toFixed(3)}`),
].join('\n');

// --------------------------------------------------------------------------- #
// 8. Escritura
// --------------------------------------------------------------------------- #
mkdirSync(SALIDA, { recursive: true });
const escribir = (nombre, contenido) => {
  writeFileSync(join(SALIDA, nombre), contenido);
  console.log(`[build-seed] public/data/${nombre} (${contenido.length} bytes)`);
};
escribir('meta.json', JSON.stringify(meta, null, 2));
escribir('parcelas.json', JSON.stringify(parcelas));
escribir('municipios.json', JSON.stringify(municipios, null, 2));
escribir('modelos.json', JSON.stringify(modelos, null, 2));
escribir('anexo.csv', `${anexo}\n`);

console.log(
  `[build-seed] OK — ${parcelas.length} parcelas, ${municipios.length} municipios, ` +
    `${modelos.length} modelos. Ajuste Ridge reconstruido: ${minAjuste} a ${maxAjuste} t/ha.`,
);
