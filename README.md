# Kine · Plataforma de fichas kinesiológicas

App web para el **ingreso, evaluación, planificación y seguimiento** de pacientes de kinesiología,
basada en el formato de ingreso en papel (anamnesis próxima/remota, evaluación con ALICIA y mapa del dolor).

## Qué incluye

| Módulo | Contenido |
|---|---|
| **Pacientes** | Identificación, centro, etiquetas libres y estado (activo / en pausa / alta). Búsqueda sin tildes y filtros por centro, etiquetas y estado. |
| **Ingreso** | Anamnesis próxima y remota completas, con edad e IMC calculados automáticamente. |
| **Evaluación** | ALICIA con EVA 0–10, **mapa del dolor interactivo** (4 vistas; región anatómica y lado del paciente automáticos), postural, movimiento, tejidos blandos, neurológica, sensoriomotor, palpación, funcional, pruebas especiales, diagnóstico kinesiológico, objetivos y plan. |
| **Sesiones** | Planificación (objetivos y ejercicios con series/reps/carga) y registro SOAP con EVA de inicio y de término. La nueva sesión copia el plan de la anterior. |
| **Adjuntos** | Fotos, exámenes (PDF), informes y videos por paciente, con fecha, categoría, evaluación relacionada y **descripción de hallazgos** (que es lo que lee un LLM). Desde el celular se puede usar “Tomar foto”. Las fotos grandes se reducen solas. |
| **Ficha imprimible / PDF** | Documento de la ficha con secciones a elegir (ingreso, evaluaciones con mapa del dolor, sesiones, adjuntos e imágenes), opcionalmente anonimizado. Se guarda como PDF desde el diálogo de impresión. |
| **Evolución y agenda** | Gráfico de EVA, próxima sesión e indicaciones vigentes; agenda por centro, más una vista de sesiones pasadas que quedaron sin registrar. |
| **Datos e IA** | Fichas en Markdown para un LLM (**anonimizadas** por defecto), respaldo JSON con importación, esquema de datos y **respaldo automático en Google Drive**. |

Todo se guarda solo mientras escribes.

## Arquitectura

```
Navegador (React)  ──►  Supabase
                         ├─ Auth: login con Google o enlace por correo
                         ├─ Postgres: tablas con RLS (cada usuario ve solo lo suyo)
                         ├─ Storage: bucket privado "adjuntos" (carpeta por usuario)
                         ├─ Vault: token de Google Drive cifrado
                         ├─ Edge Functions: drive-conectar, drive-respaldo
                         └─ pg_cron (cada hora) ──► drive-respaldo ──► Google Drive del usuario
```

- **Datos pensados para agentes:** cada registro es un documento JSON validado con el esquema de `src/domain/schema.ts`. Además hay columnas y vistas SQL (`v_pacientes`, `v_evolucion_eva`) para consultarlo. Detalle en [`AGENTS.md`](AGENTS.md).
- **Respaldo en Drive:** corre en el servidor, así que funciona con la app cerrada. Usa el permiso `drive.file`: la app solo ve los archivos que ella misma crea, nunca el resto de tu Drive. Guarda un JSON completo por respaldo (conserva los últimos 30) más una copia de cada adjunto.
- **Modo local:** sin configurar Supabase, la app guarda todo en el navegador (IndexedDB). Sirve para probarla.

```
src/domain/       modelo (schema.ts), ficha estructurada, Markdown, anonimización, mapa del dolor
src/data/         repositorios local/Supabase (datos + archivos), autoguardado
src/pages/        pantallas (incluye AdjuntosPage, ImprimirPage)
supabase/migrations/   tablas, RLS, Storage, Vault, pg_cron
supabase/functions/    Edge Functions del respaldo en Drive
```

---

## Puesta en marcha

### A. Probar sin cuenta (modo local)

```bash
npm install
npm run dev        # http://localhost:5173 → "Cargar pacientes de ejemplo"
```

### B. Producción con Supabase (paso a paso)

