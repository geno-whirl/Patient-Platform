import { describe, expect, it } from 'vitest';
import { aEjercicioSesion, catalogoBase, faltantesDelCatalogo, interpretarDosis, plantillasBase, TOTAL_CATALOGO, uuidV5 } from '../catalogo';
import { CATEGORIAS_EJERCICIO, EjercicioBibliotecaSchema, PlantillaSesionSchema } from '../schema';

describe('catálogo base de ejercicios', () => {
  it('es amplio y cubre todas las categorías', async () => {
    const c = await catalogoBase();
    expect(c.length).toBe(TOTAL_CATALOGO);
    expect(c.length).toBeGreaterThanOrEqual(200);
    for (const cat of CATEGORIAS_EJERCICIO) expect(c.some((e) => e.categoria === cat)).toBe(true);
    expect(c.filter((e) => e.equipamiento.includes('banda_elastica')).length).toBeGreaterThanOrEqual(20);
  });

  it('todos los registros son válidos según el esquema', async () => {
    for (const e of await catalogoBase()) expect(() => EjercicioBibliotecaSchema.parse(e)).not.toThrow();
  });

  it('no repite nombres ni ids', async () => {
    const c = await catalogoBase();
    expect(new Set(c.map((e) => e.nombre.toLowerCase())).size).toBe(c.length);
    expect(new Set(c.map((e) => e.id)).size).toBe(c.length);
  });

  it('los ids son estables entre cargas', async () => {
    const [a, b] = [await catalogoBase(), await catalogoBase()];
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it('cada usuario tiene ids propios (en Supabase el id es único en toda la tabla)', async () => {
    const [u1, u1b, u2] = [await catalogoBase('usuario-1:'), await catalogoBase('usuario-1:'), await catalogoBase('usuario-2:')];
    expect(u1.map((e) => e.id)).toEqual(u1b.map((e) => e.id));
    const ids2 = new Set(u2.map((e) => e.id));
    expect(u1.some((e) => ids2.has(e.id))).toBe(false);
    const { plantillasBase } = await import('../catalogo');
    const p2 = await plantillasBase('usuario-2:');
    for (const e of p2[0].ejercicios) expect(ids2.has(e.ejercicioId!)).toBe(true);
  });

  it('cada ejercicio trae una dosis sugerida y una descripción', async () => {
    for (const e of await catalogoBase()) {
      expect(e.repeticiones, e.nombre).not.toBe('');
      expect(e.descripcion.length, e.nombre).toBeGreaterThan(10);
    }
  });
});

describe('uuid v5', () => {
  it('coincide con el vector de prueba del RFC 4122', async () => {
    expect(await uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });
});

describe('dosis', () => {
  it('interpreta series, repeticiones, carga y descanso', () => {
    expect(interpretarDosis('4x6@RPE 7-8|2 min')).toEqual({ series: '4', repeticiones: '6', carga: 'RPE 7-8', descanso: '2 min' });
    expect(interpretarDosis('3x8 c/lado')).toEqual({ series: '3', repeticiones: '8 c/lado', carga: '', descanso: '' });
    expect(interpretarDosis('1x15-30 min@RPE 4-6')).toEqual({ series: '1', repeticiones: '15-30 min', carga: 'RPE 4-6', descanso: '' });
    expect(interpretarDosis('5 min')).toEqual({ series: '', repeticiones: '5 min', carga: '', descanso: '' });
    expect(interpretarDosis('6x(2 min caminar + 1 min trotar)').series).toBe('6');
  });
});

describe('plantillas base', () => {
  it('son válidas y referencian ejercicios del catálogo', async () => {
    const ids = new Set((await catalogoBase()).map((e) => e.id));
    const ps = await plantillasBase();
    expect(ps.length).toBeGreaterThanOrEqual(6);
    for (const p of ps) {
      expect(() => PlantillaSesionSchema.parse(p)).not.toThrow();
      expect(p.ejercicios.length).toBeGreaterThan(4);
      for (const e of p.ejercicios) expect(ids.has(e.ejercicioId!)).toBe(true);
    }
  });
});

describe('carga del catálogo', () => {
  it('es idempotente y respeta lo que ya existe', async () => {
    const vacio = await faltantesDelCatalogo({ ejercicios: [], plantillas: [], programas: [] });
    expect(vacio.ejercicios.length).toBe(TOTAL_CATALOGO);
    const editado = { ...vacio.ejercicios[0], nombre: 'Editado por mí', archivado: true };
    const resto = await faltantesDelCatalogo({ ejercicios: [editado, ...vacio.ejercicios.slice(1)], plantillas: vacio.plantillas, programas: vacio.programas });
    expect(resto.ejercicios).toEqual([]);
    expect(resto.plantillas).toEqual([]);
    expect(resto.programas).toEqual([]);
  });

  it('convierte un ejercicio de la biblioteca en línea de sesión con la dosis sugerida', async () => {
    const e = (await catalogoBase()).find((x) => x.nombre === 'Hip thrust con barra')!;
    expect(aEjercicioSesion(e, 'x')).toMatchObject({ ejercicioId: e.id, nombre: 'Hip thrust con barra', series: '4', repeticiones: '8', carga: 'RPE 7-8', descanso: '90 s', realizado: false });
  });
});

describe('programas de tratamiento', () => {
  it('los programas base son válidos y usan ejercicios del catálogo', async () => {
    const { programasBase } = await import('../catalogo');
    const { ProgramaTratamientoSchema } = await import('../schema');
    const ids = new Set((await catalogoBase()).map((e) => e.id));
    const ps = await programasBase();
    expect(ps.length).toBeGreaterThanOrEqual(5);
    const manguito = ps.find((p) => p.nombre.startsWith('Manguito rotador'))!;
    expect(manguito.sesiones).toHaveLength(10);
    for (const p of ps) {
      expect(() => ProgramaTratamientoSchema.parse(p)).not.toThrow();
      for (const s of p.sesiones) {
        expect(s.ejercicios.length).toBeGreaterThan(3);
        for (const e of s.ejercicios) expect(ids.has(e.ejercicioId!)).toBe(true);
      }
      expect(new Set(p.sesiones.map((s) => s.id)).size).toBe(p.sesiones.length);
    }
  });

  it('calcula fechas según los días de la semana', async () => {
    const { fechasDeSesiones, diasSugeridos } = await import('../programas');
    // 2026-10-19 es lunes
    expect(fechasDeSesiones('2026-10-19', diasSugeridos(2), 4)).toEqual(['2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29']);
    expect(fechasDeSesiones('2026-10-17', [1, 3, 5], 3)).toEqual(['2026-10-19', '2026-10-21', '2026-10-23']);
  });

  it('aplica un programa creando sesiones planificadas numeradas tras las existentes', async () => {
    const { programasBase } = await import('../catalogo');
    const { aplicarPrograma } = await import('../programas');
    const { SesionSchema } = await import('../schema');
    const p = (await programasBase()).find((x) => x.nombre.startsWith('Manguito rotador'))!;
    const sesiones = aplicarPrograma(p, 'pac-1', [{ numero: 1 }, { numero: 2 }], { inicio: '2026-10-19', dias: [1, 4], hora: '18:00' });
    expect(sesiones).toHaveLength(10);
    expect(sesiones.map((s) => s.numero)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(sesiones[0]).toMatchObject({ fecha: '2026-10-19', hora: '18:00', estado: 'planificada', pacienteId: 'pac-1' });
    expect(sesiones[9].fecha).toBe('2026-11-19');
    expect(sesiones[3].programa).toEqual({ id: p.id, nombre: p.nombre, numero: 4, total: 10 });
    expect(sesiones[0].planificacion.objetivos).toContain('Fase 1');
    expect(sesiones[9].planificacion.objetivos).toContain('Fase 3');
    // ids nuevos: aplicar dos veces no comparte ejercicios entre pacientes
    expect(sesiones[0].planificacion.ejercicios[0].id).not.toBe(p.sesiones[0].ejercicios[0].id);
    for (const s of sesiones) expect(() => SesionSchema.parse(s)).not.toThrow();
  });
});

describe('búsqueda en la biblioteca', () => {
  it('prioriza coincidencias en el nombre e ignora tildes', async () => {
    const { filtrarEjercicios, FILTRO_VACIO } = await import('../etiquetasEjercicio');
    const c = await catalogoBase();
    const r = filtrarEjercicios(c, { ...FILTRO_VACIO, texto: 'sentadilla' });
    expect(r[0].nombre.toLowerCase()).toContain('sentadilla');
    expect(r.findIndex((e) => !e.nombre.toLowerCase().includes('sentadilla'))).toBeGreaterThan(8);
    expect(filtrarEjercicios(c, { ...FILTRO_VACIO, texto: 'nordico' })[0].nombre).toBe('Curl nórdico');
    const banda = filtrarEjercicios(c, { ...FILTRO_VACIO, equipamiento: 'banda_elastica', region: 'hombro' });
    expect(banda.every((e) => e.equipamiento.includes('banda_elastica') && e.regiones.includes('hombro'))).toBe(true);
  });
});
