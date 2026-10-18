/** Descarga un texto o un archivo binario en el navegador. */
export function descargar(nombre: string, contenido: string | Blob, tipo = 'application/json') {
  const blob = typeof contenido === 'string' ? new Blob([contenido], { type: `${tipo};charset=utf-8` }) : contenido;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function nombreArchivo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
