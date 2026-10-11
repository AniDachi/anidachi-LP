# Cardless Three-Day Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать подходящему аккаунту один trial выбранного Plus/Pro на 72 часа без
карты, с отдельным явным подключением оплаты и безопасным окончанием без списания.

**Architecture:** Stripe создает Subscription через трехдневную полностью trial
фазу Schedule с `end_behavior=cancel`. Сервер AniDachi резервирует одноразовый trial и проверяет
права через существующий ledger; отдельный setup Checkout и подтвержденное
согласие позволяют переключить окончание Schedule на `release`, сохраняя исходный
trial_end. Новая политика выключена до приемки.

**Tech Stack:** Next.js, TypeScript, Supabase/Postgres, Stripe SDK 18.5.0 (lockfile;
package range ^18.3.0),
Stripe API 2025-08-27.basil, WXT extension, Cloudflare room runtime.

**Spec:** [Проект решения](../specs/2026-10-11-cardless-trial-design.md).

**Статус:** Выполнение согласовано 2026-10-11; идет Task 0 в отдельной ветке
`codex/cardless-trial` от `origin/staging` (`60df2876`). Владелец разрешил продолжить
проверку Subscription Schedule после объяснения отличий. Stripe-примитивы новой
схемы проверены, включая Checkout/3DS в браузере. Product code и выпуск не начаты.
Исходная обычная Subscription отклонена из-за обхода через старый Portal;
ее результаты сохраняются отдельно и не засчитываются новой схеме.
[Текущие доказательства и ограничения](2026-10-11-cardless-trial-acceptance.md).
Работа над дизайном расширения остается в исходном checkout. Production требует
отдельного разрешения после приемки staging.

## Global Constraints

- Длительность — ровно 72 часа от проверенного Stripe `trial_start`, один trial на аккаунт.
- Без подтвержденного подключения оплаты нет списания и двухчасового ожидания платежа.
- Существующие подписки, trial с картой, ручные права и цены сохраняют условия.
- Plus $7.99/месяц и $76.70/год; Pro $14.99/месяц и $143.90/год — исходный каталог,
  не новые цены. Повторно проверить каталог перед выпуском; использовать server-side Price mapping.
- Node 22.23.1, pnpm 11.2.2; Stripe API/SDK не обновлять в рамках задачи.
- Новые миграции additive; старые примененные миграции не редактировать.
- Auth, CSRF, owner fencing, idempotency и reconciliation обязательны для всех новых мутаций.
- Netflix, дизайн шторки, цены и новые рассылки не входят в release diff.
- Сначала согласование и staging. Production включается только после отдельного разрешения.

## Review Focus

1. У Customer уже есть карта: trial без согласия все равно заканчивается без платежной попытки — Task 0, 1.
2. Старый Checkout и два новых запроса соревнуются за trial: только одна подписка и один ledger — Task 1, 2.
3. Setup возвращается после истечения, отмены или смены аккаунта: не включает оплату/чужой доступ — Task 3, 4.
4. Stripe создал объект, но ответ/запись БД потеряны: повтор восстанавливает тот же объект — Task 1–3.
5. Код/флаг отключили после начала trial: существующие сроки и подтвержденные обязательства продолжают обслуживаться — Task 5, 6.

---

## Карта файлов

