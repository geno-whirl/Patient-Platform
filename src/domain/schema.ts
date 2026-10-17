/**
 * Modelo de datos clínico de la plataforma.
 *
 * Es la fuente de verdad única: los formularios, el almacenamiento, la
 * exportación JSON/Markdown y el JSON Schema publicado en docs/ salen de aquí.
 *
 * Convenciones (pensadas para que un LLM/agente pueda leer los datos sin ambigüedad):
 * - Claves en español, camelCase, sin tildes. Cada campo lleva `.describe()`.
 * - Cada registro tiene `tipo` (discriminador) e `id` (UUID).
 * - Fechas clínicas en ISO `YYYY-MM-DD`; marcas de tiempo en ISO 8601 completo.
 * - Escalas numéricas explícitas (EVA 0–10, kg, cm). Texto vacío = "no registrado".
 * - Las relaciones son por id: pacienteId → Paciente.id, centroId → Centro.id.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

const texto = (descripcion: string) => z.string().default('').describe(descripcion);
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
  .describe('Fecha clínica en formato ISO YYYY-MM-DD');
const eva = z
  .number()
  .min(0)
  .max(10)
  .nullable()
  .default(null)
  .describe('Escala Visual Análoga del dolor, 0 (sin dolor) a 10 (máximo). null = no registrado');

const meta = {
  id: z.string().describe('Identificador único (UUID)'),
  creadoEn: z.string().describe('Marca de tiempo ISO 8601 de creación'),
  actualizadoEn: z.string().describe('Marca de tiempo ISO 8601 de la última modificación'),
};

// ───────────────────────── Centro ─────────────────────────

export const CentroSchema = z
  .object({
    tipo: z.literal('centro'),
    ...meta,
    nombre: z.string().min(1).describe('Nombre del centro, clínica o lugar de atención (ej: "Domicilio", "Clínica X")'),
    direccion: texto('Dirección del centro'),
    color: z.string().default('#0f766e').describe('Color de la etiqueta del centro en la interfaz (hex)'),
    notas: texto('Notas libres sobre el centro'),
  })
  .describe('Centro o lugar donde se atienden pacientes. Un paciente pertenece a un centro.');

// ───────────────────────── Paciente ─────────────────────────

export const SEXOS = ['femenino', 'masculino', 'otro'] as const;
export const ESTADOS_PACIENTE = ['activo', 'en_pausa', 'alta'] as const;

export const PacienteSchema = z
  .object({
    tipo: z.literal('paciente'),
    ...meta,
    centroId: z.string().nullable().default(null).describe('Id del Centro donde se atiende (null = sin centro)'),
    etiquetas: z
      .array(z.string())
      .default([])
      .describe('Etiquetas libres para filtrar (ej: "rodilla", "deportista", "post-operatorio", "fonasa")'),
    estado: z.enum(ESTADOS_PACIENTE).default('activo').describe('Estado del tratamiento: activo, en_pausa o alta'),
    identificacion: z
      .object({
        nombre: z.string().min(1).describe('Nombre completo'),
        rut: texto('RUT u otro documento de identidad'),
        fechaNacimiento: z.union([fecha, z.literal('')]).default('').describe('Fecha de nacimiento YYYY-MM-DD (la edad se calcula a partir de ella)'),
        sexo: z.union([z.enum(SEXOS), z.literal('')]).default('').describe('Sexo: femenino, masculino u otro'),
        ocupacion: texto('Ocupación o actividad principal'),
        telefono: texto('Teléfono de contacto'),
        email: texto('Correo electrónico'),
      })
      .describe('Datos de identificación del paciente'),
    notas: texto('Notas generales del paciente (no clínicas: preferencias, horarios, etc.)'),
  })
  .describe('Paciente. Los datos clínicos están en Ingreso, Evaluacion y Sesion, enlazados por pacienteId.');

// ───────────────────────── Ingreso (anamnesis) ─────────────────────────

export const LATERALIDADES = ['diestro', 'zurdo', 'ambidiestro'] as const;

export const AnamnesisProximaSchema = z
  .object({
    diagnosticoMedico: texto('Diagnóstico médico de derivación'),
    tiempoEvolucion: texto('Tiempo de evolución del cuadro (ej: "3 semanas")'),
    medicoTratante: texto('Médico tratante / derivador'),
    prevision: texto('Previsión de salud (ej: Fonasa, Isapre, particular)'),
    motivoConsulta: texto('Motivo de consulta y cuadro clínico actual, en palabras del paciente'),
    episodiosPrevios: texto('Episodios previos similares'),
    tratamientosPrevios: texto('Tratamientos o procedimientos previos'),
    examenesComplementarios: texto('Exámenes complementarios / imágenes y sus hallazgos'),
    objetivosPaciente: texto('Objetivos y expectativas del paciente'),
  })
  .describe('Anamnesis próxima: el problema actual');

export const AnamnesisRemotaSchema = z
  .object({
    lateralidad: z.union([z.enum(LATERALIDADES), z.literal('')]).default('').describe('Lateralidad / dominancia'),
    pesoKg: z.number().positive().nullable().default(null).describe('Peso en kilogramos'),
    tallaCm: z.number().positive().nullable().default(null).describe('Talla en centímetros'),
    imc: z.number().nullable().default(null).describe('Índice de masa corporal (kg/m²), calculado desde peso y talla'),
    antecedentesMedicos: texto('Antecedentes médicos / mórbidos'),
    antecedentesQuirurgicos: texto('Antecedentes quirúrgicos'),
    antecedentesFamiliares: texto('Antecedentes familiares'),
    antecedentesGinecoobstetricos: texto('Antecedentes ginecoobstétricos'),
    medicamentos: texto('Medicamentos en uso'),
    alimentacion: texto('Alimentación'),
    suplementos: texto('Suplementos'),
    habitos: z
      .object({
        alcohol: z.boolean().default(false).describe('Consume alcohol (OH)'),
        tabaco: z.boolean().default(false).describe('Consume tabaco (TBQ)'),
        drogas: z.boolean().default(false).describe('Consume drogas'),
        detalle: texto('Detalle de cantidad / frecuencia'),
      })
      .prefault({})
      .describe('Hábitos: OH, TBQ, drogas'),
    actividadFisica: texto('Actividad física: tipo, frecuencia, intensidad'),
    sueno: texto('Calidad y cantidad de sueño'),
    psicologia: texto('Aspectos psicológicos / emocionales relevantes'),
    redDeApoyo: texto('Red de apoyo'),
    vivienda: texto('Vivienda (escaleras, accesibilidad, etc.)'),
    transporte: texto('Medio de transporte habitual'),
    abvdAvd: texto('ABVD/AVD: actividades básicas e instrumentales de la vida diaria'),
    hobbies: texto('Hobbies y actividades'),
    rutinaDiaria: texto('Rutina diaria'),
    antecedenteCaidas: texto('Antecedente de caídas'),
    ayudasTecnicas: texto('Ayudas técnicas (bastón, órtesis, etc.)'),
  })
  .describe('Anamnesis remota: antecedentes y contexto biopsicosocial');

export const IngresoSchema = z
  .object({
    tipo: z.literal('ingreso'),
    ...meta,
    pacienteId: z.string().describe('Id del Paciente'),
    fecha,
    anamnesisProxima: AnamnesisProximaSchema.prefault({}),
    anamnesisRemota: AnamnesisRemotaSchema.prefault({}),
  })
  .describe('Ingreso del paciente con anamnesis próxima y remota. Normalmente uno por episodio de tratamiento.');

// ───────────────────────── Evaluación ─────────────────────────

export const VISTAS_CUERPO = ['anterior', 'posterior', 'lateral_derecha', 'lateral_izquierda'] as const;
export const TIPOS_SINTOMA = ['dolor', 'dolor_irradiado', 'parestesia', 'rigidez', 'debilidad', 'otro'] as const;
export const LADOS = ['derecho', 'izquierdo', 'bilateral', 'central'] as const;

export const MarcaDolorSchema = z
  .object({
    id: z.string(),
    vista: z.enum(VISTAS_CUERPO).describe('Vista del mapa corporal donde se marcó'),
    x: z.number().min(0).max(1).describe('Posición horizontal normalizada (0 = borde izquierdo de la imagen, 1 = derecho)'),
    y: z.number().min(0).max(1).describe('Posición vertical normalizada (0 = cabeza, 1 = pies)'),
    region: texto('Región anatómica aproximada (ej: "hombro", "zona lumbar", "rodilla")'),
    lado: z.union([z.enum(LADOS), z.literal('')]).default('').describe('Lado del cuerpo del PACIENTE'),
    sintoma: z.enum(TIPOS_SINTOMA).default('dolor').describe('Tipo de síntoma marcado'),
    intensidad: eva,
    nota: texto('Descripción libre de la marca'),
  })
  .describe('Una marca en el mapa del dolor');

export const PruebaEspecialSchema = z
  .object({
    id: z.string(),
    nombre: z.string().describe('Nombre de la prueba (ej: "Lachman", "Neer", "SLR")'),
    lado: z.union([z.enum(LADOS), z.literal('')]).default(''),
    resultado: z
      .enum(['positivo', 'negativo', 'no_concluyente', ''])
      .default('')
      .describe('Resultado de la prueba'),
    notas: texto('Hallazgos u observaciones'),
  })
  .describe('Prueba especial / test ortopédico');

export const EvaluacionSchema = z
  .object({
    tipo: z.literal('evaluacion'),
    ...meta,
    pacienteId: z.string().describe('Id del Paciente'),
    fecha,
    clase: z.enum(['inicial', 'reevaluacion']).default('inicial').describe('Evaluación inicial o reevaluación'),
    dolor: z
      .object({
        alicia: z
          .object({
            aparicion: texto('A — Aparición: cuándo y cómo comenzó'),
            localizacion: texto('L — Localización'),
            intensidadEva: eva,
            caracter: texto('C — Carácter: punzante, quemante, sordo, etc.'),
            irradiacion: texto('I — Irradiación'),
            atenuantesAgravantes: texto('A — Agravantes y atenuantes'),
          })
          .prefault({})
          .describe('Caracterización del dolor según nemotecnia ALICIA'),
        mapa: z.array(MarcaDolorSchema).default([]).describe('Marcas en el mapa corporal del dolor'),
      })
      .prefault({}),
    postural: texto('Evaluación postural'),
    observacion: texto('Observación / inspección'),
    movimiento: z
      .object({
        activo: texto('Rango de movimiento activo'),
        pasivo: texto('Rango de movimiento pasivo'),
        artrocinematica: texto('Evaluación artrocinemática'),
      })
      .prefault({})
      .describe('Evaluación de movimiento'),
    tejidosBlandos: z
      .object({
        activacionMuscular: texto('Activación muscular'),
        fuerzaMuscular: texto('Fuerza muscular (ej: escala Daniels 0–5, dinamometría)'),
        longitudMuscular: texto('Longitud muscular / flexibilidad'),
      })
      .prefault({})
      .describe('Evaluación de tejidos blandos'),
    neurologica: z
      .object({
        dermatomas: texto('Dermatomas'),
        miotomas: texto('Miotomas'),
        reflejos: texto('Reflejos osteotendíneos'),
        neurodinamia: texto('Pruebas neurodinámicas'),
      })
      .prefault({})
      .describe('Evaluación neurológica'),
    controlSensoriomotor: texto('Evaluación de control sensoriomotor'),
    palpacion: texto('Palpación específica'),
    funcional: texto('Evaluación funcional (tests, cuestionarios, gestos)'),
    pruebasEspeciales: z.array(PruebaEspecialSchema).default([]).describe('Pruebas especiales realizadas'),
    conclusion: z
      .object({
        diagnosticoKinesiologico: texto('Diagnóstico kinesiológico / funcional'),
        objetivosGenerales: texto('Objetivo(s) general(es) del tratamiento'),
        objetivosEspecificos: texto('Objetivos específicos, idealmente medibles'),
        planTratamiento: texto('Plan de tratamiento: fases, frecuencia, número estimado de sesiones'),
      })
      .prefault({})
      .describe('Síntesis de la evaluación y plan'),
  })
  .describe('Evaluación kinesiológica (inicial o reevaluación) con mapa del dolor');

// ───────────────────────── Sesión ─────────────────────────

export const ESTADOS_SESION = ['planificada', 'realizada', 'cancelada', 'no_asistio'] as const;

export const EjercicioSchema = z
  .object({
    id: z.string(),
    nombre: z.string().default('').describe('Ejercicio o intervención (ej: "Sentadilla búlgara", "Movilización grado III")'),
    series: texto('Series'),
    repeticiones: texto('Repeticiones o tiempo'),
    carga: texto('Carga / intensidad (kg, RPE, banda, etc.)'),
    notas: texto('Indicaciones o progresión'),
    realizado: z.boolean().default(false).describe('Si se realizó en la sesión'),
  })
  .describe('Ejercicio o intervención planificada para la sesión');

export const SesionSchema = z
  .object({
    tipo: z.literal('sesion'),
    ...meta,
    pacienteId: z.string().describe('Id del Paciente'),
    fecha,
    hora: texto('Hora de la sesión HH:MM'),
    numero: z.number().int().positive().describe('Número correlativo de sesión del paciente'),
    estado: z.enum(ESTADOS_SESION).default('planificada').describe('Estado de la sesión'),
    planificacion: z
      .object({
        objetivos: texto('Objetivos de esta sesión'),
        ejercicios: z.array(EjercicioSchema).default([]),
        notas: texto('Notas de planificación'),
      })
      .prefault({})
      .describe('Lo que se planificó hacer'),
    registro: z
      .object({
        evaPre: eva.describe('EVA al inicio de la sesión (0–10)'),
        evaPost: eva.describe('EVA al final de la sesión (0–10)'),
        subjetivo: texto('S — Subjetivo: cómo llega el paciente, lo que reporta'),
        objetivo: texto('O — Objetivo: hallazgos y lo realizado en la sesión'),
        analisis: texto('A — Análisis: respuesta al tratamiento, interpretación'),
        plan: texto('P — Plan: indicaciones, tareas para la casa, próximos pasos'),
      })
      .prefault({})
      .describe('Evolución de la sesión en formato SOAP'),
  })
  .describe('Sesión de tratamiento: planificación + registro de evolución (SOAP)');

// ───────────────────────── Tipos y colecciones ─────────────────────────

export type Centro = z.infer<typeof CentroSchema>;
export type Paciente = z.infer<typeof PacienteSchema>;
export type Ingreso = z.infer<typeof IngresoSchema>;
export type Evaluacion = z.infer<typeof EvaluacionSchema>;
export type Sesion = z.infer<typeof SesionSchema>;
export type MarcaDolor = z.infer<typeof MarcaDolorSchema>;
export type PruebaEspecial = z.infer<typeof PruebaEspecialSchema>;
export type Ejercicio = z.infer<typeof EjercicioSchema>;
export type VistaCuerpo = (typeof VISTAS_CUERPO)[number];

export const COLECCIONES = {
  centros: CentroSchema,
  pacientes: PacienteSchema,
  ingresos: IngresoSchema,
  evaluaciones: EvaluacionSchema,
  sesiones: SesionSchema,
} as const;

export type Coleccion = keyof typeof COLECCIONES;

export interface RegistroPorColeccion {
  centros: Centro;
  pacientes: Paciente;
  ingresos: Ingreso;
  evaluaciones: Evaluacion;
  sesiones: Sesion;
}

export type BaseDeDatos = { [K in Coleccion]: RegistroPorColeccion[K][] };

/** Formato del archivo de exportación/respaldo completo. */
export const ExportacionSchema = z
  .object({
    formato: z.literal('kine-plataforma'),
    versionEsquema: z.number().describe('Versión del modelo de datos'),
    exportadoEn: z.string().describe('Marca de tiempo ISO 8601'),
    centros: z.array(CentroSchema),
    pacientes: z.array(PacienteSchema),
    ingresos: z.array(IngresoSchema),
    evaluaciones: z.array(EvaluacionSchema),
    sesiones: z.array(SesionSchema),
  })
  .describe('Respaldo completo de la plataforma kinesiológica');

export type Exportacion = z.infer<typeof ExportacionSchema>;
