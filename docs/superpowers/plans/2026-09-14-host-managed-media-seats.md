# Host-managed Media Seats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Delegation is optional and follows the active session instructions.

**Goal:** Вернуть понятную модель медиа-мест: автоматическая выдача при входе, управление хостом одной кнопкой и отдельный общий лимит четырех камер.

**Architecture:** Supabase закрепляет тариф и версию комнаты, Worker RoomState распределяет места и разрешения на публикацию, расширение выполняет подтвержденные решения сервера. Право на место, желание пользователя включить устройство и фактическая работа устройства остаются разными состояниями. Новая модель использует media protocol v3; действующие v2-комнаты сохраняют прежний контракт до завершения.

**Tech Stack:** TypeScript, Zod, Cloudflare Worker / Durable Objects, Supabase PostgreSQL, Next.js, WXT / React, WebRTC, Vitest, существующие room/P2P harnesses.

**Spec:** Согласованные продуктовые решения сохранены в разделе «Спецификация» этого документа. Исходные ограничения: [MVP specification](../specs/2026-09-08-personal-history-and-plans-mvp-design.md), [room/P2P roadmap](2026-06-07-production-room-p2p-hardening-roadmap.md), [room-flow execution plan](2026-06-12-room-flow-p2p-flawless-execution-plan.md).

**Status:** Реализация задач 1–4 и локальные проверки выполнены, идет итоговая проверка ветки и подготовка staging. Приемка двумя устройствами и выпуск main еще не выполнены. Результаты: [delivery record](../../releases/room-media-seats/2026-09-14-delivery.md). База разработки: staging `ccb86654ad08752d9f17d6b5b508548919884740`, production main `f9e6b96453b5344aeed0476fbd2900f7ce355acd`; на момент начала работы деревья файлов совпадали. Изолированная ветка реализации: `codex/room-media-seats-v3`.

## Global Constraints

- Работа: `codex/* -> PR -> staging -> приемка -> promotion PR -> main`. Никакого прямого push в main.
- Node `22.23.1`, pnpm `11.2.2`. В несогласованной shell-среде запускать команды через `fnm exec --using=22.23.1`.
- Меняем управление медиа, не численные лимиты тарифов, биллинг, историю, инвайты, синхронизацию видео или разрешения расширения.
- Сохраняем существующие правила продления room policy, квоты Free, reconnect grace и завершения комнаты. Пятиминутное предупреждение не должно возвращаться из-за ошибки обновления policy.
- Не добавляем очередь, запросы места, отдельные административные кнопки микрофона/камеры, новых ведущих или передачу роли хоста.
- Выпуск завершается приватным ZIP для тестеров. Публичная загрузка на сайте и Chrome Web Store не входят в этот план.

## Спецификация

### Лимиты и права

Все числа включают хоста; возможности комнаты определяет тариф хоста.

| Тариф | Людей в комнате | Медиа-мест | Одновременно включенных камер |
| --- | ---: | ---: | ---: |
| Free | 4 | 4 | 4 |
| Plus | 6 | 6 | 4 |
| Pro | 15 | 8 | 4 |

1. Медиа-место разрешает пользоваться микрофоном и включить камеру, если свободен один из четырех видеослотов. В Pro все восемь обладателей места могут пользоваться микрофонами одновременно.
2. Без места человек продолжает смотреть синхронно, слышать участников, видеть их камеры и пользоваться чатом.
3. Место автоматически получает реально вошедший участник, если есть свободное. Порядок определяет серверное принятие входа, а не время приглашения или сортировка списка. Создатель считается первым участником после успешного входа в комнату.
4. Освободившееся место не выдается автоматически уже находящемуся в комнате слушателю: хост сам выбирает, кому его дать. Новый участник при входе может получить свободное место. Скрытой очереди или резервирования между двумя нажатиями хоста нет.
5. Хост может выдать или забрать место у любого участника, включая себя. Отсутствие своего места не отнимает управление комнатой. При заполнении мест сначала освобождается одно, затем выдается выбранному человеку.
6. Выключение своего микрофона или камеры не освобождает место. Выход освобождает место и занятую камеру; временный обрыв действует по существующему reconnect grace.
7. Выдача места не включает чужие устройства. Сохраняем собственные настройки участника и обычный локальный запуск медиа; отдельное действие хоста не создает новый запрос на capture. Повторная выдача после отзыва требует собственного включения устройства участником.
8. Отзыв места останавливает исходящие аудио и видео, отменяет незавершенные запросы на их включение, освобождает камеру. Входящие медиа и просмотр продолжаются.
9. Запрет хоста нельзя обойти обновлением страницы, новым сокетом или повторным входом того же аккаунта в эту комнату. Он снимается явной выдачей места хостом; новая комната начинает новую историю распределения. Решение хранится сервером по подтвержденному userId, а действия проверяют текущую participantSessionId.
10. PTT / Open mic и собственное включение/выключение микрофона остаются. При наличии места нажатия `V` достаточно для начала PTT: дополнительного шага `Enable microphone` не требуется. Open mic включается собственным действием участника в голосовых настройках; отзыв места сбрасывает публикацию и не допускает автоматического включения после возврата. Локальное приглушение чужого звука и громкость также сохраняются.

