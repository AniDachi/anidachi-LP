create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

delete from public.users
where id in (
  '33333333-3333-4333-8333-333333333331'::uuid,
  '33333333-3333-4333-8333-333333333332'::uuid
);

insert into public.users (id, email, display_name)
values
  (
    '33333333-3333-4333-8333-333333333331',
    'watch-v2-bounds-owner@example.test',
    'Watch V2 Bounds Owner'
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    'watch-v2-bounds-other@example.test',
    'Watch V2 Bounds Other'
  );

create or replace function pg_temp.watch_v2_resource_event(
  event_id uuid,
  episode_key text,
  observed_at timestamptz,
  completed boolean default false,
  title_key text default 'bounded-title',
  provider text default 'crunchyroll',
  account_generation bigint default 1
)
returns jsonb
language sql
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'clientEventId', event_id,
    'clientSessionKey', 'bounded-session',
    'accountGeneration', account_generation,
    'provider', provider,
    'titleKey', title_key,
    'itemKind', 'series',
    'title', 'Bounded title',
    'artworkUrl', null,
    'episodeKey', episode_key,
    'episodeTitle', 'Episode ' || episode_key,
    'seasonKey', 'season-one',
    'seasonTitle', 'Season One',
    'seasonNumber', 1,
    'episodeNumber', pg_catalog.substring(episode_key, '[0-9]+$')::integer,
    'sourceUrl', case provider
      when 'youtube' then 'https://www.youtube.com/watch?v=' || episode_key
      else 'https://www.crunchyroll.com/watch/' || episode_key || '/demo'
    end,
    'currentTime', case when completed then 1200 else 300 end,
    'duration', 1200,
    'progress', case when completed then 1 else 0.25 end,
    'observedAt', observed_at,
    'kind', case when completed then 'ended' else 'heartbeat' end,
    'sharedRoom', null
  );
$$;

create or replace function pg_temp.watch_v2_explain_json(p_query text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
begin
  execute 'explain (format json, costs off) ' || p_query into plan;
  return plan;
end;
$$;

create or replace function pg_temp.watch_v2_patch_cursor(
  p_cursor text,
  p_patch jsonb
)
returns text
language sql
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.convert_to(
      (
        pg_catalog.convert_from(pg_catalog.decode(p_cursor, 'hex'), 'UTF8')::jsonb
        || p_patch
      )::text,
      'UTF8'
    ),
    'hex'
  );
$$;

select has_column(
  'public',
  'watch_history_title_summaries',
  'observed_episode_count',
  'title summaries store an exact observed episode count'
);
select has_column(
  'public',
  'watch_history_title_summaries',
  'completed_episode_count',
  'title summaries store an exact completed episode count'
);
select has_function(
  'public',
  'list_watch_history_v2_bounded_page',
  array['uuid', 'bigint', 'integer', 'timestamp with time zone', 'text'],
  'the additive bounded title-page RPC exists'
);
select has_function(
  'public',
  'list_watch_history_v2_title_episodes_page',
  array['uuid', 'bigint', 'text', 'text', 'integer', 'text'],
  'the additive bounded title-detail RPC exists'
);
select has_function(
  'public',
  'cleanup_watch_history_receipts_v2',
  array['integer'],
  'the bounded receipt-cleanup RPC exists'
);

select ok(
  (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.list_watch_history_v2_bounded_page(uuid,bigint,integer,timestamptz,text)'
    )
  ),
  'bounded title paging is security invoker with an empty search_path'
);
select ok(
  (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.list_watch_history_v2_title_episodes_page(uuid,bigint,text,text,integer,text)'
    )
  ),
  'title-detail paging is security invoker with an empty search_path'
);
select ok(
  (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.cleanup_watch_history_receipts_v2(integer)'
    )
  ),
  'receipt cleanup is security invoker with an empty search_path'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.list_watch_history_v2_bounded_page(uuid,bigint,integer,timestamptz,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_watch_history_v2_bounded_page(uuid,bigint,integer,timestamptz,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.list_watch_history_v2_bounded_page(uuid,bigint,integer,timestamptz,text)',
    'execute'
  ),
  'only service_role can execute bounded title paging'
);
select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.list_watch_history_v2_title_episodes_page(uuid,bigint,text,text,integer,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_watch_history_v2_title_episodes_page(uuid,bigint,text,text,integer,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.list_watch_history_v2_title_episodes_page(uuid,bigint,text,text,integer,text)',
    'execute'
  ),
  'only service_role can execute title-detail paging'
);
select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.cleanup_watch_history_receipts_v2(integer)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.cleanup_watch_history_receipts_v2(integer)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.cleanup_watch_history_receipts_v2(integer)',
    'execute'
  ),
  'only service_role can execute receipt cleanup'
);

