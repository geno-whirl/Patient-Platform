/** Cálculos clínicos y utilidades de presentación. */

export function edad(fechaNacimiento: string, referencia: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let anos = referencia.getFullYear() - y;
  const antesDelCumple =
    referencia.getMonth() + 1 < mo || (referencia.getMonth() + 1 === mo && referencia.getDate() < d);
  if (antesDelCumple) anos -= 1;
  return anos >= 0 ? anos : null;
}

/** IMC en kg/m² redondeado a 1 decimal. */
export function imc(pesoKg: number | null, tallaCm: number | null): number | null {
  if (!pesoKg || !tallaCm) return null;
  const m = tallaCm / 100;
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

export function categoriaImc(valor: number | null): string {
  if (valor == null) return '';
  if (valor < 18.5) return 'bajo peso';
  if (valor < 25) return 'normal';
  if (valor < 30) return 'sobrepeso';
  return 'obesidad';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-03-05" → "5 mar 2026" */
export function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || '—';
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

export const ETIQUETAS_ESTADO_PACIENTE: Record<string, string> = {
  activo: 'Activo',
  en_pausa: 'En pausa',
  alta: 'Alta',
};

export const ETIQUETAS_ESTADO_SESION: Record<string, string> = {
  planificada: 'Planificada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
};

/** Normaliza una etiqueta: minúsculas, sin espacios extremos, espacios → guion. */
export function normalizarEtiqueta(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, '-');
}

/** Búsqueda insensible a tildes y mayúsculas. */
export function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
