# Kine · Plataforma de fichas kinesiológicas

App web para el **ingreso, evaluación, planificación y seguimiento** de pacientes de kinesiología,
basada en el formato de ingreso en papel (anamnesis próxima/remota, evaluación con ALICIA y mapa del dolor).

## Qué incluye

| Módulo | Contenido |
|---|---|
| **Pacientes** | Identificación, centro, etiquetas libres y estado (activo / en pausa / alta). Búsqueda sin tildes y filtros por centro, etiquetas y estado (los filtros quedan en la URL). |
| **Ingreso** | Anamnesis próxima y remota completas, con edad e IMC calculados automáticamente. |
| **Evaluación** | ALICIA con EVA 0–10, **mapa del dolor interactivo** (4 vistas; cada marca registra región anatómica, lado del paciente, tipo de síntoma e intensidad), postural, movimiento, tejidos blandos, neurológica, sensoriomotor, palpación, funcional, pruebas especiales y conclusión (diagnóstico kinesiológico, objetivos, plan). Evaluación inicial y reevaluaciones. |
| **Sesiones** | Planificación (objetivos + lista de ejercicios con series/reps/carga) y registro SOAP con EVA de inicio y de término. La nueva sesión copia el plan de la anterior para progresar sin reescribir. |
| **Evolución** | Resumen por paciente con gráfico de EVA, próxima sesión, indicaciones vigentes y el último mapa del dolor. |
| **Agenda** | Sesiones planificadas de todos los pacientes por día, más una vista de sesiones pasadas que quedaron sin registrar. |
| **Centros** | Varios lugares de atención, cada uno con su color. |
| **Datos e IA** | Exporta fichas en Markdown para un LLM, respaldo e importación JSON y el esquema de datos (JSON Schema). |

Todo se guarda solo mientras escribes (*autoguardado*). La interfaz está pensada para usarse también en tablet o celular.

## Arquitectura propuesta (y por qué)

**Supabase (Postgres + autenticación) en lugar de Google Drive como almacenamiento principal:**

- **Inicio de sesión con Google** (o enlace mágico por correo), así que en la práctica entras con tu cuenta de Google.
- **Base de datos real**: varios dispositivos a la vez (notebook en la consulta y celular en domicilio) sin conflictos de sincronización de archivos.
- **Seguridad por fila (RLS)**: cada usuario solo puede leer y escribir sus propios registros, y la base de datos lo hace cumplir. Esto ya está probado en `supabase/schema.sql`.
- **Pensada para agentes**: cada registro es un documento JSON con esquema documentado, y además hay columnas y vistas SQL (`v_pacientes`, `v_evolucion_eva`). Un LLM puede leer los datos exportados o consultarlos directamente con SQL (por ejemplo con el servidor MCP de Supabase).
- Plan gratuito suficiente para una consulta; se puede elegir la región São Paulo.

Google Drive queda como un posible **destino de respaldo** (subir ahí el `.json` o el `.md` exportados), pero no conviene como base principal: es lento para muchos registros pequeños y se presta a conflictos de sincronización.

Sin configurar Supabase, la app funciona en **modo local**: los datos quedan en el navegador (IndexedDB). Sirve para probarla, pero en ese modo hay que descargar respaldos.

```
src/
  domain/schema.ts      ← modelo de datos (Zod) — fuente de verdad única
  domain/markdown.ts    ← ficha del paciente en Markdown para LLMs
  domain/regiones.ts    ← coordenadas del mapa del dolor → región anatómica + lado
  data/                 ← repositorio local (IndexedDB) y Supabase, autoguardado
  components/           ← mapa del dolor, gráfico EVA, campos de formulario
  pages/                ← pantallas
supabase/schema.sql     ← tablas, RLS y vistas
docs/                   ← modelo de datos y JSON Schema para agentes
```

## Puesta en marcha

### 1. Probar en local (sin cuenta)

```bash
npm install
npm run dev        # http://localhost:5173 → "Cargar pacientes de ejemplo"
```

### 2. Activar cuentas de usuario y nube (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com) (región *South America – São Paulo*).
2. En **SQL Editor** pega y ejecuta `supabase/schema.sql`.
3. **Login con Google**: en Google Cloud Console crea credenciales *OAuth client ID (Web)*, con
   redirect URI `https://<tu-proyecto>.supabase.co/auth/v1/callback`. Luego, en Supabase →
   *Authentication → Providers → Google*, pega el Client ID y el Secret.
4. En Supabase → *Authentication → URL Configuration* agrega la URL de tu app (por ejemplo `http://localhost:5173` y la de producción).
5. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (en *Project Settings → API*).
6. Recomendado: en *Authentication → Sign In / Providers* desactiva **Allow new users to sign up** después de crear tu cuenta, para que nadie más pueda registrarse.

### 3. Publicar

En Vercel o Netlify: importa el repositorio, define las dos variables `VITE_SUPABASE_*` y despliega
(`npm run build`, carpeta `dist`). Las reglas para que funcionen las rutas de la SPA ya están incluidas (`vercel.json`, `public/_redirects`).

### Desarrollo

```bash
npm test           # tests del dominio (esquema, regiones, filtros, markdown)
npm run typecheck
npm run schema     # regenera docs/esquema.json desde src/domain/schema.ts
```

## Consultar a un LLM sobre tus pacientes

- **Rápido:** en *Datos e IA* descarga las fichas `.md` (filtrables por centro) y súbelas a un proyecto de Claude.
  También puedes usar **“Copiar ficha para IA”** desde un paciente.
- **Estructurado:** el respaldo `.json` sigue `docs/esquema.json`. Cada campo tiene su descripción y unidades (EVA 0–10, kg, cm, fechas ISO).
- **En vivo:** conecta un agente al servidor MCP de Supabase y consulta con SQL las vistas `v_pacientes` y `v_evolucion_eva`.
  En [`AGENTS.md`](AGENTS.md) está la guía que conviene darle al agente.

## Privacidad

Estos son **datos sensibles de salud** (en Chile, Ley 20.584 y Ley 19.628). Recomendaciones:

- Usa Supabase con RLS (ya configurado) y desactiva los registros públicos de usuarios.
- Activa la verificación en dos pasos en tu cuenta de Google y en la de Supabase.
- Antes de compartir fichas con un servicio de IA, revisa sus condiciones y considera anonimizar (quitar RUT y datos de contacto).
