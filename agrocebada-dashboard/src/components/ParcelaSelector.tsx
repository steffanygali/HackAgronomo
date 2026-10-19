import { useId, useState } from 'react';
import type { Parcela } from '../api/types';
import { formatearNumero } from '../lib/formato';
import styles from './ParcelaSelector.module.css';

/** Lista con búsqueda: sincronizada con el clic del mapa (la seleccionada queda marcada). */
export function ParcelaLista({
  parcelas,
  seleccionada,
  onSeleccionar,
}: {
  parcelas: Parcela[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const idBusqueda = useId();
  const texto = q.trim().toLowerCase();
  const filtradas = texto
    ? parcelas.filter(
        (p) => p.id.toLowerCase().includes(texto) || p.municipio.toLowerCase().includes(texto),
      )
    : parcelas;

  return (
    <div className={styles.lista}>
      <label className="etiqueta" htmlFor={idBusqueda}>
        Buscar parcela o municipio
      </label>
      <input
        id={idBusqueda}
        type="search"
        className="campo-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="p. ej. AGC_031 o Chignahuapan"
      />
      <p className={styles.conteo} aria-live="polite">
        {filtradas.length} de {parcelas.length} parcelas
      </p>
      <ul className={styles.items} aria-label="Parcelas con predicción">
        {filtradas.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`${styles.item} ${p.id === seleccionada ? styles.itemActivo : ''}`}
              aria-pressed={p.id === seleccionada}
              onClick={() => onSeleccionar(p.id)}
            >
              <span className={`${styles.id} cifra`}>{p.id}</span>
              <span className={styles.mun}>{p.municipio}</span>
              <span className={`${styles.val} cifra`}>{formatearNumero(p.prediccion_ton_ha, 2)}</span>
            </button>
          </li>
        ))}
        {filtradas.length === 0 && (
          <li className={styles.sinResultados}>Ninguna parcela coincide con «{q}».</li>
        )}
      </ul>
    </div>
  );
}

/** Desplegable compacto para las pantallas que solo necesitan elegir parcela. */
export function ParcelaSelect({
  parcelas,
  seleccionada,
  onSeleccionar,
}: {
  parcelas: Parcela[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>
        Parcela
      </label>
      <select
        id={id}
        className="campo-select"
        value={seleccionada ?? ''}
        onChange={(e) => onSeleccionar(e.target.value)}
      >
        {parcelas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id} · {p.municipio} · {formatearNumero(p.prediccion_ton_ha, 2)} t/ha
          </option>
        ))}
      </select>
    </div>
  );
}
