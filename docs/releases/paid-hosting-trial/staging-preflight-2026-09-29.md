# Подготовка trial к staging — 29 сентября 2026

Последующий статус: schema #375 и Web #377 уже поставлены на staging;
trial/T выключены. Авторизованная admission-проба прошла внутри staging-сборки
Vercel; предварительное условие третьей фазы выполнено, Worker еще не развернут.
[Фактический отчет поставки](staging-delivery-2026-09-29.md) обновляет исторический
локальный checkpoint этого документа. Ручная приемка владельца остается открытой.

Подготовка разрешена владельцем; отправка и удаленные изменения еще не выполнены.
Ручную приемку сайта, Stripe и расширения проводит владелец. Этот документ
фиксирует локальную готовность поставки, а не завершенную приемку новой модели.

Последующий checkpoint сайта `e0f8a21e` добавляет путь P11 Restore renewal и
исправляет повторную покупку с первого клика. Он также сохраняет старый staging
ZIP `cb7f7a86` для проверки перехода. [Состав минимального сайта и свежие проверки](minimum-website-2026-09-29.md)
дополняют результаты `59d6e80e` ниже; реальные P11 и staging не приняты.

## Проверенный исходник и границы

- Основная ветка: `codex/paid-hosting-transition-plan`; проверенный продуктовый
  коммит полного preflight `59d6e80e`, минимальное дополнение billing `e0f8a21e`.
- Получен актуальный `origin/staging` `cb7f7a8642a3817c4cfe428fa63f78c6044fefe3`.
  Изменение домена `86912cb0` уже отменено этим upstream-коммитом. Локальный merge
  `432595ac` прошел без конфликтов и не изменил продуктовый код feature-ветки.
- `origin/main`: `a5a0134e1d661324061e10ef611dfb373cbe47bd`.
- Основной checkout: `/Users/vladyslavhulyi/.codex/worktrees/paid-hosting-plan/anidachi-LP-monorepo`.
  Отдельный checkout поставки: `/Users/vladyslavhulyi/.codex/worktrees/trial-staging/anidachi-LP-monorepo`.
  Он нужен для проверки промежуточного состояния без остановки localhost.
- Push, PR, remote merge, deploy, удаленные миграции, изменения Stripe/Vercel/Vault,
  включение новой политики и публикация Store не выполнялись.

## Что исправлено перед поставкой

Независимое ревью всей feature-ветки исключало сгенерированный граф и проверяло
разницу `cb7f7a86…432595ac`. Найдены и исправлены три дефекта:

1. Запоздалый connect после финализации мог вернуть комнате `live` из старого
   снимка `lobby`. Обновление теперь атомарно исключает `ended`; connect без
   обновленной строки возвращает 404 и не выдает token. Регрессия проверяет
   порядок `claim → finalize → delayed PATCH` через настоящий HTTP-обработчик.
2. Переход в Portal мог оставить `pending` reservation без созданного Checkout.
   После отмены подписки за пределами 23 часов это блокировало новое оформление.
   Управление и завершение старого checkout теперь определяются до reservation;
   если подписка появляется позднее, реальная сессия сначала согласуется или
   подтвержденно истекает. Неизвестный результат Stripe не освобождается по возрасту.
3. Пока доставка cutover задержана, исчерпанная старая Free-квота могла скрыть
   новый запрет хостинга. Frozen Free-комната после T теперь получает
   `HOST_SUBSCRIPTION_REQUIRED` до чтения квоты, в том числе после покупки плана.
   Недоступная authority сохраняет 503; обычный pre-T вход работает.

Для этих ошибок получены падающие тесты до исправления и проходящие после.
Также исправлены два блокирующих lint `any` в новых тестах. Коммит: `59d6e80e`.

## Выполненные проверки

