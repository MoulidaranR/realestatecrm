create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  email citext,
  plan text not null default 'starter',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  role_key text primary key,
  role_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  permission_key text primary key,
  description text not null
);

create table if not exists public.role_permissions (
  role_key text not null references public.roles(role_key) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  primary key (role_key, permission_key)
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  email citext not null,
  phone text,
  role_key text not null references public.roles(role_key),
  manager_user_id uuid references public.user_profiles(id),
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  constraint user_profiles_status_check check (status in ('active', 'invited', 'disabled')),
  constraint user_profiles_company_email_unique unique (company_id, email)
);

create index if not exists idx_user_profiles_company_id on public.user_profiles(company_id);
create index if not exists idx_user_profiles_auth_user_id on public.user_profiles(auth_user_id);
create index if not exists idx_user_profiles_role_key on public.user_profiles(role_key);

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role_key
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

alter table public.companies enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists companies_select_same_company on public.companies;
create policy companies_select_same_company
on public.companies
for select
to authenticated
using (id = public.current_user_company_id());

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin
on public.companies
for update
to authenticated
using (
  id = public.current_user_company_id()
  and public.current_user_role_key() = 'company_admin'
)
with check (
  id = public.current_user_company_id()
  and public.current_user_role_key() = 'company_admin'
);

drop policy if exists user_profiles_select_same_company on public.user_profiles;
create policy user_profiles_select_same_company
on public.user_profiles
for select
to authenticated
using (company_id = public.current_user_company_id());

drop policy if exists user_profiles_update_scope on public.user_profiles;
create policy user_profiles_update_scope
on public.user_profiles
for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() = 'company_admin'
    or auth_user_id = auth.uid()
  )
)
with check (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() = 'company_admin'
    or auth_user_id = auth.uid()
  )
);

drop policy if exists roles_select_all on public.roles;
create policy roles_select_all
on public.roles
for select
to authenticated
using (true);

drop policy if exists permissions_select_all on public.permissions;
create policy permissions_select_all
on public.permissions
for select
to authenticated
using (true);

drop policy if exists role_permissions_select_all on public.role_permissions;
create policy role_permissions_select_all
on public.role_permissions
for select
to authenticated
using (true);

insert into public.roles (role_key, role_name)
values
  ('company_admin', 'Company Admin'),
  ('manager', 'Manager'),
  ('telecaller', 'Telecaller'),
  ('sales_executive', 'Sales Executive')
on conflict (role_key) do update set role_name = excluded.role_name;

insert into public.permissions (permission_key, description)
values
  ('dashboard.view', 'View dashboard'),
  ('users.read', 'View users in company'),
  ('users.invite', 'Invite users into company'),
  ('users.update_role', 'Update user role'),
  ('users.update_status', 'Update user status')
on conflict (permission_key) do update set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('company_admin', 'dashboard.view'),
  ('company_admin', 'users.read'),
  ('company_admin', 'users.invite'),
  ('company_admin', 'users.update_role'),
  ('company_admin', 'users.update_status'),
  ('manager', 'dashboard.view'),
  ('manager', 'users.read'),
  ('telecaller', 'dashboard.view'),
  ('sales_executive', 'dashboard.view')
on conflict (role_key, permission_key) do nothing;
