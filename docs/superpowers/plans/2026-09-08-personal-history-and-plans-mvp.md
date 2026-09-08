# Личная история, тарифы и возможности комнат — план реализации MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`
> to implement this plan task-by-task after the user chooses to start execution.
> `superpowers:subagent-driven-development` supplies bounded implementation and
> review tasks during this authorized execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одна личная история для Plus/Pro, отсутствие сбора истории у Free,
единые платформы и согласованные лимиты комнат во всех частях AniDachi.

**Architecture:** Web/Supabase владеют тарифом, доступом и личным прогрессом;
Worker — присутствием и разрешениями публикации; background расширения —
локальным сбором и очередью. Переиспользовать каноническую идентичность Watch
History v3, существующие комнаты и приглашения. Не создавать общую историю групп.

**Tech Stack:** Существующие TypeScript/Zod, Next.js 15.5.23, React/WXT,
Supabase/Postgres, Cloudflare Worker/Durable Objects, WebRTC P2P, Stripe,
Vitest/Node test runner/pgTAP/Playwright. Node 22.23.1, pnpm 11.2.2.
Зависимости и транспорт без отдельного обоснования не обновлять.

**Spec:** [Личная история и тарифы: спецификация MVP](../specs/2026-09-08-personal-history-and-plans-mvp-design.md).

**Статус:** реализация разрешена пользователем 2026-09-08 и начата в
изолированном worktree. R01–R20 и предложенные D01–D05 приняты в разговоре
перед стартом. Разрешены реализация и проверки по плану; production promotion
остается отдельным решением после staging-приемки. Существующая история и WIP
сохраняются. Ни один будущий runtime gate не считается пройденным заранее.

## Global Constraints

- Одна личная история на аккаунт и логический эпизод; нет общего прогресса группы.
- Free: 30 минут своей комнаты в день, 4 участника, 4 камеры, 4 микрофона, без истории.
- Plus: без дневного лимита, 6 участников, 4 камеры, 6 микрофонов, личная история.
- Pro: без дневного лимита, 15 участников, 4 камеры, 8 микрофонов, личная история.
- Все поддерживаемые платформы доступны всем тарифам; история зависит от собственного тарифа.
- Участники и публикации считаются вместе с хостом; прием медиа не требует публикации.
- Free-квота идет при подключенном хосте и госте, включая паузу видео; день UTC.
- История Free не собирается в кеше/очереди; обязательные данные live-комнаты не являются личной историей.
- Существующее согласие на YouTube сохраняется; upgrade не включает его автоматически.
- Существующий ended/90% completion сохраняется; обычный rewatch не снимает completion.
- Web/Supabase — durable authority; Worker — live authority; background — единственный extension writer.
- Не сбрасывать историю, accountGeneration, аккаунты, социальные данные или все Chrome storage ради cutover.
- Сохранять рисунок текущей шторки: сезоны/Specials dropdown, 4–5 рядов сетки, стабильный detail, без дат в карточках.
- Контракты определить в `packages/protocol` до подключения потребителей.
- Совместимость, изоляция аккаунта, consent, удаления и повторы обязательны во всех этапах.
- Feature от актуального staging → PR → staging acceptance → отдельное решение о main/production.
- Никакого общего reset/stash/discard текущего WIP; applied migrations не редактировать.
- Секреты не читать в отчеты и не отдавать клиенту; staging остается gated/noindex.
- Тяжелые runtime gates относятся к реализации; подготовка этого плана проверяется как docs-only.

## 1. Исходная база и подтвержденные расхождения

Осмотрено локально 2026-09-08. HEAD `ce44393a067895a84525c85bacc666e8986b494b`,
ветка `codex/watch-toolbar-polish`; локальный `origin/staging`
`a03c0128825c73edcfdf9062a8d85e70148b2423`, ahead 4 / behind 3.
Remote fetch, dashboard/DB inspection, сборки и browser acceptance при подготовке
плана не выполнялись. Указанные deployment receipts в старых документах —
историческая база, не новая проверка доступности окружения.

Worktree содержит ранее сделанную косметику шторки, catalog route, тесты,
staging-access, protocol export и документацию/граф. Перед будущей реализацией
нужно выделить согласованную базу из этого WIP, сохранив все его содержимое.
Нельзя открывать PR из смешанного набора файлов.

Graphify использован как навигация: запрос
`Trace watch-history v3 plan entitlements room limits maxMediaSeats P2PMediaController pricing-tiers`.
Важные выводы ниже проверены по исходникам.

| Факт текущего исходного кода | Путь / точка входа | Следствие для плана |
| --- | --- | --- |
| Тарифы содержат maxMediaSeats=4 во всех планах, старые historyRetentionDays и maxActiveTrackedTitles. | `apps/web/lib/anidachi-auth/plan-entitlements.ts` | Нужны отдельные mic/camera caps и явное право на историю; D01 не выводить из старых констант. |
| `/api/me/entitlements` читает профиль, но ответ не имеет owner/version metadata. | `apps/web/app/api/me/entitlements/route.ts` | Общий owner-bound контракт и защита от позднего ответа другого аккаунта. |
| HTTP v3, browse/catalog и SSR страницы читают историю после auth; в просмотренных путях нет отдельного paid gate. | `watch-history-v3-routes.ts`, `watch-history-browse-routes.ts`, `watch-history-grid-routes.ts`, `app/account/watch-library/page.tsx` | Проверять все чтения, а не только прогресс или Popup. |
| SQL создает shared session по записи хоста; гость без нее получает `watch_history_shared_session_pending`. | `20260904205540_watch_history_canonical_catalog.sql` | Платный гость Free-хоста должен писать личный прогресс независимо. |
| `apply_watch_progress_v3` оборачивает canonical writer дополнительной групповой provenance. | `20260905084800_watch_history_browse.sql` | Новая запись не должна проходить через ненужную общую историю. Старые данные не удалять. |
| Recent People пополняется из history writer и session participants. | `20260904205540_watch_history_canonical_catalog.sql`, `social.ts` | Отключение Free capture не должно выключить Recent People; нужен отдельный факт presence. |
| Capture получает observation до финального gate, разделяет mine/together и ожидает room authority. | `apps/extension/src/watch-history-controller.ts` | Проверять доступ до сбора/каталога; убрать зависимость личной записи от истории хоста. |
| Browse требует `mode: solo/shared` и фильтрует сессии. | `packages/protocol/src/watch-history-browse.ts` и SQL browse | Просто спрятать toggle нельзя: единое чтение обязано включать оба старых источника. |
| Worker разрешает P2P_SIGNAL только между mediaSeat=joined. | `apps/api/src/room-state.ts:292` | Участник без своего места сейчас не полноценный получатель. |
| P2P-клиент выбирает максимум 3 удаленных участника. | `apps/extension/src/p2p-media.ts:35` и `syncParticipants` | Нужна ограниченная сеть publisher→receiver и проверка 6/15 клиентов. |
| Meter хранит один `day`, выбранный при начале. | `apps/api/src/room-metering.ts` | Переход UTC-полуночи требует отдельной проверки и корректной разбивки. |
| Stripe event ledger есть; subscription events передают snapshot напрямую, план зеркалируется отдельно. | `stripe-subscription-sync.ts`, `db.ts`, `app/api/stripe/webhook/route.ts` | Нужны проверки задержек, повторов, конкурентного обновления и срока права. |
| Старые `/watch-library` и `/v2` HTTP маршруты уже terminal. | `apps/web/lib/anidachi-auth/watch-library-routes.ts` | Сохранить terminal boundary и проверить SQL aliases; не оживлять старую историю. |

## 2. Принятые решения и границы объема

2026-09-08 пользователь принял рекомендованные D01–D05 из спецификации
и разрешил реализацию. Они являются обязательным поведением и определяют
соответствующие тесты. Повторного согласования этих правил не требуется.
Если реальные данные требуют технического изменения плана, записать причину
и проверить затронутые контракты, сохранив согласованное продуктовое поведение.

- D01: сохранять историю после downgrade, закрыть чтение/запись для Free, убрать старые title/day quotas.
- D02: upgrade caps только в новой комнате; потеря нужного тарифа — предупреждение и штатный конец через пять минут.
- D03: явное включение занимает место; PTT удерживает grant до выключения микрофона, без запроса на каждое нажатие.
- D04: новые ручные отметки и bulk editor отложены; текущее удаление сохраняется.
- D05: access lease максимум пять минут/до paid expiry; по истечении при недоступной проверке capture приостанавливается.

