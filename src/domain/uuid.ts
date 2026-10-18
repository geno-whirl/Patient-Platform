/** Ids deterministas (UUID v5) del catálogo base. Módulo pequeño: no arrastra el catálogo. */

const ESPACIO = '6f1c2b8e-3d4a-4e6f-8a9b-0c1d2e3f4a5b';

function bytesDeUuid(u: string): Uint8Array {
  return Uint8Array.from(u.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16)));
}

/** UUID v5 (RFC 4122) a partir de un texto: mismo texto → mismo id en cualquier dispositivo. */
export async function uuidV5(texto: string, espacio = ESPACIO): Promise<string> {
  const nombre = new TextEncoder().encode(texto);
  const datos = new Uint8Array(16 + nombre.length);
  datos.set(bytesDeUuid(espacio));
  datos.set(nombre, 16);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', datos)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// `semilla` distingue a cada usuario (en Supabase el id es único en toda la tabla).
export const idEjercicio = (nombre: string, semilla: string) => uuidV5(`${semilla}ejercicio:${nombre}`);
export const idPlantilla = (nombre: string, semilla: string) => uuidV5(`${semilla}plantilla:${nombre}`);
export const idPrograma = (nombre: string, semilla: string) => uuidV5(`${semilla}programa:${nombre}`);