select throws_like(
  $$ select public.cleanup_watch_history_receipts_v2(0) $$,
  '%watch_history_invalid_cleanup_batch%',
  'receipt cleanup rejects a zero batch'
);
select throws_like(
  $$ select public.cleanup_watch_history_receipts_v2(101) $$,
  '%watch_history_invalid_cleanup_batch%',
  'receipt cleanup rejects a batch above its hard ceiling'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes as index_definition
    where index_definition.schemaname = 'public'
      and index_definition.tablename = 'watch_episode_progress'
      and index_definition.indexname = 'idx_watch_episode_progress_title_detail'
      and index_definition.indexdef like '%(user_id, history_generation, provider, title_key, observed_at DESC, episode_key COLLATE "C")%'
  ),
  'title-detail selection has a requester/title/order leading index'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes as index_definition
    where index_definition.schemaname = 'public'
      and index_definition.tablename = 'watch_history_receipts'
      and index_definition.indexname = 'idx_watch_history_receipts_global_expiry'
      and index_definition.indexdef like '%(expires_at, user_id, client_id)%'
  ),
  'global cleanup has an expiry-leading stable index'
);

set local enable_seqscan = off;
select ok(
  pg_temp.watch_v2_explain_json($query$
    select receipt.user_id, receipt.client_id
    from public.watch_history_receipts as receipt
    where receipt.expires_at <= pg_catalog.transaction_timestamp()
    order by receipt.expires_at, receipt.user_id, receipt.client_id
    limit 100
    for update of receipt skip locked
  $query$)::text like '%idx_watch_history_receipts_global_expiry%',
  'global expired-receipt selection uses the expiry-leading index'
);
set local enable_seqscan = on;

set role service_role;
select lives_ok(
  $$
    do $body$
    declare
      item integer;
    begin
      for item in 1..12 loop
        perform public.apply_watch_progress_v2(
          '33333333-3333-4333-8333-333333333331',
          pg_temp.watch_v2_resource_event(
            ('33333333-3333-4333-8334-' || pg_catalog.lpad(item::text, 12, '0'))::uuid,
            'episode-' || item,
            case when item in (7, 8)
              then '2026-08-21 10:00:08+00'::timestamptz
              else '2026-08-21 10:00:00+00'::timestamptz + item * interval '1 second'
            end,
            item % 2 = 0
          ),
          null
        );
      end loop;
    end;
    $body$
  $$,
  'progress writes create the bounded-page fixture'
);
set role postgres;

