import { useMeta, useModelos, useMunicipios } from '../../api/hooks';
import type { Municipio } from '../../api/types';
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/Estados';
import { ConfianzaBadge } from '../../components/ConfianzaBadge';
import { formatearNumero, TEXTO_SIN_DATO } from '../../lib/formato';
import styles from './RiesgoPage.module.css';

function TablaMunicipios({
  municipios,
  columna,
  titulo,
  descripcion,
}: {
  municipios: Municipio[];
  columna: 'rendimiento_medio_predicho' | 'semiancho_90';
  titulo: string;
  descripcion: string;
}) {
  const ordenados = [...municipios].sort((a, b) => b[columna] - a[columna]);
  return (
    <div>
      <h3>{titulo}</h3>
      <p className={styles.descripcion}>{descripcion}</p>
      <div className="tabla-contenedor">
        <table className="datos">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Municipio</th>
              <th scope="col">Predicho medio (t/ha)</th>
              <th scope="col">Semiancho 90 % (t/ha)</th>
              <th scope="col">Parcelas (pred./ent.)</th>
              <th scope="col">Confianza</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((m, i) => (
              <tr key={m.municipio}>
                <td className="cifra">{i + 1}</td>
                <th scope="row">{m.municipio}</th>
                <td className="cifra">{formatearNumero(m.rendimiento_medio_predicho, 2)}</td>
                <td className="cifra">
                  {columna === 'semiancho_90' ? (
                    <strong>±{formatearNumero(m.semiancho_90, 2)}</strong>
                  ) : (
                    `±${formatearNumero(m.semiancho_90, 2)}`
                  )}
                </td>
                <td className="cifra">
                  {m.n_prediccion} / {m.n_entrenamiento}
                </td>
                <td>
                  <ConfianzaBadge confianza={m.confianza} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RiesgoPage() {
  const municipios = useMunicipios();
  const modelos = useModelos();
  const meta = useMeta();

  if (municipios.isLoading || modelos.isLoading) return <EstadoCarga filas={6} />;
  if (municipios.isError) {
    return (
      <EstadoError
        mensaje={municipios.error instanceof Error ? municipios.error.message : 'Error desconocido.'}
        onReintentar={() => municipios.refetch()}
      />
    );
  }
  if (modelos.isError) {
    return (
      <EstadoError
        mensaje={modelos.error instanceof Error ? modelos.error.message : 'Error desconocido.'}
        onReintentar={() => modelos.refetch()}
      />
    );
  }

  const listaMun = municipios.data ?? [];
  const listaModelos = modelos.data ?? [];
  const maxRmse = Math.max(...listaModelos.map((m) => m.rmse + m.rmse_sd), 0.001);
  const nota = meta.data?.nota_permutaciones;

  return (
    <section aria-labelledby="titulo-riesgo">
      <h2 id="titulo-riesgo">Riesgo por zona y comparación de modelos</h2>

      {listaMun.length === 0 ? (
        <EstadoVacio mensaje="No hay municipios registrados." />
      ) : (
        <div className={styles.tablas}>
          <TablaMunicipios
            municipios={listaMun}
            columna="rendimiento_medio_predicho"
            titulo="1. Rendimiento esperado por municipio"
            descripcion="De mayor a menor rendimiento predicho. El riesgo de cosecha baja donde el rendimiento promedio es menor."
          />
          <TablaMunicipios
            municipios={listaMun}
            columna="semiancho_90"
            titulo="2. Incertidumbre por municipio"
            descripcion="De mayor a menor semiancho del intervalo del 90 %. A mayor semiancho, menos se puede confiar en el número."
          />
        </div>
      )}

      <hr className="divisor" />

      <h3>3. Error de validación cruzada por modelo</h3>
      <p className={styles.descripcion}>
        RMSE de la validación cruzada repetida 5×4 (mismos pliegues para todos). Menor es mejor;
        la barra delgada es la desviación estándar entre repeticiones. El modelo elegido va
        resaltado.
      </p>
      {listaModelos.length === 0 ? (
        <EstadoVacio mensaje="No hay comparación de modelos." />
      ) : (
        <ul className={styles.barras}>
          {listaModelos.map((m) => (
            <li key={m.modelo} className={styles.barraFila}>
              <span className={`${styles.barraNombre} ${m.elegido ? styles.elegido : ''}`}>
                {m.modelo}
                {m.elegido && <span className={styles.etiquetaElegido}> elegido</span>}
              </span>
              <span className={styles.barraTrazo} aria-hidden="true">
                <span
                  className={`${styles.barra} ${m.elegido ? styles.barraElegida : ''}`}
                  style={{ width: `${(m.rmse / maxRmse) * 100}%` }}
                />
                <span
                  className={styles.barraError}
                  style={{
                    left: `${(m.rmse / maxRmse) * 100}%`,
                    width: `${(m.rmse_sd / maxRmse) * 100}%`,
                  }}
                />
              </span>
              <span className={`${styles.barraValor} cifra`}>
                {formatearNumero(m.rmse, 4)} ± {formatearNumero(m.rmse_sd, 4)}
              </span>
              <span className={styles.barraExtra}>
                MAE {formatearNumero(m.mae, 3)} · R² {formatearNumero(m.r2, 3)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.notaPermutacion} role="note">
        {nota ? (
          <>
            <strong>Prueba de permutaciones:</strong> dentro de cada municipio, la máxima
            correlación observada entre variables satelitales y el rendimiento fue{' '}
            <span className="cifra">{formatearNumero(nota.max_correlacion, 3)}</span>, por debajo
            del umbral de azar <span className="cifra">{formatearNumero(nota.umbral, 3)}</span>.
            Es decir, el satélite no explica variación dentro del municipio: de ahí que el modelo
            elegido sea la mediana municipal con un ajuste fino, no un bosque con 80 variables.
          </>
        ) : (
          <>Sin dato sobre la prueba de permutaciones.</>
        )}
      </p>
      <p className={styles.notaFuente}>
        {nota?.fuente ?? TEXTO_SIN_DATO} · Comparación de modelos: validación cruzada con los
        mismos pliegues; las 59 parcelas de predicción nunca participaron en ella.
      </p>
    </section>
  );
}