Не добавлять новые платформы, социальные роли, публичные группы, чат групп,
биллинг провайдеров, новые валюты, реферальную систему, SFU или отдельный
дашборд наблюдаемости. Существующие удаления истории сохранить. Ручные отметки
просмотрено/не просмотрено не подменять фиктивными playback checkpoints.

## 3. Предлагаемые контракты и владельцы

Это рабочая техническая схема для реализации после рассмотрения плана.
Имена ниже являются предлагаемыми новыми интерфейсами, не существующими API.
Текущие provider IDs, catalog schema и read schemaVersion=3 сохраняются.

### 3.1. Тариф и личный доступ

Новый `packages/protocol/src/commercial-policy.ts` содержит чистую матрицу
возможностей и Zod-контракты. Web выбирает тариф по своей durable authority,
а не по полю, присланному расширением. UI может использовать общие значения
для отображения, но не как доказательство доступа.

```ts
type PlanCode = "free" | "plus" | "pro";
type PlanPolicy = {
  planCode: PlanCode;
  historyEnabled: boolean;
  dailyHostSeconds: 1800 | null; // null = no daily cap
  maxParticipants: 4 | 6 | 15;
  maxCameras: 4;
  maxMicrophones: 4 | 6 | 8;
};
declare function getPlanPolicy(planCode: PlanCode): PlanPolicy;

type WatchHistoryAccess = {
  accessVersion: 1;
  ownerUserId: string;
  accountGeneration: number; // existing deletion/catalog boundary
  accessEpoch: number;       // rotates when paid history is lost/regained
  youtubeConsentEpoch: number;
  state: "allowed" | "plan_required";
  serverTime: string;
  captureNotBefore: string;
  validUntil: string;
  youtubeHistoryEnabled: boolean;
};
```

`GET /api/watch-history/v3/access` возвращает этот owner-bound результат, даже
для Free, без тайтлов и progress. Ошибка БД/определения права — 503, не
`plan_required`. D05: validUntil не позднее пяти минут и известного paid expiry.
Обновление выполняется перед реальной работой/при открытии UI и при истечении
права во время активного сбора, без частого фонового polling.

`GET /api/me/entitlements` сохраняет верхние `planCode`/`entitlements` для
совместимости, добавляет version/owner/serverTime metadata. Оба endpoint
используют одну серверную функцию `resolveAccountEntitlements(userId, now)`.
Состояния клиента unknown/loading/unavailable отделены от серверного Free.

### 3.2. Личный checkpoint

```ts
// WatchProgressEvent — существующий тип из packages/protocol/src/watch-history.ts.
type PersonalWatchProgressRequest = {
  captureVersion: 1;
  accessEpoch: number;
  youtubeConsentEpoch: number;
  clientSequence: number;
  event: Omit<WatchProgressEvent, "sharedRoom">;
};
```

Путь POST `/api/watch-history/v3/progress` сохраняется, новая envelope отличима
от legacy body. `clientSessionKey` принадлежит собственному локальному
просмотру; solo→room не создает другого результата. `clientSequence` монотонен
внутри этого ключа; coalescing сохраняет номер фактически оставленного события.
`clientEventId` и неизменяемая envelope дают идемпотентный retry. Owner выводится
из авторизации, не из тела.

Серверный RPC `apply_personal_watch_progress_v1(uuid,jsonb)` под тем же
account lock проверяет текущее право, accessEpoch, provider consent,
accountGeneration, event identity, порядок и удаления, затем выполняет личный
upsert и обновляет существующие точные агрегаты/receipt. Он не создает shared
watch session и не изменяет progress других пользователей. Ответ использует
существующий `WatchProgressAck`.

Canonical core можно переиспользовать после извлечения из старого shared
writer: новый путь должен быть независим от `shared_session_pending` и
групповой provenance. Внутренний core не должен оставаться обходным публичным
RPC для старого writer. Все старые public entry points после cutover становятся
terminal до любых writes; прямые anon/authenticated RPC запрещены.

Новая сессия может изменить Resume назад только новым реальным просмотром.
События одного clientSessionKey проверяются по sequence, разных — по
нормализованному observedAt с существующей server-time validation; при равных
временах используется детерминированный server order. Сравнения только по
порядку прихода HTTP недостаточно. Не заменять систему observedAt одним max
позиции. Времена сравнивать с серверным clock offset; clock skew, late delivery
и offline acceptance проверяются отдельно. Это учет личной точки, не proof-of-watch.

### 3.3. Матрица доступности HTTP/SSR

| Операция | Free | Plus/Pro | Обязательная проверка |
| --- | --- | --- | --- |
| access, entitlements, preferences GET | Metadata без истории | Metadata | Auth + owner + current server state. |
| history/list, title-episodes, browse, browse/catalog, SSR | 403 HISTORY_PLAN_REQUIRED / locked page | Данные владельца | Gate до чтения/рендера и перед отдачей результата при смене revision. |
| progress, catalog attempt/commit | 403 без записи | Валидированная собственная запись | Gate и epoch в одной транзакции с изменением. |
| consent off, delete all own history | Доступно | Доступно | Auth, mutation owner, generation, idempotency. |
| consent on | Сохранить желание только по явному действию; сбор остается запрещен | Сбор после подтверждения | Не превращать preference в entitlement. |
| Resume из истории / legacy rooms action | Нет paid-history обхода | Личная точка | Не создавать комнату из чужой/общей точки. |
| create/connect/invite существующей комнаты | По room rights | По room rights | Не связывать с historyEnabled. |

Ошибки: 401 UNAUTHORIZED; 403 HISTORY_PLAN_REQUIRED; 409 HISTORY_ACCESS_CHANGED
или существующая generation/deletion ошибка; 426 HISTORY_CLIENT_UPDATE_REQUIRED;
503 HISTORY_ACCESS_UNAVAILABLE. 403/409/426 прекращают бесконечный retry и
перепроверяют точный owner/access. Network/5xx используют bounded backoff.
Все приватные ответы — private, no-store; SSR не сериализует скрытые карточки.

### 3.4. Комната и публикация

Новый `packages/protocol/src/room-media.ts` определяет media contract v2.
Legacy maxMediaSeats сохраняется только для чтения прежних комнат/клиентов;
его нельзя переименовать в maxMicrophones и оставить старые receive gates.

```ts
type RoomMediaKind = "camera" | "microphone";
type MediaIntent = {
  type: "SET_MEDIA_INTENT";
  media: RoomMediaKind;
  enabled: boolean;
  requestId: string;
  intentSequence: number;
  revocationEpoch: number;
  participantSessionId: string;
  roomGeneration: number;
};
type ParticipantMediaState = {
  cameraGranted: boolean;
  microphoneGranted: boolean;
  cameraIntentSequence: number;
  microphoneIntentSequence: number;
  cameraRevocationEpoch: number;
  microphoneRevocationEpoch: number;
};
type RoomMediaCapabilities = {
  mediaProtocolVersion: 2;
  hostPlanCode: PlanCode;
  maxParticipants: 4 | 6 | 15;
  maxCameras: 4;
  maxMicrophones: 4 | 6 | 8;
  capabilityRevision: number;
  capabilitiesValidUntil: string;
};
```

Worker атомарно выделяет/освобождает независимые места, подтверждает результат
через sequenced snapshot/ack с requestId. Отказ имеет код MEDIA_LIMIT_REACHED
и media kind. Повтор не расходует второе место; запоздалое enable после disable
не включает захват. Host revoke — отдельная авторизованная операция с target
participantSessionId, не команда от любого участника. Отзыв повышает отдельную
версию camera/microphone revocation epoch: старый enable не выдает место, даже
если его sequence выше. Новое явное включение использует актуальную epoch.
Запоздалый disable или повтор revoke не отзывают более новое разрешение;
проверки session/generation/sequence сохраняются при восстановлении.

Grant дает право публиковать, но не означает, что локальный track уже работает.
При permission/device failure grant освобождается. D03: grant микрофона
держится от явного включения до выключения, в том числе когда PTT готов,
но клавиша отпущена. Нажатие PTT управляет только передачей звука внутри
уже выданного grant: сетевой запрос и создание peers на каждое нажатие
не нужны. Без grant PTT недоступен с понятной причиной. При входе микрофон
автоматически не включать. Keyup/blur/revoke останавливают передачу;
запоздалый ack/getUserMedia не включает звук после окончания жеста.

P2P-пара разрешена для реальных участников одной generation, если хотя бы
один из них имеет право публикации. Receiver-only пары не создаются. Получатель
не вызывает getUserMedia и игнорирует неразрешенные удаленные tracks.
SDP offer/answer/ICE в обоих направлениях разрешены для такой пары; голосовой
start и camera-on дополнительно требуют соответствующий grant отправителя.

