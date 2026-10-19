import { useEffect, useMemo, useState } from 'react';
import { useParcelas } from '../../api/hooks';
import type { Parcela } from '../../api/types';
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/Estados';
import { ConfianzaBadge } from '../../components/ConfianzaBadge';
import { IntervaloBarra } from '../../components/IntervaloBarra';
import { ParcelaLista } from '../../components/ParcelaSelector';
import { formatearNumero, formatearTon, TEXTO_SIN_DATO } from '../../lib/formato';
import styles from './MapaPage.module.css';

/** Cinco tramos iguales del rango de predicciones (color + leyenda numérica). */
const N_TRAMOS = 5;
const COLORES = ['#e8eedd', '#cfdcb6', '#a9c184', '#7a9a4e', '#4a6b2c'];

function proyeccion(parcelas: Parcela[]) {
  const lats = parcelas.map((p) => p.lat);
  const lons = parcelas.map((p) => p.lon);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const pad = 36;
  const ancho = 560;
  const alto = 420;
  const sx = (lon: number) =>
    pad + ((lon - lonMin) / (lonMax - lonMin || 1)) * (ancho - pad * 2);
  // lat crece hacia arriba en el mundo real: se invierte para el eje Y del SVG
  const sy = (lat: number) =>
    pad + ((latMax - lat) / (latMax - latMin || 1)) * (alto - pad * 2);
  return { sx, sy, ancho, alto, latMin, latMax, lonMin, lonMax };
}

