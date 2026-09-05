begin;

-- Historical membership is independent of the current regional catalog. The
-- extra lookup fetches one observed label per bounded visible/requested season,
-- including progress that arrives before the next catalog refresh.
create index if not exists watch_episode_progress_season_observed_v3_idx
  on public.watch_episode_progress
    (user_id, history_generation, provider, title_key, season_key,
     observed_at desc, episode_key collate "C");

create or replace function public.watch_catalog_read_v3(
  p_user_id uuid, p_generation bigint, p_provider text, p_title text,
  p_season_keys text[] default null
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with catalog as materialized (
    select c.accepted_title, c.projection,
      case when c.user_id is null then 'unavailable'
        else public.watch_catalog_state_v3(c.context,
          case when c.projection is not null then c.accepted_context end)
      end as state
    from (select 1) singleton
    left join public.watch_catalog_snapshots c
      on c.user_id = p_user_id and c.history_generation = p_generation
      and c.provider = p_provider and c.title_key = p_title
  ), requested as materialized (
    select distinct season_key from (
      (select p.season_key from public.watch_episode_progress p
        where p_season_keys is null and p.user_id = p_user_id
          and p.history_generation = p_generation and p.provider = p_provider
          and p.title_key = p_title
        order by p.observed_at desc, p.episode_key collate "C" limit 8)
      union all
      (select k from unnest(p_season_keys) k limit 50)
    ) keys
    where season_key is not null
  ), current_seasons as materialized (
    select s from catalog c cross join lateral jsonb_array_elements(c.projection->'seasons') s
    where c.state = 'complete'
  ), visible_seasons as (
    select s from current_seasons where s->>'seasonKey' in (select season_key from requested)
    union all
    select jsonb_build_object(
      'seasonKey', p.season_key, 'seasonTitle', coalesce(p.season_title, 'Observed episodes'),
      'seasonNumber', p.season_number, 'order', 0,
      'aggregate', jsonb_build_object('completedEpisodes', 0, 'availableEpisodes', 0, 'progress', 0),
      'nextEpisode', null)
    from requested k
    cross join lateral (
      select p.season_key, p.season_title, p.season_number
      from public.watch_episode_progress p
      where p.user_id = p_user_id and p.history_generation = p_generation
        and p.provider = p_provider and p.title_key = p_title and p.season_key = k.season_key
      order by p.observed_at desc, p.episode_key collate "C" limit 1
    ) p
    where (select state from catalog) = 'complete'
      and not exists (select 1 from current_seasons where s->>'seasonKey' = k.season_key)
  )
  select jsonb_build_object(
    'state', c.state,
    'title', case when c.state = 'complete' then c.accepted_title end,
    'aggregate', case when c.state = 'complete' then c.projection->'aggregate' end,
    'seasons', coalesce((select jsonb_agg(s order by (s->>'order')::bigint, s->>'seasonKey')
      from visible_seasons), '[]'::jsonb))
  from catalog c;
$$;

revoke all on function public.watch_catalog_read_v3(uuid,bigint,text,text,text[]) from public, anon, authenticated;
grant execute on function public.watch_catalog_read_v3(uuid,bigint,text,text,text[]) to service_role;

commit;
