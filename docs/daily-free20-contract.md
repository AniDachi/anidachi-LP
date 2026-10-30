# Free20: контракт, серверный расчет и выключенное runtime-подключение

Дата: 2026-10-30. Рабочая ветка: `codex/daily-free20-contract`.
База: staging `3089b700877e6385ff65f9c3ca8040fe2308f58f`.
Правила: [spec](superpowers/specs/2026-10-30-daily-free20-design.md).
Последовательность: [plan](superpowers/plans/2026-10-30-daily-free20-transition.md).

## Текущий этап

Блок 1А доставлен в staging через [PR #476](https://github.com/AniDachi/anidachi-LP/pull/476),
commit `d1a422a9e4772832a385b40522b556afb500ecd5`. CI, E2E Rooms/P2P, Web/Worker
deploy и smoke прошли; staging extension build #224 собран и проверен.
Production не менялся. Полная запись доставки — в PR. Free20 не включен.

После этого владелец согласовал блок 2А: расчет остатка на существующем серверном
учете, тесты и доставку через PR в staging. Ветка `codex/daily-free20-server-budget`
начата от `d1a422a9`. Ниже разделы про 1А сохраняют локальные доказательства
первого этапа; результат 2А описан отдельно ниже.

Блок 2А доставлен через [PR #477](https://github.com/AniDachi/anidachi-LP/pull/477),
staging `0e66cb45fa960a00f79eee5d1dab44ec25cb89ab`: CI и Web READY, smoke после
переключения Web alias прошли. DB workflow подтвердил отсутствие новых миграций.
Worker/extension для этого web-only diff не пересобирались. Production остался
на `9da93cd9`, promotion PR #471 открыт без auto-merge. Полная запись — в PR #477.

Владелец затем согласовал блок 2Б: сверку сохраненных секунд и живого интервала,
проверки повторов/переподключения/UTC/restart, PR и staging. Ветка
`codex/daily-free20-room-budget` начата от `0e66cb45`. Активация не согласована.

Блок 2Б доставлен через [PR #478](https://github.com/AniDachi/anidachi-LP/pull/478),
staging `5705743c8a2d021d43f99e32c35da85df89085ac`: CI/Rooms/P2P, Web READY,
Worker deploy, smoke после смены Web alias, extension build #225; DB без миграций.
Точные идентификаторы и ограничения доказательств сохранены в PR #478.

Теперь отдельно согласован блок 3А в `codex/daily-free20-runtime` от `5705743c`:
подключение к Web/DO lifecycle с выключенным по умолчанию флагом, durable
request/ACK/budget, recovery/UTC и измерением запросов/записей. Ниже ранние
разделы описывают границы своих блоков; актуальное подключение описано в 3А.

## Граница локального блока 1А

Первым разрешением была только подготовка локального контракта и проверок совместимости.
Новый формат не выдается HTTP/WS-обработчиками и не подключен к текущему UI/DO.
Нет feature-flag переключения, миграций, изменений trial/paid/Stripe, staging,
production, Store, разрешений расширения или адаптеров плееров.

Текущие `PlanPolicySchema`, `HostingAccessSchema`, `RoomQuotaStatusSchema`,
`RoomQuotaSnapshotSchema`, HTTP/WS payloads и media v2/v3 сохраняют прежнюю семантику.
Старое Free1800 не превращается в Free20 изменением константы или activationAt.
Новый протокол является подготовленным кодом, не подтверждением работы Free20.

## Новый формат

`packages/protocol/src/hosting-time.ts` вводит отдельную `hostingTimeVersion: 1`.
Она независима от существующих policy/schema/media versions.
Снимок содержит владельца хостингового бюджета, комнату и ее generation,
монотонную последовательность, серверное время измерения и UTC-период со сбросом
ровно в следующую полночь. Это не JWT, entitlement lease или room admission.

Состояния времени:

- `daily_free`: бюджет 1200 секунд, использованная часть бюджета, остаток и
  признак расхода при host + guest. Использованное и оставшееся в сумме дают 1200;
  это снимок бюджета с текущим расходом, не сырой DB settlement и не второй ledger.
- `confirmed_unlimited`: подтвержденный источник paid/trial/manual и граница
  применимости утверждения. Это не замена существующего renewal/grace-контракта.
- `unknown`: нет подтвержденных данных. Отсутствие/null/ошибка версии не становятся
  безлимитом или разрешением хостинга.

Время не содержит переопределения `hostPlanCode` или capacities. Будущее снятие
таймера сможет сосуществовать с исходными Free v3 caps 4/4/4; этот блок не реализует
покупку и не меняет pinned room capabilities или персональную history.

`hosting-time-snapshot.ts` предоставляет чистое чтение и проверку порядка снимков.
Ожидаемые owner/room/generation и UTC-день приходят от текущего подтвержденного
контекста, а не копируются из входящего снимка. Старые/повторные/чужие данные
отклоняются. После завершения комнаты ее контекст должен быть очищен.
Функция не авторизует действие, не проверяет текущую свежесть paid-права, не
завершает и не возрождает комнату, не запускает таймеры и не пополняет бюджет.

`resetAt` означает границу периода, а не дедлайн закрытия комнаты. Достижение
полуночи на клиенте не выдает новые минуты. Обработка rollover/expiry/payment,
проверка paid freshness и durable settlement относятся к следующим блокам.
Новый warning threshold, UI и хранение факта показа здесь не определены.

## Совместимость и ограничения

Текущие web/extension-парсеры отвергают Free canHost=true при активной paid-hosting
политике. Само remainingSeconds=1200 проходит старый quota v1 как обычный остаток
от 1800; это не согласование Free20. Дополнительные поля strict-объектов или новый
policy literal нельзя отправить старому клиенту без согласованного допуска.
В этом блоке новый формат нигде не отправляется; legacy parsers не ослабляются.

Исходники соответствующих parser/contract файлов frozen Store 0.1.4 (`b49bbab0`)
совпадали с исследованной базой. Текущая публикация и фактический CRX не проверены;
локальные fixtures не заменяют Store acceptance. Перед включением нужны точный
артефакт, механизм совместимости/обновления и согласованный пользовательский flow.

## Проверки

Локальная реализация завершена. Добавлены 11 protocol-тестов и 4 проверки
реальных web/extension-потребителей. TDD: сначала 11 ожидаемых ошибок отсутствующего
контракта при 245 проходящих исходных тестах; после реализации все проходят.

- `pnpm check`: 6/6 задач успешно.
- `pnpm test`: protocol 256, API 272, extension 2455; Web 1371 passed, 6 skipped.
- `pnpm --filter @anidachi/api test:runtime`: 111/111.
- `pnpm harness:rooms`: 39/39 сценариев.
- `pnpm dev:check`: рекомендует web/extension/api/rooms/docs по путям.
- Независимое ревью кода блока: соответствие scope и качество подтверждены,
  замечаний не найдено. Это ревью исходников, не staging или Store acceptance.

Все команды выполнялись через Node 22.23.1 и pnpm 11.2.2. Новый worktree получил
зафиксированные зависимости из локального кеша; lockfile не изменен.

Полный прогон не был бесшумным: существующие UI-тесты выдают React act warnings,
Web использует experimental MockTimers и выводит диагностические сообщения
проверяемых ошибок; локальный Workers runtime сообщил overdue alarm, его тесты
прошли. Шесть Web-проверок пропущены из-за отсутствия disposable RPC/benchmark
fixtures (preview, production, large-account, catalog, clear-generation, bounded
RPC). Это ограничение доказательств, а не подтверждение этих внешних сценариев.

Исключение из широкого профиля: staging build/validation, real-WebRTC и live smoke
не выполнялись, поскольку ни один текущий HTTP/WS/UI/DO consumer не подключен
к новому модулю, wire shape, media и manifest не изменены. Они нужны при будущей
интеграции/доставке. Текущие тесты не доказывают новый runtime-учет или оплату.

## Документы и Graphify

Согласованные spec/plan/handoff скопированы из исходной папки, которая осталась
нетронутой. В этой ветке только их статус и ссылки приведены к блоку 1А; продуктовые
правила не менялись. Отдельный managed worktree выбран, потому что исходный
закреплен за предыдущим чатом; основной checkout содержит чужую работу.

Свежая semantic extraction пяти полных документов: 38 узлов, 60 связей,
1 hyperedge; хеши источников и provenance проверены. Безопасный адаптер снова
завершился на существующей ошибке pending AST:
`Unresolved cross-source AST node: anidachi_protocol (@anidachi/protocol)`.
До публикации дело не дошло; SHA-256 всех трех curated graph artifacts
(`graph.json`, `GRAPH_REPORT.md`, `manifest.json`) остались прежними. Граф не
считается обновленным. Manifest не удалялся, lossy merge не применялся; ремонт
постороннего инструмента не включен в этот блок. После его исправления нужна
новая extraction, включая эту запись результата. Это документированное
исключение quality gate, не ошибка runtime Free20.

Финальное ревью всей ветки нашло одну противоречивую фразу в скопированной
спецификации о terminal end. Формулировка исправлена в соответствии с уже
согласованными D3/D5 и повторно проверена: исключение только для еще живой
комнаты, поздний alarm не возрождает истекшую. Открытых замечаний ревью нет.

## Rollback и следующий шаг

До подключения формата rollback — обычный revert локального блока. Миграций,
нового сохраненного runtime-state или платежных операций для отмены нет.
После будущей активации такой rollback не предполагается безопасным автоматически:
потребуется сохраняющий учет совместимый runtime или forward fix.

Следующий блок предлагается и согласуется отдельно. Он должен связать Free20
с существующей серверной authority и UTC-ledger, сохранив trial/paid/renewal,
ACK/settlement и защиту одного активного хостового назначения. Разработка этого
блока не разрешена одним завершением 1А.

## Блок 2А: расчет на существующих данных

Добавлен `apps/web/lib/anidachi-auth/free20-account-budget.ts`. Он использует
реальный `resolveAccountEntitlements` и существующие DB adapters
`resolveWatchHistoryAccess` / `getUsageSecondsForDay`. Новый reader пока не
импортируется HTTP/WS/room handlers. SQL, текущие payloads, grant resolution,
trial starts/renewal, Worker, UI и разрешения расширения не меняются.

Внутренний результат `Free20AccountBudget` привязан к владельцу и UTC-дню
из `history.serverTime`, полученного от БД. Часы вызывающего приложения не выбирают
дневной bucket. Для Free `committedSeconds` сохраняет сырой ledger total,
включая возможный overshoot; `remainingAfterCommittedSeconds` равен
`max(0, 1200 - committedSeconds)`. Повторные чтения не кешируют и не меняют расход.
Смена дня читает другой bucket без переноса остатка или очистки предыдущего.
Отрицательные, дробные, нечисловые и небезопасные целые значения отклоняются.
Ошибка DB/authority не превращается в новый бюджет или безлимит.

Plus/Pro, подтвержденные существующей authority из paid/trial/manual grants,
возвращают `unlimited` без чтения дневной Free-квоты. Это утверждение о режиме
расчета в момент authority, не разрешение хостинга и не новый бессрочный grant.
`refreshBy` ограничен следующей UTC-полуночью, текущей authority lease и сроком
выбранного плана. По достижении этой границы нужно заново получить authority;
она не означает автоматический Free downgrade или изменение условий trial.
Reader не запускает таймеры/опросы и не меняет сроки. Действующий DB resolver
сохраняет свой существующий locking/no-op/reconciliation contract.

`trialEligibility` и старый `trialEndsAt` не используются как запрет ежедневного
Free или доказательство текущего trial/paid. RPC не сообщает источник победившего
grant, поэтому здесь не угадывается `source` из контракта 1А. Для его выдачи
позже понадобится подтвержденный источник, вместе с room/generation и live usage.

### Граница расчета и следующей интеграции

Этот результат **не является live remaining или `HostingTimeSnapshot`**. База
может еще не содержать открытый интервал, pending ACK или незавершенный settlement.
Он не резервирует минуты, не допускает новую комнату, не возвращает использованное
и не отменяет защиту одного host assignment. Перед admission/выдачей live снимка
будущий runtime должен согласовать сохраненный и живой расход ровно один раз,
соблюдая settlement/fencing. Это отдельный этап, не доказанный тестами 2А.

Проверки 2А: 17 новых тестов используют настоящий account resolver с подменой
только внешних DB reads. Фокусный набор вместе с legacy-проверками — 34/34.
TDD: новый файл тестов сначала падал из-за отсутствия модуля, 17 baseline-тестов
проходили; после реализации новый набор проходит. `pnpm check` — 6/6;
`pnpm test` — 6/6 (Web 1388 passed, 6 skipped; неизмененные пакеты из кеша).
Шесть существующих внешних RPC/benchmark skips и известные предупреждения
описаны выше; реальные аккаунты, Stripe и база этими локальными тестами не менялись.

Delivery блока 2А и финальное ревью фиксируются в его PR. Отдельные local
real-WebRTC/Worker runtime/extension builds не требуются для этого выключенного
web reader: соответствующий runtime/manifest не менялся; CI выполняет свои gates.
Rollback до интеграции — revert этого модуля/тестов/docs через staging PR,
без отмены миграций и без очистки каких-либо пользовательских данных.

## Блок 2Б: сохраненный расход плюс живой интервал

Добавлены внутренний `Free20RoomBudgetRequest` / `Free20RoomBudgetCheckpoint`
в `packages/protocol/src/free20-room-budget.ts`, выключенный web producer
`apps/web/lib/anidachi-auth/free20-room-budget.ts` и чистая Worker-сверка
`apps/api/src/free20-room-budget.ts`. Новые функции не импортируются действующими
HTTP/WS/DO handlers; payloads, текущий Free1800, TTL/grace, UI, billing, grants,
схема SQL и окружения не переключаются. Это не выпуск Free20 для пользователей.

Producer проверяет существующую Free-комнату, последовательно подтверждает
переданные накопительные UTC-buckets через `commit_room_usage_day_v1`, затем
читает account authority и usage через reader 2А. Ответ содержит ACK и post-commit
account total вместе. Владелец берется из комнаты в БД; текущий generation 1
проверяется до записей. Завершение/смена владельца проверяется повторно перед
ответом. Partial commit может сохраниться при ошибке, но ответ с бюджетом не
выдается; retry использует те же cumulative totals. Уже подтвержденные секунды
повторно не отправляются в commit. Действующий SQL и его идемпотентность сохранены.

Нельзя вычитать из произвольно прочитанного ledger сумму `live - local ACK`:
при потере ответа ledger уже может включать эти секунды. Вместо этого consumer
сверяет весь ответ с сохраненным запросом, owner/room/generation/sequence/UTC и
authority freshness, проверяет полный точный ACK, затем применяет его целиком.
ACK впереди durable checkpoint считается неопределенностью, а не лишним кредитом.
Неполный/старый/чужой ответ не меняет meter и не дает нового бюджета.

Допустимый накопительный расход комнаты:
`max(0, 1200 - accountCommitted + roomAcknowledged)`; оставшееся время вычитает
из этого значения текущие cumulative room seconds ровно один раз. В пределах
одного дня допустимое значение только уменьшается. Пример: 420 секунд из прошлых
комнат + 180 текущих = 600 остатка до и после commit, повтора и restart.
Текущая authority по истечении `refreshBy` требует обновления, не продления
или автоматического downgrade. Unlimited от 2А не превращается в Free или
выдуманный paid/trial/manual time right: этот переход готовится в блоке 4.

В budget сохраняется ACK, с которым он был рассчитан. Meter при восстановлении
должен содержать как минимум эти секунды; неполное восстановление не возвращает
время. На новом UTC-дне старый ACK закрывает только старый bucket, минуты не
переносятся. View не создает новый дневной бюджет при локальном достижении полуночи.

### Проверки и граница доказательства 2Б

Новые protocol/API/web tests проверяют контракт, полный pipeline producer→meter,
потерю ACK после commit, retry без двойного списания, no-write renewal, partial
commit, scope/order/time fences, overshoot, неполное восстановление и UTC split.
Реальные account resolver и room meter используются с подменой только DB boundary.
Это проверка orchestration; реальная SQL concurrency и живой аккаунт не проверялись.

Существующий Cloudflare runtime harness расширен тестовой authority 1200 секунд
при сохранении default 1800: host alone, host+guest при paused playback, guest
reconnect, hibernation, ACK-before-end, обычная/точная/запоздалая UTC-полночь и
недоступный учет. Истекшая до полуночи комната завершается по прежнему deadline.
Это доказательство работы существующего DO-механизма с таким лимитом, а не
выдачи нового checkpoint через рабочий endpoint или пользовательской приемки.

Будущее подключение обязано сохранять единственный serialized DO lifecycle,
durable checkpoint и sequence до внешнего I/O, meter+budget вместе после ответа,
active-host assignment до полного settlement, terminal-before-rollover и
совместимость старых клиентов. Новый checkpoint не является admission, reservation,
room lease или публичным `HostingTimeSnapshot`; ни один из этих gates не обходится.
Новых polling/cron/таймеров/записей на playback heartbeat нет. Действующие media
и P2P не меняются. Общие блоки 1–3 и paid-live transition остаются незавершенными.

Финальные checks/review и delivery фиксируются в PR блока 2Б. До runtime wiring
rollback — revert этого выключенного кода/тестов/docs через staging PR; данных
для удаления или миграций для отката нет. После включения такой rollback должен
оцениваться заново с сохранением накопленного расхода.

Локальная проверка 2Б: `pnpm check` 6/6, `pnpm test` 6/6 (protocol 260,
API 283, Web 1397 + 6 existing skips, extension 2455); Cloudflare runtime 117/117,
room harness 39/39. 24 новых protocol/API/web tests сначала падали без реализации;
дополнительная проверка неполного восстановления также показала RED→GREEN.
Шесть дополнительных runtime cases подтверждают существующее поведение с 1200.
Отдельная ручная browser/реальная SQL/платежная приемка этим не заменяется.

Для Graphify в предыдущих блоках зафиксирован исходный сбой safe adapter:
`Unresolved cross-source AST node: anidachi_protocol (@anidachi/protocol)`.
Повторная semantic/safe-adapter попытка 2Б и неизменность team artifacts при
ошибке фиксируются в PR. Восстановление graph tooling не входит в этот блок;
граф не считается актуальным, важные выводы проверены по исходникам.

## Блок 3А: runtime с выключенной настройкой

`POST /api/internal/rooms/:roomId/free20-budget` требует существующий room service
bearer и точное серверное `ANIDACHI_FREE20_ACCOUNTING_ENABLED=true`. По умолчанию
ответ `503 FREE20_ACCOUNTING_DISABLED` приходит до DB access. Strict request
должен совпасть с roomId URL и generation 1; owner никогда не берется у клиента.
Worker использует один bounded callback без redirect, в котором возвращаются
post-commit checkpoint и подписанный pinned media lease. Для этого пути
`issueRoomPolicy` пропускает старое quota-чтение: account usage читается один раз.

Worker выбирает новый путь только при начальной настройке Free media room и
явном opt-in. Уже выбранный режим сохраняется в SQL `room_meta` под
`room_free20_accounting_v1`; отсутствие переменной после restart не превращает
его в legacy. Существующие комнаты, paid комнаты и default-off путь не меняются.
Флаг не дает admission: действующие проверки room token и web admission остаются.
Настройка не внесена в Wrangler/Vercel и не включена на staging/production.

В существующей serialized lifecycle queue materialized meter, request и sequence
записываются до fetch. После проверки ответа meter ACK и budget записываются
одной `storage.transactionSync`; synchronous SQL failure откатывает оба значения.
Кеш обновляется после записи. Media policy остается в KV; после hibernation ее
budget/refresh восстанавливаются из SQL-пары, поэтому crash между этими записями
не возвращает минуты. Неизвестное/поврежденное состояние не заменяется новым
полным лимитом. Это не новая transaction между Cloudflare и Supabase.

Потерянный ответ оставляет cumulative usage и pending request. Новый запрос с
большим sequence обязан покрывать все старые неподтвержденные buckets. ACKs,
ledger total, owner/room/generation/day/sequence и freshness проверяются вместе.
Terminal использует прежний settlement-only callback и его bounded backoff;
сохраняет запрос до I/O, подтверждает полный расход до finalize/release и не
выдает новый бюджет. Данные SQL очищаются только вместе с terminal tombstone.

Если callback пересек UTC midnight, старый ответ не применяется; разрешена ровно
одна повторная cumulative сверка нового дня. До rollover и после callback
проверяется deadline старого бюджета: истекшая до полуночи комната остается
завершенной и учитывается только до ее deadline. Остаток не переносится.
При ошибке/неподтвержденной authority кандидат закрывает комнату и доводит
settlement через существующее recovery. Новый grace/payment hold не добавлен.
Это консервативное поведение при временном сбое требует будущей live-приемки.

Один существующий alarm обслуживает quota/UTC/обязательную authority refresh.
Отдельного quota polling нет. Старый warning на 5 минут не выдается и не
планируется в новом режиме: порог нового предупреждения еще не согласован.
Playback/media heartbeat и P2P не меняются. Новые public snapshot/UI,
совместимость Store-клиентов, room admission и live paid/unlimited остаются
отдельными незавершенными блоками. Этот флаг пока нельзя считать готовой активацией.

Runtime-тесты проходят через настоящий workerd/SQLite и подписанные room tokens;
внешняя Web/DB boundary подменяется. Отдельные Web route tests проходят через
реальный producer/resolver/signing с подменой только Supabase HTTP. Это не
реальная SQL concurrency, реальный аккаунт, покупка или browser acceptance.
Измерение одинаковых 20 playback frames для Free solo и host+guest до/после:
20 необходимых room-state SQL writes, 0 meter/Free20/KV/alarm writes и
0 quota/budget callbacks. На authority refresh запись request и ACK обязательна.

До активации rollback — revert через staging PR: реальных candidate-rooms/новых
данных нет. После будущего включения старый runtime, не знающий SQL marker,
не является безопасным rollback. Сначала прекратить выбор нового режима,
сохранить понимающий marker runtime и завершить/settle выбранные комнаты.
Отключенный Web gate заставляет их fail-closed и сохраняет terminal recovery;
удалять счетчики или сбрасывать ledger нельзя. Production promotion требует
отдельного разрешения после staging acceptance.

Локальные проверки 3А: `pnpm check` 6/6; `pnpm test` 6/6 (protocol 260,
API 290, Web 1401 + 6 прежних skips, extension 2455); workerd runtime 126/126;
room harness 39/39; staging extension собран и validated с narrow permissions.
Подтверждены SQL rollback вместе с неизменным cache и восстановление из SQL
при старой policy KV без budget. Lint не содержит ошибок; существующие warnings
в больших runtime/test файлах фиксируются в PR. Свежий whole-branch review,
Graphify safe-adapter attempt и точные SHA/deployment/artifact/smoke результаты
доставки фиксируются в PR. Локальный real-WebRTC повтор не выполнялся: media
код не менялся, default-off регрессии проверяет CI E2E P2P перед merge.