D02: capability lease максимум 30 минут, обновление за пять минут до конца
через существующий authenticated internal callback transport. Web проверяет
актуальное право и подписывает lease; create/connect остаются versioned
entrypoints. Client не продлевает lease самостоятельно и не переподключается
ради renewal. Worker
хранит deadline и после wake ставит alarm заново. При потере права/grant expiry
без успешной проверки — предупреждение и пять минут до штатного room end;
повтор reconnect не сдвигает уже начавшийся deadline. Upgrade требует новой
комнаты для увеличения caps. Если известен конец оплаченного периода, lease
не выходит за него. Сбой проверки показывается как сбой, а не как отмена оплаты.

### 3.5. Recent People

Подтвержденный WebSocket join создает пары с реально присутствующими людьми,
не со всеми `room_members` или приглашенными. Источник — room DO, доставка —
существующая internal callback инфраструктура с отдельным типом сообщения.

Новый owner-private `record_recent_room_presence_v1` upsert содержит только
roomId, roomGeneration, два user/session identifiers и серверное время
пересечения. Нет provider/title/episode/position. Доставка идемпотентна по
паре/room generation и обновляет дату только вперед. При 15 одновременно
присутствующих людях возникает до 105 пар. Смена состава за долгую комнату
может создать больше пар: pending outbox ограничить 105 последними парами,
повтор пары объединять; при длительном сбое вытеснять старую недоставленную
пару с отдельным overflow counter. Recent People — ограниченный недавний
список, полнота журнала всех встреч не обещается. Проверить churn и retry.
Подробный журнал входов/выходов не строить.
Подпись/внутренняя авторизация, жизненный цикл комнаты и account deletion
проверяются независимо от права на личную историю.

## 4. Порядок и независимые результаты

```text
0. Зафиксировать решения и чистую базу
1. Общие контракты + ранняя проверка медиа-нагрузки
2. Серверная тарифная authority и revision
3. Личная запись и чтение в БД/Web
4. Независимое presence evidence для Recent People
5. Capture/очередь расширения и личный Resume
6. Единая шторка, сайт и pricing copy
7. Room caps, публикация и дневная квота Worker
8. P2P-прием и media UI расширения
9. Миграция/совместимость и сквозная проверка
10. Staging-поставка и приемка
```

Срезы 3–6 и 7–8 могут иметь отдельные PR после общих контрактов. Не включать
Free history denial до независимой записи гостя и Recent People; не показывать
обещание 6/8 микрофонов до готовности Worker и receiver path. Один общий план
удерживает эти зависимости, каждый этап имеет собственную проверку.

## Task 0: Зафиксировать решения и основание реализации

**Files:** этот план, спецификация, `docs/social-pricing-model.md`,
`docs/current-development-state.md`, существующий пользовательский WIP.

**Interfaces:** принимает R01–R20 и D01–D05; результат — зафиксированные
решения и один baseline SHA с перечнем сохраняемого локального UI.

- [x] 2026-09-08: D01–D05 согласованы пользователем перед разрешением реализации; правила зафиксированы в спецификации.
- [x] 2026-09-08: fresh fetch и GitHub подтвердили staging `a03c0128`, main `54a154b7`; 41 staging migration совпадает с локальной цепочкой; обе tester folders побайтово идентичны, build `9ee74a7c-staging-title-outline-20260906-r10`.
- [x] Создан `.worktrees/personal-history-mvp`, ветка `codex/personal-history-mvp` от fresh staging; перенесены 17 согласованных UI файлов и документация. Исходные 1069 source hashes сохранены; полный WIP скопирован в ignored backup.
- [x] Baseline `0069baf`: catalog route уже идентичен staging. `pnpm check` и `pnpm test` прошли; первая попытка тестов была остановлена sandbox IPC EPERM, повтор с доступом к локальным сокетам прошел. Web: 447 pass / 6 optional local-proof skips, extension: 1759 pass, API: 201 pass. Это локальная база, не новая staging acceptance.

**Проверка:** список файлов базы сопоставлен с текущим WIP; ни один чужой файл
не исчез/не откатился; подтверждены нужные ветка, runtime и миграции. Никакой
публикации из текущего смешанного дерева.

## Task 1: Зафиксировать общие контракты и проверить риск P2P

**Create:** `packages/protocol/src/commercial-policy.ts`,
`packages/protocol/src/personal-watch-history.ts`, `packages/protocol/src/room-media.ts`,
`packages/protocol/test/commercial-policy.test.ts`,
`packages/protocol/test/personal-watch-history.test.ts`,
`packages/protocol/test/room-media.test.ts`.
**Modify:** `packages/protocol/src/index.ts`, `packages/protocol/src/types.ts`,
`packages/protocol/src/watch-history-browse.ts`, `tests/e2e/p2p-media-harness.mjs`.

**Interfaces:** определить типы из раздела 3 и runtime schemas; сохранить
legacy read schemaVersion=3. Добавить личный browse mode `personal`, который
включает старые solo/shared события, и исключить в нем social filters.

- [x] `ed87235`: tests матрицы тарифов, owner metadata, malformed envelopes, unknown versions и запрета sharedRoom; protocol160/160 и cross-plane types6/6 pass.
- [x] `ed87235`: определены строгие ack/error/snapshot, независимые grants, intentSequence и capability lease; активные legacy event unions сохранены. Независимое review одобрило контракт и fix `259050c`.
- [x] Receiver-only4/6 и изолированный disjoint15 измерены;102пары,56video/112audio streams,0stalled за10секунд,0local capture у слушателей. Первоначальный overlap15 остановлен при конкурирующей нагрузке; standalone disjoint15 прошел после освобождения тестовой VM.
- [x] Ранние измерения4/6/15 записаны в verification record. Ruling: raw P2P эксперимент разрешает дальнейшую реализацию Tasks7/8 с согласованными лимитами. Реальный контроллер, TURN и две сети остаются обязательными проверками Tasks8/10; синтетический localhost не разрешает выпуск новых media caps сам по себе.

Проверочный контракт:

```ts
import { expect, it } from "vitest";
import { getPlanPolicy } from "../src/commercial-policy";
it("keeps guest history separate from room capacity", () => {
  expect(getPlanPolicy("free").historyEnabled).toBe(false);
  expect(getPlanPolicy("plus").maxMicrophones).toBe(6);
  expect(getPlanPolicy("pro").maxMicrophones).toBe(8);
  expect(["free", "plus", "pro"].map(p =>
    getPlanPolicy(p as "free" | "plus" | "pro").maxCameras)).toEqual([4, 4, 4]);
});
```

**Gate:** protocol check/test. Модель 15/4/8 допускает раздельных 4 camera и
8 audio publishers: до 12 публикующих, 3 receive-only, до 102 P2P-пар
(`15*14/2 - 3*2/2`), до 14 peers у одного клиента. Проверять и этот случай,
а не только 4 камеры у тех же восьми говорящих. Старый предел три remote peers
и прошлый pass на двух профилях не являются достаточным доказательством.
Плохой результат не разрешает молча снизить согласованные лимиты или добавить SFU.

## Task 2: Серверное право на историю и смена подписки

**Create:** `apps/web/lib/anidachi-auth/account-entitlements.ts`,
`apps/web/lib/anidachi-auth/account-entitlements.test.ts`,
`apps/web/lib/anidachi-auth/watch-history-access.ts`,
`apps/web/app/api/watch-history/v3/access/route.ts`.
**Modify:** `plan-entitlements.ts`, `plan-entitlements.test.ts`, `db.ts`,
`stripe-plans.ts`, `stripe-plans.test.ts`, `stripe-subscription-sync.ts`,
`stripe-subscription-sync.test.ts` в `apps/web/lib/anidachi-auth/`;
`apps/web/app/api/me/entitlements/route.ts`,
`apps/web/app/api/stripe/webhook/route.ts`,
`apps/web/app/api/billing/sync-checkout-session/route.ts`.
**DB:** создать через Supabase CLI новую additive migration с суффиксом
`personal_history_access`; timestamp получает CLI. Создать
`apps/web/supabase/tests/personal_history_access.test.sql`.

**Interfaces:** `resolveAccountEntitlements(userId: string, now: Date)` возвращает
`Promise<{ policy: PlanPolicy; history: WatchHistoryAccess }>`;
`requirePersonalHistoryAccess` дает
разрешение либо типизированную ошибку. SQL `resolve_watch_history_access_v1(uuid)`
и account accessEpoch используют durable account/billing state в одной
транзакционной границе со сменой права.