| Область | Существующие точки | Новые файлы/назначение |
| --- | --- | --- |
| Политика и ledger | `apps/web/supabase/migrations/20260927131509_paid_hosting_trial_foundation.sql`, `20260927132751_subscription_checkout_reservations.sql`, `20260927134951_stripe_trial_lifecycle.sql` — читать как контракты | Новая timestamped migration `*_cardless_subscription_trials.sql`; `apps/web/supabase/tests/cardless_subscription_trials.test.sql`; `apps/web/supabase/contracts/cardless_trial_contract.mjs` |
| Trial/Stripe | `apps/web/lib/anidachi-auth/subscription-trial.ts`, `subscription-checkout-server.ts`, `stripe-trial-state.ts`, `stripe-webhook-events.ts` | В той же папке `cardless-trial.ts`, `cardless-trial-server.ts`, `trial-renewal.ts`, `trial-renewal-server.ts` и соответствующие `*.test.ts` |
| Общий refresh | `apps/web/lib/anidachi-auth/stripe-subscription-sync.ts::syncStripeSubscriptionById` и consumers; сохранить lease, ownership и fresh Stripe reads | Обновить существующий refresh, не создать параллельный источник прав |
| API | `apps/web/lib/anidachi-auth/billing-routes.ts`, `apps/web/app/api/create-checkout-session/route.ts` | `apps/web/app/api/billing/trial/start/route.ts`, `renewal/quote/route.ts`, `renewal/setup/route.ts`, `renewal/complete/route.ts`, `renewal/cancel/route.ts` (renewal routes под `trial/`) |
| Управление подпиской | `apps/web/lib/anidachi-auth/billing.ts`, `trial-plan-change.ts`, `billing-routes.ts` | Для cardless trial consent-aware путь; paid/legacy Portal сохраняет поведение |
| Предложение | `apps/web/lib/anidachi-auth/pricing-offer.ts`, `apps/web/lib/pricing-offer.ts`, `apps/web/lib/checkout-selection.ts` | Совместимые optional-поля; новые типы в `cardless-trial.ts`/`trial-renewal.ts` |
| Сайт | `apps/web/components/pricing.tsx`, `primary-checkout-cta.tsx`, `sticky-mobile-checkout-bar.tsx`; `apps/web/app/checkout/checkout-continuation.tsx`; `apps/web/app/account/billing/billing-client.tsx`; `apps/web/app/success/checkout-session-sync.tsx`; `apps/web/lib/billing-view.ts` | Точечные сценарии trial/оплаты и mode-aware объяснения |
| Расширение/права | `apps/extension/src/hosting-paywall.tsx`, `hosting-access-client.ts`, `use-hosting-access.ts`; `packages/protocol/src/room-hosting.ts` | Только совместимые поля/тексты/refresh; room event и P2P protocol не расширять без необходимости |
| Измерение | `apps/web/lib/conversion-events.ts`, `apps/web/components/analytics-events.tsx` и существующий серверный publisher | `apps/web/lib/anidachi-auth/trial-conversion-events.ts` — дедуплицированные подтвержденные переходы через текущую аналитику |
| Документация | `docs/current-development-state.md`, доменные billing docs, release checklist | Обновляются при реализации/приемке, а не как заявление готовности сейчас |

Новые таблицы ниже закрыты от anon/authenticated: доступ через server-only RPC.
Все точные timestamp-префиксы миграций выбираются при реализации после сверки
последней migration. Не переиспользовать опубликованные номера.

## Task 0: Проверить Stripe-контракт до основной реализации

**Files:** Create `apps/web/scripts/verify-cardless-schedule-sandbox.ts`;
guard/transport in `apps/web/scripts/stripe/`; retain original diagnostic runners
`verify-cardless-trial-sandbox.ts` and `verify-cardless-trial-portal.ts`;
record `docs/superpowers/plans/2026-10-11-cardless-trial-acceptance.md`.

**Interfaces:** Consumes существующий серверный Stripe client с pinned API;
Produces per-case Schedule receipts с API version, fixture ownership, исходными
датами, снимками счетов/платежей и `passed`. Aggregate Stripe capability evidence
отдельно от полной приемки приложения. Без секретов/клиентских данных в отчете.
`CardlessStripeProof` исходного диагностического runner остается неполным: нельзя
делать его зеленым задним числом или смешивать разные архитектуры.

Граница Task 0: фактическое поведение Stripe API и hosted UI. Конкуренция операций
в БД, устаревшее согласие с новым ключом, выдача прав, webhook/return finalizer и
аналитика новой схемы проверяются после реализации в Tasks 1–5. Все эти проверки
обязательны до staging acceptance; успех Stripe-примитивов их не заменяет.

- [x] Добавить защиту скрипта: только явно выбранный test/Sandbox, создаваемые им
  Customer помечены `anidachiProof=cardless_trial`; любой live object вызывает отказ.
  Скрипт не читает список настоящих клиентов и не удаляет чужие объекты.
