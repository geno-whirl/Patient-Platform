import type { SupabaseClient } from '@supabase/supabase-js';
import { COLECCIONES, type BaseDeDatos, type Coleccion, type RegistroPorColeccion } from '../domain/schema';
import { baseVacia, type Repositorio } from './repositorio';

/**
 * Cada colección es una tabla Postgres con (id, user_id, data jsonb, ...).
 * Row Level Security garantiza que cada usuario solo vea sus registros
 * (ver supabase/schema.sql).
 */
export class RepositorioSupabase implements Repositorio {
  readonly nombre = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  async cargarTodo(): Promise<BaseDeDatos> {
    const db = baseVacia();
    await Promise.all(
      (Object.keys(COLECCIONES) as Coleccion[]).map(async (c) => {
        const { data, error } = await this.sb.from(c).select('data');
        if (error) throw new Error(`No se pudo cargar ${c}: ${error.message}`);
        (db[c] as unknown[]) = (data ?? []).flatMap((fila) => {
          const res = COLECCIONES[c].safeParse(fila.data);
          if (!res.success) console.warn(`Registro inválido en ${c}`, fila.data, res.error);
          return res.success ? [res.data] : [];
        });
      }),
    );
    return db;
  }

  async guardar<C extends Coleccion>(c: C, r: RegistroPorColeccion[C]) {
    await this.guardarVarios(c, [r]);
  }

  async guardarVarios<C extends Coleccion>(c: C, rs: RegistroPorColeccion[C][]) {
    if (!rs.length) return;
    const filas = rs.map((r) => ({ id: r.id, data: r }));
    const { error } = await this.sb.from(c).upsert(filas);
    if (error) throw new Error(`No se pudo guardar en ${c}: ${error.message}`);
  }

  async eliminar(c: Coleccion, ids: string[]) {
    if (!ids.length) return;
    const { error } = await this.sb.from(c).delete().in('id', ids);
    if (error) throw new Error(`No se pudo eliminar en ${c}: ${error.message}`);
  }
}
