/**
 * Mantiene una carpeta del computador siempre al día con los datos (ver domain/carpeta.ts).
 *
 * Usa la File System Access API (Chrome y Edge de escritorio). El acceso a la carpeta se guarda en
 * IndexedDB; al volver a abrir la app, el navegador puede pedir confirmar el permiso con un clic.
 */
import { createStore, del, get, set } from 'idb-keyval';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  leerCarpeta,
  memoriaNueva,
  resumirCarpeta,
  sincronizarCarpeta,
  soloMasNuevos,
  type Carpeta,
  type ResumenCarpeta,
} from '../domain/carpeta';
import { pacienteAMarkdown } from '../domain/markdown';
import { registrarRespaldo } from './almacenamiento';
import { useDatos } from './DatosContext';

/** Lo que usamos de FileSystemDirectoryHandle además de `Carpeta` (aún no está en los tipos de TypeScript). */
interface CarpetaConPermiso extends Carpeta {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

type VentanaConSelector = Window & {
  showDirectoryPicker?(o?: { id?: string; mode?: 'readwrite'; startIn?: string }): Promise<CarpetaConPermiso>;
};

export const carpetaSoportada = () => typeof window !== 'undefined' && typeof (window as VentanaConSelector).showDirectoryPicker === 'function';

export type EstadoCarpeta =
  | { tipo: 'no_soportado' }
  | { tipo: 'sin_carpeta' }
  /** Hay una carpeta guardada, pero el navegador pide confirmar el permiso (requiere un clic). */
  | { tipo: 'requiere_permiso'; carpeta: string }
  | { tipo: 'activa'; carpeta: string; sincronizando: boolean; ultima: Date | null; faltantes: number; error: string | null };

export interface CarpetaElegida {
  carpeta: CarpetaConPermiso;
  resumen: ResumenCarpeta;
}

interface Sincronizacion {
  estado: EstadoCarpeta;
  /** Abre el selector de carpetas y devuelve lo que contiene, sin activar nada aún. `null` si se canceló. */
  elegir(): Promise<CarpetaElegida | null>;
  /** Activa la sincronización; con `restaurar` primero importa lo que la carpeta tenga más nuevo. */
  activar(elegida: CarpetaElegida, restaurar: boolean): Promise<{ importados: number } | void>;
  reanudar(): Promise<void>;
  desconectar(): Promise<void>;
  sincronizarAhora(): void;
}

const Ctx = createContext<Sincronizacion | null>(null);
const almacen = createStore('kine-plataforma-ajustes', 'ajustes');
const ESPERA_MS = 1500;

/** `ambito` separa la carpeta de cada cuenta (o del modo local) en un mismo navegador. */
export function SincronizacionCarpetaProvider({ ambito, children }: { ambito: string; children: ReactNode }) {
  const { db, cargando, error: errorDatos, exportar, leerArchivo, importar } = useDatos();
  const clave = `carpeta:${ambito}`;
  const [estado, setEstado] = useState<EstadoCarpeta>(() => (carpetaSoportada() ? { tipo: 'sin_carpeta' } : { tipo: 'no_soportado' }));
  const carpeta = useRef<CarpetaConPermiso | null>(null);
  const memoria = useRef(memoriaNueva());
  const enCurso = useRef<Promise<void> | null>(null);
  const otraVez = useRef(false);
  // Lo más reciente, para que una sincronización en curso use siempre los datos actuales.
  const actual = useRef({ db, exportar, leerArchivo });
  actual.current = { db, exportar, leerArchivo };
  const activa = estado.tipo === 'activa';

  // Al abrir: recuperar la carpeta guardada y ver si el permiso sigue vigente.
  useEffect(() => {
    if (!carpetaSoportada()) return;
    let vigente = true;
    get<CarpetaConPermiso>(clave, almacen)
      .then(async (h) => {
        if (!h || !vigente) return;
        carpeta.current = h;
        const permiso = (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
        if (!vigente) return;
        setEstado(
          permiso === 'granted'
            ? { tipo: 'activa', carpeta: h.name, sincronizando: false, ultima: null, faltantes: 0, error: null }
            : { tipo: 'requiere_permiso', carpeta: h.name },
        );
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [clave]);

  const ejecutar = useCallback(async () => {
    const h = carpeta.current;
    if (!h) return;
    const { db: datos, exportar: exp, leerArchivo: leer } = actual.current;
    setEstado((e) => (e.tipo === 'activa' ? { ...e, sincronizando: true } : e));
    try {
      const r = await sincronizarCarpeta(
        h,
        exp(),
        () => `# Pacientes de kinesiología\n\n${datos.pacientes.map((p) => pacienteAMarkdown(p, datos)).join('\n---\n\n')}`,
        (a) => leer(a.ruta),
        memoria.current,
      );
      if (!r.faltantes.length) registrarRespaldo();
      setEstado((e) => (e.tipo === 'activa' ? { ...e, sincronizando: false, ultima: new Date(), faltantes: r.faltantes.length, error: null } : e));
    } catch (e) {
      const permisoPerdido = e instanceof Error && e.name === 'NotAllowedError';
      if (permisoPerdido) {
        setEstado({ tipo: 'requiere_permiso', carpeta: h.name });
        return;
      }
      const texto =
        e instanceof Error && e.name === 'NotFoundError'
          ? 'No se encuentra la carpeta (¿se movió o se eliminó?). Elige la carpeta de nuevo.'
          : `No se pudo escribir en la carpeta: ${e instanceof Error ? e.message : e}`;
      setEstado((s) => (s.tipo === 'activa' ? { ...s, sincronizando: false, error: texto } : s));
    }
  }, []);

  /** Sincroniza ya; si hay una pasada en curso, repite al terminar (con los datos más recientes). */
  const sincronizarAhora = useCallback(() => {
    if (enCurso.current) {
      otraVez.current = true;
      return;
    }
    enCurso.current = (async () => {
      do {
        otraVez.current = false;
        await ejecutar();
      } while (otraVez.current);
      enCurso.current = null;
    })();
  }, [ejecutar]);

  // Cada cambio en los datos se escribe en la carpeta tras una breve pausa (agrupa ediciones seguidas).
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!activa || cargando || errorDatos) return;
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(sincronizarAhora, ESPERA_MS);
    return () => clearTimeout(temporizador.current);
  }, [db, activa, cargando, errorDatos, sincronizarAhora]);

  // Al ocultar la pestaña o cerrar la app, escribir lo pendiente sin esperar la pausa.
  useEffect(() => {
    if (!activa) return;
    const alOcultar = () => {
      if (document.visibilityState === 'hidden' && temporizador.current) {
        clearTimeout(temporizador.current);
        temporizador.current = undefined;
        sincronizarAhora();
      }
    };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, [activa, sincronizarAhora]);

  const elegir = useCallback(async (): Promise<CarpetaElegida | null> => {
    const selector = (window as VentanaConSelector).showDirectoryPicker;
    if (!selector) return null;
    let h: CarpetaConPermiso;
    try {
      h = await selector({ id: 'kine-sincronizacion', mode: 'readwrite', startIn: 'documents' });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return null;
      throw e;
    }
    return { carpeta: h, resumen: await resumirCarpeta(h) };
  }, []);

  const activar = useCallback(
    async ({ carpeta: h, resumen }: CarpetaElegida, restaurar: boolean) => {
      let importados = 0;
      if (restaurar && resumen.respaldo) {
        const { datos, archivos } = await leerCarpeta(h);
        const r = await importar(soloMasNuevos(datos as unknown as Record<string, unknown[]>, actual.current.db), archivos);
        importados = r.total;
      }
      await set(clave, h, almacen);
      carpeta.current = h;
      memoria.current = memoriaNueva();
      setEstado({ tipo: 'activa', carpeta: h.name, sincronizando: false, ultima: null, faltantes: 0, error: null });
      // La escritura inicial la dispara el efecto de arriba, ya con los datos importados.
      return restaurar ? { importados } : undefined;
    },
    [clave, importar],
  );

  const reanudar = useCallback(async () => {
    const h = carpeta.current;
    if (!h) return;
    const permiso = (await h.requestPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (permiso !== 'granted') return;
    memoria.current = memoriaNueva();
    setEstado({ tipo: 'activa', carpeta: h.name, sincronizando: false, ultima: null, faltantes: 0, error: null });
  }, []);

  const desconectar = useCallback(async () => {
    clearTimeout(temporizador.current);
    await del(clave, almacen);
    carpeta.current = null;
    setEstado({ tipo: 'sin_carpeta' });
  }, [clave]);

  const valor = useMemo<Sincronizacion>(
    () => ({ estado, elegir, activar, reanudar, desconectar, sincronizarAhora }),
    [estado, elegir, activar, reanudar, desconectar, sincronizarAhora],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSincronizacionCarpeta(): Sincronizacion {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSincronizacionCarpeta fuera de SincronizacionCarpetaProvider');
  return ctx;
}
