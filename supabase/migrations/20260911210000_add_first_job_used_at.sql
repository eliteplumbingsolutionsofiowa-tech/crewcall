alter table public.profiles
add column if not exists first_job_used_at timestamptz;

comment on column public.profiles.first_job_used_at is
'Timestamp when this company permanently consumed its one free CrewCall job posting.';

update public.profiles as p
set first_job_used_at = existing_jobs.first_job_at
from (
  select
    company_id,
    min(created_at) as first_job_at
  from public.jobs
  where coalesce(is_test, false) = false
  group by company_id
) as existing_jobs
where p.id = existing_jobs.company_id
  and p.first_job_used_at is null;
