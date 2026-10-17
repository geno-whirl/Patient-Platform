/** Datos ficticios para explorar la plataforma. */
import { hoy, nuevaEvaluacion, nuevaSesion, nuevoCentro, nuevoId, nuevoIngreso, nuevoPaciente } from './factories';
import type { BaseDeDatos, EjercicioSesion } from './schema';

const dia = (delta: number) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return hoy(d);
};

const ej = (nombre: string, series: string, repeticiones: string, carga = '', realizado = false): EjercicioSesion => ({
  id: nuevoId(),
  ejercicioId: null,
  nombre,
  series,
  repeticiones,
  carga,
  descanso: '',
  notas: '',
  realizado,
});

export function datosDeEjemplo(): BaseDeDatos {
  const clinica = nuevoCentro('Clínica Deportiva Providencia');
  clinica.color = '#2a78d6';
  const domicilio = nuevoCentro('Atención domiciliaria');
  domicilio.color = '#eb6834';

  // ── Paciente 1: LCA ──
  const camila = nuevoPaciente('Camila Rojas (ejemplo)', clinica.id);
  camila.etiquetas = ['rodilla', 'deportista', 'post-operatorio'];
  Object.assign(camila.identificacion, { fechaNacimiento: '1998-04-12', sexo: 'femenino', ocupacion: 'Estudiante, futbolista amateur' });

  const ing1 = nuevoIngreso(camila.id);
  ing1.fecha = dia(-30);
  Object.assign(ing1.anamnesisProxima, {
    diagnosticoMedico: 'Post-operatorio reconstrucción LCA rodilla derecha (injerto isquiotibial)',
    tiempoEvolucion: '4 semanas post-op',
    medicoTratante: 'Dr. Muñoz',
    prevision: 'Isapre',
    motivoConsulta: 'Derivada para rehabilitación post LCA. Refiere dolor anterior de rodilla al subir escaleras y sensación de inestabilidad.',
    objetivosPaciente: 'Volver a jugar fútbol en 9 meses',
  });
  Object.assign(ing1.anamnesisRemota, {
    lateralidad: 'diestro',
    pesoKg: 61,
    tallaCm: 166,
    imc: 22.1,
    actividadFisica: 'Fútbol 3x/semana previo a lesión',
    sueno: 'Bueno, 7-8 h',
  });

  const ev1 = nuevaEvaluacion(camila.id, 'inicial');
  ev1.fecha = dia(-30);
  Object.assign(ev1.dolor.alicia, {
    aparicion: 'Post-quirúrgico, aumenta con carga',
    localizacion: 'Anterior de rodilla derecha',
    intensidadEva: 6,
    caracter: 'Sordo, opresivo',
    irradiacion: 'No irradia',
    atenuantesAgravantes: 'Agrava: escaleras, sentadilla profunda. Atenúa: hielo, reposo',
  });
  ev1.dolor.mapa = [
    { id: nuevoId(), vista: 'anterior', x: 0.405, y: 0.68, region: 'rodilla', lado: 'derecho', sintoma: 'dolor', intensidad: 6, nota: 'Peri-patelar' },
    { id: nuevoId(), vista: 'posterior', x: 0.6, y: 0.6, region: 'muslo posterior', lado: 'derecho', sintoma: 'rigidez', intensidad: 3, nota: 'Zona donante' },
  ];
  ev1.movimiento.activo = 'Flexión rodilla D 0-95°, extensión -3°';
  ev1.tejidosBlandos.fuerzaMuscular = 'Cuádriceps D 3+/5, isquiotibiales D 3/5';
  ev1.pruebasEspeciales = [{ id: nuevoId(), nombre: 'Lachman', lado: 'derecho', resultado: 'negativo', notas: 'Tope firme' }];
  Object.assign(ev1.conclusion, {
    diagnosticoKinesiologico: 'Déficit de ROM y fuerza de rodilla D post reconstrucción LCA, con dolor anterior que limita AVD (escaleras).',
    objetivosGenerales: 'Retorno progresivo al deporte',
    objetivosEspecificos: 'Flexión >120° en 4 semanas. Extensión completa en 2 semanas. Fuerza cuádriceps 4/5 en 6 semanas.',
    planTratamiento: '2 sesiones/semana. Fase 1 (sem 4-8): ROM, activación cuádriceps, control. Fase 2: fuerza y propiocepción.',
  });

  const evas: [number, number][] = [[6, 5], [5, 4], [5, 3], [4, 3], [3, 2]];
  const sesionesCamila = evas.map(([pre, post], i) => {
    const s = nuevaSesion(camila.id, i + 1, dia(-28 + i * 6));
    s.estado = 'realizada';
    s.hora = '18:00';
    s.registro.evaPre = pre;
    s.registro.evaPost = post;
    s.planificacion.objetivos = i < 3 ? 'Ganar ROM y activación de cuádriceps' : 'Fuerza en cadena cerrada';
    s.planificacion.ejercicios = [
      ej('Bicicleta estática', '1', '10 min', 'Resistencia baja', true),
      ej('Isométrico de cuádriceps', '3', '10 x 10s', '', true),
      ej(i < 3 ? 'Deslizamiento de talón' : 'Sentadilla a cajón', '3', '12', i < 3 ? '' : 'Peso corporal', true),
    ];
    s.registro.subjetivo = i === 0 ? 'Llega con dolor 6/10, realizó ejercicios en casa' : 'Refiere menos dolor en escaleras';
    s.registro.analisis = 'Buena tolerancia a la carga';
    s.registro.plan = 'Continuar ejercicios domiciliarios 1 vez al día';
    return s;
  });
  const proxCamila = nuevaSesion(camila.id, 6, dia(1));
  proxCamila.hora = '18:00';
  proxCamila.planificacion.objetivos = 'Progresar fuerza y comenzar propiocepción';
  proxCamila.planificacion.ejercicios = [
    ej('Bicicleta estática', '1', '10 min', 'Resistencia media'),
    ej('Sentadilla a cajón', '3', '12', '5 kg'),
    ej('Equilibrio unipodal en superficie inestable', '3', '30 s'),
  ];

  // ── Paciente 2: lumbago ──
  const jorge = nuevoPaciente('Jorge Fuentes (ejemplo)', domicilio.id);
  jorge.etiquetas = ['lumbar', 'adulto-mayor'];
  Object.assign(jorge.identificacion, { fechaNacimiento: '1954-09-02', sexo: 'masculino', ocupacion: 'Jubilado' });
  const ing2 = nuevoIngreso(jorge.id);
  ing2.fecha = dia(-10);
  Object.assign(ing2.anamnesisProxima, {
    diagnosticoMedico: 'Lumbago crónico con radiculopatía L5 izquierda',
    tiempoEvolucion: '6 meses',
    prevision: 'Fonasa',
    motivoConsulta: 'Dolor lumbar que irradia a pierna izquierda, dificultad para caminar más de 2 cuadras',
  });
  Object.assign(ing2.anamnesisRemota, { antecedentesMedicos: 'HTA, DM2', antecedenteCaidas: '1 caída hace 3 meses', ayudasTecnicas: 'Bastón ocasional' });
  const ev2 = nuevaEvaluacion(jorge.id, 'inicial');
  ev2.fecha = dia(-10);
  ev2.dolor.alicia.intensidadEva = 7;
  ev2.dolor.mapa = [
    { id: nuevoId(), vista: 'posterior', x: 0.5, y: 0.4, region: 'zona lumbar', lado: 'central', sintoma: 'dolor', intensidad: 7, nota: '' },
    { id: nuevoId(), vista: 'posterior', x: 0.41, y: 0.8, region: 'pantorrilla', lado: 'izquierdo', sintoma: 'dolor_irradiado', intensidad: 5, nota: '' },
    { id: nuevoId(), vista: 'anterior', x: 0.61, y: 0.94, region: 'pie', lado: 'izquierdo', sintoma: 'parestesia', intensidad: null, nota: 'Dorso del pie' },
  ];
  ev2.neurologica.neurodinamia = 'SLR izquierdo + a 45°';
  ev2.conclusion.diagnosticoKinesiologico = 'Dolor lumbar con componente radicular L5 izq., limitación en marcha y AVD.';
  const s21 = nuevaSesion(jorge.id, 1, dia(-7));
  s21.estado = 'realizada';
  s21.registro.evaPre = 7;
  s21.registro.evaPost = 5;
  const s22 = nuevaSesion(jorge.id, 2, dia(-2));
  s22.hora = '11:00';
  s22.planificacion.objetivos = 'Educación en dolor y movilidad lumbar';

  // ── Paciente 3: alta ──
  const sofia = nuevoPaciente('Sofía Lagos (ejemplo)', clinica.id);
  sofia.etiquetas = ['hombro'];
  sofia.estado = 'alta';

  return {
    centros: [clinica, domicilio],
    pacientes: [camila, jorge, sofia],
    ingresos: [ing1, ing2],
    evaluaciones: [ev1, ev2],
    sesiones: [...sesionesCamila, proxCamila, s21, s22],
    adjuntos: [],
    ejercicios: [],
    plantillas: [],
    programas: [],
  };
}
