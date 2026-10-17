/**
 * Convierte la ficha de un paciente a Markdown legible por humanos y LLMs.
 * Omite los campos vacíos para que el contexto sea compacto.
 */
import { categoriaImc, edad, imc, ETIQUETAS_ESTADO_PACIENTE, ETIQUETAS_ESTADO_SESION } from './clinica';
import { ETIQUETAS_VISTA } from './regiones';
import type { BaseDeDatos, Evaluacion, Ingreso, Paciente, Sesion } from './schema';

type Campos = [etiqueta: string, valor: string | number | null | undefined][];

function lista(campos: Campos): string {
  return campos
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `- **${k}:** ${String(v).replace(/\n+/g, ' / ')}`)
    .join('\n');
}

function seccion(titulo: string, cuerpo: string, nivel = 3): string {
  return cuerpo.trim() ? `${'#'.repeat(nivel)} ${titulo}\n\n${cuerpo}\n` : '';
}

function ingresoMd(i: Ingreso): string {
  const p = i.anamnesisProxima;
  const r = i.anamnesisRemota;
  const valorImc = r.imc ?? imc(r.pesoKg, r.tallaCm);
  const habitos = [r.habitos.alcohol && 'OH', r.habitos.tabaco && 'TBQ', r.habitos.drogas && 'drogas']
    .filter(Boolean)
    .join(', ');
  return [
    `## Ingreso — ${i.fecha}\n`,
    seccion(
      'Anamnesis próxima',
      lista([
        ['Diagnóstico médico', p.diagnosticoMedico],
        ['Tiempo de evolución', p.tiempoEvolucion],
        ['Médico tratante', p.medicoTratante],
        ['Previsión', p.prevision],
        ['Motivo de consulta', p.motivoConsulta],
        ['Episodios previos', p.episodiosPrevios],
        ['Tratamientos previos', p.tratamientosPrevios],
        ['Exámenes / imágenes', p.examenesComplementarios],
        ['Objetivos del paciente', p.objetivosPaciente],
      ]),
    ),
    seccion(
      'Anamnesis remota',
      lista([
        ['Lateralidad', r.lateralidad],
        ['Peso', r.pesoKg != null ? `${r.pesoKg} kg` : ''],
        ['Talla', r.tallaCm != null ? `${r.tallaCm} cm` : ''],
        ['IMC', valorImc != null ? `${valorImc} (${categoriaImc(valorImc)})` : ''],
        ['Ant. médicos', r.antecedentesMedicos],
        ['Ant. quirúrgicos', r.antecedentesQuirurgicos],
        ['Ant. familiares', r.antecedentesFamiliares],
        ['Ant. ginecoobstétricos', r.antecedentesGinecoobstetricos],
        ['Medicamentos', r.medicamentos],
        ['Alimentación', r.alimentacion],
        ['Suplementos', r.suplementos],
        ['Hábitos', [habitos, r.habitos.detalle].filter(Boolean).join(' — ')],
        ['Actividad física', r.actividadFisica],
        ['Sueño', r.sueno],
        ['Psicología', r.psicologia],
        ['Red de apoyo', r.redDeApoyo],
        ['Vivienda', r.vivienda],
        ['Transporte', r.transporte],
        ['ABVD/AVD', r.abvdAvd],
        ['Hobbies', r.hobbies],
        ['Rutina diaria', r.rutinaDiaria],
        ['Antecedente de caídas', r.antecedenteCaidas],
        ['Ayudas técnicas', r.ayudasTecnicas],
      ]),
    ),
  ].join('\n');
}

