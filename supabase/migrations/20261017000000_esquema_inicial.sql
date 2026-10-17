-- Esquema inicial (migración de Supabase). Se aplica con `npx supabase db push`
-- (o pegándolo en Supabase → SQL Editor si no usas la CLI).
--
-- Diseño: cada colección es una tabla con el documento completo en `data` (jsonb),
-- validado en la app con los esquemas de src/domain/schema.ts. Algunas claves se
-- exponen como columnas generadas para poder filtrar/consultar con SQL directo
-- (útil para agentes LLM conectados vía MCP de Supabase o SQL). Las fechas se guardan
-- como texto ISO YYYY-MM-DD (ordenan bien y se pueden castear con ::date).

create extension if not exists pgcrypto;

-- ───────── Tablas ─────────

create table if not exists public.centros (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  nombre text generated always as (data ->> 'nombre') stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.pacientes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  nombre text generated always as (data -> 'identificacion' ->> 'nombre') stored,
  centro_id uuid generated always as ((nullif(data ->> 'centroId', ''))::uuid) stored,
  estado text generated always as (data ->> 'estado') stored,
  etiquetas jsonb generated always as (coalesce(data -> 'etiquetas', '[]'::jsonb)) stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.ingresos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  paciente_id uuid generated always as ((data ->> 'pacienteId')::uuid) stored,
  fecha text generated always as (data ->> 'fecha') stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.evaluaciones (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  paciente_id uuid generated always as ((data ->> 'pacienteId')::uuid) stored,
  fecha text generated always as (data ->> 'fecha') stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.sesiones (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  paciente_id uuid generated always as ((data ->> 'pacienteId')::uuid) stored,
  fecha text generated always as (data ->> 'fecha') stored,
  estado text generated always as (data ->> 'estado') stored,
  updated_at timestamptz not null default now()
);

create index if not exists pacientes_user_idx on public.pacientes (user_id);
create index if not exists pacientes_centro_idx on public.pacientes (centro_id);
create index if not exists pacientes_etiquetas_idx on public.pacientes using gin (etiquetas);
create index if not exists ingresos_paciente_idx on public.ingresos (paciente_id);
create index if not exists evaluaciones_paciente_idx on public.evaluaciones (paciente_id);
create index if not exists sesiones_paciente_idx on public.sesiones (paciente_id, fecha);

-- ───────── updated_at automático ─────────

create or replace function public.tocar_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['centros', 'pacientes', 'ingresos', 'evaluaciones', 'sesiones'] loop
    execute format('drop trigger if exists tocar_updated_at on public.%I', t);
    execute format(
      'create trigger tocar_updated_at before update on public.%I for each row execute function public.tocar_updated_at()',
      t
    );
  end loop;
end $$;

-- ───────── Row Level Security: cada usuario solo accede a sus datos ─────────

do $$
declare t text;
begin
  foreach t in array array['centros', 'pacientes', 'ingresos', 'evaluaciones', 'sesiones'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "propietario" on public.%I', t);
    execute format(
      'create policy "propietario" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- ───────── Vistas de conveniencia para consultas (respetan RLS) ─────────

create or replace view public.v_pacientes with (security_invoker = true) as
select
  p.id,
  p.nombre,
  p.estado,
  p.etiquetas,
  c.nombre as centro,
  p.data -> 'identificacion' ->> 'fechaNacimiento' as fecha_nacimiento,
  (select count(*) from public.sesiones s where s.paciente_id = p.id and s.estado = 'realizada') as sesiones_realizadas,
  (select max(s.fecha) from public.sesiones s where s.paciente_id = p.id and s.estado = 'realizada') as ultima_sesion,
  (select max(s.fecha) from public.sesiones s where s.paciente_id = p.id and s.estado = 'planificada') as proxima_sesion_planificada
from public.pacientes p
left join public.centros c on c.id = p.centro_id;

create or replace view public.v_evolucion_eva with (security_invoker = true) as
select
  s.paciente_id,
  p.nombre,
  s.fecha,
  (s.data ->> 'numero')::int as numero_sesion,
  (s.data -> 'registro' ->> 'evaPre')::numeric as eva_pre,
  (s.data -> 'registro' ->> 'evaPost')::numeric as eva_post
from public.sesiones s
join public.pacientes p on p.id = s.paciente_id
where s.estado = 'realizada';
