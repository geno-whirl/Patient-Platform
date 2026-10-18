/**
 * Sincronización con una carpeta del computador (File System Access API).
 *
 * La carpeta queda con la misma estructura que el respaldo .zip, pero descomprimida, y se
 * reescribe sola después de cada cambio:
 *
 *   respaldo.json                      ← todos los datos (Exportacion, ver docs/esquema.json)
 *   fichas-pacientes.md                ← la ficha de cada paciente en Markdown (para leer o dársela a una IA)
 *   adjuntos/<id del adjunto>/<nombre> ← archivo de cada adjunto (se escribe una vez; se borra si se elimina)
 *   LEEME.txt
 *
 * Las funciones reciben una `Carpeta`: la parte de FileSystemDirectoryHandle que se usa, así se
 * pueden probar con una carpeta en memoria.
 */
import { ARCHIVO_DATOS, rutaEnZip } from './respaldoZip';
import type { Adjunto, Exportacion } from './schema';

export const ARCHIVO_FICHAS = 'fichas-pacientes.md';
const CARPETA_ADJUNTOS = 'adjuntos';
const ES_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEEME = `Carpeta sincronizada con la plataforma de fichas kinesiológicas.

La app reescribe estos archivos después de cada cambio (mientras está abierta en el navegador):

- respaldo.json: todos los datos (pacientes, ingresos, evaluaciones, sesiones, centros,
  biblioteca de ejercicios, plantillas y programas). Formato descrito en docs/esquema.json.
- fichas-pacientes.md: la ficha de cada paciente en Markdown, legible para personas y modelos de lenguaje.
- adjuntos/<id>/<archivo>: el archivo de cada adjunto; <id> corresponde a "id" en la lista
  "adjuntos" de respaldo.json.

No edites estos archivos a mano: la app los sobrescribe. Para restaurar en otro navegador,
en la app: Datos e IA → Sincronizar con una carpeta → elegir esta carpeta → Restaurar.
Contiene datos clínicos sensibles: guárdala en un lugar seguro.
`;