export function MapaPage() {
  const parcelas = useParcelas();
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const lista = useMemo(() => parcelas.data ?? [], [parcelas.data]);

  useEffect(() => {
    if (lista.length > 0 && seleccionada === null) {
      setSeleccionada(lista[0]?.id ?? null);
    }
  }, [lista, seleccionada]);

  const tramos = useMemo(() => {
    if (lista.length === 0) return [];
    const vals = lista.map((p) => p.prediccion_ton_ha);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const paso = (max - min) / N_TRAMOS || 1;
    return Array.from({ length: N_TRAMOS }, (_, i) => ({
      desde: min + i * paso,
      hasta: i === N_TRAMOS - 1 ? max : min + (i + 1) * paso,
      color: COLORES[i] ?? '#4a6b2c',
    }));
  }, [lista]);

  const colorDe = (v: number) => {
    const t = tramos.findIndex((t2) => v <= t2.hasta);
    return COLORES[t === -1 ? N_TRAMOS - 1 : t] ?? '#4a6b2c';
  };

  const centroides = useMemo(() => {
    const porMun = new Map<string, { sx: number; sy: number; n: number }>();
    if (lista.length === 0) return porMun;
    const { sx, sy } = proyeccion(lista);
    for (const p of lista) {
      const actual = porMun.get(p.municipio);
      if (actual) {
        actual.sx += sx(p.lon);
        actual.sy += sy(p.lat);
        actual.n += 1;
      } else {
        porMun.set(p.municipio, { sx: sx(p.lon), sy: sy(p.lat), n: 1 });
      }
    }
    for (const c of porMun.values()) {
      c.sx /= c.n;
      c.sy /= c.n;
    }
    return porMun;
  }, [lista]);

  if (parcelas.isLoading) return <EstadoCarga filas={6} />;
  if (parcelas.isError) {
    return (
      <EstadoError
        mensaje={parcelas.error instanceof Error ? parcelas.error.message : 'Error desconocido.'}
        onReintentar={() => parcelas.refetch()}
      />
    );
  }
  if (lista.length === 0) return <EstadoVacio mensaje="No hay parcelas con predicción." />;

  const actual = lista.find((p) => p.id === seleccionada) ?? null;
  const { sx, sy, ancho, alto, latMin, latMax, lonMin, lonMax } = proyeccion(lista);

  return (
    <section aria-labelledby="titulo-mapa">
      <h2 id="titulo-mapa">Las 59 parcelas por predecir</h2>
      <p className={styles.intro}>
        Cada punto es una parcela; el color indica el rendimiento predicho (ver leyenda con cifras).
        Sin mapa de fondo: solo la geometría real de las parcelas.
      </p>

      <div className={styles.rejilla}>
        <div>
          <svg
            viewBox={`0 0 ${ancho} ${alto}`}
            className={styles.svg}
            role="group"
            aria-label={`Dispersión geográfica de ${lista.length} parcelas. Coordenadas: latitud ${formatearNumero(latMin, 3)} a ${formatearNumero(latMax, 3)}, longitud ${formatearNumero(lonMin, 3)} a ${formatearNumero(lonMax, 3)}.`}
          >
            {lista.map((p) => {
              const activa = p.id === seleccionada;
              return (
                <circle
                  key={p.id}
                  cx={sx(p.lon)}
                  cy={sy(p.lat)}
                  r={activa ? 7 : 5}
                  fill={colorDe(p.prediccion_ton_ha)}
                  stroke={activa ? '#35501d' : '#57523f'}
                  strokeWidth={activa ? 2.5 : 1}
                  tabIndex={0}
                  role="button"
                  aria-pressed={activa}
                  aria-label={`Parcela ${p.id}, ${p.municipio}, ${formatearNumero(p.prediccion_ton_ha, 2)} toneladas por hectárea`}
                  onClick={() => setSeleccionada(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSeleccionada(p.id);
                    }
                  }}
                  className={styles.punto}
                />
              );
            })}
            {[...centroides.entries()].map(([municipio, c]) => (
              <text
                key={municipio}
                x={c.sx}
                y={c.sy - 12}
                textAnchor="middle"
                className={styles.rotulo}
              >
                {municipio} ({c.n})
              </text>
            ))}
          </svg>

          <h3 className={styles.leyendaTitulo}>Rendimiento predicho (t/ha)</h3>
          <ul className={styles.leyenda}>
            {tramos.map((t) => (
              <li key={t.desde}>
                <span className={styles.muestra} style={{ background: t.color }} aria-hidden="true" />
                {formatearNumero(t.desde, 2)} – {formatearNumero(t.hasta, 2)}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.panelLateral}>
          <ParcelaLista
            parcelas={lista}
            seleccionada={seleccionada}
            onSeleccionar={setSeleccionada}
          />
        </div>
      </div>

      <hr className="divisor" />

      <article aria-labelledby="titulo-ficha" className={styles.ficha}>
        <h2 id="titulo-ficha">Ficha de la parcela</h2>
        {actual === null ? (
          <EstadoVacio mensaje="Selecciona una parcela en el mapa o en la lista." />
        ) : (
          <>
            <p className={styles.fichaClave}>
              <strong className="cifra">{actual.id}</strong> · {actual.municipio}
            </p>
            <dl className={styles.datos}>
              <div>
                <dt>Rendimiento predicho</dt>
                <dd className="cifra">{formatearTon(actual.prediccion_ton_ha)}</dd>
              </div>
              <div>
                <dt>Municipio</dt>
                <dd>{actual.municipio}</dd>
              </div>
              <div>
                <dt>Parcelas de entrenamiento del municipio</dt>
                <dd className="cifra">
                  {actual.n_entrenamiento_municipio > 0
                    ? String(actual.n_entrenamiento_municipio)
                    : TEXTO_SIN_DATO}
                </dd>
              </div>
              <div>
                <dt>Método</dt>
                <dd>
                  {actual.metodo === 'hibrido'
                    ? 'Híbrido (mediana municipal + ajuste del satélite)'
                    : 'Vecinos más cercanos (KNN espacial)'}
                </dd>
              </div>
            </dl>
            <IntervaloBarra
              limiteInferior={actual.limite_inferior_90}
              prediccion={actual.prediccion_ton_ha}
              limiteSuperior={actual.limite_superior_90}
            />
            <p>
              <ConfianzaBadge
                confianza={actual.confianza}
                nEntrenamiento={actual.n_entrenamiento_municipio}
              />
            </p>
          </>
        )}
      </article>
    </section>
  );
}
