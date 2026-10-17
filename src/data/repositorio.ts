import type { BaseDeDatos, Coleccion, RegistroPorColeccion } from '../domain/schema';

/**
 * Almacenamiento de registros. Cada colección es un conjunto de documentos JSON
 * identificados por `id`. Hay dos implementaciones: local (IndexedDB) y Supabase.
 */
export interface Repositorio {
  readonly nombre: 'local' | 'supabase';
  cargarTodo(): Promise<BaseDeDatos>;
  guardar<C extends Coleccion>(coleccion: C, registro: RegistroPorColeccion[C]): Promise<void>;
  guardarVarios<C extends Coleccion>(coleccion: C, registros: RegistroPorColeccion[C][]): Promise<void>;
  eliminar(coleccion: Coleccion, ids: string[]): Promise<void>;
}

export const baseVacia = (): BaseDeDatos => ({
  centros: [],
  pacientes: [],
  ingresos: [],
  evaluaciones: [],
  sesiones: [],
});
