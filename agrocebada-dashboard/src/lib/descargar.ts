/** Descarga un archivo de texto en el navegador (sin librerías). */
export function descargarTexto(contenido: string, nombreArchivo: string, mime: string): void {
  const blob = new Blob([contenido], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