| Проверка | Фактический результат |
| --- | --- |
| Root `pnpm check` / `pnpm test` | 6/6 задач; до исправлений 4 задачи из cache, web/extension выполнены заново |
| Web после исправлений | Typecheck; 785 passed, 6 прежних skips; lint без ошибок, предупреждения остаются |
| Protocol / API / extension полного кандидата | 203 / 248 / 2109 tests; исходники этих пакетов после проверки не менялись |
| Workers runtime полного кандидата | 86/86, 4 файла, настоящий локальный workerd |
| Room signaling harness | 39/39 |
| Текущий WebRTC Chromium harness | 26/26; локальные синтетические участники, не опубликованный Store-клиент |
| Полный SQL replay | 69 миграций в отдельной пустой PostgreSQL 17.6 |
| Сохранность заполненной БД | Второй одноразовый контейнер: canonical users/subscriptions/history/access fences сохранились; policy dormant |
| Полная SQL-матрица | 1360/1360 assertions в 34 файлах, включая 12 cutover concurrency assertions |
| Checkout concurrency contract | Один reservation ID при двух запросах; complete/expire не коммитятся одновременно |
| Room concurrency contract | Перекрестный host/member без deadlock; поздний Free insert после T отклонен |
| Worker bundle | `wrangler deploy --env staging --dry-run` успешно; deploy не выполнялся |
| Сборка сайта | `next build` успешно в отдельном checkout, Preview/staging origin, без подключения платежных учетных данных; cache:jikan не запускался |
| Узкое расширение | `build:extension:staging` и `validate:extension:staging` успешно |
| Промежуточный Web + старые Worker/extension | Все 6 check/test задач; protocol 203, старый API 235, старое extension 2039, web 785 + 6 skips; старый Workers runtime 75/75; dry-run bundle успешен |

SQL-тесты работали только в новых контейнерах с `--network none`, без открытых
портов. Для dblink настроена парольная loopback-аутентификация внутри контейнера;
первичные ошибки настройки стенда устранены до итогового полного прогона.
Существующая локальная БД ручной приемки не сбрасывалась.

Логи находятся в игнорируемом каталоге
`.superpowers/sdd/2026-09-27-paid-hosting-and-trial-transition/staging-preflight-20260929/`.
Логи промежуточной поставки скопированы туда из `/private/tmp`.

## Почему поставка разделена

Текущие GitHub workflows применяют SQL и выкладывают Worker независимо от Git
deploy сайта в Vercel. Новый Web требует новые RPC/таблицы, а новый Worker — уже
отвечающий Web admission. **Всю исходную feature-ветку одним merge отправлять нельзя.**
Workflow не менялся: подготовлены последовательные локальные ветки.

| Порядок | Ветка и исходный коммит этапа | Состав и условие перехода |
| --- | --- | --- |
| 1 | `codex/trial-stage-schema`, `2444815c` | 6 новых миграций, SQL tests/contracts; дождаться remote migration success, сверить 69 версий, `activation_at IS NULL`, trials off, scheduler disabled, отсутствие cutover operation/targets |
| 2 | `codex/trial-stage-web`, `b0f4188f` (исходный `207bbf58`) | Web billing/admission/drain и additive protocol; включает минимальные billing fixes `e0f8a21e`. Дождаться Vercel READY и проверить новые endpoints/authority. Из-за protocol path workflow повторно выкладывает прежний Worker; эта комбинация проверена локально |
| 3 | `codex/trial-stage-runtime`, код `af9f8795` + merge `f94d6590` | Worker, extension, harnesses, минимальный billing из фазы 2, затем текущие документы/граф. Выполнять только после работоспособности Web admission. Сверить Worker deployment и итоговый source; загрузить подготовленный ZIP для ручной приемки |

Ветки складываются в проверенный продуктовый tree `e0f8a21e`: сравнение всех
`apps`, `packages`, `scripts`, `tests`, зависимостей и workflows не дает отличий.
Ветки 2/3 содержат предшествующие этапы, поэтому PR в staging открываются по
очереди после принятия предыдущего. Перед каждым PR повторно проверить новый
upstream; чужие изменения не заменять подготовленным снимком.

Каждый этап проходит `pnpm dev:check`, CI и проверку фактического deployment.
PR-описания подготовлены локально по шаблону. Automation promotion classifier
относит этот diff к ручному рассмотрению; автоматического разрешения main нет.

## Проверка внешних систем только на чтение

Снимок получен ночью 29 сентября по Asia/Ho_Chi_Minh (28 сентября UTC).

- GitHub staging CI `36453618273`/`36453613371`, migrations `36453613332`
  и smoke `36453933372` успешны для существующего upstream. Это не CI кандидата.
- Vercel staging `dpl_GyqbbyPno4KJcJyQjYcudTUoyxFb`, SHA `cb7f7a86`, READY.
  Страница staging возвращает password gate и `noindex, nofollow`.
- Supabase staging `cyppqpprkygjloyfvvvj`: ACTIVE_HEALTHY, 63 миграции,
  последняя `20260914151946`. Новых hosting policy/operation еще нет.
  Personal history policy уже активна. Все 6 наших миграций ожидают поставки.
