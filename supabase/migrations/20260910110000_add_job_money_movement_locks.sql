create or replace function public.claim_job_refund(
  p_job_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  select *
  into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    return false;
  end if;

  if v_job.job_type is distinct from 'worker_job' then
    return false;
  end if;

  if v_job.payment_status is distinct from 'paid' then
    return false;
  end if;

  if v_job.escrow_status is distinct from 'funded' then
    return false;
  end if;

  if v_job.stripe_transfer_id is not null then
    return false;
  end if;

  if v_job.payout_status in (
    'processing',
    'released',
    'refund_processing',
    'refunded'
  ) then
    return false;
  end if;

  update public.jobs
  set payout_status = 'refund_processing'
  where id = p_job_id;

  return true;
end;
$$;

create or replace function public.claim_job_payout(
  p_job_id uuid,
  p_company_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  select *
  into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    return false;
  end if;

  if v_job.company_id is distinct from p_company_id then
    return false;
  end if;

  if v_job.job_type is distinct from 'worker_job' then
    return false;
  end if;

  if v_job.status is distinct from 'completed' then
    return false;
  end if;

  if v_job.payment_status is distinct from 'paid' then
    return false;
  end if;

  if v_job.escrow_status is distinct from 'funded' then
    return false;
  end if;

  if v_job.stripe_transfer_id is not null then
    return false;
  end if;

  if v_job.payout_status in (
    'processing',
    'released',
    'refund_processing',
    'refunded'
  ) then
    return false;
  end if;

  update public.jobs
  set payout_status = 'processing'
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function public.claim_job_refund(uuid)
  from public, anon, authenticated;

revoke all on function public.claim_job_payout(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_job_refund(uuid)
  to service_role;

grant execute on function public.claim_job_payout(uuid, uuid)
  to service_role;
