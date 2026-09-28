set lock_timeout='5s';
set statement_timeout='30s';

-- Lock both policies before account/room authority. The definer only delegates
-- the shared row lock; runtime cannot edit the operator-controlled cutover.
create function public.lock_hosting_commercial_policy_v1()
returns public.hosting_commercial_policy language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype;
begin
 perform 1 from public.personal_history_policy where singleton for share;
 select * into strict policy from public.hosting_commercial_policy where singleton for share;
 return policy;
end $$;
revoke all on function public.lock_hosting_commercial_policy_v1() from public,anon,authenticated;
grant execute on function public.lock_hosting_commercial_policy_v1() to service_role;

create function public.require_room_hosting_access_v1(p_host_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype; authority jsonb;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if policy.activation_at is null or policy.activation_at>clock_timestamp() then return; end if;
 authority:=public.resolve_watch_history_access_v1(p_host_user_id);
 if authority#>>'{hosting,canHost}' is distinct from 'true' then
  raise exception 'HOST_SUBSCRIPTION_REQUIRED';
 end if;
end $$;
revoke all on function public.require_room_hosting_access_v1(uuid) from public,anon,authenticated;
grant execute on function public.require_room_hosting_access_v1(uuid) to service_role;

create function public.require_room_hosting_admission_v1(p_room_id text,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype; r public.rooms%rowtype; authority jsonb; account_id uuid;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if policy.activation_at is null or policy.activation_at>clock_timestamp() then return; end if;
 select * into r from public.rooms where room_id=p_room_id;
 if not found then return; end if; -- Existing core owns missing/ended/role errors.
 -- A guest needs no paid rights. Serialize both accounts in stable order so
 -- crossed host/guest admission cannot invert resolver account locks.
 for account_id in select distinct id from unnest(array[r.host_user_id,p_user_id]) ids(id) where id is not null order by id loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text,0));
 end loop;
 authority:=public.resolve_watch_history_access_v1(r.host_user_id);
 if r.host_plan_code='free' or r.media_closing_at is not null
  or authority#>>'{hosting,canHost}' is distinct from 'true'
  or (r.host_plan_code='pro' and authority->>'planCode'<>'pro') then
  raise exception 'HOST_SUBSCRIPTION_REQUIRED';
 end if;
end $$;
revoke all on function public.require_room_hosting_admission_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.require_room_hosting_admission_v1(text,uuid) to service_role;

-- Preserve the established input, source, quota, session and media negotiation
-- bodies. Guarded substitutions fail migration rather than patch unknown code.
do $$
declare body text; anchor text;
begin
 select pg_catalog.pg_get_functiondef('public.create_room_with_active_session_v3(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)'::regprocedure) into body;
 anchor:=' perform public.resolve_watch_history_access_v1(p_host_user_id);';
 if position(anchor in body)=0 then raise exception 'unexpected create v3 authority'; end if;
 body:=replace(body,anchor,' perform public.require_room_hosting_access_v1(p_host_user_id);'||chr(10)||anchor);
 anchor:=' had_existing_room:=found;';
 if position(anchor in body)=0 then raise exception 'unexpected create v3 reuse'; end if;
 body:=replace(body,anchor,anchor||chr(10)||' if had_existing_room then perform public.require_room_hosting_admission_v1(existing_room.room_id,p_host_user_id); end if;');
 execute body;

 select pg_catalog.pg_get_functiondef('anidachi_room_private.claim_active_room_session_v1(uuid,text,text,text)'::regprocedure) into body;
 anchor:=chr(10)||'begin'||chr(10);
 if position(anchor in body)=0 then raise exception 'unexpected claim core'; end if;
 body:=replace(body,anchor,anchor||'  perform public.require_room_hosting_admission_v1(p_room_id,p_user_id);'||chr(10));
 execute body;

 select pg_catalog.pg_get_functiondef('public.renew_room_media_lease_v2(text)'::regprocedure) into body;
 anchor:='declare r public.rooms%rowtype;';
 if position(anchor in body)=0 then raise exception 'unexpected renewal variables'; end if;
 body:=replace(body,anchor,'declare hosting_policy public.hosting_commercial_policy%rowtype; closing_deadline timestamptz; r public.rooms%rowtype;');
 body:=replace(body,chr(10)||'begin'||chr(10),chr(10)||'begin'||chr(10)||' hosting_policy:=public.lock_hosting_commercial_policy_v1();'||chr(10));
 anchor:=' if r.status=''ended'' then raise exception ''ROOM_ENDED''; end if;';
 if position(anchor in body)=0 then raise exception 'unexpected renewal status guard'; end if;
 body:=replace(body,anchor,anchor||$patch$
 if hosting_policy.activation_at is not null and hosting_policy.activation_at<=clock_timestamp()
  and (r.host_plan_code='free' or authority#>>'{hosting,canHost}' is distinct from 'true'
   or (r.host_plan_code='pro' and authority->>'planCode'<>'pro')) then
  closing_deadline:=case when r.host_plan_code='free' then hosting_policy.activation_at
   else clock_timestamp()+interval '5 minutes' end;
  closing_deadline:=least(r.media_closing_at,closing_deadline);
  update public.rooms set media_closing_at=closing_deadline where room_id=p_room_id;
  return pg_catalog.jsonb_build_object('denied',true,'closingAt',closing_deadline);
 end if;
$patch$);
 execute body;
end $$;

-- Insertion boundary: a long-running create must not rely only on a pre-T check.
create function public.enforce_room_hosting_insert_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if policy.activation_at is not null and policy.activation_at<=clock_timestamp() then
  perform public.require_room_hosting_access_v1(new.host_user_id);
  if new.host_plan_code not in ('plus','pro') then raise exception 'HOST_SUBSCRIPTION_REQUIRED'; end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_room_hosting_insert_v1() from public,anon,authenticated,service_role;
create trigger enforce_room_hosting_insert before insert on public.rooms
for each row execute function public.enforce_room_hosting_insert_v1();

reset lock_timeout;
reset statement_timeout;