- [x] Добавить проверки Free/Plus/Pro, stale JWT, owner mismatch, plan lookup failure, paid expiry и отмены автопродления без ранней потери доступа.
- [x] Добавить accessEpoch/captureNotBefore в существующую account/settings область без очистки progress; epoch меняется при потере/возврате paid history, а не при простом Plus→Pro.
- [x] Связать billing mirror и access revision атомарно; существующие ручные test grants инвентаризировать, не превращать отсутствие Stripe row в неявную бесплатную подписку.
- [x] Использовать существующий event ledger, refetch актуального Stripe subscription и durable fencing конкурентных refresh. Не сортировать lifecycle только по event.created; не полагаться на in-process mutex между Vercel instances.
- [x] Реализовать endpoint access и metadata entitlements; ошибки не считать Free; не дублировать матрицу тарифов в трех приложениях.

SQL-паттерн прав для нового RPC (с точной сигнатурой при реализации):

```sql
revoke all on function public.resolve_watch_history_access_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_watch_history_access_v1(uuid)
  to service_role;
```

**Gate:** web check/test, pgTAP на disposable local DB: paid→Free и параллельная
запись имеют одну определенную границу; stale billing commit не возвращает
старое право. Stripe TEST sandbox cases: cancel-at-period-end, effective expiry,
failed payment/current status, upgrade/downgrade, duplicate/out-of-order delivery.
Live Stripe Price, webhook configuration и реальные подписки не изменять.

Prerequisite implementation проверена локально и прошла независимое ревью
(`e1d6223`, исправление авторизации `a3ac036`). Подробности и границы доказательств
в `docs/personal-history-and-plans-mvp-verification.md`. Реальный Stripe TEST,
production grant inventory и согласованная активация остаются открытыми gates;
отметки выше не означают завершенную поставку нового поведения.

## Task 3: Независимый личный writer, paid reads и единый browse

**Create:** `apps/web/lib/anidachi-auth/personal-watch-history.ts`,
`apps/web/lib/anidachi-auth/personal-watch-history.test.ts`,
`apps/web/supabase/tests/personal_watch_history.test.sql`.
**Modify:** `watch-history-v3.ts`, `watch-history-v3-routes.ts`,
`watch-history-v3-routes.test.ts`, `watch-history-browse.ts`,
`watch-history-browse-routes.ts`, `watch-history-browse-routes.test.ts`,
`watch-history-grid.ts`, `watch-history-grid-routes.ts`, `watch-history-grid.test.ts`
в `apps/web/lib/anidachi-auth/`; `packages/protocol/src/watch-history.ts` и его tests.
**DB:** следующая CLI-generated additive migration `personal_watch_history`;
старые `20260904*`/`20260905*` migration files используются только как reference.

**Interfaces:** `applyPersonalWatchProgress({ userId, input })` принимает новую
envelope, вызывает `apply_personal_watch_progress_v1(uuid,jsonb)` и возвращает
WatchProgressAck. Existing list/detail/catalog read shapes сохраняются; personal
browse выбирает canonical rows из обоих исторических источников до pagination.

- [x] Сначала поставить failing cases: paid guest + Free host; Free write/read через каждый путь; старый shared session не должен определять точку гостя.
- [x] Реализовать личный writer с reuse canonical identity/aggregates/receipts/deletion fences, исключив group/session prerequisites. Старые sessions сохранить как данные, без нового shared result.
- [x] Проверять gate внутри SQL writes и Web reads, включая SSR, catalog begin/commit, receipt replay, detail, browse/options/sessions и legacy recreation. Публичный canonical alias не должен обходить cutover gate.
- [x] Обеспечить personal browse: owner progress из прошлых solo/shared, фильтрация перед страницами, поиск по тайтлу/эпизоду, date matching по собственным событиям, стабильный cursor binding.
- [x] Добавить youtubeConsentEpoch при on/off; новая эпоха не переиздает очередь периода без согласия. Не сбрасывать Crunchyroll consent/историю при YouTube off.
- [x] Сохранить delete-all для Free; прочие paid-only операции не должны вытекать через preferences/SSR/legacy endpoints.

Реализация `b03f581` и исправление catalog epoch `899410f` прошли независимое
ревью. Локальные Web/SQL/контрактные проверки записаны в
[verification record](../../personal-history-and-plans-mvp-verification.md).
Это готовность серверной части: policy еще inactive; реальный клиент,
HTTP/SSR в браузере и staging acceptance остаются этапами 5, 6, 9, 10.

Проверочная таблица SQL integration fixtures:

```text
Free host H: zero personal checkpoints
Plus guest A: E5=1080 seconds, ended=false
Pro guest B: E5=1440 seconds, ended=true
H continues E6; assert A.E5=1080, B.E5.completed, H has no personal progress
Replay A.clientEventId twice; assert one receipt and unchanged completed count
Delete A.E5; replay its old envelope; assert no resurrection
```

**Gate:** web/protocol checks/tests + реальные pgTAP/RPC calls, не только regex
по SQL. Смешанная историческая fixture solo/shared не теряет тайтлы и не
удваивает counts; page/detail/grid показывают одинаковые агрегаты. Whole-history
fetch не заменяет bounded pagination: 50 episode rows/page, 2000 catalog episodes,
существующие byte bounds сохраняются.

## Task 4: Recent People независимо от истории

**Create:** `packages/protocol/src/room-presence-evidence.ts`,
`apps/api/src/room-presence-evidence.ts`, `apps/api/test/room-presence-evidence.test.ts`,
`apps/web/app/api/internal/rooms/presence-evidence/route.ts`,
`apps/web/lib/anidachi-auth/room-presence-evidence.ts`,
`apps/web/lib/anidachi-auth/room-presence-evidence.test.ts`,
`apps/web/supabase/tests/room_presence_evidence.test.sql`.
**Modify:** `apps/api/src/index.ts`, `room-persistence.ts`,
`apps/api/test/runtime/room-hibernation-runtime.ts`,
`apps/web/lib/anidachi-auth/social.ts`, `social.test.ts`; CLI-generated migration
`recent_people_from_room_presence`.

**Interfaces:** `record_recent_room_presence_v1(p_evidence jsonb)` принимает
только серверно подтвержденные пары из раздела 3.5; результат `{ accepted: true }`
идемпотентен. Internal auth использует существующую room callback authority,
без передачи secret в extension и без anonymous endpoint.

- [x] Тест: Free+Free реальные WS joins создают Recent People; один лишь invite/HTTP membership не создает.
- [x] Формировать bounded pair evidence в DO при подтвержденном join; не добавлять человека, который вышел до входа другого.
- [x] Доставлять через durable bounded outbox, сохранять после hibernation и до terminal teardown; same pair repeats coalesce, callback replay не создает дубль.
- [x] Принимать позднюю легитимную delivery после конца комнаты, проверяя generation/time/authority; не восстанавливать удаленные аккаунты и скрытых Recent People.
- [x] Сохранить старую evidence таблицу/read projection; новый поток не заполняет provider/position/watch sessions для Free.

`42e1b88` прошел независимое spec/code review; runtime44, room harness39,
Web471, protocol162, SQL895 и остальные локальные проверки записаны в
[verification record](../../personal-history-and-plans-mvp-verification.md).
Согласованная доставка migration/Web/Worker и staging приемка остаются этапами 9–10.

**Gate:** API unit/runtime + Web/SQL tests, failure/retry и room-end race.
Отказ этого callback не задерживает playback/join, а исправляется ограниченным
повтором. Не переносить сюда notification outbox или общий журнал всех событий.

## Task 5: Capture, очередь и Resume расширения

**Create:** `apps/extension/src/watch-history-access.ts`,
`apps/extension/test/watch-history-access.test.ts`.
**Modify:** `apps/extension/src/watch-history-controller.ts`,
`watch-history-client.ts`, `watch-history-storage.ts`, `watch-history-outbox.ts`,
`watch-history-catalog.ts`, `watch-history-runtime-policy.ts`,
`watch-history-preference-listener.ts`, `source-adapters/core/history-policy.ts`,
`apps/extension/src/overlay-app.tsx`, `apps/extension/entrypoints/background.ts`;
одноименные tests в `apps/extension/test/`.

**Interfaces:** background хранит owner-bound WatchHistoryAccess и неизменяемую
PersonalWatchProgressRequest. Controller получает доступ до getObservation и
catalog fetch; publisher возвращает существующий ack/recovery result.