**1. Proyecto Supabase.** Crea un proyecto en [supabase.com](https://supabase.com) en la región *South America (São Paulo)*. Anota el *Project ref* (aparece en la URL `https://<ref>.supabase.co`).

**2. Base de datos, Storage y funciones** (desde este repositorio):

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                                   # aplica supabase/migrations/
npx supabase functions deploy drive-conectar drive-respaldo
```

**3. Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com)). Basta un proyecto para el login y para Drive:
- *APIs y servicios → Biblioteca*: habilita **Google Drive API**.
- *Pantalla de consentimiento OAuth*: tipo **Externo**; agrega el alcance `.../auth/drive.file`. Luego **publícala (“En producción”)**. En modo *Prueba*, Google invalida el permiso a los 7 días y el respaldo automático se detendría. `drive.file` no es un alcance sensible, así que publicar no requiere verificación de Google.
- *Credenciales → Crear ID de cliente OAuth → Aplicación web*, con estos **URI de redireccionamiento autorizados**:
  - `https://<ref>.supabase.co/auth/v1/callback` (login con Google)
  - `https://<tu-app>/datos` (conectar Drive; agrega también `http://localhost:5173/datos` para desarrollo)

**4. Login con Google en Supabase.** En *Authentication → Sign In / Providers → Google*, pega el Client ID y el Client Secret. Luego, en *Authentication → URL Configuration*, agrega la URL de tu app.

**5. Secretos de las Edge Functions.** Crea `supabase/functions/.env` a partir de `supabase/functions/.env.example`:

```bash
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
SECRETO_CRON=<cadena aleatoria larga, ej: openssl rand -hex 32>
```

Y súbelos con `npx supabase secrets set --env-file supabase/functions/.env`.

**6. Activar el respaldo programado.** En *SQL Editor* ejecuta, con tus valores:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'url_proyecto');
select vault.create_secret('<el mismo SECRETO_CRON>', 'secreto_cron');
```

pg_cron revisa cada hora a quién le toca respaldo (diario o semanal, según elija cada usuario).

**7. Publicar la app** (Vercel o Netlify): importa el repo y define estas variables:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key de Project Settings → API>
VITE_GOOGLE_CLIENT_ID=<client id>
```

**8. Cerrar el registro.** Entra una vez para crear tu usuario y luego desactiva *Allow new users to sign up* en Supabase (*Authentication → Sign In / Providers*).

Por último, en la app ve a **Datos e IA → Conectar Google Drive**. Se hace el primer respaldo de inmediato.

### C. Desarrollo con Supabase local (Docker)

```bash
npm run supabase:start     # Postgres, Auth, Storage, Edge Functions y Mailpit en Docker
# .env.local: VITE_SUPABASE_URL=http://127.0.0.1:54321 y la ANON_KEY que muestra `npx supabase status`
npm run dev
npm run functions:serve    # Edge Functions con supabase/functions/.env
```

Los correos de acceso llegan a Mailpit (http://127.0.0.1:54324). Para probar Drive sin Google real, `GOOGLE_OAUTH_URL` y `GOOGLE_API_URL` en las funciones, y `VITE_GOOGLE_AUTH_URL` en la app, pueden apuntar a un servidor simulado.

### Verificaciones

```bash
npm test           # dominio: esquema, regiones, filtros, Markdown, anonimización
npm run typecheck
npm run schema     # regenera docs/esquema.json
```

## Consultar a un LLM sobre tus pacientes

- **Rápido:** en *Datos e IA* descarga las fichas `.md` (anonimizadas por defecto, filtrables por centro) y súbelas a un proyecto de Claude. También puedes usar **“Copiar ficha para IA”** desde un paciente.
- **Desde Drive:** los respaldos JSON quedan en tu carpeta “Kine — respaldos”, y un asistente con acceso a tu Drive puede leerlos. El formato está en `docs/esquema.json`.
- **En vivo:** conecta un agente al servidor MCP de Supabase y consulta con SQL (ver [`AGENTS.md`](AGENTS.md)).

### Qué quita la anonimización

| Se quita | Se conserva |
|---|---|
| Nombre: reemplazado por un código estable, por ejemplo `P-3F2A9C` (el mismo paciente tiene siempre el mismo código) | Edad, sexo y ocupación |
| RUT, teléfono, email y fecha de nacimiento | Todo lo clínico: anamnesis, evaluaciones, mapa del dolor, sesiones y EVA |
| Médico tratante y notas generales del paciente | Fechas clínicas (para ver la evolución) |
| Nombres de archivo de los adjuntos | Centro |
| **En texto libre:** nombre del paciente (aunque no lleve tildes o esté en mayúsculas), RUT, correos y teléfonos | |

No detecta nombres de **otras personas** escritos en texto libre (familiares, otros profesionales), así que conviene revisar antes de compartir. Las fotos también pueden identificar al paciente.

## Privacidad

Estos son **datos sensibles de salud** (en Chile, Ley 20.584 y Ley 19.628). La plataforma:
- aísla los datos y archivos de cada usuario en la base de datos (Row Level Security; verificado con dos usuarios);
- guarda el permiso de Google Drive cifrado (Vault), sin que el navegador pueda leerlo, y lo revoca al desconectar;
- respalda solo en tu propio Drive.

Recomendado: activar la verificación en dos pasos en Google y en Supabase, y no compartir fichas sin anonimizar.
