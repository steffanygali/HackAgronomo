import { useQuery } from '@tanstack/react-query';
import { dataSource } from './index';
import type { FiltrosParcelas } from './types';

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => dataSource.getMeta() });
}

export function useParcelas(filtros: FiltrosParcelas = {}) {
  return useQuery({
    queryKey: ['parcelas', filtros.municipio ?? '', filtros.q ?? ''],
    queryFn: () => dataSource.getParcelas(filtros),
  });
}

export function useParcela(id: string | null) {
  return useQuery({
    queryKey: ['parcela', id ?? ''],
    queryFn: () => dataSource.getParcela(id as string),
    enabled: id !== null && id !== '',
  });
}

export function useMunicipios() {
  return useQuery({ queryKey: ['municipios'], queryFn: () => dataSource.getMunicipios() });
}

export function useModelos() {
  return useQuery({ queryKey: ['modelos'], queryFn: () => dataSource.getModelos() });
}

export function useAnexoCsv() {
  return useQuery({
    queryKey: ['anexo-csv'],
    queryFn: () => dataSource.getAnexoCsv(),
    staleTime: Infinity,
  });
}
