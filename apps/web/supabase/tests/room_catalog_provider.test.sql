begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into public.users(id, email, display_name) values
  ('cc7a1000-0000-4000-8000-000000000001', 'catalog-test-1@example.test', 'Catalog host'),
  ('cc7a1000-0000-4000-8000-000000000002', 'catalog-test-2@example.test', 'Second catalog host'),
  ('cc7a1000-0000-4000-8000-000000000003', 'catalog-test-3@example.test', 'Prime catalog host');
insert into public.subscriptions(user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
                                 plan_code, status, current_period_end, cancel_at_period_end)
select id, 'cus_catalog_' || id, 'sub_catalog_' || id, 'price_catalog', 'plus', 'active', now()+interval '1 day', true
from public.users where id in ('cc7a1000-0000-4000-8000-000000000001', 'cc7a1000-0000-4000-8000-000000000002', 'cc7a1000-0000-4000-8000-000000000003');

create function pg_temp.catalog(host_id uuid, request_id text, abuse boolean, provider text default 'disneyplus')
returns table(outcome text, room_record jsonb, active_room jsonb) language sql as $$
  select * from public.create_catalog_room_v1(provider, host_id, 'catalog-session', 'Watch together', request_id,
    'plus', 6, 4, true, true, 3, 1, abuse, null, null);
$$;

set local role service_role;
select is((select room_record->>'lobby_provider' from pg_temp.catalog('cc7a1000-0000-4000-8000-000000000001','first',false)),
          'disneyplus', 'ordinary admission stores catalog in the same transaction');
select is((select room_record->>'lobby_provider' from pg_temp.catalog('cc7a1000-0000-4000-8000-000000000002','second',true,'netflix')),
          'netflix', 'abuse-protected admission stores catalog');
select is((select count(*)::int from public.rooms where lobby_provider in ('disneyplus','netflix') and source_url is null
           and host_user_id in ('cc7a1000-0000-4000-8000-000000000001','cc7a1000-0000-4000-8000-000000000002')), 2,
          'catalog is durable without inventing a playable source');
select is((select room_record->>'room_id' from pg_temp.catalog('cc7a1000-0000-4000-8000-000000000001','first',false)),
          (select room_id from public.rooms where client_request_id='first' and host_user_id='cc7a1000-0000-4000-8000-000000000001'), 'retry reuses the room');
select is((select outcome from pg_temp.catalog('cc7a1000-0000-4000-8000-000000000001','different',false,'netflix')),
          'conflict', 'choosing another platform obeys the existing active-room rule');
select throws_ok($$select * from pg_temp.catalog('cc7a1000-0000-4000-8000-000000000001','third',false,'https://example.invalid')$$,
                 '22023','invalid catalog room','arbitrary destinations rejected');
select ok(not has_function_privilege('anon', 'public.create_catalog_room_v1(text,uuid,text,text,text,text,integer,integer,boolean,boolean,integer,integer,boolean,text,text)', 'execute'), 'no anonymous admission grant');
select ok(not has_function_privilege('authenticated', 'public.create_catalog_room_v1(text,uuid,text,text,text,text,integer,integer,boolean,boolean,integer,integer,boolean,text,text)', 'execute'), 'no authenticated client admission grant');
select is((select count(*)::int from public.rooms where host_user_id='cc7a1000-0000-4000-8000-000000000001'),
          1, 'failed and repeated creations leave no additional rooms');
select throws_ok($$update public.rooms set lobby_marketplace = 'amazon.de'
  where host_user_id='cc7a1000-0000-4000-8000-000000000001'$$, '23514', null,
  'other platforms cannot acquire a Prime storefront');
select is((select outcome from public.create_catalog_room_v2('primevideo','amazon.de',
  'cc7a1000-0000-4000-8000-000000000001','prime-session','Prime Video watchroom','prime-first','plus',
  6,4,true,true,3,1,false,null,null) ), 'conflict',
  'a conflict does not attach a storefront');
select is((select lobby_provider from public.rooms where host_user_id='cc7a1000-0000-4000-8000-000000000001'),
  'disneyplus','the active catalog is preserved');
select is((select room_record->>'lobby_marketplace' from public.create_catalog_room_v2('primevideo','amazon.de',
  'cc7a1000-0000-4000-8000-000000000003','prime-session','Prime Video watchroom','prime-first','plus',
  6,4,true,true,3,1,true,null,null)), 'amazon.de', 'admission commits the actual storefront');
select is((select room_record->>'lobby_marketplace' from public.create_catalog_room_v2('primevideo','amazon.com',
  'cc7a1000-0000-4000-8000-000000000003','prime-session','Prime Video watchroom','prime-first','plus',
  6,4,true,true,3,1,true,null,null)), 'amazon.de', 'retry preserves the initial storefront');
select ok(not has_function_privilege('authenticated', 'public.create_catalog_room_v2(text,text,uuid,text,text,text,text,integer,integer,boolean,boolean,integer,integer,boolean,text,text)', 'execute'),
  'only the server can admit to Prime lobbies');
select * from finish();
rollback;
