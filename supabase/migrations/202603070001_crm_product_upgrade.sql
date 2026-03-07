insert into public.roles (role_key, role_name)
values
  ('view_only', 'View Only')
on conflict (role_key) do update set role_name = excluded.role_name;

update public.user_profiles
set role_key = 'sales_executive'
where role_key = 'telecaller';

alter table public.user_profiles
add column if not exists last_active_at timestamptz not null default now();

update public.user_profiles
set last_active_at = coalesce(last_active_at, created_at);

alter table public.leads
add column if not exists buying_purpose text,
add column if not exists source_platform text not null default 'manual',
add column if not exists source_campaign text,
add column if not exists captured_by uuid references public.user_profiles(id),
add column if not exists lead_priority text not null default 'warm',
add column if not exists bhk_preference text,
add column if not exists possession_timeline text,
add column if not exists financing_needed boolean not null default false,
add column if not exists loan_status text,
add column if not exists site_visit_interest boolean not null default false,
add column if not exists occupation text,
add column if not exists company_name text,
add column if not exists family_size integer,
add column if not exists preferred_contact_time text,
add column if not exists tags text[] not null default '{}'::text[],
add column if not exists requirements_summary text;

update public.leads
set captured_by = created_by
where captured_by is null;

alter table public.leads
alter column captured_by set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_buying_purpose_check'
  ) then
    alter table public.leads
    add constraint leads_buying_purpose_check
    check (buying_purpose is null or buying_purpose in ('self_use', 'investment'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_source_platform_check'
  ) then
    alter table public.leads
    add constraint leads_source_platform_check
    check (
      source_platform in (
        'manual',
        'website',
        '99acres',
        'magicbricks',
        'facebook',
        'instagram',
        'google_ads',
        'referral',
        'walk_in',
        'other'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_priority_check'
  ) then
    alter table public.leads
    add constraint leads_priority_check
    check (lead_priority in ('hot', 'warm', 'cold'));
  end if;
end $$;

alter table public.follow_ups
add column if not exists mode text not null default 'call',
add column if not exists purpose text,
add column if not exists outcome text,
add column if not exists priority text not null default 'medium',
add column if not exists next_followup_at timestamptz,
add column if not exists completed_at timestamptz;

alter table public.follow_ups
drop constraint if exists follow_ups_status_check;

alter table public.follow_ups
add constraint follow_ups_status_check check (status in ('pending', 'completed', 'missed', 'cancelled'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'follow_ups_mode_check'
  ) then
    alter table public.follow_ups
    add constraint follow_ups_mode_check
    check (mode in ('call', 'whatsapp', 'sms', 'email', 'meeting'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'follow_ups_priority_check'
  ) then
    alter table public.follow_ups
    add constraint follow_ups_priority_check
    check (priority in ('low', 'medium', 'high'));
  end if;
end $$;

alter table public.site_visits
add column if not exists project_name text,
add column if not exists location text,
add column if not exists pickup_address text,
add column if not exists outcome text,
add column if not exists notes text,
add column if not exists next_action text,
add column if not exists next_followup_at timestamptz;

alter table public.notifications
add column if not exists notification_type text not null default 'system',
add column if not exists entity_type text,
add column if not exists entity_id uuid,
add column if not exists action_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_type_check'
  ) then
    alter table public.notifications
    add constraint notifications_type_check
    check (
      notification_type in (
        'assignment',
        'reminder',
        'status_change',
        'user_management',
        'system'
      )
    );
  end if;
end $$;

alter table public.activity_logs
add column if not exists before_json jsonb not null default '{}'::jsonb,
add column if not exists after_json jsonb not null default '{}'::jsonb;

create index if not exists idx_user_profiles_company_last_active
on public.user_profiles(company_id, last_active_at desc);

create index if not exists idx_leads_company_source_platform
on public.leads(company_id, source_platform);

create index if not exists idx_leads_company_priority
on public.leads(company_id, lead_priority);

create index if not exists idx_follow_ups_company_priority_due
on public.follow_ups(company_id, priority, due_at);

create index if not exists idx_site_visits_company_status_date
on public.site_visits(company_id, visit_status, visit_date);

create index if not exists idx_notifications_company_read_created
on public.notifications(company_id, is_read, created_at desc);

insert into public.permissions (permission_key, description)
values
  ('users.read', 'View users in company'),
  ('users.invite', 'Invite users into company'),
  ('users.update_role', 'Update user role'),
  ('users.update_status', 'Update user status'),
  ('users.update_manager', 'Assign reporting manager')
on conflict (permission_key) do update set description = excluded.description;

delete from public.role_permissions
where permission_key in (
  'users.read',
  'users.invite',
  'users.update_role',
  'users.update_status',
  'users.update_manager'
)
and role_key <> 'company_admin';

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
