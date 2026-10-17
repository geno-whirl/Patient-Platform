/**
 * Ficha clínica estructurada de un paciente: fuente común para el Markdown
 * (LLM) y la vista de impresión/PDF. Los campos vacíos se omiten.
 */
import { anonimizar, codigoPaciente } from './anonimizar';
import { categoriaImc, edad, imc, ETIQUETAS_ESTADO_PACIENTE, ETIQUETAS_ESTADO_SESION } from './clinica';
import { ETIQUETAS_VISTA } from './regiones';
import type { Adjunto, BaseDeDatos, Evaluacion, Ingreso, MarcaDolor, Paciente, Sesion } from './schema';

export type Campo = [etiqueta: string, valor: string];

export interface Bloque {
  titulo: string;
  campos?: Campo[];
  /** Líneas de una lista (ej: marcas del mapa, ejercicios, pruebas). */
  items?: string[];
}

export interface RegistroFicha {
  tipo: 'ingreso' | 'evaluacion' | 'sesion';
  id: string;
  titulo: string;
  bloques: Bloque[];
  mapa?: MarcaDolor[];
}

export interface Ficha {
  pacienteId: string;
  titulo: string;
  anonima: boolean;
  cabecera: Campo[];
  ingresos: RegistroFicha[];
  evaluaciones: RegistroFicha[];
  resumenSesiones: string;
  sesiones: RegistroFicha[];
  adjuntos: Adjunto[];
}

export interface OpcionesFicha {
  anonimo?: boolean;
  /** Incluir sesiones planificadas/canceladas además de las realizadas. */
  todasLasSesiones?: boolean;
}

type CampoCrudo = [string, string | number | null | undefined];

function campos(lista: CampoCrudo[]): Campo[] {
  return lista.filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]);
}

function bloques(lista: Bloque[]): Bloque[] {
  return lista.filter((b) => b.campos?.length || b.items?.length);
}

const porFecha = <T extends { fecha: string }>(a: T, b: T) => a.fecha.localeCompare(b.fecha);

