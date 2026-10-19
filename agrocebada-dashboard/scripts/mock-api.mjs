#!/usr/bin/env node
/**
 * mock-api.mjs — Servidor mínimo que implementa el contrato de
 * docs/openapi.yaml sirviendo los JSON de public/data (generados con
 * `npm run seed`). Sirve para probar VITE_DATA_MODE=api sin backend real:
 *
 *   npm run seed && npm run mock-api
 *   VITE_DATA_MODE=api VITE_API_BASE_URL=http://localhost:8080 npm run dev
 *
 * CORS abierto (solo para desarrollo local).
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const DATA = join(RAIZ, '..', 'public', 'data');
const PUERTO = Number(process.env.PORT ?? 8080);

const leerJson = (nombre) => JSON.parse(readFileSync(join(DATA, nombre), 'utf8'));

function json(res, cuerpo, estado = 200) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  });
  res.end(JSON.stringify(cuerpo));
}

function errorApi(res, codigo, mensaje, estado) {
  json(res, { error: { code: codigo, message: mensaje } }, estado);
}

const servidor = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const ruta = url.pathname.replace(/\/$/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }
  if (req.method !== 'GET') {
    return errorApi(res, 'metodo_no_permitido', 'Solo se admite GET.', 405);
  }

  try {
    if (ruta === '/api/v1/meta') return json(res, leerJson('meta.json'));

    if (ruta === '/api/v1/municipios') return json(res, leerJson('municipios.json'));

    if (ruta === '/api/v1/modelos') return json(res, leerJson('modelos.json'));

    if (ruta === '/api/v1/parcelas') {
      const municipio = url.searchParams.get('municipio');
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      let lista = leerJson('parcelas.json');
      if (municipio) lista = lista.filter((p) => p.municipio === municipio);
      if (q) {
        lista = lista.filter(
          (p) => p.id.toLowerCase().includes(q) || p.municipio.toLowerCase().includes(q),
        );
      }
      return json(res, lista);
    }

    const mParcela = ruta.match(/^\/api\/v1\/parcelas\/([^/]+)$/);
    if (mParcela) {
      const id = decodeURIComponent(mParcela[1]);
      const p = leerJson('parcelas.json').find((x) => x.id === id);
      if (!p) return errorApi(res, 'no_encontrada', `No existe la parcela ${id}.`, 404);
      return json(res, p);
    }

    if (ruta === '/api/v1/export/anexo.csv') {
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(readFileSync(join(DATA, 'anexo.csv'), 'utf8'));
    }

    return errorApi(res, 'ruta_no_encontrada', `Ruta desconocida: ${ruta}`, 404);
  } catch (e) {
    return errorApi(res, 'error_interno', String(e), 500);
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`[mock-api] http://127.0.0.1:${PUERTO}/api/v1 (Ctrl+C para detener)`);
});