select is(
  (
    select pg_catalog.concat(
      summary.observed_episode_count,
      ':',
      summary.completed_episode_count
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '12:6',
  'title counts are exact after progress writes'
);

update public.watch_episode_progress
set completed_at = observed_at
where user_id = '33333333-3333-4333-8333-333333333331'
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-1';
select is(
  (
    select pg_catalog.concat(
      summary.observed_episode_count,
      ':',
      summary.completed_episode_count
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '12:7',
  'an incomplete-to-completed transition increments the exact completed count'
);

update public.watch_episode_progress
set completed_at = null
where user_id = '33333333-3333-4333-8333-333333333331'
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-1';
select is(
  (
    select pg_catalog.concat(
      summary.observed_episode_count,
      ':',
      summary.completed_episode_count
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '12:6',
  'a completed-to-incomplete transition decrements the exact completed count'
);

update public.watch_episode_progress
set observed_at = '2026-08-21 09:59:59+00'
where user_id = '33333333-3333-4333-8333-333333333331'
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-12';
select is(
  (
    select pg_catalog.concat(
      summary.last_watched_at,
      ':',
      summary.observed_episode_count,
      ':',
      summary.completed_episode_count
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '2026-08-21 10:00:11+00:12:6',
  'a timestamp regression recomputes the exact title maximum without changing counts'
);
update public.watch_episode_progress
set observed_at = '2026-08-21 10:00:12+00'
where user_id = '33333333-3333-4333-8333-333333333331'
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-12';

update public.watch_episode_progress
set title_key = 'moved-title'
where user_id = '33333333-3333-4333-8333-333333333331'
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-1';
select is(
  (
    select pg_catalog.string_agg(
      summary.title_key || ':' || summary.observed_episode_count || ':' || summary.completed_episode_count,
      ','
      order by summary.title_key
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key in ('bounded-title', 'moved-title')
  ),
  'bounded-title:11:6,moved-title:1:0',
  'an identity move recomputes the source and initializes exact destination counts'
);
update public.watch_episode_progress
set title_key = 'bounded-title'
where user_id = '33333333-3333-4333-8333-333333333331'
  and provider = 'crunchyroll'
  and title_key = 'moved-title'
  and episode_key = 'episode-1';
select is(
  (
    select pg_catalog.concat(
      pg_catalog.count(*) filter (where summary.title_key = 'moved-title'),
      ':',
      pg_catalog.max(summary.observed_episode_count) filter (where summary.title_key = 'bounded-title'),
      ':',
      pg_catalog.max(summary.completed_episode_count) filter (where summary.title_key = 'bounded-title')
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key in ('bounded-title', 'moved-title')
  ),
  '0:12:6',
  'moving an identity back removes the empty destination and restores source counts'
);

update public.watch_episode_progress
set history_generation = 2
where user_id = '33333333-3333-4333-8333-333333333331'
  and history_generation = 1
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-2';
select is(
  (
    select pg_catalog.string_agg(
      summary.history_generation || ':' || summary.observed_episode_count || ':' || summary.completed_episode_count,
      ','
      order by summary.history_generation
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '1:11:5,2:1:1',
  'a generation move recomputes the source and initializes exact destination counts'
);
update public.watch_episode_progress
set history_generation = 1
where user_id = '33333333-3333-4333-8333-333333333331'
  and history_generation = 2
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key = 'episode-2';
select is(
  (
    select pg_catalog.concat(
      pg_catalog.count(*) filter (where summary.history_generation = 2),
      ':',
      pg_catalog.max(summary.observed_episode_count) filter (where summary.history_generation = 1),
      ':',
      pg_catalog.max(summary.completed_episode_count) filter (where summary.history_generation = 1)
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '0:12:6',
  'moving an episode back removes the empty generation summary and restores current counts'
);

update public.watch_episode_progress
set completed_at = observed_at
where user_id = '33333333-3333-4333-8333-333333333331'
  and history_generation = 1
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key in ('episode-1', 'episode-3');
select is(
  (
    select pg_catalog.concat(summary.observed_episode_count, ':', summary.completed_episode_count)
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '12:8',
  'a multi-row update applies every completion transition exactly once'
);
update public.watch_episode_progress
set completed_at = null
where user_id = '33333333-3333-4333-8333-333333333331'
  and history_generation = 1
  and provider = 'crunchyroll'
  and title_key = 'bounded-title'
  and episode_key in ('episode-1', 'episode-3');
select is(
  (
    select pg_catalog.concat(summary.observed_episode_count, ':', summary.completed_episode_count)
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '12:6',
  'a reverse multi-row update restores the exact completed count'
);

create temporary table resource_pages (
  name text primary key,
  page jsonb not null
) on commit drop;

insert into resource_pages (name, page)
values (
  'title',
  public.list_watch_history_v2_bounded_page(
    '33333333-3333-4333-8333-333333333331',
    999,
    1,
    null,
    null
  )
);

select is(
  (select pg_catalog.jsonb_array_length(page -> 'progressRows') from resource_pages where name = 'title'),
  8,
  'a title-page item contains at most eight recent episode rows'
);
select is(
  (
    select pg_catalog.concat(
      page #>> '{titleSummaries,0,observedEpisodeCount}',
      ':',
      page #>> '{titleSummaries,0,completedEpisodeCount}',
      ':',
      page #>> '{titleSummaries,0,episodePage,complete}',
      ':',
      (page #>> '{titleSummaries,0,episodePage,nextCursor}') is not null
    )
    from resource_pages
    where name = 'title'
  ),
  '12:6:false:t',
  'the bounded title carries exact counts and explicit continuation'
);
select is(
  (
    select pg_catalog.concat(
      decoded.cursor_value ->> 'userId',
      ':',
      decoded.cursor_value ->> 'accountGeneration',
      ':',
      (
        select pg_catalog.count(*)
        from pg_catalog.jsonb_object_keys(decoded.cursor_value)
      )
    )
    from (
      select pg_catalog.convert_from(
        pg_catalog.decode(page #>> '{titleSummaries,0,episodePage,nextCursor}', 'hex'),
        'UTF8'
      )::jsonb as cursor_value
      from resource_pages
      where name = 'title'
    ) as decoded
  ),
  '33333333-3333-4333-8333-333333333331:1:7',
  'title continuation binds the owner and canonical account generation in an exact seven-field cursor'
);
select is(
  (
    select pg_catalog.string_agg(row ->> 'episode_key', ',' order by ordinal)
    from resource_pages,
      pg_catalog.jsonb_array_elements(page -> 'progressRows') with ordinality as rows(row, ordinal)
    where name = 'title'
  ),
  'episode-12,episode-11,episode-10,episode-9,episode-7,episode-8,episode-6,episode-5',
  'recent slices use observed time then C-collated episode identity'
);

insert into resource_pages (name, page)
values (
  'static-one',
  public.list_watch_history_v2_title_episodes_page(
    '33333333-3333-4333-8333-333333333331',
    1,
    'crunchyroll',
    'bounded-title',
    5,
    null
  )
);
insert into resource_pages (name, page)
select
  'static-two',
  public.list_watch_history_v2_title_episodes_page(
    '33333333-3333-4333-8333-333333333331',
    1,
    'crunchyroll',
    'bounded-title',
    5,
    page ->> 'nextCursor'
  )
from resource_pages
where name = 'static-one';
insert into resource_pages (name, page)
select
  'static-three',
  public.list_watch_history_v2_title_episodes_page(
    '33333333-3333-4333-8333-333333333331',
    1,
    'crunchyroll',
    'bounded-title',
    5,
    page ->> 'nextCursor'
  )
from resource_pages
where name = 'static-two';

select is(
  (
    select pg_catalog.string_agg(
      pg_catalog.jsonb_array_length(page -> 'progressRows')::text,
      ':'
      order by case name
        when 'static-one' then 1
        when 'static-two' then 2
        else 3
      end
    )
    from resource_pages
    where name in ('static-one', 'static-two', 'static-three')
  ),
  '5:5:2',
  'an unmodified title traverses in exact 5/5/2 page sizes'
);
select is(
  (
    select pg_catalog.string_agg(row ->> 'episode_key', ',' order by page_number, ordinal)
    from resource_pages
    cross join lateral (
      select case name
        when 'static-one' then 1
        when 'static-two' then 2
        else 3
      end as page_number
    ) as page_order
    cross join lateral pg_catalog.jsonb_array_elements(page -> 'progressRows')
      with ordinality as rows(row, ordinal)
    where name in ('static-one', 'static-two', 'static-three')
  ),
  'episode-12,episode-11,episode-10,episode-9,episode-7,episode-8,episode-6,episode-5,episode-4,episode-3,episode-2,episode-1',
  'an unmodified traversal returns the full canonical ordered identity sequence'
);
select is(
  (
    select pg_catalog.count(distinct row ->> 'episode_key')
    from resource_pages
    cross join lateral pg_catalog.jsonb_array_elements(page -> 'progressRows') as rows(row)
    where name in ('static-one', 'static-two', 'static-three')
  ),
  12::bigint,
  'an unmodified traversal covers every identity exactly once'
);
select is(
  (
    select pg_catalog.concat(
      page ->> 'complete',
      ':',
      (page ->> 'nextCursor') is null
    )
    from resource_pages
    where name = 'static-three'
  ),
  'true:t',
  'the terminal static detail page is complete and has no continuation'
);

insert into resource_pages (name, page)
values (
  'detail-one',
  public.list_watch_history_v2_title_episodes_page(
    '33333333-3333-4333-8333-333333333331',
    1,
    'crunchyroll',
    'bounded-title',
    5,
    null
  )
);

-- Paging is deliberately not a snapshot. A row already seen on page one may
-- move newer; continuing from the opaque keyset cursor must not duplicate it.
set role service_role;
select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '33333333-3333-4333-8333-333333333331',
      pg_temp.watch_v2_resource_event(
        '33333333-3333-4333-8334-999999999999',
        'episode-12',
        '2026-08-21 11:00:00+00',
        true
      ),
      null
    )
  $$,
  'a live observation may move an already-seen episode before the next page'
);
set role postgres;

insert into resource_pages (name, page)
select
  'detail-two',
  public.list_watch_history_v2_title_episodes_page(
    '33333333-3333-4333-8333-333333333331',
    1,
    'crunchyroll',
    'bounded-title',
    5,
    page ->> 'nextCursor'
  )
from resource_pages
where name = 'detail-one';

select is(
  (
    select pg_catalog.concat(
      pg_catalog.jsonb_array_length(page -> 'progressRows'),
      ':',
      page ->> 'complete',
      ':',
      (page ->> 'nextCursor') is not null
    )
    from resource_pages
    where name = 'detail-one'
  ),
  '5:false:t',
  'detail pages expose five rows and one-row lookahead continuation'
);
select is(
  (
    select pg_catalog.count(*)
    from (
      select row ->> 'episode_key' as episode_key
      from resource_pages,
        pg_catalog.jsonb_array_elements(page -> 'progressRows') as rows(row)
      where name in ('detail-one', 'detail-two')
      group by row ->> 'episode_key'
      having pg_catalog.count(*) > 1
    ) as duplicates
  ),
  0::bigint,
  'equal observed timestamps do not duplicate identities across detail pages'
);
select is(
  (
    select pg_catalog.count(*)
    from resource_pages,
      pg_catalog.jsonb_array_elements(page -> 'progressRows') as rows(row)
    where name in ('detail-one', 'detail-two')
  ),
  10::bigint,
  'live continuation returns the next five rows without duplicating the moved identity'
);

select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333332',
      1,
      'crunchyroll',
      'bounded-title',
      5,
      (select page ->> 'nextCursor' from resource_pages where name = 'detail-one')
    )
  $$,
  '%watch_history_cursor_target_mismatch%',
  'a detail cursor is bound to its owner'
);

select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333331',
      1,
      'crunchyroll',
      'bounded-title',
      5,
      pg_temp.watch_v2_patch_cursor(
        (select page ->> 'nextCursor' from resource_pages where name = 'detail-one'),
        pg_catalog.jsonb_build_object('v', '1')
      )
    )
  $$,
  '%watch_history_invalid_episode_cursor%',
  'detail cursors reject a string version'
);
select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333331',
      1,
      'crunchyroll',
      'bounded-title',
      5,
      pg_temp.watch_v2_patch_cursor(
        (select page ->> 'nextCursor' from resource_pages where name = 'detail-one'),
        pg_catalog.jsonb_build_object('v', null)
      )
    )
  $$,
  '%watch_history_invalid_episode_cursor%',
  'detail cursors reject a null version'
);
select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333331',
      1,
      'crunchyroll',
      'bounded-title',
      5,
      pg_temp.watch_v2_patch_cursor(
        (select page ->> 'nextCursor' from resource_pages where name = 'detail-one'),
        pg_catalog.jsonb_build_object('v', true)
      )
    )
  $$,
  '%watch_history_invalid_episode_cursor%',
  'detail cursors reject a boolean version'
);

select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333331',
      1,
      'youtube',
      'bounded-title',
      5,
      (select page ->> 'nextCursor' from resource_pages where name = 'detail-one')
    )
  $$,
  '%watch_history_cursor_target_mismatch%',
  'a detail cursor is bound to its provider and title'
);
select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333331',
      1,
      'crunchyroll',
      'bounded-title',
      5,
      pg_catalog.encode(
        pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'v', 1,
            'userId', '33333333-3333-4333-8333-333333333331',
            'accountGeneration', 1,
            'provider', 'crunchyroll',
            'titleKey', 'bounded-title',
            'observedAt', '2026-08-21T10:00:08+00:00',
            'episodeKey', 'episode-8',
            'unknown', true
          )::text,
          'UTF8'
        ),
        'hex'
      )
    )
  $$,
  '%watch_history_invalid_episode_cursor%',
  'detail cursors reject unknown fields'
);
select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333331',
      1,
      'crunchyroll',
      'bounded-title',
      5,
      pg_catalog.encode(
        pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'v', 1,
            'userId', '33333333-3333-4333-8333-333333333331',
            'accountGeneration', 1,
            'provider', 'crunchyroll',
            'titleKey', 'bounded-title',
            'observedAt', '2026-08-21T10:00:08+00:00',
            'unknown', true
          )::text,
          'UTF8'
        ),
        'hex'
      )
    )
  $$,
  '%watch_history_invalid_episode_cursor%',
  'detail cursors require every declared field even when an unknown replacement preserves the field count'
);

