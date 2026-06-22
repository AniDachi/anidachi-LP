-- Canonicalize AniDachi subscription plan codes.
--
-- Bridge window:
-- - old writes are still accepted so existing deployed clients do not break;
-- - existing rows are backfilled to canonical values;
-- - new app code writes only free/plus/pro.

alter table public.users
  drop constraint if exists users_plan_check;

alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

alter table public.users
  alter column plan set default 'free';

update public.users
set plan = case plan
  when 'watcher' then 'free'
  when 'nakama' then 'plus'
  when 'junkie' then 'pro'
  else plan
end
where plan in ('watcher', 'nakama', 'junkie');

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_code_check;

alter table public.subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

update public.subscriptions
set plan_code = case plan_code
  when 'watcher' then 'free'
  when 'nakama' then 'plus'
  when 'junkie' then 'pro'
  else plan_code
end
where plan_code in ('watcher', 'nakama', 'junkie');

alter table public.rooms
  drop constraint if exists rooms_host_plan_code_check;

alter table public.rooms
  add constraint rooms_host_plan_code_check
  check (host_plan_code in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie'));

alter table public.rooms
  alter column host_plan_code set default 'free';

update public.rooms
set host_plan_code = case host_plan_code
  when 'watcher' then 'free'
  when 'nakama' then 'plus'
  when 'junkie' then 'pro'
  else host_plan_code
end
where host_plan_code in ('watcher', 'nakama', 'junkie');
