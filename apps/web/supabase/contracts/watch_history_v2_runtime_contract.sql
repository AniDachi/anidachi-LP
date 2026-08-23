begin;

insert into public.users (id, email, display_name)
values (
  '66666666-6666-4666-8666-666666666666',
  'watch-v2-local-rpc@example.test',
  'Watch V2 Local RPC'
);

do $$
begin
  perform public.apply_watch_progress_v2(
    '66666666-6666-4666-8666-666666666666',
    pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'clientEventId', '66666666-6666-4666-8666-666666666601',
      'clientSessionKey', 'local-rpc-session',
      'accountGeneration', 1,
      'provider', 'crunchyroll',
      'titleKey', 'local-rpc-title',
      'itemKind', 'series',
      'title', 'Local RPC title',
      'artworkUrl', null,
      'episodeKey', 'local-rpc-episode',
      'episodeTitle', 'Local RPC episode',
      'seasonKey', 'season-one',
      'seasonTitle', 'Season One',
      'seasonNumber', 1,
      'episodeNumber', 1,
      'sourceUrl', 'https://www.crunchyroll.com/watch/local-rpc-episode/demo',
      'currentTime', 120,
      'duration', 1200,
      'progress', 0.1,
      'observedAt', pg_catalog.clock_timestamp(),
      'kind', 'pause',
      'sharedRoom', null
    ),
    null
  );
end;
$$;

create temporary table watch_history_runtime_pages (
  sequence integer primary key,
  page jsonb not null
);

insert into watch_history_runtime_pages (sequence, page)
values (
  1,
  public.list_watch_history_v2_page(
    '66666666-6666-4666-8666-666666666666',
    999,
    1,
    null,
    null
  )
);

do $$
begin
  perform public.delete_watch_history_v2(
    '66666666-6666-4666-8666-666666666666',
    pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'clientMutationId', '66666666-6666-4666-8666-666666666602',
      'accountGeneration', 1,
      'requestedAt', pg_catalog.clock_timestamp(),
      'target', pg_catalog.jsonb_build_object('scope', 'all')
    )
  );
end;
$$;

insert into watch_history_runtime_pages (sequence, page)
values (
  2,
  public.list_watch_history_v2_page(
    '66666666-6666-4666-8666-666666666666',
    1,
    1,
    null,
    null
  )
);

copy (
  select pg_catalog.jsonb_agg(page order by sequence)
  from watch_history_runtime_pages
) to stdout;

rollback;
