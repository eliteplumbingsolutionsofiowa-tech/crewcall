-- CrewCall secured funds protection
--
-- Once payment activity begins, ordinary authenticated client requests
-- cannot modify the fields that determine the worker's secured
-- entitlement or delete the job.
--
-- Trusted CrewCall server routes use the service role and remain
-- able to advance the legitimate funding, completion, and payout workflow.

create or replace function public.protect_secured_job_funds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text;
begin
  request_role := coalesce(auth.role(), '');

  -- Trusted CrewCall server-side operations use service_role.
  if request_role = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  -- Prevent ordinary clients from deleting a job once payment
  -- is pending or fully secured.
  if tg_op = 'DELETE' then
    if old.payment_status in ('pending', 'paid') then
      raise exception
        'CrewCall secured funds protection: jobs with payment activity cannot be deleted.';
    end if;

    return old;
  end if;

  -- Prevent ordinary clients from changing protected job terms
  -- once payment activity has begun.
  if
    tg_op = 'UPDATE'
    and old.payment_status in ('pending', 'paid')
  then
    if
      new.status is distinct from old.status
      or new.payment_status is distinct from old.payment_status
      or new.payout_status is distinct from old.payout_status
      or new.assigned_worker_id is distinct from old.assigned_worker_id
      or new.assigned_application_id is distinct from old.assigned_application_id
      or new.company_id is distinct from old.company_id
      or new.pay_rate is distinct from old.pay_rate
    then
      raise exception
        'CrewCall secured funds protection: funded job terms are locked.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_secured_job_funds_update
on public.jobs;

create trigger protect_secured_job_funds_update
before update on public.jobs
for each row
execute function public.protect_secured_job_funds();

drop trigger if exists protect_secured_job_funds_delete
on public.jobs;

create trigger protect_secured_job_funds_delete
before delete on public.jobs
for each row
execute function public.protect_secured_job_funds();
