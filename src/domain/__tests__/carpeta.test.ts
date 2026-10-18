import { describe, expect, it } from 'vitest';
import { ARCHIVO_FICHAS, leerCarpeta, memoriaNueva, resumirCarpeta, sincronizarCarpeta, soloMasNuevos, type Carpeta } from '../carpeta';
import type { Adjunto, Exportacion } from '../schema';

/** Carpeta en memoria con el comportamiento de FileSystemDirectoryHandle que usa la app. */
class CarpetaFalsa implements Carpeta {
  archivos = new Map<string, Blob>();
  carpetas = new Map<string, CarpetaFalsa>();
  escrituras = 0;
  constructor(readonly name = 'raiz') {}
  private noExiste(): never {
    throw Object.assign(new Error('no existe'), { name: 'NotFoundError' });
  }
  async getDirectoryHandle(nombre: string, o?: { create?: boolean }) {
    if (!this.carpetas.has(nombre)) {
      if (!o?.create) this.noExiste();
      this.carpetas.set(nombre, new CarpetaFalsa(nombre));
    }
    return this.carpetas.get(nombre)!;
  }
  async getFileHandle(nombre: string, o?: { create?: boolean }) {
    if (!this.archivos.has(nombre) && !o?.create) this.noExiste();
    return {
      getFile: async () => new File([this.archivos.get(nombre) ?? ''], nombre),
      createWritable: async () => {
        let contenido: Blob = new Blob([]);
        return {
          write: async (d: Blob | string) => void (contenido = new Blob([d])),
          close: async () => {
            this.archivos.set(nombre, contenido);
            this.escrituras++;
          },
        };
      },
    };
  }
  async removeEntry(nombre: string) {
    if (!this.archivos.delete(nombre) && !this.carpetas.delete(nombre)) this.noExiste();
  }
  async *values() {
    for (const name of this.archivos.keys()) yield { kind: 'file' as const, name };
    for (const name of this.carpetas.keys()) yield { kind: 'directory' as const, name };
  }
  texto(nombre: string) {
    return this.archivos.get(nombre)!.text();
  }
}

const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

const adjunto = (id: string, nombreArchivo: string): Adjunto => ({
  tipo: 'adjunto',
  id,
  creadoEn: '',
  actualizadoEn: '',
  pacienteId: 'p1',
  fecha: '2026-10-18',
  categoria: 'examen',
  descripcion: '',
  nombreArchivo,
  tipoMime: 'application/pdf',
  tamanoBytes: 3,
  ruta: `ruta/${id}`,
  evaluacionId: null,
});

const exportacion = (adjuntos: Adjunto[], exportadoEn = '2026-10-18T10:00:00Z'): Exportacion => ({
  formato: 'kine-plataforma',
  versionEsquema: 1,
  exportadoEn,
  centros: [],
  pacientes: [],
  ingresos: [],
  evaluaciones: [],
  sesiones: [],
  adjuntos,
  ejercicios: [],
  plantillas: [],
  programas: [],
});

