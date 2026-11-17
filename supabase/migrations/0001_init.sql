-- =====================================================================
-- BIBLIOTECA AUDIOVISUAL COMERCIAL INMOBILIARIA
-- Esquema, reglas de seguridad (RLS), almacenamiento y tiempo real.
--
-- Cómo usarlo: copia todo este archivo en Supabase > SQL Editor y ejecútalo
-- una sola vez sobre un proyecto nuevo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Perfil de cada cuenta (rol y estado). Se crea solo al crear el usuario.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text        not null default '',
  full_name   text        not null default '',
  role        text        not null default 'comercial'
                check (role in ('admin', 'comercial')),
  -- Cuenta compartida por todo el equipo de ventas (un solo usuario general).
  is_shared   boolean     not null default false,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null check (length(trim(name)) > 0),
  description      text        not null default '',
  location         text        not null default '',
  status           text        not null default 'preventa'
                     check (status in ('preventa', 'en_construccion', 'entrega_inmediata', 'finalizado')),
  commercial_info  text        not null default '',
  -- Ruta de la portada dentro del bucket "materiales" (no el archivo en sí).
  cover_path       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  -- Se actualiza cuando cambia cualquier material o tipología del proyecto.
  last_activity_at timestamptz not null default now()
);

create table public.typologies (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  name        text        not null check (length(trim(name)) > 0),
  area_m2     numeric(8, 2) check (area_m2 is null or area_m2 >= 0),
  bedrooms    smallint      check (bedrooms is null or bedrooms >= 0),
  bathrooms   numeric(3, 1) check (bathrooms is null or bathrooms >= 0),
  description text        not null default '',
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table public.resources (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid        not null references public.projects (id) on delete cascade,
  typology_id  uuid        references public.typologies (id) on delete set null,
  category     text        not null
                 check (category in (
                   'brochures', 'renders_exteriores', 'renders_interiores', 'tipologias',
                   'planos', 'videos', 'fotografias', 'fichas_tecnicas',
                   'listas_precios', 'material_publicitario', 'otros')),
  name         text        not null check (length(trim(name)) > 0),
  -- 'file': archivo en Storage.  'link': enlace externo (YouTube, recorrido 360, etc.)
  kind         text        not null default 'file' check (kind in ('file', 'link')),
  storage_path text,
  thumb_path   text,
  file_name    text,
  mime_type    text,
  extension    text,
  size_bytes   bigint,
  external_url text,
  -- Aumenta sola cada vez que se reemplaza el archivo.
  version      integer     not null default 1,
  -- Identificador del enlace público para compartir con clientes.
  share_token  uuid        not null unique default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint resources_origin check (
    (kind = 'file' and storage_path is not null)
    or (kind = 'link' and external_url is not null)
  )
);

-- Historial de modificaciones. Solo lo escriben los triggers y el servidor.
create table public.activity_log (
  id           bigint generated always as identity primary key,
  action       text        not null check (action in ('created', 'updated', 'replaced', 'deleted')),
  entity_type  text        not null check (entity_type in ('project', 'typology', 'resource', 'user')),
  entity_id    uuid,
  entity_name  text        not null default '',
  project_id   uuid,
  project_name text,
  user_id      uuid,
  user_name    text        not null default '',
  details      text,
  created_at   timestamptz not null default now()
);

create index typologies_project_idx on public.typologies (project_id, sort_order);
create index resources_project_idx  on public.resources (project_id, category);
create index resources_typology_idx on public.resources (typology_id);
create index resources_updated_idx  on public.resources (updated_at desc);
create index activity_created_idx   on public.activity_log (created_at desc);
create index activity_project_idx   on public.activity_log (project_id);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE PERMISOS
-- ---------------------------------------------------------------------

create function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active
  );
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. ALTA AUTOMÁTICA DE PERFILES
--    * El primer usuario del sistema queda como administrador.
--    * Cualquier otro usuario nace INACTIVO y sin acceso. La pantalla
--      "Usuarios" (servidor, con la clave secreta) lo activa y le asigna su
--      rol al crearlo. Así, un auto-registro por la API pública no ve nada.
-- ---------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;

  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_first then 'admin' else 'comercial' end,
    v_first
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. TRIGGERS: sello de autoría, versión, actividad del proyecto e historial
--    pg_trigger_depth() > 1 identifica cambios hechos por otro trigger (por
--    ejemplo, marcar actividad en el proyecto): esos no se sellan ni registran.
-- ---------------------------------------------------------------------

