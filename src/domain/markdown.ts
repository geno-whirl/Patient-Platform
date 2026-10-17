/**
 * Convierte la ficha de un paciente a Markdown legible por humanos y LLMs.
 * Omite los campos vacíos para que el contexto sea compacto.
 */
import { construirFicha, type Bloque, type Campo, type RegistroFicha } from './ficha';
import type { BaseDeDatos, Paciente } from './schema';

function lista(campos: Campo[] = []): string {
  return campos.map(([k, v]) => `- **${k}:** ${v.replace(/\n+/g, ' / ')}`).join('\n');
}

function items(xs: string[] = []): string {
  return xs.map((x) => `- ${x.replace(/\n+/g, ' / ')}`).join('\n');
}

/** En registros de nivel 2 cada bloque es un `###`; dentro de una sesión (nivel 3) va en negrita. */
function bloqueMd(b: Bloque, nivel: 2 | 3): string {
  const cuerpo = [lista(b.campos), items(b.items)].filter(Boolean).join('\n');
  if (!b.titulo) return cuerpo;
  return nivel === 2 ? `### ${b.titulo}\n\n${cuerpo}` : `**${b.titulo}:**\n${cuerpo}`;
}

function registroMd(r: RegistroFicha, nivel: 2 | 3): string {
  return [`${'#'.repeat(nivel)} ${r.titulo}`, ...r.bloques.map((b) => bloqueMd(b, nivel))].join('\n\n');
}

export interface OpcionesMarkdown {
  anonimo?: boolean;
}

export function pacienteAMarkdown(paciente: Paciente, db: BaseDeDatos, opciones: OpcionesMarkdown = {}): string {
  const f = construirFicha(paciente, db, { anonimo: opciones.anonimo, todasLasSesiones: true });
  const adjuntos = f.adjuntos.map(
    (a) => `${a.fecha} · ${a.categoria}${a.descripcion ? `: ${a.descripcion}` : ''}${f.anonima ? '' : ` (${a.nombreArchivo})`}`,
  );
  return [
    `# Paciente: ${f.titulo}`,
    lista(f.cabecera),
    ...f.ingresos.map((r) => registroMd(r, 2)),
    ...f.evaluaciones.map((r) => registroMd(r, 2)),
    f.sesiones.length ? `## Sesiones (${f.resumenSesiones})` : '',
    ...f.sesiones.map((r) => registroMd(r, 3)),
    adjuntos.length ? `## Adjuntos\n\n${items(adjuntos)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
}
