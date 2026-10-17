import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { nombreArchivo } from '../domain/archivos';
import { ahoraIso, hoy, nuevoId } from '../domain/factories';
import { prepararArchivo } from '../domain/imagenes';
import {
  COLECCIONES,
  SCHEMA_VERSION,
  type Adjunto,
  type BaseDeDatos,
  type Coleccion,
  type Exportacion,
  type RegistroPorColeccion,
} from '../domain/schema';
import { baseVacia, type Repositorio } from './repositorio';

interface Datos {
  db: BaseDeDatos;
  cargando: boolean;
  error: string | null;
  modo: Repositorio['nombre'];
  guardar<C extends Coleccion>(c: C, r: RegistroPorColeccion[C]): Promise<RegistroPorColeccion[C]>;
  guardarVarios<C extends Coleccion>(c: C, rs: RegistroPorColeccion[C][]): Promise<RegistroPorColeccion[C][]>;
  eliminar(c: Coleccion, id: string): Promise<void>;
  eliminarPaciente(id: string): Promise<void>;
  subirAdjunto(pacienteId: string, archivo: File, datos?: Partial<Adjunto>): Promise<Adjunto>;
  leerArchivo(ruta: string): Promise<Blob>;
  exportar(): Exportacion;
  importar(datos: unknown): Promise<{ total: number }>;
  /** Agrega a la biblioteca los ejercicios, plantillas y programas del catálogo base que falten. */
  cargarCatalogo(): Promise<{ ejercicios: number; plantillas: number; programas: number }>;
}

const DatosCtx = createContext<Datos | null>(null);

