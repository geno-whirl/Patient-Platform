/**
 * Almacenamiento del navegador (modo local): pedir que sea persistente y recordar respaldos.
 *
 * Sin persistencia, el navegador puede borrar los datos de la app si le falta espacio
 * (y Safari los borra tras 7 días sin uso si la app no está instalada en la pantalla de inicio).
 */

export interface EstadoAlmacenamiento {
  soportado: boolean;
  persistente: boolean;
  usadoBytes: number | null;
  cuotaBytes: number | null;
}

export async function estadoAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s?.persisted) return { soportado: false, persistente: false, usadoBytes: null, cuotaBytes: null };
  const [persistente, estimacion] = await Promise.all([s.persisted(), s.estimate?.().catch(() => undefined)]);
  return { soportado: true, persistente, usadoBytes: estimacion?.usage ?? null, cuotaBytes: estimacion?.quota ?? null };
}

/** Pide almacenamiento persistente. El navegador decide (Firefox pregunta al usuario; Chrome y Safari deciden solos). */
export async function solicitarPersistencia(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

const CLAVE_RESPALDO = 'kine-ultimo-respaldo-completo';

export function registrarRespaldo(fecha = new Date()) {
  try {
    localStorage.setItem(CLAVE_RESPALDO, fecha.toISOString());
  } catch {
    // Sin localStorage (modo privado): el recordatorio simplemente no se guarda.
  }
}

export function ultimoRespaldo(): Date | null {
  try {
    const v = localStorage.getItem(CLAVE_RESPALDO);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

export function diasDesdeRespaldo(ahora = new Date()): number | null {
  const u = ultimoRespaldo();
  return u ? Math.floor((ahora.getTime() - u.getTime()) / 86_400_000) : null;
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
