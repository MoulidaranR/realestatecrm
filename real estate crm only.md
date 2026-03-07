# Spectre.md

## Project
Real Estate CRM SaaS for internal company use, built for a real estate business with the following default hierarchy:

- Company Admin
  - Manager
    - Telecaller
    - Sales Executive

The system must support invite-only onboarding, multi-tenant company isolation, role-based access, lead management, follow-ups, site visits, reporting, and bulk lead import from CSV/XLSX with field mapping.

---

## 1. Product Vision
Build a simple, fast, minimal real estate CRM that helps a company:

- capture and organize leads
- assign leads to staff
- track follow-ups and site visits
- monitor telecaller and sales performance
- manage permissions by role
- import large lead lists without manual entry
- operate securely in a multi-user, multi-role environment

This is a B2B internal-use SaaS, not a public marketplace.

---

## 2. Core Principles

- Minimal UI, operationally strong
- Fast lead handling
- Role-based visibility
- Multi-tenant data isolation by company
- Invite-only staff access
- Admin-controlled permissions
- Automation where useful, without making the app complex

---

## 3. Tech Stack

- Frontend: Next.js or React-based app
- Auth: Supabase Auth
- Database: Supabase Postgres
- Storage: Supabase Storage
- Realtime: Supabase Realtime for live lead/status updates
- Background jobs: Supabase Edge Functions / Cron for reminders and automation
- Deployment: Vercel for frontend, Supabase for backend

---

## 4. User Roles

### Default Roles
- company_admin
- manager
- telecaller
- sales_executive

### Future Roles
- custom_role (created by company admin)
- marketing_user
- finance_user
- data_entry_user

### Access Model
Each user is controlled by:

1. **Role** — job type
2. **Permission set** — actions allowed
3. **Scope** — own, team, or full company data

---

## 5. Auth and Onboarding

### Company Admin Onboarding
1. Company admin signs up
2. Company record is created
3. Admin user profile is created
4. Default role = `company_admin`
5. Admin lands in admin dashboard

### Team Member Onboarding
1. Admin creates employee from Users section
2. Employee invite is sent by email
3. Employee accepts invite and sets password
4. Employee logs in
5. Role-based dashboard opens

### Rules
- No open team-member signup
- Team members can only enter through invite flow
- Supabase Auth handles identity
- App database handles role, permissions, hierarchy, and company membership

---

## 6. Main Product Areas

### A. Admin Panel
Used by company admin and managers.

Modules:
- Dashboard
- Leads List
- Lead Details
- Follow-ups
- Site Visits
- Telecaller Report
- Users
- Roles & Permissions
- Reports
- Settings

### B. Staff CRM UI
Used by telecallers and sales executives.

Modules:
- Leads
- Pipeline
- Follow-ups
- Telecaller Dashboard
- Site Visits
- Reports

---

## 7. Feature Map and Connections

### Leads
Central object of the system.
Connected to:
- assigned user
- pipeline stage
- follow-ups
- site visits
- notes
- reports
- deal conversion
- import jobs

### Pipeline
Lead stage engine.
Connected to:
- lead activity
- follow-up rules
- notifications
- scoring
- manager visibility

### Follow-ups
Task system for telecallers and managers.
Connected to:
- leads
- reminders
- dashboard counters
- overdue alerts
- telecaller performance

### Site Visits
Conversion stage after lead interest.
Connected to:
- leads
- sales executives
- visit schedules
- outcome tracking
- deal closure

### Reports
Analytics layer.
Connected to:
- users
- leads
- follow-ups
- site visits
- deal values
- response time
- source performance

### Users / Permissions
Access control layer.
Connected to every module via role, permission, and scope.

### Import Engine
Bulk lead upload system.
Connected to:
- leads
- duplicate checking
- source tagging
- import history
- saved templates

---

## 8. Admin Panel Requirements

### Dashboard
Must show:
- total leads
- new leads today
- pending follow-ups
- overdue follow-ups
- site visits today
- telecaller performance
- deal count
- total deal value
- conversion funnel summary

### Leads List
Must support:
- search
- filters
- source filter
- stage filter
- assigned user filter
- date range filter
- bulk actions
- import source visibility

### Lead Details
Must include:
- lead profile
- contact data
- assignment info
- notes timeline
- follow-ups
- site visits
- pipeline stage
- score and priority
- activity log

