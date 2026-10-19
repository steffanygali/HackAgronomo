import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api';
import { Layout } from './components/Layout';
import { MapaPage } from './features/mapa/MapaPage';
import { OrigenPage } from './features/origen/OrigenPage';
import { SimuladorPage } from './features/simulador/SimuladorPage';
import { RiesgoPage } from './features/riesgo/RiesgoPage';

/**
 * Una ruta por pestaña. HashRouter permite desplegar la versión estática
 * (modo mock) en cualquier carpeta estática, incluso abriendo el archivo
 * directo, sin configurar rewrites de servidor.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/mapa" element={<MapaPage />} />
            <Route path="/origen" element={<OrigenPage />} />
            <Route path="/simulador" element={<SimuladorPage />} />
            <Route path="/riesgo" element={<RiesgoPage />} />
            <Route path="/" element={<Navigate to="/mapa" replace />} />
            <Route path="*" element={<Navigate to="/mapa" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}
