create table if not exists public.payment_release_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  company_id uuid references public.profiles(id) on delete set null,
  authorized_by uuid references public.profiles(id) on delete set null,
  worker_id uuid references public.profiles(id) on delete set null,

  gross_amount_cents bigint not null check (gross_amount_cents > 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  worker_payout_cents bigint not null check (worker_payout_cents > 0),

  acknowledgment_version text not null,
  acknowledgment_text text not null,

  authorized_at timestamptz not null default now(),
  stripe_transfer_id text,

  created_at timestamptz not null default now(),

  unique(job_id)
);

create index if not exists
  payment_release_ack_job_idx
  on public.payment_release_acknowledgments(job_id);

create index if not exists
  payment_release_ack_authorized_by_idx
  on public.payment_release_acknowledgments(authorized_by);

alter table public.payment_release_acknowledgments
  enable row level security;

revoke all on table public.payment_release_acknowledgments
  from anon, authenticated;

grant all on table public.payment_release_acknowledgments
  to service_role;