describe('sincronización con carpeta', () => {
  it('escribe datos, fichas, LEEME y adjuntos; solo reescribe lo que cambió', async () => {
    const c = new CarpetaFalsa();
    const memoria = memoriaNueva();
    let lecturas = 0;
    const leer = async (a: Adjunto) => (lecturas++, new Blob([a.id.slice(0, 3)]));
    const a1 = adjunto(ID1, 'RM rodilla.pdf');

    const r1 = await sincronizarCarpeta(c, exportacion([a1]), () => '# fichas', leer, memoria);
    expect(r1).toMatchObject({ escritos: 4, faltantes: [] });
    expect(JSON.parse(await c.texto('respaldo.json')).adjuntos[0].id).toBe(ID1);
    expect(await c.texto(ARCHIVO_FICHAS)).toBe('# fichas');
    expect(c.archivos.has('LEEME.txt')).toBe(true);
    expect(await c.carpetas.get('adjuntos')!.carpetas.get(ID1)!.texto('RM rodilla.pdf')).toBe('111');

    // Misma información con otra marca de tiempo: no se escribe nada ni se vuelven a leer adjuntos.
    const r2 = await sincronizarCarpeta(c, exportacion([a1], '2026-10-18T11:00:00Z'), () => '# fichas', leer, memoria);
    expect(r2.escritos).toBe(0);
    expect(lecturas).toBe(1);

    // Un adjunto nuevo se copia; uno eliminado se borra de la carpeta.
    const a2 = adjunto(ID2, 'foto.jpg');
    const r3 = await sincronizarCarpeta(c, exportacion([a2]), () => '# fichas', leer, memoria);
    expect(r3.adjuntosEliminados).toBe(1);
    expect([...c.carpetas.get('adjuntos')!.carpetas.keys()]).toEqual([ID2]);
  });

  it('no reescribe adjuntos que ya están en la carpeta (otra sesión) y reintenta los que no se pudieron leer', async () => {
    const c = new CarpetaFalsa();
    const a1 = adjunto(ID1, 'informe.pdf');
    await sincronizarCarpeta(c, exportacion([a1]), () => '', async () => new Blob(['abc']), memoriaNueva());
    const dir = c.carpetas.get('adjuntos')!.carpetas.get(ID1)!;
    const antes = dir.escrituras;

    const memoria = memoriaNueva();
    const r = await sincronizarCarpeta(c, exportacion([a1]), () => '', async () => Promise.reject(new Error('sin red')), memoria);
    expect(r.faltantes).toEqual([]); // el archivo ya estaba con el tamaño correcto
    expect(dir.escrituras).toBe(antes);

    const a2 = adjunto(ID2, 'otro.pdf');
    const fallo = await sincronizarCarpeta(c, exportacion([a1, a2]), () => '', async () => Promise.reject(new Error('sin red')), memoria);
    expect(fallo.faltantes.map((a) => a.id)).toEqual([ID2]);
    const reintento = await sincronizarCarpeta(c, exportacion([a1, a2]), () => '', async () => new Blob(['xyz']), memoria);
    expect(reintento.faltantes).toEqual([]);
    expect(await c.carpetas.get('adjuntos')!.carpetas.get(ID2)!.texto('otro.pdf')).toBe('xyz');
  });

  it('no borra carpetas ajenas dentro de adjuntos/', async () => {
    const c = new CarpetaFalsa();
    const adj = await c.getDirectoryHandle('adjuntos', { create: true });
    await adj.getDirectoryHandle('mis-notas', { create: true });
    await sincronizarCarpeta(c, exportacion([]), () => '', async () => new Blob([]), memoriaNueva());
    expect(adj.carpetas.has('mis-notas')).toBe(true);
  });

  it('resume y lee una carpeta existente (ida y vuelta)', async () => {
    const vacia = new CarpetaFalsa();
    expect(await resumirCarpeta(vacia)).toEqual({ respaldo: null, otrosArchivos: false });
    vacia.archivos.set('tesis.docx', new Blob(['x']));
    expect((await resumirCarpeta(vacia)).otrosArchivos).toBe(true);

    const c = new CarpetaFalsa();
    const a1 = adjunto(ID1, 'RM rodilla.pdf');
    const datos = { ...exportacion([a1]), pacientes: [{ id: 'p1' }] } as unknown as Exportacion;
    await sincronizarCarpeta(c, datos, () => '', async () => new Blob(['abc']), memoriaNueva());
    expect(await resumirCarpeta(c)).toEqual({ respaldo: { pacientes: 1, exportadoEn: '2026-10-18T10:00:00Z' }, otrosArchivos: false });

    const leido = await leerCarpeta(c);
    expect(leido.datos.adjuntos[0].id).toBe(ID1);
    expect(await leido.archivos.get(ID1)!.text()).toBe('abc');
    expect(leido.archivos.get(ID1)!.type).toBe('application/pdf');
  });

  it('al restaurar, solo trae registros nuevos o más recientes', () => {
    const actuales = { pacientes: [{ id: 'a', actualizadoEn: '2026-10-18T10:00:00Z' }, { id: 'b', actualizadoEn: '2026-10-18T10:00:00Z' }] };
    const entrada = {
      formato: 'kine-plataforma',
      pacientes: [
        { id: 'a', actualizadoEn: '2026-10-17T00:00:00Z' }, // más antiguo: se descarta
        { id: 'b', actualizadoEn: '2026-10-19T00:00:00Z' }, // más nuevo: se trae
        { id: 'c', actualizadoEn: '2026-10-01T00:00:00Z' }, // no existe: se trae
      ],
    };
    const r = soloMasNuevos(entrada, actuales);
    expect(r.pacientes.map((p) => p.id)).toEqual(['b', 'c']);
    expect(r.formato).toBe('kine-plataforma');
  });
});