select is(
  pg_catalog.jsonb_array_length(
    public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333332',
      1,
      'crunchyroll',
      'bounded-title',
      50,
      null
    ) -> 'progressRows'
  ),
  0,
  'title-detail paging never returns another owner''s rows'
);

set role service_role;
select lives_ok(
  $$
    select public.delete_watch_history_v2(
      '33333333-3333-4333-8333-333333333331',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'clientMutationId', '33333333-3333-4333-8335-000000000001',
        'accountGeneration', 1,
        'requestedAt', pg_catalog.transaction_timestamp(),
        'target', pg_catalog.jsonb_build_object(
          'scope', 'episode',
          'provider', 'crunchyroll',
          'titleKey', 'bounded-title',
          'episodeKey', 'episode-12'
        )
      )
    )
  $$,
  'an episode delete refreshes exact title counts'
);
set role postgres;
select is(
  (
    select pg_catalog.concat(
      summary.observed_episode_count,
      ':',
      summary.completed_episode_count
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-title'
  ),
  '11:5',
  'counts remain exact after deleting a completed episode'
);

-- A large title stays durable while both read surfaces remain bounded.
insert into public.user_watch_settings (user_id)
values ('33333333-3333-4333-8333-333333333332')
on conflict (user_id) do nothing;

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  completed_at,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
select
  '33333333-3333-4333-8333-333333333332',
  'crunchyroll',
  'two-thousand-title',
  'episode-' || item,
  'series',
  'Two thousand title',
  'Episode ' || item,
  'https://www.crunchyroll.com/watch/large-' || item || '/demo',
  300,
  1200,
  0.25,
  case when item % 2 = 0 then '2026-08-20 00:00:00+00'::timestamptz else null end,
  pg_catalog.md5('watch-v2-large-' || item)::uuid,
  '2026-08-20 00:00:00+00'::timestamptz + item * interval '1 second',
  item,
  1,
  pg_catalog.transaction_timestamp()
from pg_catalog.generate_series(1, 2000) as item;

analyze public.watch_episode_progress;
set local enable_seqscan = off;
select ok(
  pg_temp.watch_v2_explain_json($query$
    select episode.episode_key
    from public.watch_episode_progress as episode
    where episode.user_id = '33333333-3333-4333-8333-333333333332'
      and episode.history_generation = 1
      and episode.provider = 'crunchyroll'
      and episode.title_key = 'two-thousand-title'
    order by episode.observed_at desc, episode.episode_key collate "C"
    limit 51
  $query$)::text like '%idx_watch_episode_progress_title_detail%',
  'detail lookahead selection uses the title-detail index on a 2,000-row title'
);
set local enable_seqscan = on;

select is(
  (
    select pg_catalog.concat(
      summary.observed_episode_count,
      ':',
      summary.completed_episode_count
    )
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333332'
      and summary.title_key = 'two-thousand-title'
  ),
  '2000:1000',
  'the summary keeps exact counts for a 2,000-episode title'
);
select is(
  pg_catalog.jsonb_array_length(
    public.list_watch_history_v2_bounded_page(
      '33333333-3333-4333-8333-333333333332',
      1,
      1,
      null,
      null
    ) -> 'progressRows'
  ),
  8,
  'the 2,000-episode title returns only eight title-page rows'
);
select is(
  pg_catalog.jsonb_array_length(
    public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333332',
      1,
      'crunchyroll',
      'two-thousand-title',
      50,
      null
    ) -> 'progressRows'
  ),
  50,
  'the 2,000-episode title returns at most 50 detail rows'
);
select is(
  pg_catalog.jsonb_array_length(
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333332',
      1,
      1,
      null,
      null
    ) -> 'progressRows'
  ),
  2000,
  'the old RPC remains unchanged and compatible'
);

