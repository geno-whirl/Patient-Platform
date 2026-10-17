import { hoy } from './factories';
import type { BaseDeDatos, Evaluacion, Ingreso, Paciente, Sesion } from './schema';
import type { PuntoEva } from '../components/GraficoEva';
import { sinTildes } from './clinica';

export interface ResumenPaciente {
  sesiones: Sesion[];
  realizadas: number;
  ultimaSesion?: Sesion;
  proximaSesion?: Sesion;
  ultimaEvaluacion?: Evaluacion;
  ingreso?: Ingreso;
  ultimaEva: number | null;
}

const porFecha = <T extends { fecha: string }>(a: T, b: T) => a.fecha.localeCompare(b.fecha);

export function sesionesDe(pid: string, db: BaseDeDatos): Sesion[] {
  return db.sesiones
    .filter((s) => s.pacienteId === pid)
    .sort((a, b) => porFecha(a, b) || a.hora.localeCompare(b.hora) || a.numero - b.numero);
}

export function resumenPaciente(p: Paciente, db: BaseDeDatos, fechaHoy = hoy()): ResumenPaciente {
  const sesiones = sesionesDe(p.id, db);
  const hechas = sesiones.filter((s) => s.estado === 'realizada');
  const evaluaciones = db.evaluaciones.filter((e) => e.pacienteId === p.id).sort(porFecha);
  const ingresos = db.ingresos.filter((i) => i.pacienteId === p.id).sort(porFecha);
  const ultimaSesion = hechas.at(-1);
  const ultimaEvaluacion = evaluaciones.at(-1);
  return {
    sesiones,
    realizadas: hechas.length,
    ultimaSesion,
    proximaSesion: sesiones.find((s) => s.estado === 'planificada' && s.fecha >= fechaHoy),
    ultimaEvaluacion,
    ingreso: ingresos.at(-1),
    ultimaEva:
      ultimaSesion?.registro.evaPost ?? ultimaSesion?.registro.evaPre ?? ultimaEvaluacion?.dolor.alicia.intensidadEva ?? null,
  };
}

/** Serie de EVA: evaluaciones (un punto) + sesiones realizadas (inicio/término). */
export function serieEva(pid: string, db: BaseDeDatos): PuntoEva[] {
  const evals: (PuntoEva & { orden: number })[] = db.evaluaciones
    .filter((e) => e.pacienteId === pid && e.dolor.alicia.intensidadEva != null)
    .map((e) => ({
      fecha: e.fecha,
      etiqueta: e.clase === 'inicial' ? 'Eval. inicial' : 'Reevaluación',
      pre: e.dolor.alicia.intensidadEva,
      post: null,
      orden: 0,
    }));
  const ses = sesionesDe(pid, db)
    .filter((s) => s.estado === 'realizada')
    .map((s) => ({ fecha: s.fecha, etiqueta: `Sesión ${s.numero}`, pre: s.registro.evaPre, post: s.registro.evaPost, orden: 1 }));
  return [...evals, ...ses]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)
    .map(({ orden: _o, ...p }) => p);
}

export interface Filtros {
  texto: string;
  centroId: string; // '' = todos, 'ninguno' = sin centro
  etiquetas: string[];
  estado: string; // '' = todos
}

export function filtrarPacientes(pacientes: Paciente[], db: BaseDeDatos, f: Filtros): Paciente[] {
  const q = sinTildes(f.texto.trim());
  return pacientes.filter((p) => {
    if (f.centroId === 'ninguno' ? p.centroId != null : f.centroId && p.centroId !== f.centroId) return false;
    if (f.estado && p.estado !== f.estado) return false;
    if (f.etiquetas.some((t) => !p.etiquetas.includes(t))) return false;
    if (q) {
      const ingreso = db.ingresos.find((i) => i.pacienteId === p.id);
      const pajar = sinTildes(
        [
          p.identificacion.nombre,
          p.identificacion.rut,
          p.etiquetas.join(' '),
          ingreso?.anamnesisProxima.diagnosticoMedico ?? '',
          ingreso?.anamnesisProxima.motivoConsulta ?? '',
        ].join(' '),
      );
      if (!pajar.includes(q)) return false;
    }
    return true;
  });
}

export function todasLasEtiquetas(db: BaseDeDatos): string[] {
  return [...new Set(db.pacientes.flatMap((p) => p.etiquetas))].sort();
}
