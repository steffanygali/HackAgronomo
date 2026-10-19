import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpSource } from './httpSource';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const DATA = join(process.cwd(), 'public', 'data');

function leer(nombre: string): string {
  return readFileSync(join(DATA, nombre), 'utf8');
}

const servidores: Server[] = [];
let base: string;
let baseRota: string;

async function escuchar(handler: Handler): Promise<string> {
  const s: Server = createServer(handler);
  servidores.push(s);
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

beforeAll(async () => {
  // Servidor de prueba local con la misma forma del contrato (como mock-api.mjs).
  base = await escuchar((req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const ruta = url.pathname.replace(/\/$/, '') || '/';
    const ok = (cuerpo: string, tipo: string) => {
      res.writeHead(200, { 'Content-Type': tipo });
      res.end(cuerpo);
    };
    const mal = (estado: number, cuerpo: string) => {
      res.writeHead(estado, { 'Content-Type': 'application/json' });
      res.end(cuerpo);
    };
    if (ruta === '/api/v1/meta') return ok(leer('meta.json'), 'application/json');
    if (ruta === '/api/v1/municipios') return ok(leer('municipios.json'), 'application/json');
    if (ruta === '/api/v1/modelos') return ok(leer('modelos.json'), 'application/json');
    if (ruta === '/api/v1/export/anexo.csv') return ok(leer('anexo.csv'), 'text/csv');
    if (ruta === '/api/v1/parcelas') {
      let lista = leer('parcelas.json');
      const municipio = url.searchParams.get('municipio');
      if (municipio) {
        const datos = JSON.parse(lista) as { municipio: string }[];
        lista = JSON.stringify(datos.filter((p) => p.municipio === municipio));
      }
      return ok(lista, 'application/json');
    }
    const m = ruta.match(/^\/api\/v1\/parcelas\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1] ?? '');
      const lista = JSON.parse(leer('parcelas.json')) as { id: string }[];
      const p = lista.find((x) => x.id === id);
      if (!p) {
        return mal(
          404,
          JSON.stringify({ error: { code: 'no_encontrada', message: `No existe ${id}` } }),
        );
      }
      return ok(JSON.stringify(p), 'application/json');
    }
    return mal(404, JSON.stringify({ error: { code: 'ruta_no_encontrada', message: ruta } }));
  });

  // Segundo servidor que respeta la forma de los endpoints pero manda datos mal tipados
  // o errores sin envoltorio, para probar que la app no acepta «datos a medias».
  baseRota = await escuchar((req, res) => {
    const ruta = new URL(req.url ?? '/', 'http://local').pathname.replace(/\/$/, '') || '/';
    res.setHeader('Content-Type', 'application/json');
    if (ruta === '/api/v1/meta') {
      res.writeHead(200);
      res.end(JSON.stringify({ n_prediccion: 'cincuenta y nueve' }));
      return;
    }
    if (ruta === '/api/v1/municipios') {
      res.writeHead(500);
      res.end('error interno en texto plano');
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: { code: 'no', message: 'no' } }));
  });
});

afterAll(() => {
  for (const s of servidores) s.close();
});

describe('httpSource contra un servidor de prueba (modo api)', () => {
  it('getMeta funciona sin tocar componentes', async () => {
    const meta = await httpSource(base).getMeta();
    expect(meta.n_prediccion).toBe(59);
    expect(meta.metricas.rmse).toBeGreaterThan(0);
  });

  it('getParcelas devuelve las 59 parcelas y filtra por municipio', async () => {
    const source = httpSource(base);
    expect(await source.getParcelas()).toHaveLength(59);
    const ch = await source.getParcelas({ municipio: 'Chignahuapan' });
    expect(ch.length).toBeGreaterThan(0);
    expect(ch.every((p) => p.municipio === 'Chignahuapan')).toBe(true);
  });

  it('getParcela devuelve la parcela correcta y propaga el 404 del contrato', async () => {
    const source = httpSource(base);
    const p = await source.getParcela('AGC_003');
    expect(p.id).toBe('AGC_003');
    await expect(source.getParcela('NO_EXISTE')).rejects.toMatchObject({
      code: 'no_encontrada',
      status: 404,
    });
  });

  it('getMunicipios, getModelos y getAnexoCsv responden según el contrato', async () => {
    const source = httpSource(base);
    expect((await source.getMunicipios()).length).toBeGreaterThan(0);
    const modelos = await source.getModelos();
    expect(modelos.filter((m) => m.elegido)).toHaveLength(1);
    const csv = await source.getAnexoCsv();
    expect(csv.trim().split('\n')).toHaveLength(60);
  });

  it('rechaza respuestas que no cumplen el contrato (error claro, sin datos a medias)', async () => {
    await expect(httpSource(baseRota).getMeta()).rejects.toMatchObject({
      code: 'formato_invalido',
    });
    await expect(httpSource(baseRota).getMeta()).rejects.toThrow(/no cumple el contrato/);
  });

  it('convierte un 500 sin envoltoria en un mensaje claro', async () => {
    await expect(httpSource(baseRota).getMunicipios()).rejects.toMatchObject({
      code: 'http_500',
      status: 500,
    });
  });

  it('sin VITE_API_BASE_URL falla con instrucciones claras', () => {
    expect(() => httpSource('')).toThrow(/VITE_API_BASE_URL/);
  });
});
