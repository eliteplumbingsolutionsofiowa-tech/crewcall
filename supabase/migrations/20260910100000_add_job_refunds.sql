create table if not exists public.job_refunds (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null
    references public.jobs(id)
    on delete restrict,

  company_id uuid
    references public.profiles(id)
    on delete set null,

  requested_by uuid
    references public.profiles(id)
    on delete set null,

  worker_id uuid
    references public.profiles(id)
    on delete set null,

  amount_cents bigint not null
    check (amount_cents > 0),

  stripe_payment_intent_id text not null,
  stripe_refund_id text,

  reason text,
  status text not null default 'processing'
    check (
      status in (
        'processing',
        'succeeded',
        'failed',
        'canceled'
      )
    ),

  requested_at timestamptz not null default now(),
  refunded_at timestamptz,
  failure_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(job_id)
);

create index if not exists
  job_refunds_job_idx
  on public.job_refunds(job_id);

create index if not exists
  job_refunds_company_idx
  on public.job_refunds(company_id);

create index if not exists
  job_refunds_requested_by_idx
  on public.job_refunds(requested_by);

create unique index if not exists
  job_refunds_stripe_refund_idx
  on public.job_refunds(stripe_refund_id)
  where stripe_refund_id is not null;

alter table public.job_refunds
  enable row level security;

revoke all on table public.job_refunds
  from anon, authenticated;

grant all on table public.job_refunds
  to service_role;
