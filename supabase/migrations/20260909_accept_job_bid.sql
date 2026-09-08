-- CrewCall atomic Request Bids acceptance
--
-- Accepts one contractor bid and declines all remaining
-- pending bids in the same database transaction.
--
-- Authorization remains in the CrewCall API.
-- This function is executable only by service_role.

create or replace function public.accept_job_bid(
  p_job_id uuid,
  p_bid_id uuid
)
returns public.job_bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_bid public.job_bids%rowtype;
begin
  -- Lock the project row so competing accept operations
  -- for the same project are serialized.
  select *
  into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  if v_job.job_type <> 'bid_request' then
    raise exception 'NOT_BID_REQUEST';
  end if;

  if v_job.status <> 'open' then
    raise exception 'PROJECT_NOT_OPEN';
  end if;

  select *
  into v_bid
  from public.job_bids
  where id = p_bid_id
    and job_id = p_job_id
  for update;

  if not found then
    raise exception 'BID_NOT_FOUND';
  end if;

  if v_bid.status <> 'pending' then
    raise exception 'BID_NOT_PENDING';
  end if;

  if exists (
    select 1
    from public.job_bids
    where job_id = p_job_id
      and status = 'accepted'
      and id <> p_bid_id
  ) then
    raise exception 'BID_ALREADY_ACCEPTED';
  end if;

  update public.job_bids
  set
    status = 'accepted',
    updated_at = now()
  where id = p_bid_id
    and job_id = p_job_id
    and status = 'pending'
  returning *
  into v_bid;

  if not found then
    raise exception 'BID_NOT_PENDING';
  end if;

  update public.job_bids
  set
    status = 'declined',
    updated_at = now()
  where job_id = p_job_id
    and id <> p_bid_id
    and status = 'pending';

  return v_bid;
end;
$$;

revoke all
on function public.accept_job_bid(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.accept_job_bid(uuid, uuid)
to service_role;
