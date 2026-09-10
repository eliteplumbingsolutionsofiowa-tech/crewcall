alter table public.jobs
add column if not exists is_test boolean not null default false;

update public.jobs
set is_test = true
where id in (
  'b50aa28c-4faa-40dc-a852-8300309918c0',
  'abde3af5-b6d5-41c6-ba8d-b72bd0b78a49',
  'e3f05fde-f699-4659-97c9-ce2d17019406',
  '7feee694-54f2-4354-a5e0-bed1d73c713d',
  'cab4eac5-0976-4dd4-a032-076b1137aa90',
  '5b5f73f6-5dbd-4802-929a-749c20fc0f75',
  '930ee206-7e1a-4f7a-9cdb-ad814e780f2e',
  '6b807d9a-9849-435c-ad59-cfd2a3cf3f49',
  '4d88483c-97af-4dee-af98-a33cdd0683c4'
);

create index if not exists jobs_is_test_idx
on public.jobs (is_test);
