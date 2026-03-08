alter table public.user_profiles
add column if not exists invited_by uuid references public.user_profiles(id),
add column if not exists invited_at timestamptz,
add column if not exists last_active_at timestamptz not null default now();

update public.user_profiles
set invited_at = coalesce(invited_at, created_at)
where status = 'invited'
  and invited_at is null;

update public.user_profiles
set last_active_at = coalesce(last_active_at, created_at)
where last_active_at is null;

create index if not exists idx_user_profiles_company_status
on public.user_profiles(company_id, status);

create index if not exists idx_user_profiles_invited_by
on public.user_profiles(invited_by);
