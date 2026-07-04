alter table profiles
add column if not exists bio text,
add column if not exists availability_status text default 'available',
add column if not exists travel_radius integer,
add column if not exists expected_pay_min integer,
add column if not exists expected_pay_max integer,
add column if not exists crewcall_score integer default 80,
add column if not exists skills text[],
add column if not exists osha10 boolean default false,
add column if not exists osha30 boolean default false,
add column if not exists med_gas boolean default false,
add column if not exists background_verified boolean default false,
add column if not exists drug_tested boolean default false,
add column if not exists license_number text,
add column if not exists preferred_work text[],
add column if not exists willing_to_travel boolean default false;

update profiles
set crewcall_score = 80
where crewcall_score is null;
