# Production Readiness Checklist

## Environments
- Local: developer workstation with `.env.local`
- Staging: separate Supabase project + frontend deployment
- Production: separate Supabase project + frontend deployment

## Database
- Apply migrations in order:
  - `supabase/migrations/202603060001_phase1_init.sql`
  - `supabase/migrations/202603060002_phase2_core_modules.sql`
  - `supabase/migrations/202603060003_phase3_to_phase5_features.sql`
- Validate RLS policies per role in staging.
- Validate backup strategy and restoration process.

## Secrets
- Ensure these are set in deployment environments:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

## Monitoring
- Configure platform logs for API errors.
- Run `/api/health` checks in monitoring.
- Schedule reminder automation by calling `POST /api/automation/reminders` with `Bearer CRON_SECRET`.

## Security
- Verify no service role key usage in client code.
- Verify invite-only onboarding and role checks.
- Validate import limits/rate limits at reverse proxy or platform edge.

## Final Staging Validation
- Admin, manager, telecaller, and sales executive role walkthrough.
- Leads lifecycle: create -> follow-up -> site visit -> deal.
- Import lifecycle: CSV and XLSX import with duplicate modes.
- Reports export and notification read flow.
- Activity log visibility and correctness.
