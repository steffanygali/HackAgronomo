import { QueryClient } from '@tanstack/react-query';
import type { DataSource } from './types';
import { mockSource } from './mockSource';
import { httpSource } from './httpSource';

/**
 * Selección del origen de datos por variable de entorno.
 * - VITE_DATA_MODE=mock (defecto): JSON embebidos de public/data, sin red.
 * - VITE_DATA_MODE=api: fetch a VITE_API_BASE_URL/api/v1 (ver docs/openapi.yaml).
 * Los componentes NUNCA conocen este detalle: solo usan `dataSource`.
 */
const modo = import.meta.env.VITE_DATA_MODE ?? 'mock';

export const esModoApi = modo === 'api';

export const dataSource: DataSource = esModoApi
  ? httpSource(import.meta.env.VITE_API_BASE_URL ?? '')
  : mockSource();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // En modo api hay reintento automático (2) además del botón «Reintentar»;
      // en mock basta un reintento porque el dato es local.
      retry: esModoApi ? 2 : 1,
    },
  },
});
