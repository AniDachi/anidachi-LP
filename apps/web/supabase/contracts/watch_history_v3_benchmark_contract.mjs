import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import {
	assertAcceptedCatalogMeasurement,
	assertV3Prerequisite,
	DATABASE_PREREQUISITE_SQL,
	proofPsqlArgs,
	requireDisposableTarget,
	requireOutputPath,
	withPsqlSessionTimeouts,
} from "./watch_history_v3_disposable_target.mjs";

const target = requireDisposableTarget();
const pageOutput = requireOutputPath(
	process.env,
	"ANIDACHI_WATCH_HISTORY_BENCHMARK_PAGE_OUTPUT",
);
const measurementsOutput = requireOutputPath(
	process.env,
	"ANIDACHI_WATCH_HISTORY_BENCHMARK_MEASUREMENTS_OUTPUT",
);
const largeUser = "b9999999-1111-4111-8111-111111111111";
const smallUser = "b9999999-2222-4222-8222-222222222222";

function sql(input, timeout = 60_000) {
	const result = spawnSync("docker", proofPsqlArgs(target.container), {
		input: withPsqlSessionTimeouts(input),
		encoding: "utf8",
		maxBuffer: 12 * 1024 * 1024,
		timeout,
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim();
}

assertV3Prerequisite(JSON.parse(sql(DATABASE_PREREQUISITE_SQL)));
const quote = (value) =>
	`'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const cleanup = () =>
	sql(`delete from public.users where id in ('${largeUser}','${smallUser}');`);

function requireAcceptedCatalog(userId, revision, episodeCount, aliasCount) {
	const actual = JSON.parse(
		sql(`select jsonb_build_object(
      'revision',c.revision,
      'acceptedRevision',c.accepted_revision,
      'attemptStatus',c.attempt_status,
      'snapshotCompleteness',c.snapshot->>'completeness',
      'projectionState',public.watch_catalog_state_v3(
        c.context,case when c.projection is not null then c.accepted_context end
      ),
      'hasProjection',c.projection is not null,
      'episodeCount',(select count(distinct a.episode_key)
        from public.watch_catalog_aliases a
        where a.user_id=c.user_id and a.history_generation=c.history_generation
          and a.provider=c.provider and a.title_key=c.title_key),
      'aliasCount',(select count(*) from public.watch_catalog_aliases a
        where a.user_id=c.user_id and a.history_generation=c.history_generation
          and a.provider=c.provider and a.title_key=c.title_key)
    )
    from public.watch_catalog_snapshots c
    where c.user_id='${userId}' and c.history_generation=1
      and c.provider='crunchyroll' and c.title_key='crunchyroll:series:MAX';`),
	);
	assertAcceptedCatalogMeasurement(actual, {
		revision,
		episodeCount,
		aliasCount,
	});
	return actual;
}

function request() {
	return {
		schemaVersion: 3,
		accountGeneration: 1,
		provider: "crunchyroll",
		titleKey: "crunchyroll:series:MAX",
		providerSeriesId: "MAX",
		context: {
			region: "US",
			requestedLocale: "en-US",
			audioLocale: "ja-JP",
			subtitleLocales: [],
			observedAt: new Date().toISOString(),
		},
	};
}

function snapshot(catalogRequest, count) {
	return {
		schemaVersion: 3,
		provider: "crunchyroll",
		titleKey: catalogRequest.titleKey,
		providerSeriesId: "MAX",
		title: "Maximum catalog",
		completeness: "complete",
		context: catalogRequest.context,
		seasons: Array.from({ length: Math.ceil(count / 20) }, (_, season) => ({
			seasonKey: `crunchyroll:season:S${season}`,
			providerSeasonIdentifier: `S${season}`,
			title: `Season ${season}`,
			seasonNumber: season,
			order: season,
			episodes: Array.from(
				{ length: Math.min(20, count - season * 20) },
				(_, episode) => {
					const id = season * 20 + episode;
					return {
						episodeKey: `crunchyroll:episode:E${id}`,
						providerEpisodeIdentifier: `E${id}`,
						title: `Episode ${id}`.padEnd(200, "x"),
						episodeNumber: episode,
						order: episode,
						releasedAt: null,
						available: true,
						watchVariants: Array.from(
							{ length: id === 0 ? 32 : 1 },
							(_, variant) => ({
								providerContentId: `R${id}_${variant}`,
								audioLocale: variant ? "en-US" : "ja-JP",
								original: variant === 0,
								order: variant,
								sourceUrl: `https://www.crunchyroll.com/watch/R${id}_${variant}`,
							}),
						),
					};
				},
			),
		})),
	};
}