create function public.stamp_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Al borrar una tipología, sus materiales solo quedan desvinculados:
  -- eso no cuenta como una modificación del material.
  if tg_op = 'UPDATE' and tg_table_name = 'resources' then
    if old.typology_id is not null and new.typology_id is null
       and not exists (select 1 from public.typologies t where t.id = old.typology_id) then
      return new;
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    if tg_table_name = 'resources' then
      new.share_token := old.share_token;
      if new.storage_path is distinct from old.storage_path
         or new.external_url is distinct from old.external_url then
        new.version := old.version + 1;
      else
        new.version := old.version;
      end if;
    end if;
  elsif tg_table_name = 'resources' then
    new.version := 1;
  end if;

  return new;
end;
$$;

create trigger projects_stamp   before insert or update on public.projects
  for each row execute function public.stamp_row();
create trigger typologies_stamp before insert or update on public.typologies
  for each row execute function public.stamp_row();
create trigger resources_stamp  before insert or update on public.resources
  for each row execute function public.stamp_row();

create function public.touch_project()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_project uuid;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'DELETE' then
    v_project := old.project_id;
  else
    v_project := new.project_id;
  end if;
  update public.projects set last_activity_at = now() where id = v_project;
  return null;
end;
$$;

create trigger typologies_touch after insert or update or delete on public.typologies
  for each row execute function public.touch_project();
create trigger resources_touch  after insert or update or delete on public.resources
  for each row execute function public.touch_project();

create function public.log_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j_new     jsonb;
  j_old     jsonb;
  j         jsonb;
  v_type    text;
  v_action  text;
  v_details text;
  v_project uuid;
  v_pname   text;
  v_uid     uuid := (select auth.uid());
  v_user    text;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op <> 'INSERT' then j_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then j_new := to_jsonb(new); end if;
  j := coalesce(j_new, j_old);

  v_type := case tg_table_name
    when 'projects'   then 'project'
    when 'typologies' then 'typology'
    else 'resource'
  end;

  if tg_op = 'INSERT' then
    v_action := 'created';
    if v_type = 'resource' then
      v_details := coalesce(j ->> 'file_name', j ->> 'external_url');
    end if;
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    if v_type = 'resource' then
      v_details := coalesce(j ->> 'file_name', j ->> 'external_url');
    end if;
  else
    -- Ignora actualizaciones que no cambian nada visible.
    if (j_new - 'updated_at' - 'updated_by' - 'last_activity_at')
       = (j_old - 'updated_at' - 'updated_by' - 'last_activity_at') then
      return null;
    end if;

    -- Desvinculación automática al borrar una tipología: no se registra.
    if v_type = 'resource'
       and (j_old ->> 'typology_id') is not null and (j_new ->> 'typology_id') is null
       and not exists (select 1 from public.typologies t
                       where t.id = (j_old ->> 'typology_id')::uuid) then
      return null;
    end if;

    v_action := 'updated';
    if v_type = 'resource' and (
         (j_new ->> 'storage_path') is distinct from (j_old ->> 'storage_path')
      or (j_new ->> 'external_url') is distinct from (j_old ->> 'external_url')) then
      v_action  := 'replaced';
      v_details := 'Versión ' || (j_old ->> 'version') || ' → ' || (j_new ->> 'version')
                   || ' · ' || coalesce(j_new ->> 'file_name', j_new ->> 'external_url', '');
    elsif (j_new ->> 'name') is distinct from (j_old ->> 'name') then
      v_details := 'Nombre anterior: ' || (j_old ->> 'name');
    elsif v_type = 'resource'
      and (j_new ->> 'category') is distinct from (j_old ->> 'category') then
      v_details := 'Categoría: ' || (j_old ->> 'category') || ' → ' || (j_new ->> 'category');
    elsif v_type = 'project'
      and (j_new ->> 'status') is distinct from (j_old ->> 'status') then
      v_details := 'Estado: ' || (j_old ->> 'status') || ' → ' || (j_new ->> 'status');
    end if;
  end if;

  if v_type = 'project' then
    v_project := (j ->> 'id')::uuid;
    v_pname   := j ->> 'name';
  else
    v_project := (j ->> 'project_id')::uuid;
    select p.name into v_pname from public.projects p where p.id = v_project;
    -- El proyecto ya no existe: es un borrado en cascada y basta con el
    -- registro "proyecto eliminado".
    if not found then
      return null;
    end if;
  end if;

  select coalesce(nullif(p.full_name, ''), p.email) into v_user
  from public.profiles p where p.id = v_uid;

  insert into public.activity_log
    (action, entity_type, entity_id, entity_name, project_id, project_name, user_id, user_name, details)
  values
    (v_action, v_type, (j ->> 'id')::uuid, coalesce(j ->> 'name', ''), v_project, v_pname,
     v_uid, coalesce(v_user, 'Sistema'), v_details);

  return null;
