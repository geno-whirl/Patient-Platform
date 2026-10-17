import type { Centro } from '../domain/schema';

/**
 * <option> de centros para un <select>: los activos primero; los archivados en un grupo
 * aparte (solo si se piden, o si `actualId` apunta a uno archivado).
 */
export function OpcionesCentros({ centros, conArchivados = false, actualId }: { centros: Centro[]; conArchivados?: boolean; actualId?: string | null }) {
  const orden = (a: Centro, b: Centro) => a.nombre.localeCompare(b.nombre, 'es');
  const activos = centros.filter((c) => !c.archivado).sort(orden);
  const archivados = centros.filter((c) => c.archivado && (conArchivados || c.id === actualId)).sort(orden);
  return (
    <>
      {activos.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
      {archivados.length > 0 && (
        <optgroup label="Archivados">
          {archivados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} (archivado)
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
