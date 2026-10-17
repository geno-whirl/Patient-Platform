-- Biblioteca de ejercicios, plantillas de sesión y programas de tratamiento (por usuario, mismo patrón que el resto:
-- documento completo en `data` + columnas generadas para consultar con SQL).

create table if not exists public.ejercicios (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  nombre text generated always as (data ->> 'nombre') stored,
  categoria text generated always as (data ->> 'categoria') stored,
  regiones jsonb generated always as (coalesce(data -> 'regiones', '[]'::jsonb)) stored,
  equipamiento jsonb generated always as (coalesce(data -> 'equipamiento', '[]'::jsonb)) stored,
  archivado boolean generated always as (coalesce((data ->> 'archivado')::boolean, false)) stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.plantillas (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  nombre text generated always as (data ->> 'nombre') stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.programas (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  nombre text generated always as (data ->> 'nombre') stored,
  updated_at timestamptz not null default now()
);

create index if not exists ejercicios_user_idx on public.ejercicios (user_id);
create index if not exists plantillas_user_idx on public.plantillas (user_id);
create index if not exists programas_user_idx on public.programas (user_id);

do $$
declare t text;
begin
  foreach t in array array['ejercicios', 'plantillas', 'programas'] loop
    execute format('drop trigger if exists tocar_updated_at on public.%I', t);
    execute format(
      'create trigger tocar_updated_at before update on public.%I for each row execute function public.tocar_updated_at()',
      t
    );
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

-- Ejercicios usados en sesiones realizadas, con su frecuencia (útil para agentes y reportes).
create or replace view public.v_ejercicios_realizados with (security_invoker = true) as
select
  s.paciente_id,
  p.nombre as paciente,
  s.fecha,
  e ->> 'nombre' as ejercicio,
  e ->> 'ejercicioId' as ejercicio_id,
  e ->> 'series' as series,
  e ->> 'repeticiones' as repeticiones,
  e ->> 'carga' as carga
from public.sesiones s
join public.pacientes p on p.id = s.paciente_id
cross join lateral jsonb_array_elements(coalesce(s.data -> 'planificacion' -> 'ejercicios', '[]'::jsonb)) e
where s.estado = 'realizada' and coalesce((e ->> 'realizado')::boolean, false);
