# Real Estate CRM (Phase 1 to Phase 5 Implementation)

This repository includes a Next.js + Supabase implementation across all planned phases from `real estate crm only.md`.

## What is implemented
- Company admin signup (`/signup`)
- Invite-only employee onboarding (`/invite/accept`)
- Protected dashboard shell (`/dashboard`)
- Users management (`/users`) with role/status/manager updates
- Leads list/create (`/leads`) and lead detail workflow (`/leads/[id]`)
- Follow-up task view (`/follow-ups`) with status updates
- Site visit view (`/site-visits`) with status updates
- Deal capture from lead detail for conversion tracking
- Reports module (`/reports`) with CSV export
- Notifications module (`/notifications`)
- Import engine (`/imports`) for CSV/XLSX with mapping + duplicate handling + job logs
- Activity logs (`/activity-logs`) for audit trail
- Automation endpoint (`POST /api/automation/reminders`) and health endpoint (`GET /api/health`)
- Supabase migrations for phases 1-5 RBAC/tenancy/core/reporting/import/audit tables

## Local setup
1. Install dependencies:
   - `npm install`
2. Copy env file:
   - `copy .env.example .env.local`
3. Fill real Supabase values in `.env.local` (including `CRON_SECRET` for reminder automation).
4. Run database migration + seed in Supabase SQL editor:
   - `supabase/migrations/202603060001_phase1_init.sql`
   - `supabase/migrations/202603060002_phase2_core_modules.sql`
   - `supabase/migrations/202603060003_phase3_to_phase5_features.sql`
   - `supabase/migrations/202603060004_performance_indexes.sql`
   - `supabase/seed/phase1_seed.sql` (optional re-seed)
5. Start app:
   - `npm run dev`

## Verification
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`

## Notes
- `sparkle_dashboard/` remains as the original static design reference.
- Service role key is used only in server routes for privileged actions.
- For production hardening and deployment checks, see `docs/production-readiness.md`.