- [x] Failing tests: confirmed Free никогда не вызывает history observation/catalog/enqueue; room detection/sync при этом работает.
- [x] Один paid recorder работает при solo и room. Убрать ожидание room_history authority именно из личной записи; live source/session fences остаются у комнаты.
- [x] Persist clientSequence/accessEpoch вместе с очередью; повтор не присваивает новую epoch, owner или eventId. Account switch немедленно отключает все предыдущие callbacks.
- [x] D05: после validUntil прекратить сбор, сохранить ограниченную уже допустимую очередь; при 503 не показывать Free. При подтвержденном Free очистить текущие observations и закрыть presentation, не стирать durable server history.
- [x] При доступном аккаунте на том же epoch повторить eligible очередь; после paid→Free→paid старую очередь не переоформлять как новый просмотр.
- [x] Resume передавать безопасному player launch path с личным URL/time, без автоматического room create. Сохранить account/current-room protections и явное действие запуска.

Уточнение по исходному коду во время Task5: текущий Resume вызывает
`chrome.tabs.create` с одним `episode.sourceUrl`; готового переноса сохраненного
времени не оказалось. Поэтому в этот этап входит небольшой безопасный
одноразовый launch intent/helper, общий для Popup и сайта на этапе 6.
Проверки владельца, поколения, источника и активной комнаты выполняются до seek;
сессионные токены в URL и новые разрешения на сайты не добавляются.

Этап реализован `e4f9083` и исправлен `092f189`; независимое ревью одобрило
результат. Полный extension run: 1 772 теста; после узкого исправления browse
48 проверок, после исправлений Resume 91 целевая проверка и 167 protocol tests.
Extension/protocol checks и narrow staging build/validate прошли. Для Crunchyroll
Resume использует отдельную проверку состояния существующего MAIN player bridge;
обычные room-команды не меняются. Реальное поведение загруженного расширения,
рекламы и MV3 остается отдельной приемкой этапов 8–10. Подробности —
`docs/personal-history-and-plans-mvp-verification.md`.

Ключевой unit-кейс использует существующую dependency-injection поверхность:

```text
start with access.state=plan_required
fire playback heartbeat, pause, ended, room_leave and source_change
assert history getObservation/enqueue/catalog upload calls = 0
assert room source detection and host synchronization remain operational
switch account while access request pending; resolve old response
assert new account cache and capture state are unchanged
```

**Gate:** extension check/test, new/old storage fixtures, MV3 restart, delayed
network, consent off/on, logout/account switch, leave/source change races. Не
считать последнюю секунду после kill процесса гарантированно сохраненной.

## Task 6: Единая шторка, сайт и тарифные формулировки

**Modify:** `apps/extension/src/popup-watch-drawer.tsx`, `popup-watch-browse.ts`,
`popup-watch-filters.tsx`, `popup-watch-history.tsx`, `watch-history-browse.ts`,
`watch-history-browse-cache.ts`, `popup-watch-history-styles.ts`;
`apps/extension/test/popup-watch-browse.test.tsx`, `popup-watch-history.test.tsx`,
`watch-history-browse.test.ts`, `watch-history-browse-date.test.ts`;
`apps/web/app/account/watch-library/page.tsx`, `watch-library-client.tsx`,
`watch-library-client.test.tsx`; `apps/web/lib/pricing-tiers.ts`, `pricing-copy.ts`,
`apps/web/components/pricing.tsx`, `apps/web/app/pricing/page.tsx`;
`docs/social-pricing-model.md`.

**Interfaces:** personal browse + WatchHistoryAccess; существующие карточки,
episode grid и progress detail принимают те же canonical owner-bound данные.

- [x] Удалить Mine/Together, social history filters и session/company pills; запрос personal содержит оба прошлых источника, search расширяется.
- [x] Убрать старые UI mode/group/participant, сохранить валидные own search/date; мигрировать persisted keys только если они существуют. Кеш personal имеет отдельный query key, не смешивается с прежним solo/shared.
- [x] Добавить locked Free, temporary access error, upgrade-required и paid empty states без скачков; stale cached paid cards не мигают перед confirmed Free.
- [x] Сохранить всю согласованную косметику: карточки, posters, dropdown, 4–5 рядов, autohide scrollbars, фокус, reduced motion, отсутствие дат/chips и стабильный нижний detail.
- [x] На сайте использовать тот же gate до SSR data fetch, убрать shared resume/labels и сохранить удаления/consent controls. Free clear-all не раскрывает список тайтлов.
- [x] Согласовать pricing copy с общей policy: все интеграции, Free без истории, Plus 6/Pro 8 микрофонов. Публичный выпуск этих обещаний зависит от Task 8/10; не менять Stripe prices.

Уточнение по исходному коду Task6: просмотренные фильтры хранятся в React state,
отдельных persisted UI keys нет. Удаляется ненужное состояние без создания
нового хранилища или искусственной миграции. Существующий query key уже включает
mode и разделяет namespace personal. В исходниках готовится финальная тарифная
формулировка; служебная надпись о стадиях разработки в продукт не добавляется.
Публичный выпуск остается закрыт до media acceptance этапов 8–10.

**Gate:** extension + web checks/tests; web `pnpm test` не включает TSX в app,
поэтому отдельно запускать `pnpm --filter @anidachi/web exec tsx --test
app/account/watch-library/watch-library-client.test.tsx`. Реальный browser
осмотр на узкой/широкой шторке, длинных именах, фильтрах, фильмах/Specials,
смене сезона, Free/paid и stale request; маленькие UI правки внутри этапа не
требуют полного пересчета графа и room harness после каждой строки.

## Task 7: Worker caps, media grants и дневная квота

**Modify:** `apps/web/lib/anidachi-auth/plan-entitlements.ts`, `db.ts`, `jwt.ts`,
`room-create.ts`, `room-usage.ts`, `apps/web/lib/room-quota.ts`,
`apps/web/app/api/rooms/route.ts`, `apps/web/app/api/rooms/[roomId]/connect/route.ts`;
`apps/api/src/index.ts`, `auth.ts`, `room-state.ts`, `room-persistence.ts`,
`room-socket-attachment.ts`, `room-source-persistence.ts`, `room-metering.ts`, `room-admission.ts`;
`apps/api/test/room-state.test.ts`, `room-metering.test.ts`,
`room-persistence.test.ts`, `runtime/room-hibernation-runtime.ts`;
`packages/protocol/src/types.ts`, `room-media.ts`, `room-session.ts`.
**DB:** CLI-generated additive migration `room_media_capabilities_v2`;
`apps/web/supabase/tests/room_media_capabilities.test.sql`.

Уточнение по исходникам при реализации: также затрагиваются существующие Web
internal lifecycle callback/helper и client/server protocol unions. Для выдачи
проверенного capability lease и расчета Worker deadlines допустимы два узких
helper-модуля вместо расширения большого index.ts. Используются прежние JWT
signing, internal auth и общий scheduler; отдельная авторизация, конкурирующий
alarm или независимый cutover flag не добавляются. Точные пути и покрытие
потребителей фиксируются в отчете этапа. Exhaustive consumer
`apps/extension/src/debug-log.ts` получает только краткие безопасные summary
новых событий для совместимости типов; media/UI-реализация остается этапу 8.

**Interfaces:** RoomMediaCapabilities, MediaIntent, ParticipantMediaState из
Task 1; room creation/connect/token и persisted room capabilities используют
одну версию. Источник caps всегда host room authority. V2 использует строгую
форму существующего подписанного capabilities claim без maxMediaSeats;
неизвестное top-level поле версии само по себе не закрывает старый verifier.
Create/connect согласуют X-Anidachi-Media-Protocol:2, с обновлением фактических
Web-потребителей на этом этапе и extension-потребителей на этапе 8. После
activation новый legacy create RPC закрыт атомарно; v2 wrapper использует тот
же защищенный core и порядок блокировок policy-before-account. Legacy claim
также отвергает уже сохраненную v2 room; versioned claim проверяет согласованную
версию атомарно, без возможности обхода через private core. Новый клиент может
подключиться к прежней room по ее v1 caps. Уже созданные legacy rooms
завершаются по прежнему контракту.

Выявленный при ревью прежний Web-маршрут создания room из watch-history session
остается только для совместимости до activation. После activation он явно
возвращает terminal update-required, включая гонку с включением policy; временная
ошибка учета не подменяет постоянный отказ. Новый Resume уже открывает личный
URL/время, а обычное создание комнат и приглашения остаются отдельным действием.

