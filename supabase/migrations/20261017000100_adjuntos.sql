-- Adjuntos: metadatos en la tabla `adjuntos` y archivos en el bucket privado `adjuntos`
-- de Supabase Storage, bajo la carpeta <user_id>/<paciente_id>/.

create table if not exists public.adjuntos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  paciente_id uuid generated always as ((data ->> 'pacienteId')::uuid) stored,
  fecha text generated always as (data ->> 'fecha') stored,
  categoria text generated always as (data ->> 'categoria') stored,
  updated_at timestamptz not null default now()
);

create index if not exists adjuntos_paciente_idx on public.adjuntos (paciente_id);

drop trigger if exists tocar_updated_at on public.adjuntos;
create trigger tocar_updated_at before update on public.adjuntos
  for each row execute function public.tocar_updated_at();

alter table public.adjuntos enable row level security;
drop policy if exists "propietario" on public.adjuntos;
create policy "propietario" on public.adjuntos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Bucket privado (25 MB por archivo).
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Cada usuario solo accede a archivos dentro de su carpeta <user_id>/...
drop policy if exists "adjuntos: leer propios" on storage.objects;
create policy "adjuntos: leer propios" on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "adjuntos: subir propios" on storage.objects;
create policy "adjuntos: subir propios" on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "adjuntos: modificar propios" on storage.objects;
create policy "adjuntos: modificar propios" on storage.objects for update to authenticated
  using (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "adjuntos: borrar propios" on storage.objects;
create policy "adjuntos: borrar propios" on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and (storage.foldername(name))[1] = (select auth.uid())::text);
