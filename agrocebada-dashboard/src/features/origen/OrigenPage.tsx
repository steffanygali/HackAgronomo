import { useEffect, useMemo, useState } from 'react';
import { useParcelas } from '../../api/hooks';
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/Estados';
import { ParcelaSelect } from '../../components/ParcelaSelector';
import { formatearNumero, formatearTon, TEXTO_SIN_DATO } from '../../lib/formato';
import styles from './OrigenPage.module.css';

export function OrigenPage() {
  const parcelas = useParcelas();
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const lista = useMemo(() => parcelas.data ?? [], [parcelas.data]);

  useEffect(() => {
    if (lista.length > 0 && seleccionada === null) {
      setSeleccionada(lista[0]?.id ?? null);
    }
  }, [lista, seleccionada]);

  const rangoAjustes = useMemo(() => {
    const ajustes = lista
      .map((p) => p.desglose?.ajuste_ridge)
      .filter((a): a is number => typeof a === 'number');
    if (ajustes.length === 0) return null;
    return { min: Math.min(...ajustes), max: Math.max(...ajustes) };
  }, [lista]);

  if (parcelas.isLoading) return <EstadoCarga filas={5} />;
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

  return (
    <section aria-labelledby="titulo-origen">
      <h2 id="titulo-origen">¿De dónde sale esta predicción?</h2>
      <p className={styles.frase}>«Casi todo es ubicación; el satélite mueve muy poco».</p>

      <div className={styles.selector}>
        <ParcelaSelect
          parcelas={lista}
          seleccionada={seleccionada}
          onSeleccionar={setSeleccionada}
        />
      </div>

      {actual === null ? (
        <EstadoVacio mensaje="Selecciona una parcela." />
      ) : actual.metodo === 'knn_otros' ? (
        <div className={styles.bloque}>
          <h3>
            {actual.id} · {actual.municipio}
          </h3>
          <p>
            Esta predicción <strong>no usa</strong> la cascada mediana + Ridge: el municipio tiene
            solo {actual.n_entrenamiento_municipio} parcela(s) de entrenamiento, así que el valor
            sale de <strong>las 3 parcelas de entrenamiento más cercanas</strong> (KNN espacial con
            ponderación por distancia).
          </p>
          <dl className={styles.datos}>
            <div>
              <dt>Predicción (KNN)</dt>
              <dd className="cifra">{formatearTon(actual.prediccion_ton_ha)}</dd>
            </div>
            <div>
              <dt>Mediana municipal</dt>
              <dd>{TEXTO_SIN_DATO}</dd>
            </div>
            <div>
              <dt>Ajuste del satélite</dt>
              <dd>{TEXTO_SIN_DATO}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className={styles.bloque}>
          <h3>
            {actual.id} · {actual.municipio}
          </h3>
          <ol className={styles.cascada}>
            <li className={styles.paso}>
              <span className={styles.pasoNumero}>1</span>
              <div>
                <h4>Mediana del municipio</h4>
                <p className={styles.pasoDetalle}>
                  Rendimiento mediano de las {actual.n_entrenamiento_municipio} parcelas de
                  entrenamiento de {actual.municipio}. Es la base del modelo: casi todo el valor
                  predicho viene de aquí.
                </p>
                <p className={`${styles.pasoValor} cifra`}>
                  {actual.desglose
                    ? formatearTon(actual.desglose.mediana_municipal)
                    : TEXTO_SIN_DATO}
                </p>
              </div>
            </li>
            <li className={styles.paso}>
              <span className={styles.pasoNumero}>2</span>
              <div>
                <h4>Ajuste fino del satélite (Ridge)</h4>
                <p className={styles.pasoDetalle}>
                  Una corrección pequeña sobre la mediana, aprendida de las variables satelitales y
                  topográficas.
                  {rangoAjustes
                    ? ` En las 59 parcelas este ajuste va de ${formatearNumero(rangoAjustes.min, 3)} a ${formatearNumero(rangoAjustes.max, 3)} t/ha.`
                    : ''}
                </p>
                <p className={`${styles.pasoValor} cifra`}>
                  {actual.desglose
                    ? `${actual.desglose.ajuste_ridge >= 0 ? '+' : ''}${formatearTon(actual.desglose.ajuste_ridge)}`
                    : TEXTO_SIN_DATO}
                </p>
              </div>
            </li>
            <li className={`${styles.paso} ${styles.pasoFinal}`}>
              <span className={styles.pasoNumero}>3</span>
              <div>
                <h4>Predicción final</h4>
                <p className={styles.pasoDetalle}>
                  Mediana del municipio + ajuste del satélite (el modelo híbrido promedia la
                  mediana con la mediana ya corregida; el resultado es idéntico a esta suma).
                </p>
                <p className={`${styles.pasoValor} cifra`}>
                  {actual.desglose
                    ? formatearTon(
                        Math.round((actual.desglose.mediana_municipal + actual.desglose.ajuste_ridge) * 1000) / 1000,
                      )
                    : formatearTon(actual.prediccion_ton_ha)}
                  {actual.desglose && (
                    <span className={styles.validacion}>
                      {' '}
                      (en el Anexo: {formatearTon(actual.prediccion_ton_ha)}; la diferencia es
                      redondeo a 3 decimales)
                    </span>
                  )}
                </p>
              </div>
            </li>
          </ol>
          <p className={styles.intervalo}>
            Intervalo del 90 %: {formatearNumero(actual.limite_inferior_90, 2)} –{' '}
            {formatearNumero(actual.limite_superior_90, 2)} t/ha, calculado con el error del 90 %
            del municipio en la validación cruzada.
          </p>
        </div>
      )}
    </section>
  );
}