- [x] Проверить Schedule: trial=259200 секунд, `end_behavior=cancel` в create,
  карты отдельно нет/есть. Относительная длительность фазы day=3 + trial=true
  проверена отдельно, затем в браузерном и exact-boundary сценариях.
  После тестовых часов: canceled, нет платежной попытки после trial, нет долга.
- [x] Проверить `opt_in_preserves_trial_end`: setup → owned PaymentMethod →
  Schedule default + end_behavior=release одним update; первый обычный счет
  не раньше original trial_end, ровно один, сумма соответствует выбранной цене.
- [x] Проверить завершение setup после истечения, сохранение отмены при повторе
  прежнего opt-in с тем же ключом и задержку update на границе срока. Проверить
  ровно trial_end и trial_end+4h, настройку без карты и Customer
  с ранее сохраненной картой. Любой неожиданный charge блокирует следующий этап.
- [x] Проверить отказы, SCA/3DS (setup, отмена банковского окна и успешный повтор)
  и неизменность trial_end при смене тарифа/периода. Зафиксировать нулевые invoices
  отдельно от счета с реальной суммой; аналитику приложения проверить в Task 5.
- [x] Проверить уже открытый старый Portal Session того же Customer: он не должен
  позволять включить списание для нового trial в обход согласия AniDachi.
  Если позволяет, доказательство не пройдено; не менять глобальную paid-конфигурацию
  молча и не считать отсутствие новой кнопки Portal достаточной защитой.
- [x] Запустить все Schedule cases в согласованной тестовой среде:
  `pnpm --filter @anidachi/web exec tsx scripts/verify-cardless-schedule-sandbox.ts`
  с явными phase/case/--test/--account/--cli-profile (команды в acceptance).
  Каждый завершенный обязательный Schedule case имеет `passed=true` без live-вызовов.
  Если пограничная семантика API не обеспечивает spec, пересмотреть spec до кода,
  а не отметить проверку пройденной на основании обычного happy path.
- [ ] Зафиксировать проверочный инструмент и обезличенный результат отдельным
  коммитом `test(billing): prove cardless trial lifecycle in Stripe sandbox`.

## Task 1: Хранение, одноразовость и права

**Files:** New migration/tests/contract runner из карты;
Modify `apps/web/lib/anidachi-auth/stripe-trial-state.ts` и существующий refresh.

**Interfaces:**
- Produces policy `cardless_trials_enabled: boolean = false` с общей revision.
- Produces `subscription_trial_activations`: ID, owner, request ID, plan/period,
  verified Price, policy revision, Stripe customer/schedule/subscription IDs, stable
  idempotency key, состояние `pending | created | committed | failed`, даты.
- Produces `subscription_trial_renewals`: ID, owner/subscription, quote/terms
  revision, plan/period/price/amount/currency, original trial_end, setup session
  и intent IDs, mutation generation, состояние
  `quoted | setup_pending | applying | applied | canceled | expired | failed`.
- Produces ledger `trial_mode: card_required | cardless` с legacy default,
  `renewal_operation_id` для проверенного подключения, verified Schedule provenance;
  trial даты immutable. `cancel_at_period_end=false` само по себе ничего не
  говорит о согласии — это исходное состояние Schedule trial.
- RPC contracts: `reserve_cardless_trial_v1`, `record_cardless_trial_created_v1`,
  `commit_stripe_subscription_refresh_v3`, `reserve_trial_renewal_v1`,
  `commit_trial_renewal_v1`. Inputs привязаны к owner/operation/revision;
  возвращают подтвержденную запись или typed conflict, не молчаливый успех.

- [ ] Написать pgTAP assertions: legacy rows остаются `card_required`; cardless
  без applied renewal теряет grant при `now >= trial_end` даже при ошибочном
  `cancel_at_period_end=false`; applied renewal сохраняет прежний first-payment
  предел 2 часа; paid/failed/action_required и ручные grants не регрессируют.
- [ ] Написать concurrency contract: одновременные старый Checkout/new activation
  и Plus/Pro создают одну reservation authority; повтор request ID идемпотентен,
  чужой owner/price/revision отвергается; unknown outcome не освобождает слот.
