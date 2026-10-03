# Поэтапная поставка trial на staging — 29 сентября 2026

Это отчет о фактической поставке, а не подтверждение готовности production.
Владелец разрешил подготовленную поставку в AniDachi Sandbox и staging. Активация
новой модели, main/production, Chrome Web Store и ручная приемка в этот блок не входят.
Правила продукта сохраняются: один трехдневный trial с картой для любого Free
с неиспользованным trial; закрытие существующих Free-комнат только при отдельном T.

## Фактическое состояние

Снимок runtime-поставки зафиксирован для merge 50a054b3. Последующие коммиты
самого отчета и графа не меняют продуктовый код; deployment IDs ниже относятся
к указанным проверенным фазам, а не к будущим пересборкам документации.

| Этап | Результат |
| --- | --- |
| AniDachi Sandbox | Используется согласованный Sandbox, livemode false. В существующий staging webhook добавлен invoice.payment_action_required; прежние семь событий, URL, API version и enabled status сохранены. Plus $7.99/месяц и Pro $14.99/месяц проверены. Default Portal active, отмена at_period_end, смена плана в Portal выключена |
| Отдельный ключ закрытия комнат | Новый случайный ключ помещен в staging Vault и sensitive-переменную Vercel только Preview/staging. Значение не записывалось в файлы и не выводилось. Совпадение Vault с отправленным значением проверено; последующая HTTP-проба подтвердила совпадение с Web |
| База | [PR #375](https://github.com/AniDachi/anidachi-LP/pull/375), merge 4ffdc7c8a1bdcdcf72b764b48e80da0b828c80d4. [Миграции](https://github.com/AniDachi/anidachi-LP/actions/runs/36475524072) завершились успешно; 69 версий, включая все шесть новых |
| Сайт и billing/admission API | [PR #377](https://github.com/AniDachi/anidachi-LP/pull/377), merge f8a90d219649ab8918d322e40b627390656a7d9e. Первый Vercel deployment dpl_AKcLbMFp5R4L3W2MzUru8PkgmYYg READY; последующая диагностическая пересборка того же SHA dpl_8ZTqRaH3ZETgwf2vH7Qkoac2tEpt также READY и обслуживала staging.anidachi.app до runtime-фазы. PR CI, room signaling, P2P, Vercel и staging smoke прошли; последующие staging CI и deploy также прошли |
| Worker после второй фазы | Повторно развернут прежний совместимый Worker, version 8125f458-2ba3-43b5-87f1-3946bf5eb32d, [workflow](https://github.com/AniDachi/anidachi-LP/actions/runs/36476411540). Это исторический checkpoint второй фазы; затем заменен Worker из #378 |
| Третья фаза | [PR #378](https://github.com/AniDachi/anidachi-LP/pull/378), merge 50a054b340dd81607e2e0dc502a760f724f65d95. Новый Worker 78e5de69-f2dc-42f6-b5d7-e44cc4b24f82 развернут на 100% staging; Vercel dpl_HPZFYmKPbFZKDHdGdg95V46dCKTk READY на staging.anidachi.app. CI, deployments, extension build и технические smoke прошли |
| Новые правила | activation_at NULL, revision 1, trials_enabled false; scheduler disabled, без operation/outbox/trial rows. Никакая комната не закрывалась этим переходом |
| Main | Остается a5a0134e1d661324061e10ef611dfb373cbe47bd. Автоматика открыла [promotion PR #376](https://github.com/AniDachi/anidachi-LP/pull/376); auto-merge выключен, PR не слит |

## Проверки и точная граница доказательств

До и после миграций совпали количества: 62 users, 6 subscriptions, 503 rooms,
113 history title summaries, 247 history session summaries, 0 history receipts.
Personal history policy осталась active. Это проверка сохранения количеств;
байтовая сохранность удаленных строк этим сравнением не доказывается. Полный
популяционный SQL replay и проверки сохранности уже есть в локальном preflight.

У всех шести новых таблиц включен RLS и нет прямого SELECT у anon/authenticated.
Admission RPC разрешен service_role и закрыт для пользовательских ролей;
активация закрыта и для service_role. Security advisor выдал только INFO
rls_enabled_no_policy, ожидаемый для существующей серверной модели доступа.

RPC check_room_hosting_socket_v1 выполнен от service_role с несуществующим room/user
и вернул allowed false / ROOM_ENDED. Он берет FOR SHARE, поэтому формально read-only
transaction для него неприменима; проверочный вызов не создавал данные.

Из staging Supabase через настоящий pg_net выполнен POST в Web cutover/drain с
ключом из Vault, при нулевых operation/target и выключенной модели. Ответ ровно
HTTP 200 {"ok":true}, без timeout и остатка очереди. Это доказывает транспорт,
совпадение dedicated key, проход служебного запроса через staging gate и доступ
Web к RPC базы. Это не доказывает закрытие комнаты или цепочку до Worker.

Без авторизации оба новых внутренних endpoint возвращают 401. Сайт сохраняет
password gate/noindex, robots Disallow: / и пустой sitemap; unsigned Stripe
webhook возвращает 400 Missing stripe-signature. Сохраненные Vercel sensitive
значения не выдаются env run — это не означает, что их нет в deployment.

## Авторизация подтверждена без выгрузки ключа

[Runbook](cutover-operations.md) требует рабочий Web admission до нового Worker:
новый Worker вызывает его при каждом WebSocket upgrade. Предварительное условие
подтверждено настоящим HTTP-запросом, а не только наличием endpoint и SQL.

История настройки показала: 12 июля staging ANIDACHI_INTERNAL_API_SECRET был
сгенерирован, передан в Vercel и Cloudflare; временный файл удален. Запрашивать
его у владельца или считать отсутствие локальной копии поломкой не требуется.
Write-only настройки и работающие ключи не менялись.

Для проверки создана одноразовая пересборка уже развернутого staging-коммита
f8a90d219649ab8918d322e40b627390656a7d9e, Vercel
`dpl_8ZTqRaH3ZETgwf2vH7Qkoac2tEpt`. Ее команда сборки использовала существующий
ключ внутри Vercel и вызвала фиксированный staging admission для заведомо
несуществующих room/user. В журнале 2026-09-28T20:29:11.373Z получен HTTP 200 и
точный ответ:

```json
{"roomId":"deployment-readiness-nonexistent-room","roomGeneration":1,"allowed":false,"code":"ROOM_ENDED"}
```

Запрос уложился в установленный предел 8 секунд (по журналу около 3,35 секунды).
Секрет не выгружался, не печатался и не ротировался. Общие настройки проекта после
запуска остались `pnpm build` / `apps/web`; изменена только команда этой пересборки,
после пробы запускающая обычный `pnpm build`. Исходный код сайта тот же. Передача
ключа на клиент и ослабление staging gate не требовались.

Это подтверждает положительную служебную авторизацию, отсутствие redirect и
реальный admission через Web к Supabase. Это еще не проверка нового Worker,
живого WebSocket или пользовательской комнаты. Локальная прежняя JWT-проба
вернула INVALID_ROOM_TOKEN и не использовалась как доказательство staging.

## Завершенная третья фаза и оставшаяся приемка

Runtime PR #378 прошла [CI](https://github.com/AniDachi/anidachi-LP/actions/runs/36480745753),
[room signaling](https://github.com/AniDachi/anidachi-LP/actions/runs/36480745455),
[P2P](https://github.com/AniDachi/anidachi-LP/actions/runs/36480745454), Vercel и
[smoke](https://github.com/AniDachi/anidachi-LP/actions/runs/36481072811).
Merge 50a054b3 выполнен 2026-09-28T20:43:51Z. После merge прошли:

- [Staging CI](https://github.com/AniDachi/anidachi-LP/actions/runs/36481260147)
  и дублирующая CI promotion-PR; room/P2P также успешны.
- [Deploy Worker](https://github.com/AniDachi/anidachi-LP/actions/runs/36481260183),
  version 78e5de69-f2dc-42f6-b5d7-e44cc4b24f82, 100% трафика staging.
  Binding origin указывает staging.anidachi.app; прежние service/JWT secrets сохранены.
- [Build Extension](https://github.com/AniDachi/anidachi-LP/actions/runs/36481260140)
  и [migration workflow](https://github.com/AniDachi/anidachi-LP/actions/runs/36481260159).
- Vercel dpl_HPZFYmKPbFZKDHdGdg95V46dCKTk READY, alias staging.anidachi.app,
  точный SHA 50a054b3, обычная команда pnpm build без диагностического override.
- [Staging smoke](https://github.com/AniDachi/anidachi-LP/actions/runs/36481610343)
  и отдельный pnpm smoke:worker:staging против уже обновленного Worker.

Повторный SQL readback: activation_at NULL, revision 1, trials_enabled false,
scheduler false, operation/targets/trials 0; users 62, subscriptions 6. Rooms 504:
последняя дополнительная комната создана 20:05:02Z и завершена 20:15:46Z,
до новой версии Worker (20:45:08Z). Первоначальная проверка сохранения 503 rooms
относится к фазе миграций; последующее изменение счетчика не выдается за удаление
или миграцию данных. Технические пробы не создавали комнаты/аккаунты/подписки.

Main остается a5a0134e; production dpl_XTKdQCGK6YpQJsz1Zi5Awn5pzK2u READY
обслуживает anidachi.app/www.anidachi.app. Promotion PR #376 открыта без auto-merge.

Техническая поставка завершена при выключенной модели. Следующий шаг — ручная
проверка владельцем старого расширения с обновленным сервером при прежних правилах,
затем отдельно согласованная репетиция активации T на staging. Ручные
Sandbox/подписка/комнаты/P11/старый и новый клиент еще не приняты;
Task 7 остается открытой. Store и production не выпускались.

## Артефакты и откат

Старый staging ZIP cb7f7a86 и новый локальный кандидат 59d6e80e сохранены в
[отчете минимального сайта](minimum-website-2026-09-29.md). Не перезаписывать старую
unpacked-папку перед проверкой перехода. Новый ZIP еще не опубликован в Store.

До T возможен возврат совместимых потребителей с сохранением добавленной dormant
схемы; не удалять таблицы и данные. При уже совершенной активации действует
отдельный recovery runbook с сохранением T, использованных trials и outbox.

Технические детали без секретов: существующий локальный ledger и ignored receipt
.superpowers/sdd/2026-09-27-paid-hosting-and-trial-transition/staging-delivery-20260929/.