function fichaIngreso(i: Ingreso): RegistroFicha {
  const p = i.anamnesisProxima;
  const r = i.anamnesisRemota;
  const valorImc = r.imc ?? imc(r.pesoKg, r.tallaCm);
  const habitos = [r.habitos.alcohol && 'OH', r.habitos.tabaco && 'TBQ', r.habitos.drogas && 'drogas'].filter(Boolean).join(', ');
  return {
    tipo: 'ingreso',
    id: i.id,
    titulo: `Ingreso — ${i.fecha}`,
    bloques: bloques([
      {
        titulo: 'Anamnesis próxima',
        campos: campos([
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
      },
      {
        titulo: 'Anamnesis remota',
        campos: campos([
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
      },
    ]),
  };
}

export function describirMarca(m: MarcaDolor): string {
  return (
    `${m.sintoma.replace('_', ' ')} en ${m.region || 'región no especificada'}` +
    `${m.lado ? ` (${m.lado})` : ''}` +
    `${m.intensidad != null ? `, EVA ${m.intensidad}/10` : ''}` +
    ` [vista ${ETIQUETAS_VISTA[m.vista].toLowerCase()}]` +
    `${m.nota ? ` — ${m.nota}` : ''}`
  );
}

function fichaEvaluacion(e: Evaluacion): RegistroFicha {
  const a = e.dolor.alicia;
  return {
    tipo: 'evaluacion',
    id: e.id,
    titulo: `Evaluación ${e.clase === 'inicial' ? 'inicial' : '(reevaluación)'} — ${e.fecha}`,
    mapa: e.dolor.mapa,
    bloques: bloques([
      {
        titulo: 'Dolor (ALICIA)',
        campos: campos([
          ['Aparición', a.aparicion],
          ['Localización', a.localizacion],
          ['Intensidad (EVA)', a.intensidadEva != null ? `${a.intensidadEva}/10` : ''],
          ['Carácter', a.caracter],
          ['Irradiación', a.irradiacion],
          ['Agravantes / atenuantes', a.atenuantesAgravantes],
        ]),
      },
      { titulo: 'Mapa del dolor', items: e.dolor.mapa.map(describirMarca) },
      {
        titulo: 'Hallazgos',
        campos: campos([
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
      },
      {
        titulo: 'Pruebas especiales',
        items: e.pruebasEspeciales
          .filter((p) => p.nombre)
          .map((p) => `${p.nombre}${p.lado ? ` (${p.lado})` : ''}: ${p.resultado.replace('_', ' ') || 'sin resultado'}${p.notas ? ` — ${p.notas}` : ''}`),
      },
      {
        titulo: 'Conclusión y plan',
        campos: campos([
          ['Diagnóstico kinesiológico', e.conclusion.diagnosticoKinesiologico],
          ['Objetivos generales', e.conclusion.objetivosGenerales],
          ['Objetivos específicos', e.conclusion.objetivosEspecificos],
          ['Plan de tratamiento', e.conclusion.planTratamiento],
        ]),
      },
    ]),
  };
}

function fichaSesion(s: Sesion): RegistroFicha {
  const r = s.registro;
  const eva = r.evaPre != null || r.evaPost != null ? ` · EVA ${r.evaPre ?? '?'} → ${r.evaPost ?? '?'}` : '';
  return {
    tipo: 'sesion',
    id: s.id,
    titulo:
      `Sesión ${s.numero} — ${s.fecha}${s.hora ? ` ${s.hora}` : ''} (${ETIQUETAS_ESTADO_SESION[s.estado]})${eva}` +
      (s.programa ? ` · ${s.programa.nombre} ${s.programa.numero}/${s.programa.total}` : ''),
    bloques: bloques([
      { titulo: '', campos: campos([['Objetivos de la sesión', s.planificacion.objetivos], ['Notas de planificación', s.planificacion.notas]]) },
      {
        titulo: 'Ejercicios / intervenciones',
        items: s.planificacion.ejercicios
          .filter((x) => x.nombre)
          .map(
            (x) =>
              `${x.realizado ? '[x]' : '[ ]'} ${x.nombre}` +
              [x.series && `${x.series} series`, x.repeticiones && `${x.repeticiones} reps`, x.carga, x.descanso && `descanso ${x.descanso}`]
                .filter(Boolean)
                .map((t) => ` · ${t}`)
                .join('') +
              (x.notas ? ` — ${x.notas}` : ''),
          ),
      },
      { titulo: '', campos: campos([['S', r.subjetivo], ['O', r.objetivo], ['A', r.analisis], ['P', r.plan]]) },
    ]),
  };
}

export function construirFicha(paciente: Paciente, dbOriginal: BaseDeDatos, opciones: OpcionesFicha = {}): Ficha {
  const anonima = !!opciones.anonimo;
  let db = dbOriginal;
  let p = paciente;
  let anos = edad(paciente.identificacion.fechaNacimiento);
  if (anonima) {
    const r = anonimizar(dbOriginal, [paciente]);
    db = r.db;
    p = r.db.pacientes[0];
    anos = r.edades[paciente.id];
  }
  const id = p.identificacion;
  const centro = db.centros.find((c) => c.id === p.centroId);
  const deP = <T extends { pacienteId: string }>(xs: T[]) => xs.filter((x) => x.pacienteId === p.id);
  const sesiones = deP(db.sesiones).sort((a, b) => porFecha(a, b) || a.numero - b.numero);
  const realizadas = sesiones.filter((s) => s.estado === 'realizada');
  const mostradas = opciones.todasLasSesiones ? sesiones : realizadas;

  return {
    pacienteId: paciente.id,
    titulo: id.nombre,
    anonima,
    cabecera: campos([
      anonima ? ['Código', codigoPaciente(paciente.id)] : ['Id', p.id],
      ['Centro', centro?.nombre ?? 'Sin centro'],
      ['Estado', ETIQUETAS_ESTADO_PACIENTE[p.estado]],
      ['Etiquetas', p.etiquetas.join(', ')],
      ['Edad', anos != null ? `${anos} años` : ''],
      ['Fecha de nacimiento', id.fechaNacimiento],
      ['RUT', id.rut],
      ['Sexo', id.sexo],
      ['Ocupación', id.ocupacion],
      ['Teléfono', id.telefono],
      ['Email', id.email],
      ['Notas', p.notas],
    ]),
    ingresos: deP(db.ingresos).sort(porFecha).map(fichaIngreso),
    evaluaciones: deP(db.evaluaciones).sort(porFecha).map(fichaEvaluacion),
    resumenSesiones: sesiones.length ? `${realizadas.length} realizadas de ${sesiones.length} registradas` : '',
    sesiones: mostradas.map(fichaSesion),
    adjuntos: deP(db.adjuntos).sort(porFecha),
  };
}