- [ ] Создать `cardless_trial_contract.mjs` по существующей disposable-DB защите:
  только контейнер `anidachi-paid-hosting-*` с labels `anidachi.disposable=true`,
  `anidachi.task=paid-hosting`; ни remote DB URL, ни production допуска не добавлять.
  Runner применяет новую миграцию, запускает новый SQL и существующие trial,
  eligibility, checkout-reservation, lifecycle и room-admission regressions.
- [ ] Запустить `node apps/web/supabase/contracts/cardless_trial_contract.mjs`
  в настроенном disposable-контейнере: RED на отсутствующем новом контракте.
- [ ] Реализовать additive схему и общую account-level сериализацию существующего
  Checkout с новыми операциями. Не держать SQL transaction во время Stripe HTTP.
  Незавершенные сетевые операции имеют durable state; TTL не доказывает их провал.
- [ ] Расширить refresh v3 проверкой activation ID/owner/provenance; сохранить
  существующий lease, fresh snapshot и immutable даты. Старый v2 остается
  совместимым для старых обработчиков; он не может создать cardless ledger.
- [ ] Повторить SQL/concurrency command: GREEN; snapshot старых grants неизменен.
- [ ] Commit `feat(billing): add fenced cardless trial and renewal records`.

## Task 2: Авторизованный старт без Checkout

**Files:** Create `cardless-trial.ts`, `cardless-trial-server.ts`, их tests и
`apps/web/app/api/billing/trial/start/route.ts`; modify pricing-offer,
subscription-checkout-server и legacy create-checkout route из карты.

**Interfaces:**
```ts
type TrialStartInput = {
  requestId: string; planCode: 'plus' | 'pro';
  billingPeriod: 'monthly' | 'yearly'; offerRevision: string;
};
type TrialStartResult =
  | { state: 'active'; trialEndsAt: string; planCode: 'plus' | 'pro' }
  | { state: 'pending'; operationId: string }
  | { state: 'ineligible' | 'offer_changed' | 'unavailable' };
// userId приходит только из проверенной website session.
startCardlessTrial(userId: string, input: TrialStartInput): Promise<TrialStartResult>;
```
Фабрика `createCardlessTrialService(deps)` изолирует Stripe/storage/time для tests;
`cardless-trial-server.ts` связывает ее с действующими server clients и RPC Task 1.
UI не получает Stripe secrets. HTTP: 200 active, 202 pending, 409 ineligible/offer
changed, 503 unavailable; auth/owner failures сохраняют текущие коды guards.

- [ ] Написать failing tests с named assertions:
  `double_click_reuses_activation` — один Stripe create;
  `created_but_response_lost_reconciles` — те же schedule/subscription IDs;
  `completed_legacy_checkout_blocks_cardless` — ноль новых create;
  `flag_disabled_during_recovery_finishes_existing_operation` — recover разрешен,
  fresh reservation запрещена; `used_trial_never_becomes_paid_checkout` — явный 409.
- [ ] Запустить `pnpm --filter @anidachi/web exec tsx --test
  lib/anidachi-auth/cardless-trial.test.ts`: RED.
- [ ] Реализовать серверную проверку актуального offer, owner, eligibility и
  Customer; pending старый Session read/expire/reconcile до native create.
  Создавать Schedule с параметрами spec и стабильным ключом `trial:<activationId>`.
  Проверять его Subscription, владельца обоих объектов и точные 259200 секунд.
  Не повторять blind create после истечения Stripe idempotency retention.
- [ ] Подключить private/no-store API и существующие Origin/Sec-Fetch-Site,
  JSON, session и `X-Anidachi-Billing-Owner` guards. Ограничить частоту на account;
  исчерпание лимита не помечает trial использованным.
- [ ] Расширить shared offer optional-полем `trialMode: 'card_required' | 'cardless'`
  и revision, не менять существующий `action` enum. Флаг off оставляет старый flow;
  новый mode не возвращается при выключенных общих trials/paid-hosting.
- [ ] Заблокировать создание новых card-required trial из устаревшей страницы
  при включенном cardless mode: вернуть offer_changed, обновить предложение;
  не переводить пользователя в немедленную оплату. Уже начатый Checkout обслужить.
