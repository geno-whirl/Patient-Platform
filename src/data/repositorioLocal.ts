import { createStore, get, set } from 'idb-keyval';
import { COLECCIONES, type BaseDeDatos, type Coleccion, type RegistroPorColeccion } from '../domain/schema';
import { baseVacia, type Repositorio } from './repositorio';

type Mapa = Record<string, unknown>;

/** Guarda cada colección como un objeto { id: registro } en IndexedDB del navegador. */
export class RepositorioLocal implements Repositorio {
  readonly nombre = 'local' as const;
  private store = createStore('kine-plataforma', 'colecciones');

  private async leer(c: Coleccion): Promise<Mapa> {
    return ((await get(c, this.store)) as Mapa | undefined) ?? {};
  }

  async cargarTodo(): Promise<BaseDeDatos> {
    const db = baseVacia();
    for (const c of Object.keys(COLECCIONES) as Coleccion[]) {
      const mapa = await this.leer(c);
      // Re-validar al cargar aplica valores por defecto de campos nuevos del esquema.
      (db[c] as unknown[]) = Object.values(mapa).flatMap((r) => {
        const res = COLECCIONES[c].safeParse(r);
        if (!res.success) console.warn(`Registro inválido en ${c}`, r, res.error);
        return res.success ? [res.data] : [];
      });
    }
    return db;
  }

  async guardar<C extends Coleccion>(c: C, r: RegistroPorColeccion[C]) {
    await this.guardarVarios(c, [r]);
  }

  async guardarVarios<C extends Coleccion>(c: C, rs: RegistroPorColeccion[C][]) {
    const mapa = await this.leer(c);
    for (const r of rs) mapa[r.id] = r;
    await set(c, mapa, this.store);
  }

  async eliminar(c: Coleccion, ids: string[]) {
    const mapa = await this.leer(c);
    for (const id of ids) delete mapa[id];
    await set(c, mapa, this.store);
  }
}
