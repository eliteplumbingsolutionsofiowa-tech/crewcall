alter table public.subscriptions
drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
add constraint subscriptions_plan_check
check (
  plan in (
    'starter',
    'pro',
    'enterprise',
    'founding_member',
    'worker_pro',
    'worker_membership'
  )
);