export interface EscrituraArchivo {
  write(datos: Blob | string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface ArchivoCarpeta {
  getFile(): Promise<File>;
  createWritable(): Promise<EscrituraArchivo>;
}

export interface Carpeta {
  readonly name: string;
  getDirectoryHandle(nombre: string, opciones?: { create?: boolean }): Promise<Carpeta>;
  getFileHandle(nombre: string, opciones?: { create?: boolean }): Promise<ArchivoCarpeta>;
  removeEntry(nombre: string, opciones?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>;
}

const noExiste = (e: unknown) => e instanceof Error && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError');

async function archivoSiExiste(carpeta: Carpeta, nombre: string): Promise<File | null> {
  try {
    return await (await carpeta.getFileHandle(nombre)).getFile();
  } catch (e) {
    if (noExiste(e)) return null;
    throw e;
  }
}

async function carpetaSiExiste(carpeta: Carpeta, nombre: string): Promise<Carpeta | null> {
  try {
    return await carpeta.getDirectoryHandle(nombre);
  } catch (e) {
    if (noExiste(e)) return null;
    throw e;
  }
}

/** Escribe el archivo completo. El navegador escribe en un archivo temporal y lo reemplaza al cerrar. */
async function escribir(carpeta: Carpeta, nombre: string, datos: Blob | string) {
  const w = await (await carpeta.getFileHandle(nombre, { create: true })).createWritable();
  try {
    await w.write(datos);
    await w.close();
  } catch (e) {
    await w.abort?.().catch(() => undefined);
    throw e;
  }
}

/** Datos de la exportación sin la marca de tiempo, para saber si algo cambió de verdad. */
const huella = (e: Exportacion) => JSON.stringify({ ...e, exportadoEn: undefined });

/**
 * Lo ya escrito en esta sesión, para no reescribir lo que no cambió. Se descarta al elegir otra
 * carpeta o recargar la página (la primera sincronización revisa todo).
 */
export interface Memoria {
  datos?: string;
  fichas?: string;
  leeme?: boolean;
  /** Adjuntos cuyo archivo ya se comprobó o escribió en la carpeta. */
  adjuntos: Set<string>;
}

export const memoriaNueva = (): Memoria => ({ adjuntos: new Set() });

export interface ResultadoSincronizacion {
  /** Archivos escritos en esta pasada (0 si nada cambió). */
  escritos: number;
  adjuntosEliminados: number;
  /** Adjuntos cuyo archivo no se pudo leer; se reintentan en la próxima pasada. */
  faltantes: Adjunto[];
}

export async function sincronizarCarpeta(
  carpeta: Carpeta,
  exportacion: Exportacion,
  fichas: () => string,
  leerArchivo: (a: Adjunto) => Promise<Blob>,
  memoria: Memoria,
): Promise<ResultadoSincronizacion> {
  let escritos = 0;
  const h = huella(exportacion);
  if (memoria.datos !== h) {
    await escribir(carpeta, ARCHIVO_DATOS, JSON.stringify(exportacion, null, 2));
    memoria.datos = h;
    escritos++;
    const md = fichas();
    if (memoria.fichas !== md) {
      await escribir(carpeta, ARCHIVO_FICHAS, md);
      memoria.fichas = md;
      escritos++;
    }
  }
  if (!memoria.leeme) {
    if (!(await archivoSiExiste(carpeta, 'LEEME.txt'))) {
      await escribir(carpeta, 'LEEME.txt', LEEME);
      escritos++;
    }
    memoria.leeme = true;
  }

  const faltantes: Adjunto[] = [];
  const pendientes = exportacion.adjuntos.filter((a) => !memoria.adjuntos.has(a.id));
  const vigentes = new Set(exportacion.adjuntos.map((a) => a.id));
  let raiz = await carpetaSiExiste(carpeta, CARPETA_ADJUNTOS);
  if (pendientes.length) raiz ??= await carpeta.getDirectoryHandle(CARPETA_ADJUNTOS, { create: true });
  for (const a of pendientes) {
    const [, id, nombre] = rutaEnZip(a).split('/');
    const dir = await raiz!.getDirectoryHandle(id, { create: true });
    const actual = await archivoSiExiste(dir, nombre);
    if (!actual || actual.size !== a.tamanoBytes) {
      let contenido: Blob;
      try {
        contenido = await leerArchivo(a);
      } catch {
        faltantes.push(a);
        continue;
      }
      if (!actual || actual.size !== contenido.size) {
        await escribir(dir, nombre, contenido);
        escritos++;
      }
    }
    memoria.adjuntos.add(a.id);
  }

  // Adjuntos eliminados en la app: se borra su carpeta. Solo se tocan subcarpetas con forma de id.
  let adjuntosEliminados = 0;
  if (raiz) {
    const sobrantes: string[] = [];
    for await (const e of raiz.values()) {
      if (e.kind === 'directory' && ES_ID.test(e.name) && !vigentes.has(e.name)) sobrantes.push(e.name);
    }
    for (const nombre of sobrantes) {
      await raiz.removeEntry(nombre, { recursive: true });
      memoria.adjuntos.delete(nombre);
      adjuntosEliminados++;
    }
  }
  return { escritos, adjuntosEliminados, faltantes };
}

export interface ResumenCarpeta {
  /** La carpeta tiene un respaldo.json de esta app. */
  respaldo: { pacientes: number; exportadoEn: string } | null;
  /** Tiene otros archivos (la app solo agrega los suyos; no borra nada fuera de adjuntos/). */
  otrosArchivos: boolean;
}

const PROPIOS = new Set([ARCHIVO_DATOS, ARCHIVO_FICHAS, 'LEEME.txt', CARPETA_ADJUNTOS]);

export async function resumirCarpeta(carpeta: Carpeta): Promise<ResumenCarpeta> {
  let otrosArchivos = false;
  for await (const e of carpeta.values()) {
    if (!PROPIOS.has(e.name) && !e.name.startsWith('.')) otrosArchivos = true;
  }
  const archivo = await archivoSiExiste(carpeta, ARCHIVO_DATOS);
  if (!archivo) return { respaldo: null, otrosArchivos };
  try {
    const d = JSON.parse(await archivo.text()) as Partial<Exportacion>;
    if (d.formato !== 'kine-plataforma') return { respaldo: null, otrosArchivos: true };
    return { respaldo: { pacientes: d.pacientes?.length ?? 0, exportadoEn: d.exportadoEn ?? '' }, otrosArchivos };
  } catch {
    return { respaldo: null, otrosArchivos: true };
  }
}

/** Lee el respaldo de la carpeta (datos y archivos de los adjuntos), con la misma forma que `leerRespaldoZip`. */
export async function leerCarpeta(carpeta: Carpeta): Promise<{ datos: Exportacion; archivos: Map<string, Blob> }> {
  const archivo = await archivoSiExiste(carpeta, ARCHIVO_DATOS);
  if (!archivo) throw new Error(`La carpeta no tiene ${ARCHIVO_DATOS}`);
  const datos = JSON.parse(await archivo.text()) as Exportacion;
  const archivos = new Map<string, Blob>();
  const raiz = await carpetaSiExiste(carpeta, CARPETA_ADJUNTOS);
  if (raiz) {
    for (const a of datos.adjuntos ?? []) {
      const dir = await carpetaSiExiste(raiz, a.id);
      const f = dir && (await archivoSiExiste(dir, rutaEnZip(a).split('/')[2]));
      if (f) archivos.set(a.id, new Blob([f], { type: a.tipoMime || f.type }));
    }
  }
  return { datos, archivos };
}

/**
 * Para combinar un respaldo con los datos actuales sin retroceder: quita los registros que ya
 * existen con una versión igual o más reciente (por `actualizadoEn`).
 */
export function soloMasNuevos<T extends Partial<Record<string, unknown>>>(datos: T, actuales: Record<string, { id: string; actualizadoEn: string }[]>): T {
  const salida: Record<string, unknown> = { ...datos };
  for (const [c, lista] of Object.entries(actuales)) {
    const entrantes = datos[c];
    if (!Array.isArray(entrantes)) continue;
    const version = new Map(lista.map((r) => [r.id, r.actualizadoEn]));
    salida[c] = (entrantes as { id: string; actualizadoEn?: string }[]).filter((r) => {
      const actual = version.get(r.id);
      return actual == null || (r.actualizadoEn ?? '') > actual;
    });
  }
  return salida as T;
}
