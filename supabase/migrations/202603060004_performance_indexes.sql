create index if not exists idx_leads_company_created_at
on public.leads(company_id, created_at desc);

create index if not exists idx_leads_company_stage
on public.leads(company_id, pipeline_stage);

create index if not exists idx_leads_company_score_bucket
on public.leads(company_id, score_bucket);

create index if not exists idx_follow_ups_company_status_due
on public.follow_ups(company_id, status, due_at);

create index if not exists idx_site_visits_company_visit_date
on public.site_visits(company_id, visit_date);

create index if not exists idx_notifications_company_user_read_created
on public.notifications(company_id, user_profile_id, is_read, created_at desc);
