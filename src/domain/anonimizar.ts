/**
 * Anonimización de fichas para compartir (por ejemplo, con un LLM).
 *
 * Quita los identificadores directos (nombre, RUT, contacto, fecha de nacimiento,
 * médico tratante, notas generales, nombres de archivo) y reemplaza al paciente por
 * un código estable derivado de su id. En el texto libre enmascara RUT, correos,
 * teléfonos y el nombre del paciente. No puede detectar nombres de terceros
 * escritos en texto libre, así que conviene revisar antes de compartir.
 */
import { edad } from './clinica';
import type { BaseDeDatos, Paciente } from './schema';

/** Código corto y estable: mismo paciente → mismo código en cada exportación. */
export function codigoPaciente(id: string): string {
  return `P-${id.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase()}`;
}

const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const TELEFONO = /(?:\+?56[\s-]?)?(?:\(?\d\)?[\s-]?)?\b\d{4}[\s-]?\d{4}\b/g;

const VARIANTES: Record<string, string> = { a: 'aáàä', e: 'eéèë', i: 'iíìï', o: 'oóòö', u: 'uúùü', n: 'nñ' };

/** Regex que encuentra una palabra sin importar mayúsculas ni tildes. */
function patronPalabra(palabra: string): RegExp {
  const base = palabra.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const cuerpo = [...base]
    .map((c) => (VARIANTES[c] ? `[${VARIANTES[c]}]` : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`(?<![\\p{L}\\d])${cuerpo}(?![\\p{L}\\d])`, 'giu');
}

/** Palabras del nombre que vale la pena buscar (≥ 3 letras, sin partículas). */
function palabrasDelNombre(nombre: string): string[] {
  const particulas = new Set(['del', 'las', 'los', 'van', 'von']);
  return nombre
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}'-]/gu, ''))
    .filter((w) => w.length >= 3 && !particulas.has(w.toLowerCase()));
}

export function limpiarTexto(texto: string, nombres: RegExp[], codigo: string): string {
  if (!texto) return texto;
  let t = texto.replace(EMAIL, '[email]').replace(RUT, '[RUT]').replace(TELEFONO, '[teléfono]');
  for (const re of nombres) t = t.replace(re, codigo);
  // "María Pérez" → "P-X P-X" → "P-X"
  return t.replace(new RegExp(`${codigo}(?:\\s+${codigo})+`, 'g'), codigo);
}

/** Aplica `limpiar` a todos los strings de un objeto (copia profunda). */
function limpiarProfundo<T>(valor: T, limpiar: (s: string) => string, omitir: Set<string>): T {
  if (typeof valor === 'string') return limpiar(valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => limpiarProfundo(v, limpiar, omitir)) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, omitir.has(k) ? v : limpiarProfundo(v, limpiar, omitir)]),
    ) as T;
  }
  return valor;
}

// Claves técnicas que no son texto clínico (ids, fechas, enums).
const CLAVES_TECNICAS = new Set([
  'id', 'tipo', 'pacienteId', 'centroId', 'evaluacionId', 'creadoEn', 'actualizadoEn', 'fecha', 'hora',
  'estado', 'clase', 'vista', 'sintoma', 'lado', 'resultado', 'categoria', 'tipoMime', 'ruta', 'lateralidad',
]);

export interface ResultadoAnonimizado {
  db: BaseDeDatos;
  /** Edad calculada antes de quitar la fecha de nacimiento, por id de paciente. */
  edades: Record<string, number | null>;
}

/** Devuelve una copia anonimizada de los pacientes indicados y sus registros. */
export function anonimizar(db: BaseDeDatos, pacientes: Paciente[] = db.pacientes): ResultadoAnonimizado {
  const salida: BaseDeDatos = {
    centros: db.centros,
    pacientes: [],
    ingresos: [],
    evaluaciones: [],
    sesiones: [],
    adjuntos: [],
    // La biblioteca, las plantillas y los programas no contienen datos de pacientes.
    ejercicios: db.ejercicios,
    plantillas: db.plantillas,
    programas: db.programas,
  };
  const edades: Record<string, number | null> = {};

  for (const p of pacientes) {
    const codigo = codigoPaciente(p.id);
    const nombres = palabrasDelNombre(p.identificacion.nombre).map(patronPalabra);
    const limpiar = (s: string) => limpiarTexto(s, nombres, codigo);
    const limpio = <T>(r: T) => limpiarProfundo(r, limpiar, CLAVES_TECNICAS);
    edades[p.id] = edad(p.identificacion.fechaNacimiento);

    salida.pacientes.push({
      ...p,
      etiquetas: p.etiquetas.map(limpiar),
      identificacion: {
        nombre: codigo,
        rut: '',
        fechaNacimiento: '',
        sexo: p.identificacion.sexo,
        ocupacion: limpiar(p.identificacion.ocupacion),
        telefono: '',
        email: '',
      },
      notas: '',
    });
    for (const i of db.ingresos.filter((x) => x.pacienteId === p.id)) {
      const c = limpio(i);
      c.anamnesisProxima.medicoTratante = '';
      salida.ingresos.push(c);
    }
    salida.evaluaciones.push(...db.evaluaciones.filter((x) => x.pacienteId === p.id).map(limpio));
    salida.sesiones.push(...db.sesiones.filter((x) => x.pacienteId === p.id).map(limpio));
    salida.adjuntos.push(
      ...db.adjuntos
        .filter((x) => x.pacienteId === p.id)
        .map((a) => ({ ...limpio(a), nombreArchivo: `${a.categoria}-${a.id.slice(0, 8)}`, ruta: '' })),
    );
  }
  return { db: salida, edades };
}
