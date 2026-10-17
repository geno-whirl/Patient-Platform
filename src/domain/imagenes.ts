/**
 * Reduce fotos grandes antes de subirlas (las fotos de celular pesan 3–8 MB).
 * Imágenes de más de 2000 px se redimensionan y re-codifican como JPEG.
 * PDFs, videos y otros archivos se suben tal cual.
 */
const LADO_MAXIMO = 2000;
export const TAMANO_MAXIMO = 25 * 1024 * 1024;

export async function prepararArchivo(archivo: File): Promise<File> {
  if (archivo.size > TAMANO_MAXIMO) throw new Error('El archivo supera el máximo de 25 MB');
  const reducible = ['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type);
  if (!reducible || typeof createImageBitmap === 'undefined') return archivo;
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
    if (escala === 1 && archivo.size < 1.5 * 1024 * 1024) return archivo;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob || blob.size >= archivo.size) return archivo;
    return new File([blob], archivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return archivo;
  }
}