### Follow-ups
Must include:
- today
- overdue
- upcoming
- by assigned user
- completion status

### Site Visits
Must include:
- scheduled visits
- completed visits
- no-show
- rescheduled
- outcome note

### Telecaller Report
Must include:
- leads assigned
- leads contacted
- follow-ups completed
- overdue follow-ups
- interested leads
- site visits generated
- deals influenced

### Users
Must support:
- create user
- invite user
- suspend user
- assign role
- assign manager
- assign custom permissions

### Roles & Permissions
Must support:
- create custom role
- duplicate existing role
- attach permissions
- scope control

### Settings
Must support:
- company profile
- projects
- lead sources
- notification settings
- import templates

---

## 9. Staff CRM UI Requirements

### Leads
- only accessible based on role scope
- telecaller sees own assigned leads
- manager sees team leads
- admin sees all company leads

### Pipeline
Visual stage-based lead board with alerts and recommended next actions.

Default stages:
- New
- Attempted
- Contacted
- Interested
- Follow-up Due
- Site Visit Planned
- Visit Done
- Negotiation
- Booked
- Lost

### Follow-ups
- task-first interface
- today’s follow-ups
- overdue follow-ups
- quick note entry
- mark complete / reschedule

### Telecaller Dashboard
Must show:
- my new leads
- today’s tasks
- overdue follow-ups
- hot leads
- completion stats

### Site Visits
Must show:
- assigned visits
- upcoming visits
- completed visits
- outcome logging

### Reports
Show only permitted reports based on role.

---

## 10. Smart Automation Requirements

### Automatic Pipeline Updates
The system should automatically move leads based on actions.

Examples:
- new import -> `New`
- first unsuccessful call -> `Attempted`
- successful conversation -> `Contacted`
- interest captured -> `Interested`
- future follow-up exists -> `Follow-up Due`
- site visit created -> `Site Visit Planned`
- site visit done -> `Visit Done`
- booking amount entered -> `Booked`
- no response after defined threshold -> `Cold` or flagged for review
- explicit rejection -> `Lost`

### Lead Scoring
Create a simple scoring system.

Example weights:
- answered call = +10
- budget shared = +20
- preferred location shared = +15
- site visit booked = +30
- overdue follow-up = -10
- no activity for 14 days = -20

Buckets:
- Hot
- Warm
- Cold

### Smart Notifications
Notify users for:
- new lead assigned
- follow-up due soon
- follow-up overdue
- high-score lead untouched
- site visit tomorrow
- site visit rescheduled
- import completed
- duplicate detected during import

Notification channels:
- in-app
- email for invitations and important reminders
- WhatsApp/SMS later as optional extension

---

## 11. Bulk Lead Import Requirements

### Upload Types
- CSV
- XLSX

### Upload Flow
1. User uploads file
2. System reads headers
3. System shows column mapping UI
4. User maps file columns to CRM lead fields
5. Preview first rows
6. Validate required fields
7. Detect duplicates
8. Import rows
9. Show success/failure summary

### Mapping Requirements
Allow mapping of source columns to destination fields such as:
- full_name
- phone
- alternate_phone
- email
- city
- preferred_location
- budget_min
- budget_max
- property_type
- source
- notes

### Duplicate Handling Options
- skip duplicate
- update existing lead
- import anyway
- flag for manual review

### Import Enhancements
- save mapping template
- preview errors before final import
- downloadable failed-row report
- background processing for large files
- attach import source and uploader metadata to imported leads

---

## 12. Permission Model

### Permission Examples
- dashboard.view
- lead.view
- lead.create
- lead.edit
- lead.assign
- lead.delete
- followup.view
- followup.manage
- sitevisit.view
- sitevisit.manage
- report.view
- report.export
- user.view
- user.manage
- settings.manage
- import.manage

### Scope Types
- own
- team
- company

### Examples
- Telecaller: view/edit own leads and follow-ups
- Manager: view team leads, assign leads, view reports
- Company Admin: full company access

---

## 13. Data Model

### Core Tables
- companies
- user_profiles
- roles
- permissions
- role_permissions
- leads
- lead_notes
- follow_ups
- site_visits
- deals
- projects
- lead_sources
- notifications
- activity_logs
- import_jobs
- import_rows

### Recommended Fields

#### companies
- id
- name
- slug
- phone
- email
- plan
- status
- created_at