-- Exact 14-day cleanup boundary and relation scope.
insert into public.watch_history_receipts (
  user_id,
  client_id,
  kind,
  acknowledgement,
  accepted_at,
  expires_at
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8336-000000000001',
    'progress',
    '{}'::jsonb,
    pg_catalog.transaction_timestamp() - interval '14 days 1 second',
    pg_catalog.transaction_timestamp() - interval '1 second'
  ),
  (
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8336-000000000002',
    'progress',
    '{}'::jsonb,
    pg_catalog.transaction_timestamp() - interval '14 days',
    pg_catalog.transaction_timestamp()
  ),
  (
    '33333333-3333-4333-8333-333333333331',
    '33333333-3333-4333-8336-000000000003',
    'progress',
    '{}'::jsonb,
    pg_catalog.transaction_timestamp() - interval '13 days 23 hours 59 minutes 59 seconds',
    pg_catalog.transaction_timestamp() + interval '1 second'
  );

create temporary table receipt_cleanup_scope_before as
select
  (select pg_catalog.count(*) from public.watch_episode_progress) as progress_count,
  (select pg_catalog.count(*) from public.user_watch_settings) as settings_count,
  (select pg_catalog.count(*) from public.watch_history_title_summaries) as summary_count,
  (select pg_catalog.count(*) from public.watch_history_deletions) as deletion_count;