function event() {
	return {
		schemaVersion: 3,
		accountGeneration: 1,
		provider: "crunchyroll",
		titleKey: "crunchyroll:series:MAX",
		seasonKey: "crunchyroll:season:S0",
		episodeKey: "crunchyroll:episode:E0",
		itemKind: "series",
		title: "Title",
		episodeTitle: "Episode",
		seasonTitle: "Season",
		seasonNumber: 0,
		episodeNumber: 0,
		artworkUrl: null,
		clientEventId: crypto.randomUUID(),
		clientSessionKey: "heartbeat-benchmark",
		sourceUrl: "https://www.crunchyroll.com/watch/R0_0",
		currentTime: 10,
		duration: 100,
		progress: 0.1,
		kind: "heartbeat",
		sharedRoom: null,
		observedAt: new Date().toISOString(),
		crunchyrollIdentity: {
			providerSeriesId: "MAX",
			providerSeasonIdentifier: "S0",
			providerEpisodeIdentifier: "E0",
			providerContentId: "R0_0",
			audioLocale: "ja-JP",
		},
	};
}

cleanup();
try {
	sql(`insert into public.users(id,email,display_name) values
    ('${largeUser}','large-catalog@example.test','Large'),
    ('${smallUser}','small-catalog@example.test','Small');
  insert into public.user_watch_settings(user_id,write_schema_version) values
    ('${largeUser}',3),('${smallUser}',3);`);

	const measurements = [];
	for (const [userId, count] of [
		[smallUser, 1],
		[largeUser, 2000],
	]) {
		const catalogRequest = request();
		const begin = JSON.parse(
			sql(
				`select public.begin_watch_catalog_v3('${userId}',${quote(catalogRequest)});`,
			),
		);
		const catalogSnapshot = snapshot(catalogRequest, count);
		const commit = {
			...catalogRequest,
			revision: begin.revision,
			snapshot: catalogSnapshot,
		};
		const plan = JSON.parse(
			sql(
				`explain (analyze,format json) select public.apply_watch_catalog_v3('${userId}',${quote(commit)});`,
			),
		);
		const acceptedCatalog = requireAcceptedCatalog(
			userId,
			begin.revision,
			count,
			count + 31,
		);
		measurements.push({
			count,
			variants: count + 31,
			bytes: Buffer.byteLength(JSON.stringify(catalogSnapshot)),
			commitMs: plan[0]["Execution Time"],
			acceptedCatalog,
		});
	}

	sql(`insert into public.watch_episode_progress(
    user_id,provider,title_key,episode_key,item_kind,title,episode_title,season_key,
    season_title,source_url,current_time_seconds,duration,progress,last_event_id,
    observed_at,server_order,history_generation,updated_at
  )
  select '${largeUser}','crunchyroll',
    case when title_number=0 then 'crunchyroll:series:MAX' else 'crunchyroll:series:T'||title_number end,
    'crunchyroll:episode:E'||episode_number,'series','Title','Episode','crunchyroll:season:S0',
    'Season','https://www.crunchyroll.com/watch/R'||episode_number||'_0',10,100,0.1,
    gen_random_uuid(),now()-title_number*interval '1 second',2+title_number*8+episode_number,1,now()
  from generate_series(0,500) title_number cross join generate_series(0,7) episode_number;
  update public.user_watch_settings set next_server_order=5000 where user_id='${largeUser}';
  insert into public.watch_sessions(
    host_user_id,provider,item_key,item_kind,item_title,episode_key,episode_title,
    source_url,schema_version,history_generation,client_session_key
  )
  select '${largeUser}','crunchyroll','crunchyroll:series:MAX','series','Maximum',
    'crunchyroll:episode:E0','Episode','https://www.crunchyroll.com/watch/R0_0',3,1,
    'bench-'||number from generate_series(1,20) number;
  insert into public.watch_session_participants(session_id,user_id,role,schema_version)
  select id,'${largeUser}','host',3 from public.watch_sessions where host_user_id='${largeUser}';`);

	const page = JSON.parse(
		sql(
			`select public.list_watch_history_v3_bounded_page('${largeUser}',1,100);`,
		),
	);
	assert.equal(page.progressRows.length, 800);
	assert.equal(page.titleSummaries.length, 100);
	assert.equal(page.sessionIds.length, 20);
	const readPlan = JSON.parse(
		sql(
			`explain (analyze,format json) select public.list_watch_history_v3_bounded_page('${largeUser}',1,100);`,
		),
	);

	for (const [index, userId] of [smallUser, largeUser].entries()) {
		const heartbeat = event();
		sql(
			`select public.apply_watch_progress_v3('${userId}',${quote(heartbeat)},null);`,
		);
		const timings = [];
		for (let batch = 0; batch < 3; batch += 1) {
			timings.push(
				Number(
					sql(`create temporary table timing(ms double precision);
      do $$ declare started timestamptz:=clock_timestamp(); begin
        for number in 1..100 loop
          perform public.apply_watch_progress_v3('${userId}',${quote(heartbeat)} ||
            jsonb_build_object('clientEventId',gen_random_uuid(),'observedAt',clock_timestamp()),null);
        end loop;
        insert into timing values(extract(epoch from clock_timestamp()-started)*1000/100);
      end; $$;
      select ms from timing;`),
				),
			);
		}
		measurements[index].heartbeatMs = timings;
	}

	const report = {
		catalogs: measurements,
		read100TitlesMs: readPlan[0]["Execution Time"],
		readBytes: Buffer.byteLength(JSON.stringify(page)),
		readRows: page.progressRows.length,
		readSessions: page.sessionIds.length,
	};
	const sameAccountRequest = request();
	sameAccountRequest.context.requestedLocale = "ja-JP";
	const sameBegin = JSON.parse(
		sql(
			`select public.begin_watch_catalog_v3('${largeUser}',${quote(sameAccountRequest)});`,
		),
	);
	const replacementAck = JSON.parse(
		sql(
			`select public.apply_watch_catalog_v3('${largeUser}',${quote({
				...sameAccountRequest,
				revision: sameBegin.revision,
				snapshot: snapshot(sameAccountRequest, 1),
			})});`,
		),
	);
	assert.equal(replacementAck.outcome, "applied");
	const replacementCatalog = requireAcceptedCatalog(
		largeUser,
		sameBegin.revision,
		1,
		32,
	);
	const controlled = [];
	const controlledEvent = event();
	for (let batch = 0; batch < 3; batch += 1) {
		controlled.push(
			Number(
				sql(`create temporary table timing(ms double precision);
    do $$ declare started timestamptz:=clock_timestamp(); begin
      for number in 1..100 loop
        perform public.apply_watch_progress_v3('${largeUser}',${quote(controlledEvent)} ||
          jsonb_build_object('clientEventId',gen_random_uuid(),'observedAt',clock_timestamp()),null);
      end loop;
      insert into timing values(extract(epoch from clock_timestamp()-started)*1000/100);
    end; $$;
    select ms from timing;`),
			),
		);
	}
	report.sameLargeAccountSmallCatalogHeartbeatMs = controlled;
	report.replacementCatalog = replacementCatalog;

	writeFileSync(pageOutput, `${JSON.stringify(page)}\n`);
	writeFileSync(measurementsOutput, `${JSON.stringify(report, null, 2)}\n`);
	console.log(
		JSON.stringify({
			...report,
			target: {
				project: target.project,
				container: target.container,
				hostPort: target.hostPort,
			},
			pageOutput,
			measurementsOutput,
		}),
	);
} finally {
	cleanup();
}