### Камеры

- Камеры доступны только обладателям мест. Первые четыре подтвержденных сервером включения занимают слоты; параллельные запросы не создают пятую камеру.
- Когда заняты все четыре слота, чужая выключенная камера недоступна с причиной `All 4 cameras are in use`. Микрофон и место остаются доступными.
- Кнопка выключения уже работающей камеры доступна и при полном лимите. Освобождение слота разрешает другим нажать включение, но не запускает их камеры автоматически.
- Отказ разрешения, отсутствие устройства, ошибка capture или уход участника освобождают соответствующий видеослот. Ошибка камеры не забирает место и не выключает рабочий микрофон.
- Ожидающее включение камеры резервируется только серверным разрешением. Поздний результат capture после отмены/отзыва останавливается и не публикуется.

### Шторка

- В строке участника: аватар, имя в одну строку с корректным сокращением, компактное состояние и справа одна круглая кнопка медиа-места. Строки не меняют порядок и высоту при выдаче/отзыве.
- Кнопка использует один узнаваемый значок медиа-места; проверить существующий `Radio` в реальной шторке. Это не отдельный значок включения камеры или микрофона.
- Место есть: теплая белая заливка и темный значок. Места нет: серый значок на темной поверхности. Плавная смена цвета около 160–180 мс, без сдвига геометрии; учитывать reduced motion.
- Только у хоста кнопка интерактивна. У остальных состояние пассивное. Для кнопки: `aria-pressed`, доступное имя с участником, подсказка `Grant media seat` / `Revoke media seat`, видимый клавиатурный фокус.
- В People оставляем число людей и одну строку счетчиков: `8/8 media seats · 4/4 cameras`. Убираем дублирование этой строки в шапке профиля.
- Убираем административные `Enable microphone`, `Disable microphone`, `Revoke microphone`, `Revoke camera`. Собственные голосовые настройки и собственная кнопка камеры остаются.
- При заполнении мест выдача недоступна с причиной `All media seats are in use. Free a seat first.` Отзыв доступен. Ошибка/ожидание относятся только к нужной строке; белый активный статус появляется после подтверждения сервера.

## Проверенная исходная реализация

- `packages/protocol/src/room-media.ts` содержит strict v2-схемы с независимыми camera/microphone grants; общего места там нет. Добавление полей без новой версии сломает старые парсеры.
- `apps/api/src/room-state.ts` в v2 создает участника без grants и выдает их по собственному intent. Legacy seat handlers в `apps/api/src/index.ts` для v2 запрещены. Их простое включение не реализует нужную модель.
- Web create/connect и SQL negotiation fence сейчас принимают media header `2`; renewal RPC формирует v2 lease. Необходимо согласованно изменить все эти границы.
- `RoomMediaSession` отделяет intent от подтвержденного capture и при восстановлении освобождает старые grants. Новое право на место не должно теряться при таком освобождении.

## Карта изменений