set role service_role;
select is(
  public.cleanup_watch_history_receipts_v2(100),
  2,
  'cleanup removes rows whose exact 14-day expiry has passed or arrived'
);
set role postgres;

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_receipts as receipt
    where receipt.client_id in (
      '33333333-3333-4333-8336-000000000001'::uuid,
      '33333333-3333-4333-8336-000000000002'::uuid
    )
  ),
  0::bigint,
  'cleanup removes expired receipts at the inclusive boundary'
);
select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_receipts as receipt
    where receipt.client_id = '33333333-3333-4333-8336-000000000003'
  ),
  1::bigint,
  'cleanup preserves a receipt before its exact expiry'
);
select is(
  (
    select pg_catalog.concat(
      (select pg_catalog.count(*) from public.watch_episode_progress), ':',
      (select pg_catalog.count(*) from public.user_watch_settings), ':',
      (select pg_catalog.count(*) from public.watch_history_title_summaries), ':',
      (select pg_catalog.count(*) from public.watch_history_deletions)
    )
  ),
  (
    select pg_catalog.concat(
      progress_count, ':', settings_count, ':', summary_count, ':', deletion_count
    )
    from receipt_cleanup_scope_before
  ),
  'receipt cleanup deletes no progress, settings, summaries, or fences'
);
select is(
  public.cleanup_watch_history_receipts_v2(100),
  0,
  'receipt cleanup is repeatable after eligible rows drain'
);

