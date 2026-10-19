import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App (modo mock)', () => {
  it('monta el dashboard, muestra la franja de métricas y las 59 parcelas', async () => {
    window.location.hash = '#/mapa';
    render(<App />);

    // Franja fija: métricas leídas de meta.json
    expect(await screen.findByText('RMSE (t/ha)')).toBeInTheDocument();
    expect(await screen.findByText('0.486')).toBeInTheDocument();
    expect(screen.getByText(/Error esperado cercano a 0.5 t\/ha/)).toBeInTheDocument();

    // La pantalla de mapa se llena con las 59 parcelas
    await new Promise((r) => setTimeout(r, 50));
    expect(await screen.findByText(/59 de 59 parcelas/)).toBeInTheDocument();
  });
});
