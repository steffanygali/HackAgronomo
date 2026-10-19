import styles from './Estados.module.css';

export function EstadoCarga({ filas = 4, etiqueta = 'Cargando datos…' }: { filas?: number; etiqueta?: string }) {
  return (
    <div role="status" aria-live="polite" className={styles.carga}>
      <span className={styles.visuallyHidden}>{etiqueta}</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className={styles.linea} aria-hidden="true" />
      ))}
    </div>
  );
}

export function EstadoError({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div role="alert" className={styles.error}>
      <h3>No se pudieron cargar los datos</h3>
      <p>{mensaje}</p>
      <button type="button" className="boton" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

export function EstadoVacio({ mensaje }: { mensaje: string }) {
  return (
    <p className={styles.vacio} role="status">
      {mensaje}
    </p>
  );
}
