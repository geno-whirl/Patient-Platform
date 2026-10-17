import type { EjercicioBiblioteca, EjercicioSesion } from './schema';

/** Convierte un ejercicio de la biblioteca en una línea de sesión con sus parámetros sugeridos. */
export function aEjercicioSesion(e: EjercicioBiblioteca, id: string): EjercicioSesion {
  return {
    id,
    ejercicioId: e.id,
    nombre: e.nombre,
    series: e.series,
    repeticiones: e.repeticiones,
    carga: e.carga,
    descanso: e.descanso,
    notas: '',
    realizado: false,
  };
}