#### user_profiles
- id
- auth_user_id
- company_id
- full_name
- email
- phone
- role_key
- manager_user_id
- status
- created_at

#### leads
- id
- company_id
- created_by
- assigned_to
- project_id
- source_id
- full_name
- phone
- alternate_phone
- email
- city
- preferred_location
- budget_min
- budget_max
- property_type
- pipeline_stage
- lead_status
- score
- next_followup_at
- last_contacted_at
- notes_summary
- created_at
- updated_at

#### follow_ups
- id
- company_id
- lead_id
- assigned_user_id
- due_at
- status
- reminder_sent
- note
- created_at

#### site_visits
- id
- company_id
- lead_id
- assigned_sales_user_id
- visit_date
- visit_status
- pickup_required
- outcome_note
- created_at

#### deals
- id
- company_id
- lead_id
- sales_user_id
- deal_value
- booking_amount
- deal_status
- closed_at

#### import_jobs
- id
- company_id
- uploaded_by
- file_name
- file_url
- file_type
- mapping_json
- status
- total_rows
- success_rows
- failed_rows
- created_at

#### import_rows
- id
- import_job_id
- raw_data_json
- parsed_data_json
- row_status
- error_message

---

## 14. Security Requirements

### Multi-Tenancy
Every business table must contain `company_id`.

### RLS
Enable Row Level Security on all business tables.

Rules must ensure:
- users can only access their company data
- telecallers only access their own assigned records where applicable
- managers access team-scoped records
- company admins access all company records

### Security Rules
- never expose service role key in client
- enforce server-side permission checks for sensitive actions
- validate all file imports server-side
- restrict storage access by company
- audit critical actions
- rate limit auth and import flows

---

## 15. Audit and Activity Tracking

Log these actions:
- user invited
- role changed
- lead created
- lead assigned
- stage changed
- follow-up added/completed
- site visit scheduled/completed
- import job started/completed
- duplicate override action
- deal marked booked/closed

Every lead should have an activity timeline visible in UI.

---

## 16. UX Requirements

### Design Style
- clean
- minimal
- fast
- mobile-friendly where possible
- clear counters and task visibility

### UI Patterns
- table-heavy admin views
- task-oriented telecaller views
- card/timeline lead detail page
- simple import wizard
- role-based navigation visibility

### Performance Goals
- fast initial dashboard load
- responsive large lead lists with pagination
- background import processing for heavy files

---

## 17. Reporting Requirements

### Standard Reports
- leads by source
- leads by stage
- telecaller performance
- manager team performance
- follow-up completion rate
- overdue follow-up summary
- site visit conversion
- deals closed
- total deal value

### Filters
- date range
- project
- source
- assigned user
- role/team

---

## 18. MVP Scope

The first version must include:
- company admin signup
- invite-only employee onboarding
- users, roles, permissions
- admin dashboard
- leads list and lead details
- follow-ups
- site visits
- telecaller dashboard
- reports
- CSV/XLSX import with mapping
- automatic pipeline stage rules
- in-app notifications

---

## 19. Build Order

### Phase 1
- auth setup
- company onboarding
- user profiles
- roles and permissions
- basic dashboard shell

### Phase 2
- leads module
- lead detail page
- follow-ups
- site visits
- user management

### Phase 3
- reports
- pipeline automation
- scoring
- notifications

### Phase 4
- import engine
- mapping templates
- duplicate handling
- import logs

### Phase 5
- audit logs
- production hardening
- monitoring
- staging and deployment

---

## 20. Production Requirements

### Environments
- local
- staging
- production

### Deployment
- frontend on Vercel
- backend on Supabase

### Must Have Before Production
- migrations for schema changes
- environment secret separation
- error logging
- import job logs
- auth logs
- RLS verified in production
- backup plan
- monitoring and alerting

---

## 21. Future Expansion

- WhatsApp integration
- call logging
- campaign tracking
- branch support
- finance module
- document uploads
- mobile app
- AI-powered lead prioritization
- voice note / call summary integration

---

## 22. Final Product Goal
This CRM should become the operating system for a real estate company:

- Admin controls team and reports
- Managers assign and monitor work
- Telecallers manage follow-ups efficiently
- Sales executives handle site visits and conversion
- Leads move through a structured pipeline
- High-volume data can be imported and managed without chaos

The product must remain simple for daily users, while being strong enough to scale operationally and securely.

