import { descargarTexto } from '../lib/descargar';
import { useAnexoCsv } from '../api/hooks';
import styles from './DescargarAnexo.module.css';

/** Botón «Descargar tabla del Anexo (CSV)»: 59 predicciones con ID y t/ha. */
export function DescargarAnexo() {
  const anexo = useAnexoCsv();

  if (anexo.isError) {
    return (
      <p className={styles.aviso} role="alert">
        No se pudo preparar el Anexo.{' '}
        <button type="button" className="boton boton-secundario" onClick={() => anexo.refetch()}>
          Reintentar
        </button>
      </p>
    );
  }

  return (
    <button
      type="button"
      className="boton"
      disabled={anexo.isLoading}
      onClick={() => {
        if (anexo.data) descargarTexto(anexo.data, 'anexo_predicciones.csv', 'text/csv');
      }}
    >
      {anexo.isLoading ? 'Preparando…' : 'Descargar tabla del Anexo (CSV)'}
    </button>
  );
}
