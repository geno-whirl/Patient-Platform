# Guía para agentes (LLM)

Instrucciones para un agente que lee o consulta los datos clínicos de esta plataforma,
o que modifica su código.

## Leer los datos

Hay tres formatos con la misma información:

1. **Markdown por paciente** (export “Datos e IA” o “Copiar ficha para IA”): una sección `# Paciente: …`
   seguida de Ingreso, Evaluaciones y Sesiones en orden cronológico. Los campos vacíos se omiten,
   así que si un dato no aparece significa “no registrado”, no “normal”.
2. **JSON de respaldo**: objeto `{ formato, versionEsquema, exportadoEn, centros[], pacientes[], ingresos[], evaluaciones[], sesiones[] }`.
   El esquema completo, con descripciones, está en `docs/esquema.json`.
3. **SQL (Supabase)**: tablas `centros`, `pacientes`, `ingresos`, `evaluaciones` y `sesiones`, cada una con `data jsonb`
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

- La fuente de verdad del modelo es `src/domain/schema.ts`. Agrega campos con `.default(...)` para que los registros antiguos sigan siendo válidos, describe cada campo con `.describe()`, ejecuta `npm run schema` y actualiza `domain/markdown.ts`.
- Si agregas una columna generada en SQL, añádela también a `supabase/schema.sql` de forma idempotente.
- Ejecuta `npm test` y `npm run typecheck` antes de hacer commit.
