-- CrewCall Request Bids
-- Adds a second job mode while preserving all existing jobs as worker jobs.

alter table public.jobs
add column if not exists job_type text not null default 'worker_job';

alter table public.jobs
add column if not exists bid_deadline timestamptz;

alter table public.jobs
add column if not exists work_deadline date;

alter table public.jobs
drop constraint if exists jobs_job_type_check;

alter table public.jobs
add constraint jobs_job_type_check
check (job_type in ('worker_job', 'bid_request'));

create table if not exists public.job_bids (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null
    references public.jobs(id)
    on delete cascade,

  company_id uuid not null
    references public.profiles(id)
    on delete cascade,

  submitted_by uuid not null
    references public.profiles(id)
    on delete cascade,

  amount_cents bigint not null
    check (amount_cents > 0),

  availability text,
  estimated_duration text,
  note text,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'declined',
        'withdrawn'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (job_id, company_id)
);

create index if not exists job_bids_job_id_idx
  on public.job_bids(job_id);

create index if not exists job_bids_company_id_idx
  on public.job_bids(company_id);

create unique index if not exists job_bids_one_accepted_per_job_idx
  on public.job_bids(job_id)
  where status = 'accepted';

create index if not exists job_bids_status_idx
  on public.job_bids(status);

alter table public.job_bids
enable row level security;


-- Bid access is intentionally server/API only.
-- CrewCall API routes authenticate the user and resolve
-- the correct company through resolveCompanyContext.
-- No authenticated client policies are created here.
