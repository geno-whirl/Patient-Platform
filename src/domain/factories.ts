import {
  CentroSchema,
  EvaluacionSchema,
  IngresoSchema,
  PacienteSchema,
  SesionSchema,
  type Centro,
  type Evaluacion,
  type Ingreso,
  type Paciente,
  type Sesion,
} from './schema';

export const nuevoId = (): string => crypto.randomUUID();

export const ahoraIso = (): string => new Date().toISOString();

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function hoy(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function base() {
  const t = ahoraIso();
  return { id: nuevoId(), creadoEn: t, actualizadoEn: t };
}

export const nuevoCentro = (nombre: string): Centro =>
  CentroSchema.parse({ tipo: 'centro', ...base(), nombre });

export const nuevoPaciente = (nombre = 'Sin nombre', centroId: string | null = null): Paciente =>
  PacienteSchema.parse({ tipo: 'paciente', ...base(), centroId, identificacion: { nombre } });

export const nuevoIngreso = (pacienteId: string): Ingreso =>
  IngresoSchema.parse({ tipo: 'ingreso', ...base(), pacienteId, fecha: hoy() });

export const nuevaEvaluacion = (pacienteId: string, clase: Evaluacion['clase'] = 'inicial'): Evaluacion =>
  EvaluacionSchema.parse({ tipo: 'evaluacion', ...base(), pacienteId, fecha: hoy(), clase });

export const nuevaSesion = (pacienteId: string, numero: number, fecha = hoy()): Sesion =>
  SesionSchema.parse({ tipo: 'sesion', ...base(), pacienteId, numero, fecha });