- [x] Тестировать атомарную конкуренцию за 4-ю камеру/8-й микрофон, host counted, independent camera/mic releases, no ghost grant on replay.
- [x] Подписывать и сохранять caps при создании; существующая room не принимает caps гостя или выше из client body. Переподключение не повышает тариф.
- [x] Реализовать Worker grant/deny/release/revoke, разрешения signaling receiver pairs, versioned snapshot и durable восстановление grants/deadlines.
- [x] Привязать grants к participant session и room generation. Явный выход освобождает их сразу. В v2 краткий обрыв сохраняет участника и grants на прежние 60 секунд grace с connected:false; он не участвует в signaling/presence/metering. Та же session может восстановить разрешения, новая session заменяет резерв с выключенной публикацией. Истечение grace и прежний более ранний host-end deadline освобождают резерв. Старые socket/message/timer не затрагивают замену; grant сам по себе не запускает capture. Legacy rooms сохраняют прежнее поведение.
- [x] Ввести capability expiry/renewal по D02; timeout не продлевается бесконечно за счет reconnect. Старые rooms/mediaSeat работают в legacy mode до завершения.
- [x] Исправить дневную разбивку meter: versioned per-day accumulator + idempotent cumulative upsert по room/day. Добавить `commit_room_usage_day_v1` для подтверждения закрытого UTC bucket без завершения живой комнаты; действующий finalize не использовать как промежуточный commit. На UTC boundary закрыть прошлый bucket, получить остаток нового дня и начать новый; retry не добавляет cumulative seconds повторно.
- [x] При нулевой квоте или невозможности надежно выдать следующий дневной бюджет немедленно остановить живую room: зафиксировать окончательный расход, отправить ROOM_ENDED и закрыть WebSockets, не ожидая ответа учета. Durable usage acknowledgement требуется перед окончательной записью завершения и выдачей новой квоты/повторным использованием room. Pending bucket и состояние завершения сохраняются при hibernation; повтор учета идемпотентен, с конечным timeout и сохраненным 10-секундным retry. Повторный alarm не открывает room и не списывает расход повторно. Сохранять single-active-room restriction и отсутствие расхода у гостя.
- [x] Ограничить число ожидающих подтверждения дневных bucket; при невозможности надежно учитывать время не выдавать новый Free-бюджет. Показывать ошибку учета, не бесконечную бесплатную комнату.

Задержавшийся alarm не применяет вчерашний остаток ко времени после полуночи.
Исчерпание до полуночи завершает room в тот момент; совпадение с полуночью
обрабатывается как граница дня с подтверждением старого bucket и получением
нового бюджета. Эти случаи проверяются в Worker, а не только в helper учета.

Проверочный meter-пример:

```text
23:58 UTC host + guest start; 00:03 stop
expected day1=120 seconds, day2=180 seconds
repeat finalization twice; totals stay 120/180
host alone for 10 minutes; totals unchanged
guest reconnect; no duplicated participant or parallel room quota
```

**Gate:** protocol/web/API tests + API runtime и room harness. Проверить 5-го,
7-го,16-го участника; request/deny не запрашивает media capture. Не использовать
камерный лимит как общий participant или microphone cap.

## Task 8: Receiver-only P2P и media controls расширения

**Modify:** `apps/extension/src/p2p-media.ts`, `ghost-cam.ts`, `media-types.ts`,
`overlay-app.tsx`, `room-client.ts`, `overlay-room-media-controls.tsx`,
`apps/extension/test/p2p-media.test.ts`, `overlay-room-media-controls.test.tsx`,
`overlay-media-session.test.ts`, `tests/e2e/p2p-media-harness.mjs`.
**Create:** `apps/extension/src/room-media-session.ts` — узкое volatile-состояние
явного intent и согласования ACK/snapshot, без собственного захвата устройств.
**Additional verified consumers:** `apps/api/src/room-rate-limit.ts`,
`apps/api/src/index.ts` и соответствующие unit/runtime проверки границ сообщений.

**Interfaces:** syncParticipants потребляет весь room roster и grants,
ограничивает peers правилами Task 1/7; start local capture только после актуального
grant и intent. Receive-only controller не зависит от local media seat.

Уточнение по исходникам: текущая overlay уже превышает 6000 строк, а обработка
grant/ACK в ней и RoomClient отсутствует. Допустим один узкий helper согласования
намерения и разрешения; транспорт/session остается в RoomClient, захват — у
существующего media controller/overlay. Отдельный источник authority, polling
тарифа или второй владелец захвата не добавляются. Точный путь и интерфейсы
фиксируются в отчете и проверяются вместе с реальным подключением потребителей.

Фактический 4-client прогон выявил старый общий лимит SDP 8/10 секунд, который
закрывает соединения; для 15 участников одному publisher нужно минимум 14
первичных SDP к разным peers. В подписанном v2 допустим прежний бюджет на каждую
разрешенную P2P-пару: SDP 8, ICE 80, control 40, total 120 за 10 секунд.
P2P control включает сообщения голоса/переподключения; обычные команды, реакции,
неверные сообщения и ping сохраняют прежний общий бюджет участника. Перед
парсингом остается конечный общий предел из frozen caps, перед выделением
pair bucket проверяется текущая авторизация. Количество bucket ограничено,
переподключение/смена socket и churn не сбрасывают активное окно. Legacy path
сохраняется. Точные пределы, реальные signal counts и антиспам-регрессии
фиксируются в отчете; лишние повторные negotiation исправляются отдельно.

Уточнение независимой проверки: при удалении subject сохраняются все еще
действующие target windows, включая начавшиеся позже общего окна. Терминальный
отказ захвата освобождает только соответствующее место через существующий
intent-контракт. Внутренний callback несет неизменяемый MediaIntent именно
исходной попытки; запоздалый отказ не выключает более новое намерение.
Потерянный disable согласуется с актуальным snapshot ограниченно, по реальному
поколению транспорта, с исходными request/sequence. Повтор snapshot не создает
цикл отправок, а новые intent/epoch отменяют старое согласование.

- [x] Убрать жесткий slice трех remote peers только вместе с ограниченным pair-selection; не создавать receiver↔receiver mesh.
- [x] Поддержать offer/answer/renegotiation recvonly/sendonly/sendrecv и добавление публикации после входа; при отзыве удалить собственный track, продолжить прием остальных.
- [x] Reconcile granted vs actual camera/mic, оба счетчика в room UI, понятный limit feedback; не возвращать случайные старые состояния после source switch/reload.
- [x] D03: готовый PTT удерживает разрешенное место, press/release не пересоздает peers и не требует round trip выдачи grant. Keyup/blur/revoke во время async capture не оставляет открытый звук. Проверить latency первого и повторного нажатия; вход в room сам не занимает microphone slot.
- [x] Проверить сохранность существующего Open mic, PTT, per-listener mute/volume, speaking indicators и layout четырех камер. У каждого из 15 получателей должны играть разрешенные streams.

**Gate:** extension checks/tests + harness 4/6/15 с фактическим decoded media,
включая 4 camera-only + 8 mic-only + 3 receive-only, forced relay, permissions
denied, device removed, late join, host/viewer reload, short network loss.
Использовать существующие SLO TTFM p95<6s, recovery<10s, PTT p50<300ms как
цели проверки; проценты надежности нельзя выводить из одного запуска.
Если P2P не выдерживает требование — блокировать Pro media release, представить
измерения и отдельное решение; не выдавать изменение константы за поддержку.

## Task 9: Совместимость, сохранность и сквозная приемка

**Create:** `docs/personal-history-and-plans-mvp-verification.md` при начале
исполнения; специализированные cross-plane fixtures рядом с existing tests.
**Modify:** consumer tests перечисленных этапов,
`scripts/room-signaling-harness.mjs`, `tests/e2e/p2p-media-harness.mjs`.
По найденному расхождению v2 quota также проверить контракт
`packages/protocol/src/types.ts`, Worker `apps/api/src/index.ts`,
`apps/extension/src/overlay-app.tsx`, `room-quota-display.ts` и их тесты.

**Interfaces:** один release manifest: DB versions, Web SHA, Worker SHA,
extension version_name, policyVersion, captureVersion, mediaProtocolVersion.

По проверенным исходникам существующий `ROOM_SNAPSHOT` получает необязательный
`quota: { day, remainingSeconds, metering, measuredAt }` только для Free v2.
Остаток ограничен 0–1800 и рассчитывается Worker из frozen budget за день за
вычетом полного usage комнаты; HTTP-остаток повторно не вычитается. Существующий
scheduler публикует snapshot при обновлении бюджета/дня и metering; отдельного
таймера не появляется. UI принимает только актуальную комнату/session/owner и
новый порядок day/time, интерполирует разрешенный metering и не завершает v2
комнату своей оценкой. Отсутствующий Free budget означает ожидание authority;
отсутствие quota у paid v2 нормально. Legacy расчет и завершение сохраняются.

