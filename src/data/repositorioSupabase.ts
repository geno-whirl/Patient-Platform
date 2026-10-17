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
  readonly semillaIds: string;

  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {
    this.semillaIds = `${userId}:`;
  }

  private bucket() {
    return this.sb.storage.from('adjuntos');
  }

  async cargarTodo(): Promise<BaseDeDatos> {
    const db = baseVacia();
    await Promise.all(
      (Object.keys(COLECCIONES) as Coleccion[]).map(async (c) => {
        const filas = await this.leerTodas(c);
        (db[c] as unknown[]) = filas.flatMap((fila) => {
          const res = COLECCIONES[c].safeParse(fila.data);
          if (!res.success) console.warn(`Registro inválido en ${c}`, fila.data, res.error);
          return res.success ? [res.data] : [];
        });
      }),
    );
    return db;
  }

  /** PostgREST limita las filas por consulta (max_rows), así que se lee por páginas. */
  private async leerTodas(c: Coleccion): Promise<{ data: unknown }[]> {
    const pagina = 1000;
    const filas: { data: unknown }[] = [];
    for (let desde = 0; ; desde += pagina) {
      const { data, error } = await this.sb
        .from(c)
        .select('data')
        .order('id')
        .range(desde, desde + pagina - 1);
      if (error) throw new Error(`No se pudo cargar ${c}: ${error.message}`);
      filas.push(...(data ?? []));
      if (!data || data.length < pagina) return filas;
    }
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

  async subirArchivo(clave: string, archivo: Blob) {
    // Las políticas de Storage exigen que la primera carpeta sea el id del usuario.
    const ruta = `${this.userId}/${clave}`;
    const { error } = await this.bucket().upload(ruta, archivo, { contentType: archivo.type, upsert: true });
    if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
    return ruta;
  }

  async leerArchivo(ruta: string) {
    const { data, error } = await this.bucket().download(ruta);
    if (error || !data) throw new Error(`No se pudo descargar el archivo: ${error?.message}`);
    return data;
  }

  async eliminarArchivos(rutas: string[]) {
    if (!rutas.length) return;
    const { error } = await this.bucket().remove(rutas);
    if (error) throw new Error(`No se pudo eliminar el archivo: ${error.message}`);
  }
}
