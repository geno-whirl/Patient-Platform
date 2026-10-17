/** Aplicar un programa de tratamiento a un paciente: crea sus sesiones planificadas con fecha. */
import { hoy, nuevaSesion, nuevoId } from './factories';
import type { ProgramaTratamiento, Sesion } from './schema';

/** Días de la semana sugeridos según la frecuencia (0 = domingo … 6 = sábado). */
export function diasSugeridos(sesionesPorSemana: number): number[] {
  const tabla: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return tabla[Math.min(7, Math.max(1, sesionesPorSemana))];
}

/** Próximas `n` fechas (YYYY-MM-DD) desde `inicio` (incluido) que caen en `dias`. */
export function fechasDeSesiones(inicio: string, dias: number[], n: number): string[] {
  if (!dias.length || n <= 0) return [];
  const [y, m, d] = inicio.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const salida: string[] = [];
  while (salida.length < n) {
    if (dias.includes(f.getDay())) salida.push(hoy(f));
    f.setDate(f.getDate() + 1);
  }
  return salida;
}

export interface OpcionesAplicar {
  inicio: string;
  dias: number[];
  hora: string;
}

export function aplicarPrograma(
  programa: ProgramaTratamiento,
  pacienteId: string,
  sesionesExistentes: Pick<Sesion, 'numero'>[],
  { inicio, dias, hora }: OpcionesAplicar,
): Sesion[] {
  const fechas = fechasDeSesiones(inicio, dias, programa.sesiones.length);
  let numero = sesionesExistentes.reduce((m, s) => Math.max(m, s.numero), 0);
  return programa.sesiones.map((tipo, i) => {
    const s = nuevaSesion(pacienteId, ++numero, fechas[i]);
    s.hora = hora;
    s.programa = { id: programa.id, nombre: programa.nombre, numero: i + 1, total: programa.sesiones.length };
    s.planificacion = {
      objetivos: [tipo.titulo, tipo.objetivos].filter(Boolean).join(' — '),
      notas: tipo.notas,
      ejercicios: tipo.ejercicios.map((e) => ({ ...e, id: nuevoId(), realizado: false })),
    };
    return s;
  });
}
