/**
 * Preparación de un respaldo antes de importarlo, para que funcione en cualquier destino.
 *
 * 1. Catálogo base: los ejercicios, plantillas y programas `predefinido` tienen ids que dependen
 *    del usuario. Se les asigna el id que les corresponde en el destino (por nombre), así
 *    reemplazan a la copia existente en vez de duplicar el catálogo.
 * 2. En Supabase el id de cada fila es único en toda la tabla (entre todos los usuarios). Un
 *    respaldo de modo local o de otra cuenta puede traer ids que ya usa otra persona. Por eso,
 *    los registros que no existen en la cuenta reciben un id propio de ella (UUID v5 de usuario +
 *    id original: determinista, así reimportar el mismo respaldo actualiza en vez de duplicar).
 *    En modo local (`semilla` vacía) los ids se conservan.
 *
 * Las referencias (pacienteId, centroId, evaluacionId, ejercicioId, programa.id…) se actualizan en
 * todo el respaldo reemplazando cada valor que coincida exactamente con un id reasignado.
 */
import { idEjercicio, idPlantilla, idPrograma, uuidV5 } from './uuid';

type Registro = Record<string, unknown> & { id: string; nombre?: string; predefinido?: boolean };
type Entrada = Partial<Record<string, unknown[]>>;

const CATALOGO: Record<string, (nombre: string, semilla: string) => Promise<string>> = {
  ejercicios: idEjercicio,
  plantillas: idPlantilla,
  programas: idPrograma,
};

function reemplazarIds<T>(valor: T, ids: Map<string, string>): T {
  if (typeof valor === 'string') return (ids.get(valor) ?? valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => reemplazarIds(v, ids)) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reemplazarIds(v, ids)])) as T;
  }
  return valor;
}

export interface Adaptado {
  entrada: Entrada;
  /** id original → id en el destino (solo los que cambiaron). */
  ids: Map<string, string>;
}

export async function adaptarIdsAlDestino(entrada: Entrada, semilla: string, idsExistentes: Set<string> = new Set()): Promise<Adaptado> {
  const ids = new Map<string, string>();
  for (const [coleccion, lista] of Object.entries(entrada)) {
    if (!Array.isArray(lista)) continue;
    for (const r of lista as Registro[]) {
      if (!r || typeof r.id !== 'string') continue;
      let nuevo = r.id;
      if (r.predefinido && r.nombre && CATALOGO[coleccion]) {
        nuevo = await CATALOGO[coleccion](r.nombre, semilla);
      } else if (semilla && !idsExistentes.has(r.id)) {
        nuevo = await uuidV5(`${semilla}importado:${r.id}`);
      }
      if (nuevo !== r.id) ids.set(r.id, nuevo);
    }
  }
  return { entrada: ids.size ? reemplazarIds(entrada, ids) : entrada, ids };
}
