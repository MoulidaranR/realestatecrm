alter table public.leads
add column if not exists score_bucket text not null default 'cold';

alter table public.leads
add column if not exists last_scored_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_score_bucket_check'
  ) then
    alter table public.leads
    add constraint leads_score_bucket_check check (score_bucket in ('hot', 'warm', 'cold'));
  end if;
end $$;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sales_user_id uuid not null references public.user_profiles(id),
  deal_value numeric(14,2) not null default 0,
  booking_amount numeric(14,2) not null default 0,
  deal_status text not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint deals_status_check check (deal_status in ('open', 'booked', 'closed', 'lost'))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  channel text not null default 'in_app',
  event_type text not null,
  title text not null,
  message text not null,
  payload_json jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_channel_check check (channel in ('in_app', 'email'))
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references public.user_profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  description text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  uploaded_by uuid not null references public.user_profiles(id),
  file_name text not null,
  file_type text not null,
  mapping_json jsonb not null default '{}'::jsonb,
  duplicate_handling text not null default 'skip',
  status text not null default 'queued',
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  failed_rows integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint import_jobs_file_type_check check (file_type in ('csv', 'xlsx')),
  constraint import_jobs_duplicate_handling_check check (
    duplicate_handling in ('skip', 'update_existing', 'import_anyway', 'manual_review')
  ),
  constraint import_jobs_status_check check (status in ('queued', 'processing', 'completed', 'failed'))
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  raw_data_json jsonb not null default '{}'::jsonb,
  parsed_data_json jsonb not null default '{}'::jsonb,
  row_status text not null default 'pending',
  error_message text,
  constraint import_rows_status_check check (row_status in ('pending', 'success', 'failed', 'duplicate'))
);

create table if not exists public.import_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id),
  template_name text not null,
  mapping_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint import_templates_company_name_unique unique (company_id, template_name)
);

create index if not exists idx_deals_company_id on public.deals(company_id);
create index if not exists idx_notifications_company_user on public.notifications(company_id, user_profile_id);
create index if not exists idx_activity_logs_company_created on public.activity_logs(company_id, created_at desc);
create index if not exists idx_import_jobs_company_created on public.import_jobs(company_id, created_at desc);
create index if not exists idx_import_rows_job_id on public.import_rows(import_job_id);
create index if not exists idx_import_templates_company_id on public.import_templates(company_id);

alter table public.deals enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;
alter table public.import_templates enable row level security;

drop policy if exists deals_select_scope on public.deals;
create policy deals_select_scope
on public.deals
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or sales_user_id = public.current_user_profile_id()
  )
);

drop policy if exists deals_write_scope on public.deals;
create policy deals_write_scope
on public.deals
for all
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or sales_user_id = public.current_user_profile_id()
  )
)
with check (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or sales_user_id = public.current_user_profile_id()
  )
);

drop policy if exists notifications_select_scope on public.notifications;
create policy notifications_select_scope
on public.notifications
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    user_profile_id = public.current_user_profile_id()
    or public.current_user_role_key() in ('company_admin', 'manager')
  )
);

drop policy if exists notifications_update_scope on public.notifications;
create policy notifications_update_scope
on public.notifications
for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    user_profile_id = public.current_user_profile_id()
    or public.current_user_role_key() in ('company_admin', 'manager')
  )
)
with check (
  company_id = public.current_user_company_id()
);

drop policy if exists activity_logs_select_scope on public.activity_logs;
create policy activity_logs_select_scope
on public.activity_logs
for select
to authenticated
using (
  company_id = public.current_user_company_id()
);

drop policy if exists import_jobs_manage_scope on public.import_jobs;
create policy import_jobs_manage_scope
on public.import_jobs
for all
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_role_key() in ('company_admin', 'manager')
)
with check (
  company_id = public.current_user_company_id()
  and public.current_user_role_key() in ('company_admin', 'manager')
);

drop policy if exists import_rows_manage_scope on public.import_rows;
create policy import_rows_manage_scope
on public.import_rows
for all
to authenticated
using (
  exists (
    select 1
    from public.import_jobs ij
    where ij.id = import_job_id
      and ij.company_id = public.current_user_company_id()
      and public.current_user_role_key() in ('company_admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.import_jobs ij
    where ij.id = import_job_id
      and ij.company_id = public.current_user_company_id()
      and public.current_user_role_key() in ('company_admin', 'manager')
  )
);

drop policy if exists import_templates_manage_scope on public.import_templates;
create policy import_templates_manage_scope
on public.import_templates
for all
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_role_key() in ('company_admin', 'manager')
)
with check (
  company_id = public.current_user_company_id()
  and public.current_user_role_key() in ('company_admin', 'manager')
);

insert into public.permissions (permission_key, description)
values
  ('reports.view', 'View company reports'),
  ('reports.export', 'Export reports'),
  ('import.manage', 'Manage lead imports'),
  ('notifications.read', 'Read notifications'),
  ('notifications.manage', 'Manage notifications'),
  ('activity_logs.view', 'View activity logs')
on conflict (permission_key) do update set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('company_admin', 'reports.view'),
  ('company_admin', 'reports.export'),
  ('company_admin', 'import.manage'),
  ('company_admin', 'notifications.read'),
  ('company_admin', 'notifications.manage'),
  ('company_admin', 'activity_logs.view'),
  ('manager', 'reports.view'),
  ('manager', 'reports.export'),
  ('manager', 'import.manage'),
  ('manager', 'notifications.read'),
  ('manager', 'notifications.manage'),
  ('manager', 'activity_logs.view'),
  ('telecaller', 'reports.view'),
  ('telecaller', 'notifications.read'),
  ('sales_executive', 'reports.view'),
  ('sales_executive', 'notifications.read')
on conflict (role_key, permission_key) do nothing;
