// Respaldo de los datos de un usuario en su Google Drive:
// JSON completo (mismo formato que "Descargar respaldo" en la app) + adjuntos nuevos.
import * as google from './google.ts';
import { descargarAdjunto, guardarEstado, leerEstado, leerTabla, rpc } from './servicio.ts';

const COLECCIONES = ['centros', 'pacientes', 'ingresos', 'evaluaciones', 'sesiones', 'adjuntos'] as const;
// Debe coincidir con SCHEMA_VERSION de src/domain/schema.ts.
const VERSION_ESQUEMA = 1;
const RESPALDOS_A_CONSERVAR = 30;
const ADJUNTOS_POR_EJECUCION = 40;
export const NOMBRE_CARPETA = 'Kine — respaldos';

interface Adjunto {
  id: string;
  pacienteId: string;
  fecha: string;
  nombreArchivo: string;
  tipoMime: string;
  descripcion: string;
  ruta: string;
}

const sello = (d = new Date()) => d.toISOString().slice(0, 16).replace('T', '_').replace(':', '');
const limpio = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim();

export async function prepararCarpetas(token: string, userId: string) {
  const estado = await leerEstado(userId);
  if (estado?.carpeta_id && estado.carpeta_adjuntos_id && (await google.carpetaExiste(token, estado.carpeta_id))) {
    return { carpeta: estado.carpeta_id, carpetaAdjuntos: estado.carpeta_adjuntos_id, subidos: estado.adjuntos_subidos ?? {} };
  }
  // Primera vez, o el usuario borró la carpeta: se crea de nuevo y se re-suben los adjuntos.
  const carpeta = await google.crearCarpeta(token, NOMBRE_CARPETA);
  const carpetaAdjuntos = await google.crearCarpeta(token, 'adjuntos', carpeta);
  await guardarEstado(userId, { carpeta_id: carpeta, carpeta_adjuntos_id: carpetaAdjuntos, adjuntos_subidos: {} });
  return { carpeta, carpetaAdjuntos, subidos: {} as Record<string, string> };
}

export async function respaldarUsuario(userId: string): Promise<{ archivo: string; adjuntosNuevos: number; pendientes: number }> {
  try {
    const refresh = await rpc<string | null>('drive_leer_token', { p_user: userId });
    if (!refresh) throw new Error('Google Drive no está conectado');
    const token = await google.tokenDeAcceso(refresh);
    const { carpeta, carpetaAdjuntos, subidos } = await prepararCarpetas(token, userId);

    const datos: Record<string, unknown[]> = {};
    for (const c of COLECCIONES) {
      datos[c] = (await leerTabla<{ data: unknown }>(c, userId)).map((f) => f.data);
    }
    const exportacion = { formato: 'kine-plataforma', versionEsquema: VERSION_ESQUEMA, exportadoEn: new Date().toISOString(), ...datos };
    const archivo = `respaldo-kine-${sello()}.json`;
    await google.subirArchivo(token, {
      nombre: archivo,
      carpeta,
      tipo: 'application/json',
      contenido: new Blob([JSON.stringify(exportacion, null, 2)], { type: 'application/json' }),
      descripcion: 'Respaldo completo de la plataforma de fichas kinesiológicas (JSON, esquema en docs/esquema.json)',
    });

    // Adjuntos: solo los que aún no están en Drive (los borrados en la app se conservan en Drive).
    const nombres = new Map(
      (datos.pacientes as { id: string; identificacion: { nombre: string } }[]).map((p) => [p.id, p.identificacion.nombre]),
    );
    const faltantes = (datos.adjuntos as Adjunto[]).filter((a) => !subidos[a.id]);
    const nuevos = { ...subidos };
    for (const a of faltantes.slice(0, ADJUNTOS_POR_EJECUCION)) {
      const contenido = await descargarAdjunto(a.ruta);
      nuevos[a.id] = await google.subirArchivo(token, {
        nombre: limpio(`${nombres.get(a.pacienteId) ?? 'paciente'} — ${a.fecha} — ${a.nombreArchivo}`),
        carpeta: carpetaAdjuntos,
        tipo: a.tipoMime || 'application/octet-stream',
        contenido,
        descripcion: a.descripcion,
      });
    }
    const adjuntosNuevos = Object.keys(nuevos).length - Object.keys(subidos).length;
    const pendientes = faltantes.length - adjuntosNuevos;

    await google.podarRespaldos(token, carpeta, 'respaldo-kine-', RESPALDOS_A_CONSERVAR);
    await guardarEstado(userId, {
      adjuntos_subidos: nuevos,
      ultimo_respaldo: new Date().toISOString(),
      ultimo_archivo: archivo,
      ultimo_estado: `ok${adjuntosNuevos ? ` · ${adjuntosNuevos} adjunto(s) nuevo(s)` : ''}${pendientes ? ` · ${pendientes} pendiente(s)` : ''}`,
    });
    return { archivo, adjuntosNuevos, pendientes };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await guardarEstado(userId, { ultimo_estado: `error: ${mensaje.slice(0, 300)}` }).catch(() => undefined);
    throw e;
  }
}