end;
$$;

create trigger projects_log   after insert or update or delete on public.projects
  for each row execute function public.log_activity();
create trigger typologies_log after insert or update or delete on public.typologies
  for each row execute function public.log_activity();
create trigger resources_log  after insert or update or delete on public.resources
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------
-- 5. SEGURIDAD A NIVEL DE FILA (RLS)
--    Lectura: cualquier usuario activo.  Escritura: solo administradores.
-- ---------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.projects     enable row level security;
alter table public.typologies   enable row level security;
alter table public.resources    enable row level security;
alter table public.activity_log enable row level security;

revoke all on public.profiles, public.projects, public.typologies,
              public.resources, public.activity_log from anon;

grant select on public.profiles, public.activity_log to authenticated;
grant select, insert, update, delete
  on public.projects, public.typologies, public.resources to authenticated;

-- El servidor (clave secreta) gestiona usuarios, historial y enlaces públicos.
grant all on public.profiles, public.projects, public.typologies,
             public.resources, public.activity_log to service_role;

-- Las funciones de trigger no se pueden llamar por la API.
revoke execute on function public.handle_new_user(), public.stamp_row(),
                           public.touch_project(), public.log_activity()
  from public, anon, authenticated;

-- Perfiles: cada quien ve el suyo; el administrador ve todos.
-- (Los cambios de perfil se hacen solo desde el servidor.)
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy projects_select on public.projects
  for select to authenticated using ((select public.is_active_user()));
create policy projects_insert on public.projects
  for insert to authenticated with check ((select public.is_admin()));
create policy projects_update on public.projects
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy projects_delete on public.projects
  for delete to authenticated using ((select public.is_admin()));

create policy typologies_select on public.typologies
  for select to authenticated using ((select public.is_active_user()));
create policy typologies_insert on public.typologies
  for insert to authenticated with check ((select public.is_admin()));
create policy typologies_update on public.typologies
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy typologies_delete on public.typologies
  for delete to authenticated using ((select public.is_admin()));

create policy resources_select on public.resources
  for select to authenticated using ((select public.is_active_user()));
create policy resources_insert on public.resources
  for insert to authenticated with check ((select public.is_admin()));
create policy resources_update on public.resources
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy resources_delete on public.resources
  for delete to authenticated using ((select public.is_admin()));

-- Historial: solo lectura y solo para administradores.
create policy activity_select on public.activity_log
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 6. ALMACENAMIENTO (Supabase Storage)
--    Bucket privado: los archivos se sirven con enlaces firmados temporales.
--    Estructura:  {proyecto}/{recurso}/{marca-de-tiempo}-{archivo}
--                 {proyecto}/{recurso}/thumb-{marca-de-tiempo}.webp
--                 {proyecto}/portada-{marca-de-tiempo}.webp
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', false)
on conflict (id) do nothing;

create policy materiales_select on storage.objects
  for select to authenticated
  using (bucket_id = 'materiales' and (select public.is_active_user()));
create policy materiales_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiales' and (select public.is_admin()));
create policy materiales_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materiales' and (select public.is_admin()))
  with check (bucket_id = 'materiales' and (select public.is_admin()));
create policy materiales_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiales' and (select public.is_admin()));

-- ---------------------------------------------------------------------
-- 7. TIEMPO REAL
-- ---------------------------------------------------------------------

alter publication supabase_realtime
  add table public.projects, public.typologies, public.resources, public.activity_log;
