import { NavLink, Outlet } from 'react-router-dom';
import { useMeta } from '../api/hooks';
import { esModoApi } from '../api';
import { formatearFecha, formatearNumero, TEXTO_SIN_DATO } from '../lib/formato';
import { DescargarAnexo } from './DescargarAnexo';
import styles from './Layout.module.css';

const PESTANAS = [
  { ruta: '/mapa', etiqueta: 'Mapa y ficha' },
  { ruta: '/origen', etiqueta: '¿De dónde sale?' },
  { ruta: '/simulador', etiqueta: 'Ingreso y crédito' },
  { ruta: '/riesgo', etiqueta: 'Riesgo y modelos' },
];

function Metrica({ etiqueta, valor, titulo }: { etiqueta: string; valor: string; titulo: string }) {
  return (
    <div className={styles.metrica}>
      <span className="etiqueta">{etiqueta}</span>
      <strong className={`${styles.metricaValor} cifra`} title={titulo}>
        {valor}
      </strong>
    </div>
  );
}

export function Layout() {
  const meta = useMeta();

  return (
    <div className={styles.app}>
      <header className={styles.franja}>
        <div className={`contenedor ${styles.franjaInterior}`}>
          <div className={styles.titular}>
            <p className={styles.sobre}>Reto AgroCebada FIRA 2026</p>
            <h1>Predicción de rendimiento de cebada</h1>
          </div>
          <div className={styles.metricas} aria-label="Métricas globales del modelo">
            {meta.isError && (
              <p role="alert" className={styles.metaError}>
                Sin métricas: {meta.error instanceof Error ? meta.error.message : 'error'}.
                <button type="button" className="boton boton-secundario" onClick={() => meta.refetch()}>
                  Reintentar
                </button>
              </p>
            )}
            {meta.data && (
              <>
                <Metrica
                  etiqueta="RMSE (t/ha)"
                  valor={formatearNumero(meta.data.metricas.rmse, 3)}
                  titulo="Error cuadrático medio de la validación cruzada 5×4"
                />
                <Metrica
                  etiqueta="MAE (t/ha)"
                  valor={formatearNumero(meta.data.metricas.mae, 3)}
                  titulo="Error absoluto medio de la validación cruzada 5×4"
                />
                <Metrica
                  etiqueta="R²"
                  valor={formatearNumero(meta.data.metricas.r2, 3)}
                  titulo="Coeficiente de determinación de la validación cruzada 5×4"
                />
              </>
            )}
          </div>
        </div>
        <p className={styles.notaFija}>
          Error esperado cercano a 0.5 t/ha. Validado solo para estos municipios.
        </p>
      </header>

      <nav className={styles.nav} aria-label="Secciones del dashboard">
        <div className={`contenedor ${styles.navInterior}`}>
          {PESTANAS.map((p) => (
            <NavLink
              key={p.ruta}
              to={p.ruta}
              className={({ isActive }) => `${styles.navEnlace} ${isActive ? styles.navActivo : ''}`}
            >
              {p.etiqueta}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className={`contenedor ${styles.main}`}>
        <Outlet />
      </main>

      <footer className={styles.pie}>
        <div className="contenedor">
          <h2>Limitaciones</h2>
          <ul className={styles.limitaciones}>
            <li>
              El modelo está validado <strong>solo para los municipios del reto</strong>; no
              extrapole a zonas nuevas.
            </li>
            <li>
              Los intervalos del 90 % provienen del error de la propia validación cruzada:{' '}
              <strong>no son una validación independiente</strong>.
            </li>
            <li>
              La mejora del modelo híbrido sobre la mediana municipal proviene casi por completo
              del grupo «Otros»; el error real esperado es de 0.50 a 0.55 t/ha.
            </li>
            <li>El simulador es una estimación por zona, no un diagnóstico ni una recomendación de crédito.</li>
          </ul>
          <div className={styles.pieInferior}>
            <DescargarAnexo />
            <p className={styles.pieMeta}>
              {meta.data ? (
                <>
                  Generado el {formatearFecha(meta.data.generado_en)} ·{' '}
                  {meta.data.n_entrenamiento} parcelas de entrenamiento y{' '}
                  {meta.data.n_prediccion} por predecir de {meta.data.n_parcelas_total} en total
                  {' · '}modelo {meta.data.modelo}
                  {meta.data.semiancho_global_90 != null
                    ? ` · intervalo 90 % de ±${formatearNumero(meta.data.semiancho_global_90, 2)} t/ha`
                    : ''}
                  {esModoApi ? ' · origen: API' : ' · origen: datos embebidos (mock)'}
                </>
              ) : (
                TEXTO_SIN_DATO
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
