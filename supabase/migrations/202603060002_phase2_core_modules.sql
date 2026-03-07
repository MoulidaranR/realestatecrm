create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id),
  assigned_to uuid references public.user_profiles(id),
  full_name text not null,
  phone text not null,
  alternate_phone text,
  email citext,
  city text,
  preferred_location text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  property_type text,
  source text not null default 'manual',
  pipeline_stage text not null default 'new',
  lead_status text not null default 'open',
  score integer not null default 0,
  next_followup_at timestamptz,
  last_contacted_at timestamptz,
  notes_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_pipeline_stage_check check (
    pipeline_stage in (
      'new',
      'attempted',
      'contacted',
      'interested',
      'follow_up_due',
      'site_visit_planned',
      'visit_done',
      'negotiation',
      'booked',
      'lost'
    )
  ),
  constraint leads_status_check check (lead_status in ('open', 'won', 'lost', 'cold'))
);

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_user_id uuid not null references public.user_profiles(id),
  note_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_user_id uuid not null references public.user_profiles(id),
  due_at timestamptz not null,
  status text not null default 'pending',
  reminder_sent boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint follow_ups_status_check check (status in ('pending', 'completed', 'cancelled'))
);

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_sales_user_id uuid not null references public.user_profiles(id),
  visit_date timestamptz not null,
  visit_status text not null default 'scheduled',
  pickup_required boolean not null default false,
  outcome_note text,
  created_at timestamptz not null default now(),
  constraint site_visits_status_check check (
    visit_status in ('scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled')
  )
);

create index if not exists idx_leads_company_id on public.leads(company_id);
create index if not exists idx_leads_assigned_to on public.leads(assigned_to);
create index if not exists idx_leads_pipeline_stage on public.leads(pipeline_stage);
create index if not exists idx_follow_ups_company_due on public.follow_ups(company_id, due_at);
create index if not exists idx_follow_ups_assigned_user_id on public.follow_ups(assigned_user_id);
create index if not exists idx_site_visits_company_date on public.site_visits(company_id, visit_date);
create index if not exists idx_lead_notes_lead_id on public.lead_notes(lead_id);

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_access_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_role_key() = 'company_admin' then true
    when public.current_user_role_key() = 'manager' then (
      target_profile_id is null
      or exists (
        select 1
        from public.user_profiles up
        where up.id = target_profile_id
          and up.company_id = public.current_user_company_id()
          and (
            up.id = public.current_user_profile_id()
            or up.manager_user_id = public.current_user_profile_id()
          )
      )
    )
    else target_profile_id = public.current_user_profile_id()
  end;
$$;

create or replace function public.can_access_lead_row(
  lead_company_id uuid,
  lead_assigned_to uuid,
  lead_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    lead_company_id = public.current_user_company_id()
    and (
      public.current_user_role_key() = 'company_admin'
      or (
        public.current_user_role_key() = 'manager'
        and (
          lead_assigned_to is null
          or public.can_access_profile(lead_assigned_to)
          or public.can_access_profile(lead_created_by)
        )
      )
      or lead_assigned_to = public.current_user_profile_id()
      or lead_created_by = public.current_user_profile_id()
    )
  );
$$;

alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;
alter table public.follow_ups enable row level security;
alter table public.site_visits enable row level security;

drop policy if exists leads_select_scope on public.leads;
create policy leads_select_scope
on public.leads
for select
to authenticated
using (
  public.can_access_lead_row(company_id, assigned_to, created_by)
);

drop policy if exists leads_insert_scope on public.leads;
create policy leads_insert_scope
on public.leads
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and created_by = public.current_user_profile_id()
);

drop policy if exists leads_update_scope on public.leads;
create policy leads_update_scope
on public.leads
for update
to authenticated
using (
  public.can_access_lead_row(company_id, assigned_to, created_by)
)
with check (
  company_id = public.current_user_company_id()
);

drop policy if exists lead_notes_select_scope on public.lead_notes;
create policy lead_notes_select_scope
on public.lead_notes
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.can_access_lead_row(l.company_id, l.assigned_to, l.created_by)
  )
);

drop policy if exists lead_notes_insert_scope on public.lead_notes;
create policy lead_notes_insert_scope
on public.lead_notes
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and author_user_id = public.current_user_profile_id()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.can_access_lead_row(l.company_id, l.assigned_to, l.created_by)
  )
);

drop policy if exists follow_ups_select_scope on public.follow_ups;
create policy follow_ups_select_scope
on public.follow_ups
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or assigned_user_id = public.current_user_profile_id()
  )
);

drop policy if exists follow_ups_insert_scope on public.follow_ups;
create policy follow_ups_insert_scope
on public.follow_ups
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.can_access_lead_row(l.company_id, l.assigned_to, l.created_by)
  )
);

drop policy if exists follow_ups_update_scope on public.follow_ups;
create policy follow_ups_update_scope
on public.follow_ups
for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or assigned_user_id = public.current_user_profile_id()
  )
)
with check (
  company_id = public.current_user_company_id()
);

drop policy if exists site_visits_select_scope on public.site_visits;
create policy site_visits_select_scope
on public.site_visits
for select
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or assigned_sales_user_id = public.current_user_profile_id()
  )
);

drop policy if exists site_visits_insert_scope on public.site_visits;
create policy site_visits_insert_scope
on public.site_visits
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.can_access_lead_row(l.company_id, l.assigned_to, l.created_by)
  )
);

drop policy if exists site_visits_update_scope on public.site_visits;
create policy site_visits_update_scope
on public.site_visits
for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and (
    public.current_user_role_key() in ('company_admin', 'manager')
    or assigned_sales_user_id = public.current_user_profile_id()
  )
)
with check (
  company_id = public.current_user_company_id()
);

insert into public.permissions (permission_key, description)
values
  ('users.update_manager', 'Assign reporting manager'),
  ('leads.read', 'View leads'),
  ('leads.create', 'Create leads'),
  ('leads.update', 'Update lead details and notes'),
  ('leads.assign', 'Assign leads to users'),
  ('followups.read', 'View follow-up tasks'),
  ('followups.manage', 'Create and update follow-up tasks'),
  ('site_visits.read', 'View site visits'),
  ('site_visits.manage', 'Create and update site visits')
on conflict (permission_key) do update set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values
  ('company_admin', 'users.update_manager'),
  ('company_admin', 'leads.read'),
  ('company_admin', 'leads.create'),
  ('company_admin', 'leads.update'),
  ('company_admin', 'leads.assign'),
  ('company_admin', 'followups.read'),
  ('company_admin', 'followups.manage'),
  ('company_admin', 'site_visits.read'),
  ('company_admin', 'site_visits.manage'),
  ('manager', 'users.update_manager'),
  ('manager', 'leads.read'),
  ('manager', 'leads.create'),
  ('manager', 'leads.update'),
  ('manager', 'leads.assign'),
  ('manager', 'followups.read'),
  ('manager', 'followups.manage'),
  ('manager', 'site_visits.read'),
  ('manager', 'site_visits.manage'),
  ('telecaller', 'leads.read'),
  ('telecaller', 'leads.create'),
  ('telecaller', 'leads.update'),
  ('telecaller', 'followups.read'),
  ('telecaller', 'followups.manage'),
  ('telecaller', 'site_visits.read'),
  ('sales_executive', 'leads.read'),
  ('sales_executive', 'leads.update'),
  ('sales_executive', 'followups.read'),
  ('sales_executive', 'site_visits.read'),
  ('sales_executive', 'site_visits.manage')
on conflict (role_key, permission_key) do nothing;
