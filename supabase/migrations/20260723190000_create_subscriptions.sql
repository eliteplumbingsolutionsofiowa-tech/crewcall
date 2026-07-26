create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  plan text not null default 'starter'
    check (plan in ('starter', 'pro', 'enterprise')),

  status text not null default 'trial'
    check (
      status in (
        'trial',
        'active',
        'past_due',
        'canceled',
        'expired',
        'incomplete'
      )
    ),

  stripe_customer_id text,
  stripe_subscription_id text,

  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),

  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_user_id_unique unique (user_id),
  constraint subscriptions_stripe_customer_id_unique unique (stripe_customer_id),
  constraint subscriptions_stripe_subscription_id_unique unique (stripe_subscription_id)
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions(user_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions(status);

create index if not exists subscriptions_trial_ends_at_idx
  on public.subscriptions(trial_ends_at);

alter table public.subscriptions
enable row level security;

drop policy if exists "Users can view own subscription"
on public.subscriptions;

create policy "Users can view own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_subscription_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subscription_updated_at
on public.subscriptions;

create trigger set_subscription_updated_at
before update
on public.subscriptions
for each row
execute function public.set_subscription_updated_at();

create or replace function public.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    user_id,
    plan,
    status,
    trial_started_at,
    trial_ends_at
  )
  values (
    new.id,
    'starter',
    'trial',
    now(),
    now() + interval '14 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_subscription_after_profile
on public.profiles;

create trigger create_subscription_after_profile
after insert
on public.profiles
for each row
execute function public.create_default_subscription();

insert into public.subscriptions (
  user_id,
  plan,
  status,
  trial_started_at,
  trial_ends_at
)
select
  profiles.id,
  'starter',
  'trial',
  now(),
  now() + interval '14 days'
from public.profiles
where not exists (
  select 1
  from public.subscriptions
  where subscriptions.user_id = profiles.id
);
