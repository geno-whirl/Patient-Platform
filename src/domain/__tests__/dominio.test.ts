import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { edad, imc, normalizarEtiqueta } from '../clinica';
import { filtrarPacientes, resumenPaciente, serieEva } from '../consultas';
import { nuevaEvaluacion, nuevaSesion, nuevoCentro, nuevoIngreso, nuevoPaciente } from '../factories';
import { pacienteAMarkdown } from '../markdown';
import { detectarRegion } from '../regiones';
import { escribirRuta, leerRuta } from '../rutas';
import { ExportacionSchema, PacienteSchema, type BaseDeDatos } from '../schema';

function baseEjemplo() {
  const centro = nuevoCentro('Clínica Norte');
  const ana = nuevoPaciente('Ana Pérez', centro.id);
  ana.etiquetas = ['rodilla', 'deportista'];
  ana.identificacion.fechaNacimiento = '1990-06-15';
  const beto = nuevoPaciente('Beto Soto');
  beto.etiquetas = ['lumbar'];
  beto.estado = 'alta';

  const ingreso = nuevoIngreso(ana.id);
  ingreso.anamnesisProxima.diagnosticoMedico = 'Rotura LCA rodilla derecha';
  ingreso.anamnesisRemota.pesoKg = 60;
  ingreso.anamnesisRemota.tallaCm = 165;

  const ev = nuevaEvaluacion(ana.id);
  ev.fecha = '2026-01-05';
  ev.dolor.alicia.intensidadEva = 7;
  ev.dolor.mapa.push({ id: 'm1', vista: 'anterior', x: 0.4, y: 0.66, region: 'rodilla', lado: 'derecho', sintoma: 'dolor', intensidad: 7, nota: '' });

  const s1 = nuevaSesion(ana.id, 1, '2026-01-08');
  s1.estado = 'realizada';
  s1.registro.evaPre = 6;
  s1.registro.evaPost = 4;
  s1.planificacion.ejercicios.push({ id: 'e1', nombre: 'Sentadilla isométrica', series: '3', repeticiones: '30s', carga: '', notas: '', realizado: true });
  const s2 = nuevaSesion(ana.id, 2, '2026-01-12');
  s2.estado = 'realizada';
  s2.registro.evaPre = 4;
  s2.registro.evaPost = 3;
  const s3 = nuevaSesion(ana.id, 3, '2026-01-15');

  const db: BaseDeDatos = {
    centros: [centro],
    pacientes: [ana, beto],
    ingresos: [ingreso],
    evaluaciones: [ev],
    sesiones: [s3, s1, s2],
    adjuntos: [],
  };
  return { db, centro, ana, beto };
}

describe('cálculos clínicos', () => {
  it('calcula edad considerando el cumpleaños', () => {
    expect(edad('1990-06-15', new Date(2026, 5, 14))).toBe(35);
    expect(edad('1990-06-15', new Date(2026, 5, 15))).toBe(36);
    expect(edad('')).toBeNull();
  });
  it('calcula IMC', () => {
    expect(imc(60, 165)).toBe(22);
    expect(imc(null, 165)).toBeNull();
  });
  it('normaliza etiquetas', () => {
    expect(normalizarEtiqueta('  Post Operatorio ')).toBe('post-operatorio');
  });
});

describe('esquema', () => {
  it('rellena valores por defecto en registros parciales (migración suave)', () => {
    const p = PacienteSchema.parse({ tipo: 'paciente', id: 'x', creadoEn: '', actualizadoEn: '', identificacion: { nombre: 'Z' } });
    expect(p.etiquetas).toEqual([]);
    expect(p.estado).toBe('activo');
    expect(p.identificacion.rut).toBe('');
  });
  it('los registros nuevos son válidos y exportables', () => {
    const { db } = baseEjemplo();
    const exp = ExportacionSchema.parse({ formato: 'kine-plataforma', versionEsquema: 1, exportadoEn: '', ...db });
    expect(exp.sesiones).toHaveLength(3);
  });
  it('genera JSON Schema con descripciones', () => {
    const js = JSON.stringify(z.toJSONSchema(ExportacionSchema, { io: 'input' }));
    expect(js).toContain('Escala Visual Análoga');
    expect(js).toContain('ALICIA');
  });
});