| Область | Файлы и ответственность |
| --- | --- |
| Контракт | `packages/protocol/src/room-media.ts`, `src/types.ts`, `src/index.ts`: версия, seat state, команда хоста, схемы и события. `src/commercial-policy.ts`: источник существующих лимитов. |
| Durable authority | `apps/api/src/room-state.ts`, `index.ts`, `room-persistence.ts`, `room-socket-attachment.ts`, `participant-disconnect.ts`: распределение, полномочия, persistence, reconnect. `auth.ts`, `room-capability.ts`: совместимые lease readers. |
| Web / Supabase | `apps/web/lib/anidachi-auth/db.ts`, `room-capability.ts`, `jwt.ts`; `app/api/rooms/route.ts`, `app/api/rooms/[roomId]/connect/route.ts`; новая миграция `apps/web/supabase/migrations/20260914180000_room_media_seats_v3.sql`: создание, допуск, renewal без смены версии. Перед созданием проверить порядок миграций. |
| Клиент | `apps/extension/src/room-client.ts`, `room-media-session.ts`, `overlay-media-session.ts`, `overlay-voice-session.ts`, `p2p-media.ts`, `overlay-app.tsx`, `debug-log.ts`: negotiation, события, capture и сохранение приема медиа. |
| UI | `apps/extension/src/overlay-room-media-controls.tsx`, `styles.ts`: единая кнопка, причины недоступности, стабильная разметка. |

Не переносить эти обязанности в новый сервис и не устраивать общий рефакторинг больших файлов. В новых именах ниже `V2` означает сохраненную схему, `V3` — новую модель; общий экспорт принимает обе через union.

## Task 1: Версионированный контракт

**Files:** protocol из карты; `packages/protocol/test/room-media.test.ts`, новый `packages/protocol/test/room-media-seats.test.ts`.

**Interfaces:** Вход — существующие v2-схемы и `getPlanPolicy`. Выход — `RoomMediaV3CapabilitiesSchema`, `ParticipantMediaV3StateSchema`, `SetMediaSeatSchema`, `MediaSeatResultSchema`, тип `SetMediaSeat`; union-экспорты capabilities, lease, snapshot и media intent ACK/error для потребителей.

- [x] Добавить контрактные тесты: Free 4/4/4, Plus 6/6/4, Pro 15/8/4; неверные лимиты отвергаются; старые v2 fixtures продолжают читаться; v2 не принимает v3 seat fields. До реализации новые тесты должны падать на отсутствии нового контракта.

```ts
import { expect, it } from "vitest";
import { RoomMediaV3CapabilitiesSchema } from "../src/room-media";

it("rejects a ninth Pro media seat in signed capabilities", () => {
  const caps = {
    mediaProtocolVersion: 3, hostPlanCode: "pro", maxParticipants: 15,
    maxMediaSeats: 8, maxCameras: 4, capabilityRevision: 1,
    capabilitiesValidUntil: "2026-09-15T12:00:00.000Z",
  };
  expect(RoomMediaV3CapabilitiesSchema.safeParse(caps).success).toBe(true);
  expect(RoomMediaV3CapabilitiesSchema.safeParse({
    ...caps, maxMediaSeats: 9,
  }).success).toBe(false);
});
```

- [x] Описать v3 capabilities как strict-схему: `mediaProtocolVersion: 3`, `hostPlanCode`, `maxParticipants`, `maxMediaSeats`, `maxCameras: 4`, `capabilityRevision`, `capabilitiesValidUntil`. Значение `maxMediaSeats` сверять с существующим `getPlanPolicy(plan).maxMicrophones`; отдельного лимита публикаций микрофона в v3 нет.
- [x] Добавить к состоянию участника `mediaSeatGranted: boolean`, `seatRevision: nonnegative integer`; сохранить intent sequence и оба revocation epoch. Команда хоста задает желаемое состояние, а не неидемпотентное «переключить»:

```ts
type SetMediaSeat = {
  type: "SET_MEDIA_SEAT";
  roomId: string;
  roomGeneration: number;
  targetUserId: string;
  targetParticipantSessionId: string;
  expectedSeatRevision: number;
  enabled: boolean;
  requestId: string;
};
// Schema: непустые ID, положительный roomGeneration, неотрицательная revision.
// v3 invariant: (cameraGranted || microphoneGranted) => mediaSeatGranted.
```

