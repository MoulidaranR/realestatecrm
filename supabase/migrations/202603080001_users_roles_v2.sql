-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: users_roles_v2
-- Adds: custom role support, per-user permission overrides, access_mode,
--       new permission keys for settings + roles management
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enhance roles table
alter table public.roles
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists description text not null default '',
  add column if not exists scope text not null default 'company'
    check (scope in ('own', 'team', 'company')),
  add column if not exists is_system boolean not null default false,
  add column if not exists is_protected boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Mark existing system roles
update public.roles set is_system = true, is_protected = false where role_key in ('company_admin', 'manager', 'sales_executive', 'telecaller', 'view_only');
update public.roles set is_protected = true where role_key = 'company_admin';

-- Add description to system roles
update public.roles set description = 'Full access to all modules, users, settings, and reports.' where role_key = 'company_admin';
update public.roles set description = 'Team oversight — leads, follow-ups, site visits, reports.' where role_key = 'manager';
update public.roles set description = 'Individual contributor — manage own leads and site visits.' where role_key = 'sales_executive';
update public.roles set description = 'Call-focused — create and manage own leads and follow-ups.' where role_key = 'telecaller';
update public.roles set description = 'Read-only access to assigned modules.' where role_key = 'view_only';

-- Add missing system role view_only if not present
insert into public.roles (role_key, role_name, description, is_system, is_protected)
values ('view_only', 'View Only', 'Read-only access to assigned modules.', true, false)
on conflict (role_key) do nothing;

-- 2. Add access_mode to user_profiles
alter table public.user_profiles
  add column if not exists access_mode text not null default 'role_only'
    check (access_mode in ('role_only', 'custom_override'));

-- 3. Create user_permission_overrides table
create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_profile_id, permission_key)
);

alter table public.user_permission_overrides enable row level security;

-- Company admins can manage overrides for their company users
create policy if not exists user_permission_overrides_admin_all
on public.user_permission_overrides
for all
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = user_permission_overrides.user_profile_id
      and up.company_id = public.current_user_company_id()
  )
  and public.current_user_role_key() = 'company_admin'
);

-- Users can read their own overrides
create policy if not exists user_permission_overrides_self_read
on public.user_permission_overrides
for select
to authenticated
using (
  user_profile_id = (
    select id from public.user_profiles where auth_user_id = auth.uid() limit 1
  )
);

create index if not exists idx_user_perm_overrides_user_profile_id
  on public.user_permission_overrides (user_profile_id);

-- 4. Seed new permission keys
insert into public.permissions (permission_key, description)
values
  ('settings.manage', 'Manage company settings, lead sources, and pipeline stages'),
  ('roles.manage',    'Create, edit, and delete roles and permissions'),
  ('users.manage',    'Full user management: create, archive, edit, assign permissions'),
  ('users.update_manager', 'Change reporting manager of a user'),
  ('leads.delete',    'Delete leads'),
  ('leads.export',    'Export leads to CSV'),
  ('followups.create','Create follow-up entries'),
  ('site_visits.create','Schedule new site visits'),
  ('activity_logs.view', 'View activity log')
on conflict (permission_key) do update set description = excluded.description;

-- 5. Seed new permissions into role_permissions for system roles

-- company_admin: all permissions
insert into public.role_permissions (role_key, permission_key)
select 'company_admin', permission_key from public.permissions
on conflict (role_key, permission_key) do nothing;

-- manager: most permissions except role management and user management
insert into public.role_permissions (role_key, permission_key)
values
  ('manager', 'users.read'),
  ('manager', 'users.update_manager'),
  ('manager', 'leads.read'),
  ('manager', 'leads.create'),
  ('manager', 'leads.update'),
  ('manager', 'leads.assign'),
  ('manager', 'leads.export'),
  ('manager', 'followups.read'),
  ('manager', 'followups.manage'),
  ('manager', 'followups.create'),
  ('manager', 'site_visits.read'),
  ('manager', 'site_visits.manage'),
  ('manager', 'site_visits.create'),
  ('manager', 'reports.view'),
  ('manager', 'reports.export'),
  ('manager', 'import.manage'),
  ('manager', 'notifications.read'),
  ('manager', 'notifications.manage'),
  ('manager', 'activity_logs.view')
on conflict (role_key, permission_key) do nothing;

-- sales_executive
insert into public.role_permissions (role_key, permission_key)
values
  ('sales_executive', 'leads.read'),
  ('sales_executive', 'leads.update'),
  ('sales_executive', 'leads.create'),
  ('sales_executive', 'followups.read'),
  ('sales_executive', 'followups.create'),
  ('sales_executive', 'site_visits.read'),
  ('sales_executive', 'site_visits.manage'),
  ('sales_executive', 'site_visits.create'),
  ('sales_executive', 'reports.view'),
  ('sales_executive', 'notifications.read')
on conflict (role_key, permission_key) do nothing;

-- telecaller
insert into public.role_permissions (role_key, permission_key)
values
  ('telecaller', 'leads.read'),
  ('telecaller', 'leads.create'),
  ('telecaller', 'leads.update'),
  ('telecaller', 'followups.read'),
  ('telecaller', 'followups.create'),
  ('telecaller', 'followups.manage'),
  ('telecaller', 'site_visits.read'),
  ('telecaller', 'notifications.read')
on conflict (role_key, permission_key) do nothing;

-- view_only
insert into public.role_permissions (role_key, permission_key)
values
  ('view_only', 'dashboard.view'),
  ('view_only', 'leads.read'),
  ('view_only', 'followups.read'),
  ('view_only', 'site_visits.read'),
  ('view_only', 'reports.view'),
  ('view_only', 'notifications.read'),
  ('view_only', 'activity_logs.view')
on conflict (role_key, permission_key) do nothing;

-- 6. RLS: allow admins to manage custom roles in their company
drop policy if exists roles_admin_manage on public.roles;
create policy roles_admin_manage
on public.roles
for all
to authenticated
using (
  company_id = public.current_user_company_id()
  or company_id is null -- system roles readable by all
);

drop policy if exists roles_select_all on public.roles;
create policy roles_select_all_v2
on public.roles
for select
to authenticated
using (
  company_id is null -- system roles
  or company_id = public.current_user_company_id() -- custom roles for this company
);

-- 7. Index for custom role lookup
create index if not exists idx_roles_company_id on public.roles(company_id);

-- 8. Trigger to keep updated_at fresh on roles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roles_updated_at on public.roles;
create trigger roles_updated_at
before update on public.roles
for each row execute function public.touch_updated_at();

drop trigger if exists user_perm_overrides_updated_at on public.user_permission_overrides;
create trigger user_perm_overrides_updated_at
before update on public.user_permission_overrides
for each row execute function public.touch_updated_at();