- [ ] Повторить focused tests и existing subscription-trial/pricing-offer tests:
  GREEN. Commit `feat(billing): start cardless trials with durable recovery`.

## Task 3: Согласие на оплату, setup и платежный lifecycle

**Files:** Create `trial-renewal.ts`, `trial-renewal-server.ts`, tests и четыре renewal
routes из карты; modify `stripe-webhook-events.ts`, billing-routes, stripe-trial-state
и существующие cancel/restore/plan-change services.

**Interfaces:**
```ts
type RenewalQuoteInput = {
  planCode: 'plus' | 'pro'; billingPeriod: 'monthly' | 'yearly';
};
type TrialRenewalQuote = RenewalQuoteInput & {
  id: string; amount: number; currency: string; firstChargeAt: string;
  expiresAt: string; termsRevision: string;
};
quoteTrialRenewal(userId: string, input: RenewalQuoteInput): Promise<TrialRenewalQuote>;
beginTrialRenewal(userId: string, quoteId: string, requestId: string):
  Promise<{ state: 'setup'; url: string } | { state: 'offer_changed' | 'expired' }>;
completeTrialRenewal(userId: string, operationId: string):
  Promise<{ state: 'active' | 'pending' | 'expired' | 'canceled' | 'offer_changed' }>;
cancelTrialRenewal(userId: string, requestId: string):
  Promise<{ state: 'canceled' | 'pending' }>;
```
Quote TTL — максимум 5 минут, не позже исходного trial_end. Он разрешает начать
setup, но не обойти повторную проверку выбранных условий и срока при завершении.
Confirmed setup может завершиться после quote TTL при неизменных условиях и
активном trial; после original trial_end требует нового платного Checkout.

- [ ] Написать tests `setup_does_not_grant_paid_access`,
  `saved_card_is_not_renewal_consent`, `duplicate_setup_event_is_noop`,
  `late_setup_after_cancel_stays_canceled`, `setup_for_other_owner_rejected`,
  `expired_setup_requires_new_payment_confirmation`, `changed_price_invalidates_quote`.
  Assertions: subscription mutation count 0 на запрещенных путях; original
  trial_end неизменен; один confirmed renewal на допустимом повторе.
- [ ] Запустить `pnpm --filter @anidachi/web exec tsx --test
  lib/anidachi-auth/trial-renewal.test.ts`: RED.
- [ ] Реализовать quote и setup с серверными ID/ценой и явными условиями будущего
  списания. Проверять Checkout Session + SetupIntent + принадлежность Customer/PM.
  Записывать согласие до обращения к Stripe; статус applied — только после
  подтвержденного изменения нужного Schedule/Subscription и записи результата.
- [ ] Реализовать последовательные account billing mutations с поколением
  операции: cancel/restore/change plan/setup используют один порядок; неизвестная
  Stripe mutation сначала reconciles, потом допускается следующая. Долгое ожидание
  показывать pending, не сообщать успешную отмену без подтвержденного результата.
- [ ] Применить доказанный Task 0 путь: Schedule end_behavior=release + owned
  default PM + выбранная цена одним update; сохранить original start/end/trial_end,
  исключить немедленные prorations. Schedule остается прикрепленным до trial_end;
  API release до этого срока не вызывать. Отмена до конца trial меняет end_behavior
  на cancel; после release подписка обслуживается обычным paid flow.
  Если подтвержденный тариф/период отличается, применить выбранный item Price
  в той же согласованной операции с проверками существующего trial-plan-change.
  После повтора запроса читать текущее состояние: закешированный Stripe response
  может описывать состояние до более поздней отмены. После истечения не создавать
  новую подписку из callback. Пограничную гарантию
  проверить отдельно, не выдавать timestamp-check за Stripe atomic compare-and-set.
- [ ] Расширить `checkout.session.completed` для setup через тот же идемпотентный
  finalizer. Return page и webhook сходятся к одному результату. Existing event
  registration проверить read-only; новые live webhook changes сюда не подразумеваются.
- [ ] Закрыть обход через старую Restore renewal/Portal/change-plan логику только
  для нового trial. Later cancel инвалидирует pending setup. Для paid/legacy
  сохраняется действующее управление. Нулевой invoice не переводит ledger в paid.