export function DatosProvider({ repositorio, children }: { repositorio: Repositorio; children: ReactNode }) {
  const [db, setDb] = useState<BaseDeDatos>(baseVacia);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef(db);
  dbRef.current = db;
  // Ids eliminados en esta sesión: un autoguardado pendiente no debe volver a crearlos.
  const eliminados = useRef(new Set<string>());
  const fueEliminado = (r: { id: string; pacienteId?: string }) =>
    eliminados.current.has(r.id) || (!!r.pacienteId && eliminados.current.has(r.pacienteId));

  useEffect(() => {
    let vigente = true;
    repositorio
      .cargarTodo()
      .then((d) => vigente && setDb(d))
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [repositorio]);

  const cargarCatalogo = useCallback(async () => {
    const { faltantesDelCatalogo } = await import('../domain/catalogo');
    const faltan = await faltantesDelCatalogo(dbRef.current, repositorio.semillaIds);
    await repositorio.guardarVarios('ejercicios', faltan.ejercicios);
    await repositorio.guardarVarios('plantillas', faltan.plantillas);
    await repositorio.guardarVarios('programas', faltan.programas);
    setDb((prev) => ({
      ...prev,
      ejercicios: [...prev.ejercicios, ...faltan.ejercicios],
      plantillas: [...prev.plantillas, ...faltan.plantillas],
      programas: [...prev.programas, ...faltan.programas],
    }));
    return { ejercicios: faltan.ejercicios.length, plantillas: faltan.plantillas.length, programas: faltan.programas.length };
  }, [repositorio]);

  // Primera vez: la biblioteca viene prellenada con el catálogo base.
  const catalogoRevisado = useRef(false);
  useEffect(() => {
    if (cargando || error || catalogoRevisado.current) return;
    catalogoRevisado.current = true;
    if (!db.ejercicios.some((e) => e.predefinido)) {
      cargarCatalogo().catch((e: Error) => setError(`No se pudo cargar el catálogo de ejercicios: ${e.message}`));
    }
  }, [cargando, error, db.ejercicios, cargarCatalogo]);

  const guardar = useCallback(
    async <C extends Coleccion>(c: C, r: RegistroPorColeccion[C]) => {
      if (fueEliminado(r as { id: string; pacienteId?: string })) return r;
      const validado = COLECCIONES[c].parse({ ...r, actualizadoEn: ahoraIso() }) as RegistroPorColeccion[C];
      await repositorio.guardar(c, validado);
      setDb((prev) => {
        const lista = prev[c] as RegistroPorColeccion[C][];
        const existe = lista.some((x) => x.id === validado.id);
        return {
          ...prev,
          [c]: existe ? lista.map((x) => (x.id === validado.id ? validado : x)) : [...lista, validado],
        };
      });
      return validado;
    },
    [repositorio],
  );

  const guardarVarios = useCallback(
    async <C extends Coleccion>(c: C, rs: RegistroPorColeccion[C][]) => {
      const t = ahoraIso();
      const validados = rs.map((r) => COLECCIONES[c].parse({ ...r, actualizadoEn: t }) as RegistroPorColeccion[C]);
      validados.forEach((r) => eliminados.current.delete(r.id));
      await repositorio.guardarVarios(c, validados);
      const ids = new Set(validados.map((r) => r.id));
      setDb((prev) => ({ ...prev, [c]: [...(prev[c] as RegistroPorColeccion[C][]).filter((x) => !ids.has(x.id)), ...validados] }));
      return validados;
    },
    [repositorio],
  );

  const eliminar = useCallback(
    async (c: Coleccion, id: string) => {
      if (c === 'adjuntos') {
        const a = db.adjuntos.find((x) => x.id === id);
        if (a) await repositorio.eliminarArchivos([a.ruta]);
      }
      eliminados.current.add(id);
      await repositorio.eliminar(c, [id]);
      setDb((prev) => ({ ...prev, [c]: (prev[c] as { id: string }[]).filter((x) => x.id !== id) }));
    },
    [db.adjuntos, repositorio],
  );

  const eliminarPaciente = useCallback(
    async (id: string) => {
      eliminados.current.add(id);
      await repositorio.eliminarArchivos(db.adjuntos.filter((a) => a.pacienteId === id).map((a) => a.ruta));
      const hijos = ['ingresos', 'evaluaciones', 'sesiones', 'adjuntos'] as const;
      for (const c of hijos) {
        const ids = db[c].filter((x) => x.pacienteId === id).map((x) => x.id);
        await repositorio.eliminar(c, ids);
      }
      await repositorio.eliminar('pacientes', [id]);
      setDb((prev) => ({
        ...prev,
        pacientes: prev.pacientes.filter((p) => p.id !== id),
        ingresos: prev.ingresos.filter((x) => x.pacienteId !== id),
        evaluaciones: prev.evaluaciones.filter((x) => x.pacienteId !== id),
        sesiones: prev.sesiones.filter((x) => x.pacienteId !== id),
        adjuntos: prev.adjuntos.filter((x) => x.pacienteId !== id),
      }));
    },
    [db, repositorio],
  );

  const subirAdjunto = useCallback(
    async (pacienteId: string, original: File, datos: Partial<Adjunto> = {}) => {
      const archivo = await prepararArchivo(original);
      const id = nuevoId();
      const extension = archivo.name.includes('.') ? archivo.name.slice(archivo.name.lastIndexOf('.')) : '';
      const base = nombreArchivo(archivo.name.replace(/\.[^.]+$/, '')) || 'archivo';
      const ruta = await repositorio.subirArchivo(`${pacienteId}/${id}-${base}${extension.toLowerCase()}`, archivo);
      const t = ahoraIso();
      try {
        return await guardar('adjuntos', {
          tipo: 'adjunto',
          id,
          creadoEn: t,
          actualizadoEn: t,
          pacienteId,
          fecha: hoy(),
          categoria: archivo.type.startsWith('image/') ? 'imagen' : archivo.type.startsWith('video/') ? 'video' : 'examen',
          descripcion: '',
          nombreArchivo: original.name,
          tipoMime: archivo.type || 'application/octet-stream',
          tamanoBytes: archivo.size,
          ruta,
          evaluacionId: null,
          ...datos,
        });
      } catch (e) {
        await repositorio.eliminarArchivos([ruta]).catch(() => undefined);
        throw e;
      }
    },
    [guardar, repositorio],
  );

  const leerArchivo = useCallback((ruta: string) => repositorio.leerArchivo(ruta), [repositorio]);

  const exportar = useCallback(
    (): Exportacion => ({
      formato: 'kine-plataforma',
      versionEsquema: SCHEMA_VERSION,
      exportadoEn: ahoraIso(),
      ...db,
    }),
    [db],
  );

  /** Importa un respaldo: agrega o reemplaza registros por id (no borra nada). */
  const importar = useCallback(
    async (datos: unknown) => {
      const entrada = datos as Partial<Record<Coleccion, unknown[]>>;
      let total = 0;
      const nuevo = { ...db };
      for (const c of Object.keys(COLECCIONES) as Coleccion[]) {
        const registros = (entrada[c] ?? []).map((r) => COLECCIONES[c].parse(r));
        // Restaurar un respaldo es explícito: lo importado vuelve a ser editable.
        registros.forEach((r) => eliminados.current.delete(r.id));
        await repositorio.guardarVarios(c, registros as never);
        const ids = new Set(registros.map((r) => r.id));
        (nuevo[c] as unknown[]) = [...(db[c] as { id: string }[]).filter((x) => !ids.has(x.id)), ...registros];
        total += registros.length;
      }
      setDb(nuevo);
      return { total };
    },
    [db, repositorio],
  );

  const valor = useMemo<Datos>(
    () => ({
      db,
      cargando,
      error,
      modo: repositorio.nombre,
      guardar,
      guardarVarios,
      eliminar,
      eliminarPaciente,
      subirAdjunto,
      leerArchivo,
      exportar,
      importar,
      cargarCatalogo,
    }),
    [db, cargando, error, repositorio.nombre, guardar, guardarVarios, eliminar, eliminarPaciente, subirAdjunto, leerArchivo, exportar, importar, cargarCatalogo],
  );

  return <DatosCtx.Provider value={valor}>{children}</DatosCtx.Provider>;
}

export function useDatos(): Datos {
  const ctx = useContext(DatosCtx);
  if (!ctx) throw new Error('useDatos fuera de DatosProvider');
  return ctx;
}