- [x] Расширить shared events/exports и snapshot validation: мест не больше лимита, камер не больше четырех, без места grants отсутствуют. Вложенное `state` в v3 `MEDIA_INTENT_ACK` / `MEDIA_INTENT_ERROR` также принимает v3-схему; для отказа публикации без места добавить `MEDIA_SEAT_REQUIRED`. Сохранить v2 lease/snapshot/intent/ACK семантику без изменений.
- [x] Определить `MediaSeatResultSchema`: strict-ответ `type: "MEDIA_SEAT_RESULT"`, `requestId`, `targetParticipantSessionId`, `code` и полный v3 `snapshot`. Коды: `OK`, `MEDIA_FORBIDDEN`, `MEDIA_LIMIT_REACHED`, `MEDIA_STALE_SESSION`, `MEDIA_STALE_GENERATION`, `MEDIA_STALE_SEAT_REVISION`, `MEDIA_CAPABILITY_EXPIRED`. Ответ коррелирует действие хоста; состояние интерфейса берется только из подтвержденного snapshot с проверкой поколения/sequence, в том числе при ошибке. Тестировать поздний результат после более нового snapshot и отказ устаревшей revision.
- [x] Запустить `pnpm --filter @anidachi/protocol check` и `pnpm --filter @anidachi/protocol test`; зафиксировать отдельный commit `feat(protocol): define host-managed media seats v3`.

## Task 2: Durable room policy и совместимость Web

**Files:** Web / Supabase из карты; `apps/web/lib/anidachi-auth/room-capability.test.ts`, `active-room-session-routes.test.ts`, `apps/web/supabase/tests/room_media_capabilities.test.sql`.

**Interfaces:** Принимает shared lease union из Task 1. Производит подписанный lease с закрепленной версией и лимитами, который Worker проверяет. Header `x-anidachi-media-protocol: 3` означает клиент с поддержкой v2 и v3; `2` поддерживает только v2.

- [x] Добавить падающие тесты матрицы: клиент 3 создает v3, клиент 2 создает прежнюю v2; клиент 3 подключается к v2/v3; клиент 2 получает `ROOM_UPDATE_REQUIRED` при входе в v3 до захвата active session. Повтор создания с тем же client request ID не меняет ранее выбранную версию.
- [x] Создать новую additive-миграцию: v3 create/claim RPC, запись версии при создании и renewal с сохранением исходной версии. Существующие v2 RPC/комнаты не переинтерпретировать. Применять grants/lock order из текущей миграции `20260913055426_room_policy_renewal_lock_permissions.sql`.
- [x] В create/connect/renew и token readers использовать общую схему и явную совместимость, не сравнение с единственной строкой `2`:

```ts
const supportsRoom = (client: number, room: 2 | 3): boolean =>
  room === 3 ? client === 3 : client === 2 || client === 3;
// Версия берется из durable room lease. Заголовок клиента не задает права,
// тариф или лимиты. Неизвестная версия получает ROOM_UPDATE_REQUIRED.
```

- [x] Проверить SQL под runtime role: create/claim/renew для обоих протоколов, отказ повышения лимитов, повторная выдача lease через 30 минут, сохранение Free quota и paid entitlement behavior. Миграция не обновляет массово уже существующие комнаты.
- [x] Запустить Web check/test и SQL suite штатным Supabase test runner; commit `feat(web): negotiate durable media seats v3`. Этот этап не выкатывать отдельно как включенный v3 до готовности Worker из Task 3.

## Task 3: Серверное распределение и отзыв

**Files:** Worker из карты; новый `apps/api/test/room-media-seats.test.ts`; существующие `room-media-grants.test.ts`, `room-persistence.test.ts`, `test/runtime/room-hibernation-runtime.ts`.

**Interfaces:** Принимает подписанный v3 lease, `SetMediaSeat` и текущие intents. Добавляет в `RoomState` метод `applyMediaSeatCommand(actorUserId: string, command: SetMediaSeat)` с результатом `{ accepted: true } | { accepted: false; code: string }`; Worker формирует `MEDIA_SEAT_RESULT` из Task 1 после сохранения и рассылает room snapshot существующим путем.

- [x] Написать падающие unit-тесты выдачи первых N мест при входе, отсутствия автопродвижения слушателей, host-only grant/revoke, отказа сверх лимита и независимости места от выключенного микрофона. Старые `room-media-grants.test.ts` оставить проверять v2.
- [x] Для нового suite перенести локальные helpers `room()` / `intent()` из `apps/api/test/room-media-grants.test.ts`, заменив только fixture capabilities на `mediaProtocolVersion: 3`, `maxMediaSeats: 8` вместо `maxMicrophones: 8`. Проверить пользовательский переход на существующих методах RoomState:

```ts
it("keeps the media seat after the participant mutes their microphone", () => {
  const r = room();
  expect(r.applyMediaIntent("u0", intent(0, "microphone", true, 1)))
    .toMatchObject({ type: "MEDIA_INTENT_ACK" });
  expect(r.applyMediaIntent("u0", intent(0, "microphone", false, 2)))
    .toMatchObject({ type: "MEDIA_INTENT_ACK" });
  expect(r.mediaFor("u0")).toMatchObject({
    mediaSeatGranted: true, microphoneGranted: false,
  });
});
```

- [x] Реализовать join и host command в существующем владельце RoomState. Проверять identity, room generation, текущую target session, revision и requestId; дубликат не меняет состояние повторно. По комнате сохранять запрет хоста для userId, чтобы rejoin его не сбрасывал. Использовать отдельные durable записи для запретов, не растущий список ушедших участников в broadcast snapshot; удалять при выдаче места и окончании комнаты.
- [x] В v3 заменить независимое ограничение микрофонов проверкой места; camera intent дополнительно проверяет четыре слота. Отказ «нет места» отличается от «заняты камеры». Основное правило допуска:

```ts
const publicationAllowed = (
  hasSeat: boolean,
  media: "camera" | "microphone",
  camerasUsed: number,
  alreadyHasCamera: boolean,
) => hasSeat && (media === "microphone" || alreadyHasCamera || camerasUsed < 4);
// Проверка и резервирование выполняются одной сериализованной операцией DO.
// Выключение разрешено независимо от заполнения лимита.
```

- [x] При revoke атомарно снять место/оба grants, увеличить seat revision и оба revocation epoch, сохранить запрет. После успешного persistence отправить snapshot/ACK. Старый intent/ACK/сокет не возвращает медиа. При сбое сохранения не сообщать успех.
- [x] Сохранить места на текущий reconnect grace; replacement session не переносит старое разрешение capture. Явный leave/истечение grace освобождают ресурсы. Возвращение после grace допускается по правилу свободного места и сохраненного host override. Восстановление DO сохраняет места, запреты, лимиты и версии.
- [x] Проверить две одновременные выдачи последнего места, два включения четвертой камеры, revoke во время capture, выход/кик/host end, stale timeout после reconnect. При отказе камеры освобождается только ее grant; слушатели продолжают получать P2P.
- [x] Запустить API check/test, `pnpm --filter @anidachi/api test:runtime`, `pnpm harness:rooms`; commit `feat(api): enforce host-managed media seats`.

## Task 4: Клиентские устройства и кнопка места

**Files:** Extension и UI из карты; `apps/extension/test/room-media-session.test.ts`, `overlay-media-session.test.ts`, `overlay-voice-session.test.ts`, `overlay-room-media-controls.test.tsx`, `p2p-media.test.ts`.

**Interfaces:** `RoomMediaSession` принимает v2/v3 snapshots и совместимые intent ACK/error. `RoomPeopleSection` получает подтвержденное seat state и `onSetMediaSeat(userId: string, enabled: boolean): void`; room-client формирует session/revision/requestId по последнему snapshot, отправляет `SET_MEDIA_SEAT` и завершает ожидание по соответствующему `MEDIA_SEAT_RESULT`.

- [x] Добавить падающие тесты: выключение mic сохраняет место; grant хоста не вызывает capture; revoke прерывает pending capture и обе публикации; restored intent cleanup не снимает место; receive-only остается рабочим. Отдельно проверить старую v2 room path новым клиентом.
- [x] Добавить negotiation `3`, обработку новых событий и подтверждений без optimistic grant. Для seated участника первое собственное нажатие `V` / включение Open mic отправляет microphone intent и запускает capture только после ACK и локального разрешения. Отпускание `V` до завершения запроса отменяет публикацию. При отзыве очистить локальные intents и остановить полученные с опозданием tracks; при повторной выдаче не восстанавливать отозванный intent. Не реконструировать весь P2P controller при обычной смене seat state.
- [x] Заменить административные кнопки в v3 одной кнопкой. Логика действия исходит из подтвержденного состояния:

```tsx
<button
  type="button"
  aria-pressed={hasSeat}
  aria-label={`${hasSeat ? "Revoke" : "Grant"} media seat: ${displayName}`}
  disabled={pending || (!hasSeat && seatsFull)}
  onClick={() => onSetMediaSeat(userId, !hasSeat)}
>
  <Radio aria-hidden="true" />
</button>
// Доступная причина при полном лимите размещается и вне disabled button.
// Для не-хоста рендерить пассивный индикатор, без обработчика клика.
```