- [ ] Добавить assertions для failure/action_required/retry/out-of-order invoice:
  прежний first-payment deadline не растет; успешный повторный платеж восстанавливает
  доступ только после fresh verified snapshot, stale failure не откатывает paid.
- [ ] Повторить focused suite + existing webhook/trial/billing tests: GREEN.
  Commit `feat(billing): require explicit renewal consent for cardless trials`.

## Task 4: Единый понятный flow сайта и расширения

**Files:** UI/offer/extension paths из карты; existing tests
`apps/web/lib/{billing-client,billing-preview,checkout-continuation,checkout-session-sync,checkout-success-preview}.test.ts`.

**Interfaces:** Consumes Task 2–3 API. Produces optional billing trial fields
`mode: 'card_required' | 'cardless'`,
`renewalState: 'not_enabled' | 'pending' | 'enabled'`, `endsAt`;
права/цены приходят из сервера. Отсутствующий mode означает legacy, не cardless.

- [ ] Добавить RED cases: разные CTA по mode; login сохраняет выбранный тариф,
  но не запускает trial без подтверждения; account switch уничтожает чужие
  offer/setup результаты; stale flag off → понятное обновление предложения.
- [ ] Добавить RED cases: default scheduled cancellation нового trial отображается
  как «Пробный период до …», а не «Подписка отменена»; время окончания с timezone;
  setup return expired → отдельная кнопка оплаты, не redirect на списание.
- [ ] Обновить pricing, mobile CTA и checkout continuation. Текст старого карточного
  trial остается правдивым; новый прямо говорит «Без карты» и «Без автоматического
  списания». CTA не обещает 3 дня тому, у кого eligibility уже израсходована.
- [ ] Обновить billing: конец trial, состояние подключения, цена/период/дата
  первого платежа, повтор после ошибки и отмена. Saved card не помечать как paid.
- [ ] Обновить все потребители card-required copy в paywall и связанных подсказках;
  узкий diff без переноса локального onboarding/redesign. Старому расширению
  server rights остаются совместимыми; неизвестный mode не вызывает crash или
  автоматическую подписку. Вернувшись с сайта, refresh прав, без автосоздания комнаты.
- [ ] Проверить FAQ/help/terms на противоречие новому сценарию; обновить только
  затронутые условия, отделить поведение действующих trial с картой.
- [ ] Запустить web focused tests, web check и extension check/test; осмотреть
  desktop/mobile, signed-out/Free/trial/paid, оба периода в staging browser.
  Ожидается GREEN и отсутствие неверного обещания оплаты/доступа.
- [ ] Commit `feat(billing): show cardless trial and renewal states across clients`.

## Task 5: Аналитика и полная проверка на staging

**Files:** New `trial-conversion-events.ts` + tests; conversion-events и текущий
publisher; `cardless-trial-acceptance.md`; текущие billing/domain docs.

**Interfaces:** `recordTrialConversion(event)` принимает server-verified
`trial_started | trial_renewal_enabled | trial_first_payment_succeeded`,
`eventId`, user ID, mode, plan/period, timestamp и environment. Event ID связан
с неизменяемой activation/renewal/invoice записью, не со временем webhook delivery.
Использовать существующую доставку; recoverable pending delivery хранить с
операцией, повторная доставка использует тот же ID. Не обещать exactly-once сеть.

- [ ] Написать RED tests: same transition дважды → один логический event ID;
  zero invoice/setup/click → нет paid event; environment обязательный, без
  email/PM/card data. Реализовать и выполнить focused suite до GREEN.
- [ ] Зафиксировать funnel с существующими room событиями: первый реальный
  shared session = host + хотя бы один подключенный guest, а не copy invite click.
  Если такого события нет, записать пробел и добавить минимальное серверное
  подтверждение присутствия с тестом, без video/chat content telemetry.
- [ ] Выполнить repo `pnpm check`, `pnpm test`, `pnpm harness:rooms` и
  `pnpm --filter @anidachi/api test:runtime`; SQL contract Task 1.
  Ожидается GREEN; не менять unrelated код ради обхода проверок.
