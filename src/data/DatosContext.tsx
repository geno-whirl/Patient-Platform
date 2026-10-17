import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ahoraIso } from '../domain/factories';
import {
  COLECCIONES,
  SCHEMA_VERSION,
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
  eliminar(c: Coleccion, id: string): Promise<void>;
  eliminarPaciente(id: string): Promise<void>;
  exportar(): Exportacion;
  importar(datos: unknown): Promise<{ total: number }>;
}

const DatosCtx = createContext<Datos | null>(null);

export function DatosProvider({ repositorio, children }: { repositorio: Repositorio; children: ReactNode }) {
  const [db, setDb] = useState<BaseDeDatos>(baseVacia);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const guardar = useCallback(
    async <C extends Coleccion>(c: C, r: RegistroPorColeccion[C]) => {
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

  const eliminar = useCallback(
    async (c: Coleccion, id: string) => {
      await repositorio.eliminar(c, [id]);
      setDb((prev) => ({ ...prev, [c]: (prev[c] as { id: string }[]).filter((x) => x.id !== id) }));
    },
    [repositorio],
  );

  const eliminarPaciente = useCallback(
    async (id: string) => {
      const hijos = ['ingresos', 'evaluaciones', 'sesiones'] as const;
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
      }));
    },
    [db, repositorio],
  );

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
    () => ({ db, cargando, error, modo: repositorio.nombre, guardar, eliminar, eliminarPaciente, exportar, importar }),
    [db, cargando, error, repositorio.nombre, guardar, eliminar, eliminarPaciente, exportar, importar],
  );

  return <DatosCtx.Provider value={valor}>{children}</DatosCtx.Provider>;
}

export function useDatos(): Datos {
  const ctx = useContext(DatosCtx);
  if (!ctx) throw new Error('useDatos fuera de DatosProvider');
  return ctx;
}