-- A concurrent worker must make progress past a locked oldest receipt.
select extensions.dblink_connect(
  'watch_receipt_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=watch_receipt_setup'
);
select extensions.dblink_exec(
  'watch_receipt_setup',
  $setup$
    insert into public.users (id, email, display_name)
    values (
      '33333333-3333-4333-8338-000000000001',
      'watch-v2-receipt-lock@example.test',
      'Watch Receipt Lock'
    );
    insert into public.watch_history_receipts (
      user_id, client_id, kind, acknowledgement, accepted_at, expires_at
    ) values
      (
        '33333333-3333-4333-8338-000000000001',
        '33333333-3333-4333-8338-000000000011',
        'progress',
        '{}'::jsonb,
        pg_catalog.transaction_timestamp() - interval '15 days',
        pg_catalog.transaction_timestamp() - interval '1 day'
      ),
      (
        '33333333-3333-4333-8338-000000000001',
        '33333333-3333-4333-8338-000000000012',
        'progress',
        '{}'::jsonb,
        pg_catalog.transaction_timestamp() - interval '14 days 1 hour',
        pg_catalog.transaction_timestamp() - interval '1 hour'
      );
  $setup$
);
select extensions.dblink_connect(
  'watch_receipt_lock',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=watch_receipt_lock'
);
select extensions.dblink_exec('watch_receipt_lock', 'begin');
select is(
  (
    select locked
    from extensions.dblink(
      'watch_receipt_lock',
      $lock$
        select 1
        from public.watch_history_receipts
        where user_id = '33333333-3333-4333-8338-000000000001'
          and client_id = '33333333-3333-4333-8338-000000000011'
        for update
      $lock$
    ) as result(locked integer)
  ),
  1,
  'the concurrency fixture holds the oldest expired receipt lock'
);
select extensions.dblink_connect(
  'watch_receipt_worker',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=watch_receipt_worker'
);
select extensions.dblink_exec('watch_receipt_worker', 'set role service_role');
select is(
  (
    select deleted_count
    from extensions.dblink(
      'watch_receipt_worker',
      'select public.cleanup_watch_history_receipts_v2(1)'
    ) as result(deleted_count integer)
  ),
  1,
  'cleanup skips one locked expired receipt and deletes an unlocked candidate'
);
select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_receipts as receipt
    where receipt.user_id = '33333333-3333-4333-8338-000000000001'
      and receipt.client_id = '33333333-3333-4333-8338-000000000011'
  ),
  1::bigint,
  'the concurrently locked expired receipt remains'
);
select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_receipts as receipt
    where receipt.user_id = '33333333-3333-4333-8338-000000000001'
      and receipt.client_id = '33333333-3333-4333-8338-000000000012'
  ),
  0::bigint,
  'the unlocked expired receipt is deleted instead'
);
select extensions.dblink_exec('watch_receipt_lock', 'commit');
select extensions.dblink_disconnect('watch_receipt_lock');
select is(
  (
    select deleted_count
    from extensions.dblink(
      'watch_receipt_worker',
      'select public.cleanup_watch_history_receipts_v2(100)'
    ) as result(deleted_count integer)
  ),
  1,
  'a later cleanup call drains the formerly locked receipt'
);
select extensions.dblink_exec('watch_receipt_worker', 'reset role');
select extensions.dblink_disconnect('watch_receipt_worker');
select extensions.dblink_exec(
  'watch_receipt_setup',
  $$ delete from public.users where id = '33333333-3333-4333-8338-000000000001' $$
);
select extensions.dblink_disconnect('watch_receipt_setup');

