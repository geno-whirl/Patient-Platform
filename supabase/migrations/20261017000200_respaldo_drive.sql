-- Respaldo automático en Google Drive.
--
-- * `respaldos_drive`: estado visible para el usuario (una fila por usuario).
-- * El refresh token de Google se guarda cifrado en Supabase Vault y solo lo
--   pueden leer las Edge Functions (service_role) mediante funciones privilegiadas.
-- * pg_cron llama cada hora a la Edge Function `drive-respaldo`, que respalda a
--   quienes les toca según su frecuencia. La URL del proyecto y el secreto del cron
--   se leen de Vault (ver README: secretos `url_proyecto` y `secreto_cron`).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.respaldos_drive (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  email_google text,
  carpeta_id text,
  carpeta_adjuntos_id text,
  frecuencia text not null default 'diaria' check (frecuencia in ('diaria', 'semanal', 'pausada')),
  ultimo_respaldo timestamptz,
  ultimo_estado text,
  ultimo_archivo text,
  -- id de adjunto → id del archivo en Drive (para no volver a subirlo)
  adjuntos_subidos jsonb not null default '{}'::jsonb,
  conectado_en timestamptz not null default now()
);

alter table public.respaldos_drive enable row level security;

drop policy if exists "leer propio" on public.respaldos_drive;
create policy "leer propio" on public.respaldos_drive for select to authenticated
  using (user_id = (select auth.uid()));

-- El usuario solo puede cambiar la frecuencia; el resto lo escriben las Edge Functions.
revoke update on public.respaldos_drive from authenticated;
grant update (frecuencia) on public.respaldos_drive to authenticated;
drop policy if exists "cambiar frecuencia" on public.respaldos_drive;
create policy "cambiar frecuencia" on public.respaldos_drive for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke insert, delete on public.respaldos_drive from authenticated, anon;

-- ───────── Token de Google en Vault (solo service_role) ─────────

create or replace function public.drive_guardar_token(p_user uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := 'drive_refresh_' || p_user::text;
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_nombre;
  if v_id is null then
    perform vault.create_secret(p_token, v_nombre, 'Refresh token de Google Drive');
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end $$;

create or replace function public.drive_leer_token(p_user uuid) returns text
language sql security definer set search_path = '' stable as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'drive_refresh_' || p_user::text;
$$;

create or replace function public.drive_borrar_token(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from vault.secrets where name = 'drive_refresh_' || p_user::text;
$$;

/** Usuarios a los que les toca respaldo (según frecuencia y último respaldo). */
create or replace function public.drive_respaldos_pendientes() returns setof uuid
language sql security definer set search_path = '' stable as $$
  select user_id from public.respaldos_drive
  where frecuencia <> 'pausada'
    and (
      ultimo_respaldo is null
      or (frecuencia = 'diaria' and ultimo_respaldo < now() - interval '23 hours')
      or (frecuencia = 'semanal' and ultimo_respaldo < now() - interval '7 days' + interval '1 hour')
    );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'drive_guardar_token(uuid, text)', 'drive_leer_token(uuid)', 'drive_borrar_token(uuid)', 'drive_respaldos_pendientes()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Al borrar un usuario, borrar también su token.
create or replace function public.drive_limpiar_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where name = 'drive_refresh_' || old.user_id::text;
  return old;
end $$;

drop trigger if exists drive_limpiar_token on public.respaldos_drive;
create trigger drive_limpiar_token after delete on public.respaldos_drive
  for each row execute function public.drive_limpiar_token();

-- ───────── Tarea programada: cada hora revisa quién necesita respaldo ─────────

select cron.unschedule(jobid) from cron.job where jobname = 'respaldo-drive';
select cron.schedule(
  'respaldo-drive',
  '17 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_proyecto') || '/functions/v1/drive-respaldo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-secreto-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'secreto_cron')
    ),
    body := '{"modo":"programado"}'::jsonb,
    timeout_milliseconds := 300000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'url_proyecto');
  $$
);
