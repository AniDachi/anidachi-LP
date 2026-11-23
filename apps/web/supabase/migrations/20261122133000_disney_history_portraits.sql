begin;

-- The extra field belongs to an existing personal history row. Normal playback
-- checkpoints never write it; deleting the history removes the artwork with it.
alter table public.watch_episode_progress add column disney_portrait_url text;
create index watch_episode_disney_portraits on public.watch_episode_progress
  (user_id, history_generation, title_key) where disney_portrait_url is not null;

create function public.save_disney_history_portraits_v1(
  p_user_id uuid, p_generation bigint, p_epoch bigint, p_cards jsonb
) returns text[] language plpgsql security invoker set search_path = '' as $$
declare
  access jsonb; card jsonb; existing public.watch_episode_progress%rowtype; saved text[] := '{}';
begin
  access := public.check_personal_history_operation_v1(p_user_id, 'personal')->'access';
  if (access->>'accountGeneration')::bigint is distinct from p_generation
    or (access->>'accessEpoch')::bigint is distinct from p_epoch then
    raise exception 'HISTORY_ACCESS_CHANGED';
  end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) > 40 then
    raise exception 'invalid portrait batch';
  end if;
  for card in select value from jsonb_array_elements(p_cards) order by value->>'key' loop
    if coalesce(card->>'key','') !~ '^disneyplus:(movie|series):[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      or length(card->>'url') > 2048
      or coalesce(card->>'url','') !~ '^https://disney[.]images[.]edge[.]bamgrid[.]com/ripcut-delivery/v2/variant/disney/([a-fA-F0-9]{64}|[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})/compose[?]format=webp&label=standard_art_vertical(_[a-z0-9-]+)*_[0-9]{3}&width=800$' then
      raise exception 'invalid Disney portrait';
    end if;
    select p.* into existing from public.watch_episode_progress p
      where p.user_id = p_user_id and p.history_generation = p_generation
        and p.provider = 'disneyplus' and p.title_key = card->>'key'
      order by (p.disney_portrait_url is not null) desc, p.episode_key limit 1 for update;
    if found then
      if existing.disney_portrait_url is distinct from card->>'url' then
        update public.watch_episode_progress set disney_portrait_url = card->>'url'
          where user_id = p_user_id and history_generation = p_generation and provider = 'disneyplus'
            and title_key = existing.title_key and episode_key = existing.episode_key;
      end if;
      saved := array_append(saved, existing.title_key);
    end if;
  end loop;
  return saved;
end $$;

revoke all on function public.save_disney_history_portraits_v1(uuid,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.save_disney_history_portraits_v1(uuid,bigint,bigint,jsonb) to service_role;
commit;
