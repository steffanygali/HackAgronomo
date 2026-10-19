import { useEffect, useMemo, useState } from 'react';
import { useParcelas } from '../../api/hooks';
import { EstadoCarga, EstadoError, EstadoVacio } from '../../components/Estados';
import { ParcelaSelect } from '../../components/ParcelaSelector';
import {
  calcularSimulacion,
  ETIQUETAS_CAMPOS,
  parsearEntradas,
  validarEntradas,
  type CampoSimulador,
} from '../../lib/calculos';
import { formatearMoneda, formatearNumero } from '../../lib/formato';
import styles from './SimuladorPage.module.css';

/** Valores de arranque de demostración; NO son datos del reto. */
const EJEMPLO: Record<CampoSimulador, string> = {
  hectareas: '10',
  precioPorTonelada: '3000',
  costoPorHa: '12000',
  creditoMonto: '80000',
};

const CAMPOS: { campo: CampoSimulador; etiqueta: string; unidad: string }[] = [
  { campo: 'hectareas', etiqueta: ETIQUETAS_CAMPOS.hectareas, unidad: 'ha' },
  { campo: 'precioPorTonelada', etiqueta: ETIQUETAS_CAMPOS.precioPorTonelada, unidad: 'MXN/t' },
  { campo: 'costoPorHa', etiqueta: ETIQUETAS_CAMPOS.costoPorHa, unidad: 'MXN/ha' },
  { campo: 'creditoMonto', etiqueta: ETIQUETAS_CAMPOS.creditoMonto, unidad: 'MXN' },
];

export function SimuladorPage() {
  const parcelas = useParcelas();
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [entradas, setEntradas] = useState<Record<CampoSimulador, string>>(EJEMPLO);
  const [tocados, setTocados] = useState(false);

  const lista = useMemo(() => parcelas.data ?? [], [parcelas.data]);
  useEffect(() => {
    if (lista.length > 0 && seleccionada === null) {
      setSeleccionada(lista[0]?.id ?? null);
    }
  }, [lista, seleccionada]);

  const errores = useMemo(() => validarEntradas(entradas), [entradas]);
  const actual = lista.find((p) => p.id === seleccionada) ?? null;

  const simulacion = useMemo(() => {
    if (errores.length > 0 || actual === null) return null;
    return calcularSimulacion(
      parsearEntradas(entradas),
      actual.limite_inferior_90,
      actual.prediccion_ton_ha,
      actual.limite_superior_90,
    );
  }, [errores, entradas, actual]);

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

  return (
    <section aria-labelledby="titulo-simulador">
      <h2 id="titulo-simulador">Ingreso y crédito</h2>
      <p className={styles.avisoPermanente} role="note">
        Estimación por zona, no un diagnóstico individual ni una recomendación de crédito.
      </p>

      <div className={styles.rejilla}>
        <form
          className={styles.formulario}
          onSubmit={(e) => {
            e.preventDefault();
            setTocados(true);
          }}
          noValidate
        >
          <p className={styles.ejemploMarca}>EJEMPLO, no son datos reales</p>
          <div className={styles.selector}>
            <ParcelaSelect
              parcelas={lista}
              seleccionada={seleccionada}
              onSeleccionar={setSeleccionada}
            />
          </div>
          {CAMPOS.map(({ campo, etiqueta, unidad }) => {
            const vacioTocado = tocados && entradas[campo].trim() === '';
            const malo = errores.includes(etiqueta) && entradas[campo].trim() !== '';
            const mostrarError = tocados && (vacioTocado || malo);
            return (
              <p className={styles.campo} key={campo}>
                <label className="etiqueta" htmlFor={`sim-${campo}`}>
                  {etiqueta} ({unidad})
                </label>
                <input
                  id={`sim-${campo}`}
                  className="campo-input cifra"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={entradas[campo]}
                  aria-invalid={mostrarError || undefined}
                  aria-describedby={mostrarError ? `err-${campo}` : undefined}
                  onChange={(e) => setEntradas((prev) => ({ ...prev, [campo]: e.target.value }))}
                />
                {mostrarError && (
                  <span id={`err-${campo}`} className={styles.errorCampo} role="alert">
                    {vacioTocado
                      ? 'Este campo es obligatorio.'
                      : entradas[campo].includes('-')
                        ? 'No se admiten valores negativos.'
                        : 'Introduce un número válido, sin negativos.'}
                  </span>
                )}
              </p>
            );
          })}
          <button type="submit" className="boton">
            Calcular escenarios
          </button>
          {tocados && errores.length > 0 && (
            <p role="alert" className={styles.resumenErrores}>
              Corrige {errores.length === 1 ? 'el campo' : 'los campos'}:{' '}
              {errores.join(', ')}.
            </p>
          )}
        </form>

        <div className={styles.resultados}>
          <h3>Escenarios para {actual?.id ?? ''}</h3>
          {simulacion === null ? (
            <EstadoVacio mensaje="Captura valores válidos (números no negativos) para ver los escenarios." />
          ) : (
            <div className="tabla-contenedor">
              <table className="datos">
                <caption className={styles.tablaCaption}>
                  Rendimiento de {actual?.municipio}: {formatearNumero(actual?.prediccion_ton_ha ?? 0, 2)}{' '}
                  t/ha (predicción), con el intervalo del 90 %.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Escenario</th>
                    <th scope="col">Rendimiento (t/ha)</th>
                    <th scope="col">Ingreso</th>
                    <th scope="col">Costo</th>
                    <th scope="col">Neto</th>
                    <th scope="col">¿Cubre el crédito?</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Pesimista (límite inferior 90 %)', actual?.limite_inferior_90 ?? 0, simulacion.pesimista],
                      ['Esperado (predicción)', actual?.prediccion_ton_ha ?? 0, simulacion.esperado],
                      ['Optimista (límite superior 90 %)', actual?.limite_superior_90 ?? 0, simulacion.optimista],
                    ] as const
                  ).map(([nombre, rend, r]) => (
                    <tr key={nombre}>
                      <th scope="row">{nombre}</th>
                      <td className="cifra">{formatearNumero(rend, 2)}</td>
                      <td className="cifra">{formatearMoneda(r.ingreso)}</td>
                      <td className="cifra">{formatearMoneda(r.costo)}</td>
                      <td className="cifra">{formatearMoneda(r.neto)}</td>
                      <td>
                        <span className={r.cubreCredito ? styles.si : styles.no}>
                          {r.cubreCredito ? 'Sí, cubre' : 'No cubre'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {simulacion && (
            <p className={styles.formulas}>
              ingreso = rendimiento × hectáreas × precio · costo = costo/ha × hectáreas · neto =
              ingreso − costo · «cubre el crédito» si neto ≥ monto.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