- [ ] Собрать `pnpm build:extension:staging`, затем
  `pnpm validate:extension:staging`. Проверить загруженную сборку, права и старую
  опубликованную версию. Если меняются shared fields — проверить все consumers.
- [ ] Через обычный PR в staging проверить новую миграцию и deploy с flag off,
  затем включить только staging. Снять before/after evidence для старых paid,
  отмененных paid, trial с картой и ручного grant: исходные условия сохранены.
- [ ] Проверить матрицу: Plus/Pro × month/year, guest/login, новая/старая карта,
  отмена/возврат/3DS/decline, повторная попытка, два таба, отключение сети в create,
  сбой БД после Stripe success, duplicate/out-of-order webhooks, выключение флага.
- [ ] Проверить 72h expiration и 5min room closure без reset на reconnect;
  no-opt-in не получает 2h grace, guest join работает, history reads сохранены.
  Stripe Test Clocks не считать часами БД: deadline unit/SQL tests отдельно,
  end-to-end staging с согласованным способом проверки реального срока отдельно.
- [ ] Проверить попытку обычной покупки во время pending activation/renewal,
  удаление аккаунта, смену аккаунта и устаревшие вкладки. Unknown outcome должен
  иметь путь восстановления оператором, без ручного редактирования entitlement.
- [ ] Записать фактические результаты/ограничения, обновить доменные docs/Graphify,
  выполнить `pnpm dev:check`. Commit `test(billing): verify cardless trial rollout`.
- [ ] Получить приемку владельца на staging. Ни наличие плана, ни зеленый unit
  suite сами по себе не являются разрешением production promotion.

## Task 6: Контролируемый выпуск и восстановление

**Files:** release/acceptance record из Task 0 и актуальные release docs.
**Interfaces:** Consumes accepted staging SHAs, SQL receipts, совместимые
артефакты сайта/Worker/расширения; produces проверенный точный production diff,
порядок переключения и способ выключить новые старты.

- [ ] Сверить свежие main/staging, live Stripe price/event configuration read-only
  и опубликованную версию расширения. Составить точный набор коммитов; исключить
  Netflix/redesign/непринятые изменения из продвижения.
- [ ] Проверить rollback с уже pending/active/renewal-enabled trial на staging:
  flag off запрещает только fresh starts, idempotent recovery/webhooks/оплата
  продолжаются; оффер и CTA отражают отключение. Ledger и consent не удаляются.
- [ ] Подготовить promotion PR и migration/deploy checklist. До разрешения на
  production все действия здесь остаются незапущенными.
- [ ] После разрешения: additive migration с flag off → совместимый сервер →
  сайт и нужный совместимый extension artifact → подтверждение клиентов → флаг on.
  Если Store build нужен для правильного объяснения trial, публикация включена в
  checklist; не считать пользователей мгновенно обновленными.
- [ ] Проверить активированный trial и права, отсутствие изменения существующих
  подписок. Отдельно дождаться первых реальных исходов: expiry без карты,
  добровольный opt-in и подтвержденный платеж. До этого не заявлять end-to-end
  production lifecycle полностью подтвержденным.
- [ ] При аномальном charge, дублях, потере доступа или росте ошибок выключить
  новые старты, восстановить зависшие операции и исправить forward. Не возвращать
  обработчик к версии, не понимающей новый ledger. Ошибочный charge требует
  отдельного согласованного финансового действия, не скрытой компенсации.

## Критерии завершения и журнал доказательств

| Доказательство | На момент создания плана |
| --- | --- |
| Исходники текущего billing и официальные Stripe возможности изучены | Да; это основание проекта решения |
| Stripe Sandbox proof с existing card и boundary race | Не выполнено |
| Новая схема/API/UI/extension | Не реализованы |
| SQL/concurrency/unit/runtime checks | Не выполнялись для новой функции |
| Staging browser, старые клиенты, 72h/room lifecycle | Не проверены |
| Согласование реализации и production release | Не получено |

При выполнении отмечать checkbox только с результатом и ссылкой на evidence.
Не заменять неизвестный исход зеленой отметкой и не расширять этот billing
выпуск другими накопленными продуктовыми изменениями.
