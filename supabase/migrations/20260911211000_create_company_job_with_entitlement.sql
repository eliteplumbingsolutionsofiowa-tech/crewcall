create or replace function public.create_company_job_with_entitlement(
  p_company_id uuid,
  p_title text,
  p_trade text,
  p_location text,
  p_pay_rate text,
  p_description text,
  p_job_type text,
  p_bid_deadline timestamptz default null,
  p_work_deadline date default null,
  p_bypass_membership boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_job_used_at timestamptz;
  v_has_paid_membership boolean := false;
  v_job_id uuid;
begin
  select first_job_used_at
  into v_first_job_used_at
  from public.profiles
  where id = p_company_id
  for update;

  if not found then
    raise exception 'COMPANY_PROFILE_NOT_FOUND';
  end if;

  if not p_bypass_membership then
    select exists (
      select 1
      from public.subscriptions
      where user_id = p_company_id
        and plan = 'founding_member'
        and stripe_subscription_id is not null
        and status in ('active', 'trialing')
    )
    into v_has_paid_membership;

    if v_first_job_used_at is not null
       and not v_has_paid_membership then
      raise exception 'COMPANY_MEMBERSHIP_REQUIRED';
    end if;
  end if;

  insert into public.jobs (
    company_id,
    title,
    trade,
    location,
    pay_rate,
    description,
    status,
    payment_status,
    job_type,
    bid_deadline,
    work_deadline,
    is_test
  )
  values (
    p_company_id,
    trim(p_title),
    trim(p_trade),
    trim(p_location),
    p_pay_rate,
    trim(p_description),
    'open',
    'unpaid',
    p_job_type,
    p_bid_deadline,
    p_work_deadline,
    false
  )
  returning id into v_job_id;

  if not p_bypass_membership
     and not v_has_paid_membership
     and v_first_job_used_at is null then
    update public.profiles
    set first_job_used_at = now()
    where id = p_company_id;
  end if;

  return v_job_id;
end;
$$;

revoke all on function public.create_company_job_with_entitlement(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  date,
  boolean
) from public, anon, authenticated;

grant execute on function public.create_company_job_with_entitlement(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  date,
  boolean
) to service_role;