- В Vercel Preview присутствуют имена TEST Stripe key/webhook/prices,
  Supabase, OAuth, JWT и internal room credentials; проверено наследование
  Preview и overrides именно staging. Значения не раскрывались и соответствие
  всех значений между сервисами этим чтением не доказано.
- Worker staging доступен: GET `/` возвращает `ok:true`, `service:anidachi-api`.
  `/health` не является его health route. Имена JWT/internal/TURN secrets есть;
  значения не читались. Это не проверка авторизованного room flow кандидата.
- Подключен правильный AniDachi Sandbox `acct_1RlmiIPQIEOqG7pr`, `livemode=false`.
  Имена переменных `_TEST` относятся к этому Sandbox, не к другому Test mode.
  Endpoint `we_1Tkl14PQIEOqG7prAB0aLM7a` включен, URL
  `https://staging.anidachi.app/api/stripe/webhook`, API `2025-06-30.basil`.

## Что подготовить удаленно после разрешения на staging

1. Добавить `invoice.payment_action_required` к существующему webhook AniDachi Sandbox,
   сохранив остальные события. Локальный registration script уже содержит его;
   endpoint пока не менялся. Без этого нельзя принимать сценарий первого 3DS.
2. Создать отдельный **staging** `ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET` в Vercel
   и совпадающее значение в Vault под именем `anidachi_hosting_cutover_drain_secret`.
   Оба сейчас отсутствуют. Не переиспользовать room/notification secrets.
   После env change нужен новый Web deployment. В Worker этот секрет не нужен.
3. После трех поставок проверить авторизованный admission, dedicated drain,
   private schema/ACL, фиксированный URL, pg_net и Cron при выключенной политике.
   Секреты и scheduler относятся к репетиции активации; отсутствие секрета не
   дает оснований включить политику или признать drain рабочим.
4. Подтвердить Sandbox account/price mapping действующего сайта, webhook signing,
   Portal cancellation, recovery и настройки trial email. Не включать Portal
   plan updates с `trial_update_behavior=end_trial` для согласованной смены плана.
5. Сохранить версии/deployment IDs и только затем согласовать тестовую активацию.
   Все production env, LIVE Stripe, main и Store остаются отдельным этапом.

## Артефакт для владельца

- ZIP: `artifacts/anidachi-extension-staging-59d6e80e.zip`.
- Размер: `708726` bytes; manifest version `0.1.0` (staging, не Store release).
- Build ID в собранном коде: `59d6e80e-staging-20260929004849`.
- SHA-256: `f352982d6b5749e047f2631c58c4e090a846b6c356a31c6376d6df986d55c7fe`.
- Только YouTube/Crunchyroll и staging Web/Worker host permissions; нет broad
  permissions. Этот ZIP не отправлялся в Store и не устанавливался за владельца.

## Открытые условия приемки

Владелец проходит [матрицу плана](../../superpowers/plans/2026-09-27-paid-hosting-and-trial-transition.md#задача-7-сквозная-приемка-staging)
после доставки и подготовки AniDachi Sandbox. Обязательно проверить:

- Новый и существующий Free → один trial с картой → Plus/Pro → исходные 72 часа;
  повторная попытка не создает второй trial/подписку.
- Оплата, отказ, 3DS, задержка/перестановка webhook, отмена и смена Plus↔Pro.
  Для P11 «отмена → повторное включение продления» кнопка и серверный путь добавлены
  локально в `e0f8a21e`; реальный Portal → возврат → сохранение исходного срока
  должен подтвердить владелец. Этот пункт еще не принят.
- Free join в paid/trial room, просмотр дольше 30 минут/UTC, отсутствие новой
  личной истории и сохранение read/Resume/delete прежней.
- Две реальные учетные записи/профиля, точный старый опубликованный Store-клиент,
  новый ZIP, reconnect, reload, смена аккаунта, аудио/видео cleanup при закрытии.
- Настоящая Cron → Web → Worker → Web/SQL доставка, измеренная задержка закрытия,
  sleep/restart/outage/потеря ACK и все targets в завершенном состоянии.
- Неподтвержденный legacy terminal tombstone: доказать отсутствие среди targets
  либо подготовить и принять безопасное восстановление. Нельзя записать ему
  выдуманный fence или отбросить outbox.
- Старые checkout URLs и сохранность реальных staging данных до/после миграций.
  Остальные marketing/help/SEO/Store обещания согласовать до production T.

До активации rollback возвращает совместимые потребители, оставляя добавочную
схему. После T откат не стирает T, consumed trials или pending closures и не
воскрешает Free-комнаты: действует [runbook восстановления](cutover-operations.md).