function evaluacionMd(e: Evaluacion): string {
  const a = e.dolor.alicia;
  const mapa = e.dolor.mapa
    .map(
      (m) =>
        `- ${m.sintoma.replace('_', ' ')} en ${m.region || 'región no especificada'}` +
        `${m.lado ? ` (${m.lado})` : ''}` +
        `${m.intensidad != null ? `, EVA ${m.intensidad}/10` : ''}` +
        ` [vista ${ETIQUETAS_VISTA[m.vista].toLowerCase()}]` +
        `${m.nota ? ` — ${m.nota}` : ''}`,
    )
    .join('\n');
  const pruebas = e.pruebasEspeciales
    .map((p) => `- ${p.nombre}${p.lado ? ` (${p.lado})` : ''}: ${p.resultado || 'sin resultado'}${p.notas ? ` — ${p.notas}` : ''}`)
    .join('\n');
  return [
    `## Evaluación ${e.clase === 'inicial' ? 'inicial' : '(reevaluación)'} — ${e.fecha}\n`,
    seccion(
      'Dolor (ALICIA)',
      lista([
        ['Aparición', a.aparicion],
        ['Localización', a.localizacion],
        ['Intensidad (EVA)', a.intensidadEva != null ? `${a.intensidadEva}/10` : ''],
        ['Carácter', a.caracter],
        ['Irradiación', a.irradiacion],
        ['Agravantes / atenuantes', a.atenuantesAgravantes],
      ]),
    ),
    seccion('Mapa del dolor', mapa),
    seccion(
      'Hallazgos',
      lista([
        ['Postural', e.postural],
        ['Observación / inspección', e.observacion],
        ['Movimiento activo', e.movimiento.activo],
        ['Movimiento pasivo', e.movimiento.pasivo],
        ['Artrocinemática', e.movimiento.artrocinematica],
        ['Activación muscular', e.tejidosBlandos.activacionMuscular],
        ['Fuerza muscular', e.tejidosBlandos.fuerzaMuscular],
        ['Longitud muscular', e.tejidosBlandos.longitudMuscular],
        ['Dermatomas', e.neurologica.dermatomas],
        ['Miotomas', e.neurologica.miotomas],
        ['Reflejos', e.neurologica.reflejos],
        ['Neurodinamia', e.neurologica.neurodinamia],
        ['Control sensoriomotor', e.controlSensoriomotor],
        ['Palpación', e.palpacion],
        ['Evaluación funcional', e.funcional],
      ]),
    ),
    seccion('Pruebas especiales', pruebas),
    seccion(
      'Conclusión y plan',
      lista([
        ['Diagnóstico kinesiológico', e.conclusion.diagnosticoKinesiologico],
        ['Objetivos generales', e.conclusion.objetivosGenerales],
        ['Objetivos específicos', e.conclusion.objetivosEspecificos],
        ['Plan de tratamiento', e.conclusion.planTratamiento],
      ]),
    ),
  ].join('\n');
}

function sesionMd(s: Sesion): string {
  const r = s.registro;
  const eva =
    r.evaPre != null || r.evaPost != null ? ` · EVA ${r.evaPre ?? '?'} → ${r.evaPost ?? '?'}` : '';
  const ejercicios = s.planificacion.ejercicios
    .filter((x) => x.nombre)
    .map(
      (x) =>
        `- ${x.realizado ? '[x]' : '[ ]'} ${x.nombre}` +
        [x.series && `${x.series} series`, x.repeticiones && `${x.repeticiones} reps`, x.carga && x.carga]
          .filter(Boolean)
          .map((t) => ` · ${t}`)
          .join('') +
        (x.notas ? ` — ${x.notas}` : ''),
    )
    .join('\n');
  return [
    `### Sesión ${s.numero} — ${s.fecha}${s.hora ? ` ${s.hora}` : ''} (${ETIQUETAS_ESTADO_SESION[s.estado]})${eva}\n`,
    lista([['Objetivos de la sesión', s.planificacion.objetivos], ['Notas de planificación', s.planificacion.notas]]),
    ejercicios ? `\n**Ejercicios / intervenciones:**\n${ejercicios}\n` : '',
    lista([
      ['S', r.subjetivo],
      ['O', r.objetivo],
      ['A', r.analisis],
      ['P', r.plan],
    ]),
    '',
  ].join('\n');
}

export function pacienteAMarkdown(paciente: Paciente, db: BaseDeDatos): string {
  const id = paciente.identificacion;
  const centro = db.centros.find((c) => c.id === paciente.centroId);
  const porFecha = <T extends { fecha: string }>(a: T, b: T) => a.fecha.localeCompare(b.fecha);
  const ingresos = db.ingresos.filter((i) => i.pacienteId === paciente.id).sort(porFecha);
  const evaluaciones = db.evaluaciones.filter((e) => e.pacienteId === paciente.id).sort(porFecha);
  const sesiones = db.sesiones
    .filter((s) => s.pacienteId === paciente.id)
    .sort((a, b) => porFecha(a, b) || a.numero - b.numero);
  const anos = edad(id.fechaNacimiento);

  const cabecera = [
    `# Paciente: ${id.nombre}`,
    '',
    lista([
      ['Id', paciente.id],
      ['Centro', centro?.nombre ?? 'Sin centro'],
      ['Estado', ETIQUETAS_ESTADO_PACIENTE[paciente.estado]],
      ['Etiquetas', paciente.etiquetas.join(', ')],
      ['Edad', anos != null ? `${anos} años` : ''],
      ['Fecha de nacimiento', id.fechaNacimiento],
      ['Sexo', id.sexo],
      ['Ocupación', id.ocupacion],
      ['Notas', paciente.notas],
    ]),
    '',
  ].join('\n');

  const realizadas = sesiones.filter((s) => s.estado === 'realizada').length;
  const cuerpoSesiones = sesiones.length
    ? `## Sesiones (${realizadas} realizadas de ${sesiones.length} registradas)\n\n${sesiones.map(sesionMd).join('\n')}`
    : '';

  return [cabecera, ...ingresos.map(ingresoMd), ...evaluaciones.map(evaluacionMd), cuerpoSesiones]
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
}
