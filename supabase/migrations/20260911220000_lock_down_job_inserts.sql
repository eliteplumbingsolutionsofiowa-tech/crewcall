-- CrewCall First Job Free security hardening.
--
-- All new jobs must be created through the server-side
-- create_company_job_with_entitlement() RPC.
--
-- These legacy policies allowed authenticated clients to bypass
-- the new company posting entitlement rules.

drop policy if exists "Companies can insert own jobs"
on public.jobs;

drop policy if exists "Company team members can insert jobs"
on public.jobs;

-- Defense in depth: browsers should not insert directly into jobs.
revoke insert on table public.jobs from anon;
revoke insert on table public.jobs from authenticated;