- [x] На populated disposable fixture сравнить до/после counts и hashes канонического progress, completion, consent, social/invite, room и account данных. Ни clean-start, ни backfill групп не нужны.
- [x] Согласовать v2 countdown с authority Worker: disconnected reservation не расходует время; nonterminal ACK не вычитается повторно; новый UTC-день принимается при старом ненулевом usage. Оценка в UI сама не завершает v2-комнату. Проверить реальный Overlay и сохранить legacy-путь; точный минимальный snapshot-контракт определить по исходникам до правки потребителей.
- [ ] Проверить migration-before-runtime и rollback-to-compat-runtime. Старые v1/v2 и legacy v3 personal writers после activation terminal; новый клиент не падает назад на старый write после 403/426/503.
- [ ] Drain допустимые paid pending events до activation; оставшиеся legacy envelopes не переиздавать с новой accessEpoch. Учесть их отдельно и ограниченно без ложного Synced; подтвержденные server rows сохраняются.
- [ ] Ввести cutover switch только при готовности зависимостей: server policy version с совместимым dark-launch runtime, без публичного UI-флага как authority.
- [ ] Выполнить acceptance matrix ниже; зафиксировать каждый результат как pass/fail/not run и приложить evidence без PII/secrets.

**Gate:** все обязательные сценарии проходят на совместимом стеке; ни Free
capture, ни потеря paid guest progress, ни недоступный receiver не маскируются
как deferred polish. Rate limits, retries, пагинация и payload bounds не
расширяются без измерения.

**Локальная реализация Task 9 проверена:** `b4706c1` и исправление `f7ed14c`
прошли независимое ревью, включая повторную проверку сохраненного legacy quota.
Заполненная база с 41 миграцией из staging `a03c012` прошла все 14 новых
миграций: старые поля/counts/hashes 24 таблиц совпали; 19 таблиц были непустыми.
Policy остается неактивной. Protocol 169, API 217, Worker 61, комнаты 39 и
Extension 1812 прошли; поздние правки дополнительно покрыты focused 57,
reconnect 1 и после ревью focused 50, check/build/validation.
Это пересекающиеся наборы проверок, их количества не суммируются.
Все H/E/UI/M/S/C строки имеют среду и результат в
[verification record](../../personal-history-and-plans-mvp-verification.md).
Оставшиеся unchecked пункты включают операционную приемку Task 10: фактический
drain установленных клиентов, совместимый rollback, activation, loaded MV3,
Stripe TEST, реальные провайдеры, устройства/TURN/две сети. Они не объявлены
пройденными по локальным тестам. Исходный checkout и обе r10 tester folders
проверены полными хешами и сохранены.

## Task 10: Staging-поставка и решение о дальнейшем выпуске

**Files:** verification record, `docs/current-development-state.md`,
`docs/project-architecture-and-development.md`, `docs/social-pricing-model.md`,
активные room/P2P планы, release PR templates и Graphify artifacts.

- [ ] Зафиксировать совместимый rollback candidate Web/Worker/extension до rollout; активные legacy rooms завершить штатно или дождаться их окончания.
- [x] Применить additive DB prerequisites через отдельный migration PR; проверить функции/grants/counts и отсутствие destructive changes.
- [x] Доставить совместимые Web/Worker runtimes с еще не активированной coordinated policy; затем matching extension. Старый клиент до обновления остается на разрешенном legacy contract либо получает честное update-required.
- [ ] Проверить loaded artifact, затем включить coordinated policy; проконтролировать 403/426, paid writes, Recent People и media у обоих тарифных направлений гостей.
- [x] Синхронизировать ровно согласованный staging artifact в обе установленные tester folders с отдельными backup и полной hash verification.
- [ ] Зафиксировать фактический reload и loaded artifact в Chrome AniDachi Test.
- [ ] Провести staging two-account/two-network flow, Stripe TEST changes и нагрузку 15/4/8. Внести результаты в verification record и активный P2P plan.
- [x] Подготовить итог поставки и сохранить main/production без продвижения: решение о выпуске остается отдельным после операционной приемки. Согласование плана или green local tests не означает разрешение на production.

**Локальная подготовка и итоговое ревью завершены:** пакет поставки создан в
`61927b0`; единственное полное ревью выявило три Important: атомарную проверку
старых комнат перед переключением политики, восстановление лимита Pro после
пробуждения Worker и сохранение собственной ссылки вместе со временем Resume.
Исправления `d2e32e8` и обновленный source pin `fd873a4` прошли регрессионные
проверки и независимое scoped rereview без новых Critical/Important. Текущий
runtime pin — `d2e32e87494924d73ddb16ed9956490a9f635061`. Семантический Graphify
завершен в `48b5fd8`: все 16 измененных документов и 167 файлов кода обработаны,
проверки целостности прошли. Найденная CI ошибка линтера исправлена единственной
строкой `let` → `const` в тесте Stripe (`2bf18fb`); линтер, 9 тестов модуля и
независимое scoped review прошли. Рабочее поведение и сборка extension не менялись.

