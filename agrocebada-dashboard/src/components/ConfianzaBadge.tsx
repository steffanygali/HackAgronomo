import type { Confianza } from '../api/types';
import styles from './ConfianzaBadge.module.css';

const TEXTO: Record<Confianza, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

/**
 * Semáforo de confianza. El color NUNCA va solo: siempre lleva el texto
 * «Alta» / «Media» / «Baja» y un título que explica la regla.
 */
export function ConfianzaBadge({ confianza, nEntrenamiento }: { confianza: Confianza; nEntrenamiento?: number }) {
  const explicacion =
    confianza === 'alta'
      ? 'El municipio tiene 9 o más parcelas de entrenamiento.'
      : confianza === 'media'
        ? 'El municipio tiene de 2 a 8 parcelas de entrenamiento (grupo «Otros»).'
        : 'El municipio tiene una sola parcela de entrenamiento (o ninguna).';
  return (
    <span className={`${styles.badge} ${styles[confianza]}`} title={explicacion}>
      <span aria-hidden="true" className={styles.marca} />
      Confianza {TEXTO[confianza]}
      {typeof nEntrenamiento === 'number' ? ` · ${nEntrenamiento} parcela(s) de entrenamiento` : ''}
    </span>
  );
}