describe('regiones del mapa del dolor', () => {
  it('invierte el lado en la vista anterior', () => {
    expect(detectarRegion('anterior', 0.4, 150 / 220)).toEqual({ region: 'rodilla', lado: 'derecho' });
    expect(detectarRegion('posterior', 0.4, 150 / 220)).toEqual({ region: 'hueco poplíteo', lado: 'izquierdo' });
  });
  it('detecta zona lumbar central', () => {
    expect(detectarRegion('posterior', 0.5, 85 / 220)).toEqual({ region: 'zona lumbar', lado: 'central' });
  });
  it('detecta hombro y mano', () => {
    expect(detectarRegion('anterior', 0.75, 38 / 220).region).toBe('hombro');
    expect(detectarRegion('anterior', 0.18, 120 / 220)).toEqual({ region: 'mano', lado: 'derecho' });
  });
  it('vistas laterales distinguen anterior/posterior', () => {
    expect(detectarRegion('lateral_derecha', 0.58, 85 / 220)).toEqual({ region: 'abdomen', lado: 'derecho' });
    expect(detectarRegion('lateral_derecha', 0.4, 85 / 220)).toEqual({ region: 'zona lumbar', lado: 'derecho' });
    expect(detectarRegion('lateral_izquierda', 0.4, 85 / 220)).toEqual({ region: 'abdomen', lado: 'izquierdo' });
  });
});

describe('consultas', () => {
  it('filtra por centro, etiquetas, estado y texto (sin tildes)', () => {
    const { db, centro, ana, beto } = baseEjemplo();
    const f = { texto: '', centroId: '', etiquetas: [] as string[], estado: '' };
    expect(filtrarPacientes(db.pacientes, db, { ...f, centroId: centro.id })).toEqual([ana]);
    expect(filtrarPacientes(db.pacientes, db, { ...f, centroId: 'ninguno' })).toEqual([beto]);
    expect(filtrarPacientes(db.pacientes, db, { ...f, etiquetas: ['rodilla', 'deportista'] })).toEqual([ana]);
    expect(filtrarPacientes(db.pacientes, db, { ...f, estado: 'alta' })).toEqual([beto]);
    expect(filtrarPacientes(db.pacientes, db, { ...f, texto: 'perez' })).toEqual([ana]);
    expect(filtrarPacientes(db.pacientes, db, { ...f, texto: 'lca' })).toEqual([ana]);
  });
  it('resume el seguimiento', () => {
    const { db, ana } = baseEjemplo();
    const r = resumenPaciente(ana, db, '2026-01-13');
    expect(r.realizadas).toBe(2);
    expect(r.ultimaSesion?.numero).toBe(2);
    expect(r.proximaSesion?.numero).toBe(3);
    expect(r.ultimaEva).toBe(3);
  });
  it('arma la serie de EVA en orden cronológico', () => {
    const { db, ana } = baseEjemplo();
    expect(serieEva(ana.id, db).map((p) => [p.etiqueta, p.pre, p.post])).toEqual([
      ['Eval. inicial', 7, null],
      ['Sesión 1', 6, 4],
      ['Sesión 2', 4, 3],
    ]);
  });
});

describe('markdown para LLM', () => {
  it('incluye las secciones con datos y omite las vacías', () => {
    const { db, ana } = baseEjemplo();
    const md = pacienteAMarkdown(ana, db);
    expect(md).toContain('# Paciente: Ana Pérez');
    expect(md).toContain('**Centro:** Clínica Norte');
    expect(md).toContain('**Diagnóstico médico:** Rotura LCA rodilla derecha');
    expect(md).toContain('**IMC:** 22 (normal)');
    expect(md).toContain('dolor en rodilla (derecho), EVA 7/10');
    expect(md).toContain('### Sesión 1 — 2026-01-08 (Realizada) · EVA 6 → 4');
    expect(md).toContain('[x] Sentadilla isométrica · 3 series · 30s reps');
    expect(md).not.toContain('Ant. quirúrgicos');
  });
});

describe('rutas', () => {
  it('lee y escribe rutas anidadas sin mutar', () => {
    const o = { a: { b: 1, c: 2 } };
    const n = escribirRuta(o, 'a.b', 5);
    expect(n).toEqual({ a: { b: 5, c: 2 } });
    expect(o.a.b).toBe(1);
    expect(leerRuta(n, 'a.c')).toBe(2);
  });
});