**Фактическая поставка:** migration PR
[#273](https://github.com/AniDachi/anidachi-LP/pull/273) вошел в staging как
`756f04e`; DB workflow `34225005537` прошел. В staging 55 миграций, policy v1
неактивна, grants проверены, 62 пользователя и 19 записей прогресса сохранены.
Runtime PR [#274](https://github.com/AniDachi/anidachi-LP/pull/274) вошел в staging
как `c7fbdb5` после зеленых CI, Rooms, P2P, smoke и Vercel preview. Staging Web
`dpl_BWTGmyLxHTp619UwkHFbit7GG6v9` имеет READY и правильные aliases; Worker
version `14e77738-6c1e-4424-a142-366e75137525` обслуживает 100% deployment
`87a4b594-2183-43df-b34f-8f2255e6e8f4`. Staging CI, DB/API/extension workflows,
Rooms/P2P и smoke прошли; сайт остается под паролем с noindex, Worker health
возвращает 200, ICE без авторизации — 401.

Обе tester folders синхронизированы 8 сентября в 12:37 UTC сборкой
`48b5fd8-staging-20260908191943`: все 12 файлов совпадают с проверенным
артефактом, обе отдельные резервные копии совпадают с прежней r10.
Финальный source pin `2bf18fb` отличается от проверенного runtime `d2e32e8`
только исправлением линтера в Web-тесте; extension source не изменился после
сборки `48b5fd8`. Поэтому разные build/source/staging SHA записаны отдельно.
Повторная независимая проверка в 12:38 UTC подтвердила сохранность всех 1069
файлов исходного checkout, его HEAD и прежних 38 записей рабочего статуса.
Поставка с неактивной политикой завершена; unchecked пункты операционной приемки
остаются открытыми, поэтому Task 10 целиком не объявлен завершенным.
Mac сейчас заблокирован, Stripe TEST connector не подключен; loaded Chrome/MV3,
Stripe TEST, C04 и проверки устройств/сетей этим ревью не закрыты.

В базе также остаются 177 старых незавершенных legacy записей: 35 со статусом
live (созданы в июне–июле) и 142 lobby (июнь–август). Это не доказательство
наличия 177 активных комнат Worker. Перед activation нужна сверка с фактическим
жизненным циклом комнат и проверенная процедура согласования устаревших записей;
возраст записи сам по себе не разрешает ее удаление или принудительное завершение.
Атомарная проверка перед activation сохранена, shared policy остается выключенной.

Последующая правка тестового binding и фиксация delivery IDs/результатов не
меняют архитектуру и связи исходников. Graphify `48b5fd8` остается снимком
проверенной реализации; для этой финальной записи поставки повторный граф не
требовался. Новые изменения поведения потребуют соответствующих проверок.

**Rollback:** до activation — возврат прежних runtime при сохранении additive
schema. После activation — вернуть только заранее проверенный compat runtime,
который продолжает paid gates и новый personal writer; старый runtime с Free
историей или host-dependent guest writer недопустим. При media regression новые
v2 комнаты приостановить/завершить штатно; не интерпретировать их как legacy
maxMediaSeats. Данные и epochs назад не откатывать; исправления — forward migration.

## 5. Приемочная матрица

Проверки H/E/UI/M/S/C обязательны. Сценарии с D выполняются по окончательно
выбранному правилу. Каждая строка должна иметь evidence, а не только checkbox.

| ID | Сценарий и ожидаемый результат | Этап |
| --- | --- | --- |
| H01 | Plus solo и тот же тайтл в комнате: одна личная запись, без двойного тайтла. | 3,5,6 |
| H02 | Free host + Plus guest: гость пишет до собственной точки без checkpoint хоста. | 3,5 |
| H03 | Plus host + Free guest: у гостя нет observation/catalog/outbox/server history. | 2,3,5 |
| H04 | Два paid гостя уходят на разных сериях/минутах: дальнейший хост их записи не меняет. | 3,5 |
| H05 | Гость вошел на 12, смотрел до 18: E5=18, E1–E4 не отмечены. | 3,5 |
| H06 | Вход на paused frame без playback: не возникает просмотренное видео. | 5 |
| H07 | Реклама/buffering/source mismatch не записывают чужое время и неверный episode key. | 3,5 |
| H08 | Повторная озвучка того же эпизода: одна completion, Resume на реальном raw variant. | 3,5 |
| H09 | Новый rewatch/seek назад меняет Resume после playback, completion остается. | 3,5 |
| H10 | Duplicate, out-of-order, одинаковое observedAt и разные устройства: детерминированный результат, старое не затирает новое. | 3,5 |
| H11 | Delete episode/title/all + late write/retry: удаленное не воскресает. | 3,5 |
| H12 | MV3/browser kill: восстановлена последняя durable point/eligible очередь, без ложной гарантии последней секунды. | 5 |
| H13 | Source change/leave/reconnect: финальный checkpoint относится к исходному эпизоду и аккаунту. | 3,5 |
| E01 | Free GET через все history APIs, SSR, browse и catalog: нет скрытых данных/200 с платными данными. | 2,3,6 |
| E02 | Free POST напрямую, SQL aliases и stale paid JWT не обходят gate. | 2,3 |
| E03 | Paid→Free: новая запись/чтение закрыты; old durable history сохранена по D01. | 2,3,5,6 |
| E04 | Free→paid: без backfill Free-периода, новая epoch, согласие YouTube не включено само. | 2,3,5 |
| E05 | Consent off/on: события выключенного периода не попадают после включения; CR не сломан. | 3,5 |
| E06 | Entitlement service failure: retry/unavailable, без ложного downgrade/logout и бесконечного capture. | 2,5,6 |
| E07 | Cancel-at-period-end, expiry, past_due, duplicate и обратный порядок webhook: одна верная durable policy. | 2 |
| E08 | Pending response аккаунта A после перехода к B: ноль утечек и записей под B. | 2,3,5,6 |
| E09 | Free может удалить все свои старые данные без покупки доступа и просмотра списка. | 3,6 |
| E10 | Crunchyroll и YouTube: create/join/sync доступны во всех тарифах; отсутствие history access и YouTube-history consent не блокирует просмотр или приглашения. | 1,2,5,6,7 |
| UI01 | Убрали toggle: прежние solo/shared записи видимы вместе, counts не удвоены. | 3,6 |
| UI02 | Search/date filter применяются до pagination, future dates заблокированы, UTC/DST корректны. | 3,6 |
| UI03 | Старые saved social filters не дают пустую историю; search/date сохранены корректно. | 6 |
| UI04 | Сезон/Specials, длинное название, E0, фильм, missing cover/catalog: стабильная сетка и detail. | 6 |
| UI05 | Free/paid/loading/error/empty/filter-empty различимы; paid cache не мелькает в Free. | 6 |
| UI06 | Keyboard, Escape/focus, reduced motion и 4–5 рядов/скроллы работают в узком drawer. | 6 |
| UI07 | Resume из Popup и сайта открывает личную точку; room invitation остается в плеере. | 5,6 |
| M01 | Room caps 4/6/15 включают хоста; лишний участник получает ROOM_FULL. | 7 |
| M02 | 5-я камера / 7-й Plus / 9-й Pro mic запрещены, уже работающие сохраняются. | 7,8 |
| M03 | Camera+mic одного человека занимают разные счетчики; выключение одного не выключает другой. | 7,8 |
| M04 | Receive-only слышит/видит всех publishers без local capture permission. | 8 |
| M05 | Гонка enable/disable/revoke/PTT keyup/grant не включает микрофон позже. | 7,8 |
| M06 | Wake/reconnect/source switch/device failure: grants восстановлены либо освобождены, phantom seats нет. | 7,8 |
| M07 | 15 участников, disjoint camera/audio publishers: decoded streams у каждого, измеренные CPU/uplink/relay. | 1,8,10 |
| M08 | Listener mute/volume, speaking indicator, PTT/Open mic и четыре camera slots не регрессируют. | 8 |
| M09 | Free гость в paid room не расходует свою quota; paid гость не повышает Free room. | 7 |
| M10 | UTC midnight, repeated finalize, host alone, reload, quota=0: корректные секунды и штатный конец. | 7 |
| M11 | Смена тарифа/expiry/неудачная renewal: D02 соблюден без random kicks и бесконечного продления. | 2,7 |
| S01 | Direct/group/link invites идут прежним путем, повтор не дублирует push. | 4,9 |
| S02 | Free+Free presence создает Recent People; invite без WS join не создает. | 4 |
| S03 | A ушел до B: их не считают встречавшимися; поздняя delivery после конца допустима только с valid authority. | 4 |
| S04 | Group edit/archive/friend removal не меняют личную историю и не публикуют private group names. | 3,4,9 |
| S05 | Гость не управляет комнатой и не становится хостом; уход/возврат хоста использует прежний lifecycle/grace, личная запись остальных зависит от их плеера и доступа. | 5,7,9 |
| C01 | Смешанные существующие записи пережили migration с теми же progress/completion/consent. | 9 |
| C02 | Legacy writer, receipt replay, старый cached access и SQL alias не обходят activation. | 3,9 |
| C03 | Old/new extension + old/new Worker/Web: поддержанная комбинация или явный update-required, без тихого fallback. | 7,9 |
| C04 | Compat rollback сохраняет gates, данные, epochs и возможность следующего исправления. | 9,10 |

## 6. Проверки и свидетельства

Команды запускать с toolchain репозитория. Для shell без fnm setup использовать
`fnm exec --using="$(cat .node-version)"` перед командой. Проверка схемы/графа
этого документа не является ни одним из нижеследующих runtime результатов.

```bash
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web exec tsx --test app/account/watch-library/watch-library-client.test.tsx
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm harness:rooms
npm --prefix tests/e2e run harness:p2p
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm smoke:worker:staging
pnpm dev:check
```

DB: подтвердить версию установленного Supabase CLI и `--help`, создать отдельную
disposable local DB, применить всю migration chain, выполнить `supabase test db`
и lint/advisors доступной версии. Не запускать reset на общем локальном или remote
проекте. `supabase migration new <описательное-имя>` создает новый timestamped
файл; конкретные имена task suffix приведены выше, applied файлы не переписываются.

На staging фиксировать: даты, SHA/migration revisions, Web/Worker deployment,
extension version_name и hash, реальные аккаунты-тарифы без идентификаторов в
публичном отчете, direct/relay факт, playback/media outcomes и оставшиеся gaps.
Существующие цели P2P из активного roadmap остаются критериями; один успешный
harness run не доказывает 99% reliability. Не пересобирать/синхронизировать
tester folders при каждой мелкой правке — только для согласованных кандидатов.

## 7. Покрытие спецификации

| Требования | Этапы |
| --- | --- |
| R01, R08–R11, R17–R18 | 2,3,5,9 |
| R02, R16 | 1,2,3,5,6,9 |
| R03–R04 | 1,2,6,7 |
| R05–R07, R19 | 4,7,9 |
| R12 | 3,5,6 |
| R13–R14 | 3,5,6 |
| R15, R20 | 1,7,8,9,10 |

Готовность документа: источники и файлы сверены, все R имеют этапы и кейсы,
D имеют конкретные рекомендации, нет зависимых задач без контракта. Готовность
функции наступает только после выполнения этапов, проверки сохранности,
совместимости и staging acceptance. Сейчас зафиксирован именно план.

## 8. Проверенные технические ориентиры

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions):
  invoker/definer, ограничение EXECUTE и search_path. Доступ к таблице и RLS —
  разные границы; существующая custom auth AniDachi остается на Web, не
  заменяется Supabase Auth.
- [Stripe Webhooks](https://docs.stripe.com/webhooks): события повторяются и
  не гарантируют порядок. Использовать event ledger и актуальное состояние
  ресурса, проверять конкурентную запись; event.created не задает надежный порядок.
- [MDN: RTCRtpTransceiver.direction](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/direction):
  направления приема и передачи независимы. Это основа receiver-only сценария,
  но не доказательство производительности P2P на 15 участниках.
- [Cloudflare WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/):
  восстановление in-memory state требует persisted data/socket attachments;
  новые media grants и deadlines должны проходить реальный forced-wake test.

Источники проверены 2026-09-08 через Context7 и первичную документацию.
Supabase changelog.md не отдался через web reader; перед созданием реальных
миграций перепроверить release notes установленной версии. Новые framework/SDK
возможности и обновления зависимостей этот план не требует.