select is(
  (
    select pg_catalog.count(*)
    from cron.job as job
    where job.jobname = 'anidachi-watch-history-receipt-cleanup-hourly'
      and job.schedule = '0 * * * *'
      and job.command = 'select public.cleanup_watch_history_receipts_v2();'
      and job.active
  ),
  1::bigint,
  'one active hourly Watch History receipt cleanup job is installed'
);

insert into resource_pages (name, page)
values (
  'before-full-clear',
  public.list_watch_history_v2_title_episodes_page(
    '33333333-3333-4333-8333-333333333332',
    1,
    'crunchyroll',
    'two-thousand-title',
    5,
    null
  )
);

set role service_role;
select lives_ok(
  $$
    select public.delete_watch_history_v2(
      '33333333-3333-4333-8333-333333333332',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'clientMutationId', '33333333-3333-4333-8337-000000000001',
        'accountGeneration', 1,
        'requestedAt', pg_catalog.transaction_timestamp(),
        'target', pg_catalog.jsonb_build_object('scope', 'all')
      )
    )
  $$,
  'full clear advances the owner generation'
);
set role postgres;
select is(
  (
    select pg_catalog.concat(
      settings.history_generation,
      ':',
      pg_catalog.count(summary.*),
      ':',
      pg_catalog.count(progress.*)
    )
    from public.user_watch_settings as settings
    left join public.watch_history_title_summaries as summary
      on summary.user_id = settings.user_id
    left join public.watch_episode_progress as progress
      on progress.user_id = settings.user_id
    where settings.user_id = '33333333-3333-4333-8333-333333333332'
    group by settings.history_generation
  ),
  '2:0:0',
  'full clear leaves zero count projections and durable rows in the new generation'
);
select throws_like(
  $$
    select public.list_watch_history_v2_title_episodes_page(
      '33333333-3333-4333-8333-333333333332',
      2,
      'crunchyroll',
      'two-thousand-title',
      5,
      (select page ->> 'nextCursor' from resource_pages where name = 'before-full-clear')
    )
  $$,
  '%watch_history_cursor_target_mismatch%',
  'a cursor issued before full clear is rejected against the new canonical generation'
);
select is(
  (
    select summary.observed_episode_count
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333331'
      and summary.title_key = 'bounded-title'
  ),
  11::bigint,
  'full clear leaves another account untouched'
);

select * from finish();
rollback;
