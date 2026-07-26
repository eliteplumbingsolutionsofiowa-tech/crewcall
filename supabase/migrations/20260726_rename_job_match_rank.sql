do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'job_matches'
      and column_name = 'rank'
  ) then
    alter table public.job_matches
      rename column rank to match_rank;
  end if;
end
$$;

create index if not exists job_matches_job_match_rank_idx
  on public.job_matches (job_id, match_rank);

comment on column public.job_matches.match_rank is
  'Worker ranking position for a specific job match.';
