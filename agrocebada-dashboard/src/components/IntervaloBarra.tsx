import { formatearNumero } from '../lib/formato';
import styles from './IntervaloBarra.module.css';

/**
 * Barra del intervalo del 90 %: rango ocre con el punto de la predicción.
 * El color no es la única señal: el rango está escrito a los lados.
 */
export function IntervaloBarra({
  limiteInferior,
  prediccion,
  limiteSuperior,
}: {
  limiteInferior: number;
  prediccion: number;
  limiteSuperior: number;
}) {
  const anchoTotal = 320;
  const margen = 14;
  const util = anchoTotal - margen * 2;
  const lo = Math.min(limiteInferior, prediccion, limiteSuperior);
  const hi = Math.max(limiteInferior, prediccion, limiteSuperior);
  const span = hi - lo || 1;
  const x = (v: number) => margen + ((v - lo) / span) * util;

  return (
    <figure className={styles.figura}>
      <svg
        viewBox={`0 0 ${anchoTotal} 46`}
        role="img"
        aria-label={`Intervalo del 90 por ciento: de ${formatearNumero(lo, 2)} a ${formatearNumero(hi, 2)} toneladas por hectárea; predicción ${formatearNumero(prediccion, 2)}.`}
        className={styles.svg}
      >
        <line x1={margen} y1={30} x2={anchoTotal - margen} y2={30} className={styles.eje} />
        <rect x={x(lo)} y={22} width={Math.max(x(hi) - x(lo), 2)} height={16} className={styles.rango} />
        <polygon
          points={`${x(prediccion)},16 ${x(prediccion) - 5},8 ${x(prediccion) + 5},8`}
          className={styles.punta}
        />
        <line x1={x(prediccion)} y1={16} x2={x(prediccion)} y2={40} className={styles.pred} />
      </svg>
      <figcaption className={styles.pies}>
        <span>{formatearNumero(lo, 2)} t/ha (límite inferior 90 %)</span>
        <strong className="cifra">{formatearNumero(prediccion, 2)} t/ha</strong>
        <span>{formatearNumero(hi, 2)} t/ha (límite superior 90 %)</span>
      </figcaption>
    </figure>
  );
}
