-- CrewCall no longer creates a default 14-day starter trial
-- when a new profile is created.
--
-- Companies now join free, receive their first job post free,
-- and upgrade to Company Pro only when they need continued
-- job-posting access.

drop trigger if exists create_subscription_after_profile
on public.profiles;

drop function if exists public.create_default_subscription();