- [x] Обновить счетчики и стили по спецификации. Собственную кнопку камеры блокировать только при отсутствии места или заполнении слотов, когда она выключена. Не менять настройки PTT/Open mic и локальную громкость собеседника.
- [x] Проверить DOM/voice тестами grant/revoke, первое нажатие `V` без `Enable microphone`, быстрое нажатие/отпускание до ACK, отсутствие старых действий в v3, полные лимиты, pending/error, клавиатуру и длинные имена. Визуально проверить хоста/гостя, 4/6/15 участников и реальный размер шторки; не менять фиксированную ширину/геометрию самой панели.
- [x] Запустить Extension check/test, staging build и validator; commit `feat(extension): simplify participant media seat controls`.

## Task 5: Проверка, staging и выпуск

**Files:** существующие `scripts/room-signaling-harness.mjs`, `tests/e2e/p2p-media-harness.mjs`; обновляемые разделы `docs/current-development-state.md`, `docs/project-architecture-and-development.md` и активного room/P2P плана.

- [x] Расширить существующий harness сценариями: 15 участников/8 мест/4 камеры; два конкурирующих запроса последнего ресурса; host revoke -> audio/video stop -> grant -> только собственное включение; no-seat receive; повторное подключение и DO restore. Зафиксировать результаты по действующему [quality gate](../../development-quality-gates.md).
- [x] Выполнить `pnpm dev:check`, общий check/test для затронутых потребителей, room harness и `npm --prefix tests/e2e run harness:p2p`. Повторять успешно пройденные проверки только после релевантных изменений.
- [ ] Обновить контрактные разделы документации и Graphify по реальному изменению. Старая спецификация независимых grants остается историей v2; новый документ описывает v3. PR содержит scope, тесты, миграцию, совместимость, staging evidence и rollback.
- [ ] На staging сначала развернуть additive SQL и совместимые readers Worker/Web, затем новый клиент. Во время промежуточного состояния создание v3 не включать. SQL/Worker/Web должны продолжать обслуживать действующие v2-комнаты.
- [ ] В `Chrome AniDachi Test` проверить шторку и реальную комнату со вторым устройством/аккаунтом. Проверить PTT, Open mic, камеру, отзыв/возврат места, продолжение приема после отзыва, reload и смену ролика. Массовые лимиты проверяются harness, реальный WebRTC — двумя устройствами; не выдавать одно за другое.
- [ ] Провести матрицу совместимости старого ZIP/нового ZIP с v2/v3. Старый клиент получает понятное предложение обновиться при попытке войти в новую комнату, не занимает слот и не ломает личную историю.
- [ ] После приемки staging подготовить promotion PR. Выпуск main — после явного согласования в рабочей сессии; затем проверить production policy renewal и собрать/проверить новый приватный ZIP с SHA и инструкцией тестеру.

### Критерии готовности

| Сценарий | Обязательный результат |
| --- | --- |
| Первые 8 из 15 в Pro | 8 мест; следующие 7 смотрят и слышат, не публикуют. |
| Все 8 используют микрофон, 4 включили камеры | У остальных четырех работает микрофон; пятая камера не включается. |
| Host отозвал место | Аудио/видео прекращаются, место/камера свободны, входящие медиа сохраняются. |
| Host вернул место | Право вернулось, устройства самостоятельно не включились. |
| Mic mute / camera off | Место остается; camera off освобождает только видеослот. |
| Участник вышел / новый вошел | Ресурсы освобождаются; существующие слушатели не продвигаются автоматически; новый получает свободное место. |
| Reload / reconnect / rejoin после host revoke | Запрет не обходится, старые сообщения не запускают capture. |
| Разрешение камеры отклонено | Камера освобождается, микрофон/место сохраняются. |
| Hibernation / renewal | Состояние и версия комнаты сохраняются, лимиты не растут, ложного закрытия нет. |
| История / инвайты / provider navigation | Поведение остается прежним, включая последние production fixes. |

### Откат

При проблеме остановить создание новых v3-комнат, сохранив совместимые readers и обслуживание уже созданных v3. Не менять контракт активной комнаты на v2 и не удалять additive SQL. Для v3-клиента показать понятную временную недоступность создания новой комнаты вместо скрытого обхода правил. Откат только на старый ZIP/Worker, не понимающий v3, не является безопасным откатом: сначала завершение затронутых комнат по существующим правилам либо исправление совместимой версии.
