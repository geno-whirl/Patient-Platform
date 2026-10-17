# Guía para agentes (LLM)

Instrucciones para un agente que lee o consulta los datos clínicos de esta plataforma,
o que modifica su código.

## Leer los datos

Hay tres formatos con la misma información:

1. **Markdown por paciente** (export “Datos e IA” o “Copiar ficha para IA”): una sección `# Paciente: …`
   seguida de Ingreso, Evaluaciones, Sesiones y Adjuntos en orden cronológico. Los campos vacíos se omiten,
   así que si un dato no aparece significa “no registrado”, no “normal”.
   Si el título es un código como `P-3F2A9C`, la ficha está **anonimizada**: ese código reemplaza al nombre
   del paciente en todo el texto, y `[RUT]`, `[email]` y `[teléfono]` marcan datos que se quitaron.
2. **JSON de respaldo** (descarga manual o carpeta “Kine — respaldos” en Google Drive): objeto
   `{ formato, versionEsquema, exportadoEn, centros[], pacientes[], ingresos[], evaluaciones[], sesiones[], adjuntos[] }`.
   El esquema completo, con descripciones, está en `docs/esquema.json`.
3. **SQL (Supabase)**: tablas `centros`, `pacientes`, `ingresos`, `evaluaciones`, `sesiones` y `adjuntos`, cada una con `data jsonb`
   (el mismo documento del JSON) y columnas de conveniencia (`nombre`, `centro_id`, `paciente_id`, `fecha`, `estado` y `etiquetas`).
   Además hay vistas `v_pacientes` (resumen de seguimiento) y `v_evolucion_eva` (EVA de inicio y término por sesión realizada).

## Convenciones del modelo

- Relaciones por id: `ingreso.pacienteId`, `evaluacion.pacienteId` y `sesion.pacienteId` apuntan a `paciente.id`; `paciente.centroId` apunta a `centro.id`.
- Fechas clínicas en `YYYY-MM-DD`; `creadoEn` y `actualizadoEn` en ISO 8601.
- **EVA**: 0 (sin dolor) a 10 (máximo); `null` significa que no se registró.
- Evaluación del dolor con **ALICIA**: Aparición, Localización, Intensidad, Carácter, Irradiación, Agravantes/Atenuantes.
- **Mapa del dolor**: `dolor.mapa[]` con `vista`, `region`, `lado` (siempre el lado del **paciente**), `sintoma`, `intensidad` y `nota`. `x` e `y` son coordenadas de dibujo; para razonar usa `region` y `lado`.
- **Sesión** = `planificacion` (objetivos y ejercicios) + `registro` en formato SOAP (`subjetivo`, `objetivo`, `analisis`, `plan`) con `evaPre` y `evaPost`.
  `estado`: `planificada` | `realizada` | `cancelada` | `no_asistio`. Solo las sesiones realizadas cuentan como evolución.
- `paciente.estado`: `activo` | `en_pausa` | `alta`. `etiquetas[]` son palabras en minúscula con guiones.
- **Adjunto**: metadatos de un archivo (foto, examen, informe). El contenido binario no está en el JSON;
  lo que se puede leer es `descripcion` (hallazgos escritos por el kinesiólogo), `categoria` y `fecha`.
  `evaluacionId` lo vincula opcionalmente a una evaluación.

## Ejemplos de consultas SQL

```sql
-- Pacientes activos de un centro, con su última sesión
select nombre, ultima_sesion, sesiones_realizadas from v_pacientes where centro = 'Clínica X' and estado = 'activo';

-- Pacientes cuya EVA no bajó entre su primera y su última sesión realizada
select paciente_id, nombre,
       (array_agg(eva_pre order by fecha))[1] as eva_inicial,
       (array_agg(eva_post order by fecha desc))[1] as eva_actual
from v_evolucion_eva group by paciente_id, nombre
having (array_agg(eva_post order by fecha desc))[1] >= (array_agg(eva_pre order by fecha))[1];

-- Pacientes con una etiqueta
select nombre from pacientes where etiquetas ? 'lumbar';
```

## Al modificar el código

- La fuente de verdad del modelo es `src/domain/schema.ts`. Agrega campos con `.default(...)` para que los registros antiguos sigan siendo válidos, describe cada campo con `.describe()`, ejecuta `npm run schema` y actualiza `domain/ficha.ts` (Markdown e impresión) y, si el campo identifica al paciente, `domain/anonimizar.ts`.
- Los cambios de base de datos van en una **nueva** migración en `supabase/migrations/` (no edites las ya aplicadas).
  Pruébalas con `npx supabase db reset` en el Supabase local.
- La ficha (Markdown y vista de impresión) se arma en `src/domain/ficha.ts`; la anonimización está en `src/domain/anonimizar.ts`.
- Las Edge Functions (`supabase/functions/`) no usan dependencias externas: llaman a las APIs REST de Supabase y Google con `fetch`.
- Ejecuta `npm test` y `npm run typecheck` antes de hacer commit.
