# Anidachi: понятное руководство для команды

Этот документ написан для Владислава, кофаундера, разработчиков и ИИ-агентов,
которые будут работать над Anidachi.

Цель документа: простым человеческим языком объяснить, как у нас сейчас устроен
проект, где что лежит, как должна вестись разработка, что можно менять, что нельзя
ломать и какие документы надо читать перед работой.

## Важное про актуальность

Это живой документ. Он актуален на момент:

```txt
2026-06-04, после переноса проекта в основной monorepo и production release.
```

Некоторые вещи будут меняться по ходу разработки:

- staging URL;
- production/staging настройки Vercel;
- Cloudflare Worker URL;
- Supabase структура;
- Stripe настройки;
- P2P видео/аудио;
- способ сборки расширения;
- QA-чеклисты.

Если документ конфликтует с текущим кодом, текущий код важнее. Если документ
конфликтует с Vercel, Cloudflare, Supabase или GitHub dashboard, фактические настройки
в dashboard важнее. Но после изменения таких вещей нужно обновить этот документ или
связанные документы.

## Что такое Anidachi

Anidachi — это не стриминговый сервис.

Мы не хостим фильмы, не раздаем видео, не обходим DRM и не делаем screen sharing.
Каждый пользователь смотрит видео у себя на исходном сайте: Crunchyroll, YouTube или
другом поддерживаемом видеоплеере.

Anidachi добавляет поверх просмотра социальный слой:

- комнаты для совместного просмотра;
- синхронизацию play/pause/seek;
- реакции;
- чат поверх видео;
- маленькие видео-кружки друзей;
- push-to-talk аудио;
- в будущем сохранение прогресса просмотра с друзьями.

Главный принцип продукта:

```txt
Видео главное. Интерфейс Anidachi должен быть легким социальным слоем поверх него.
```

Нельзя превращать Anidachi в Zoom, Discord, Teleparty clone, большой чат сбоку или
сервис для раздачи видео.

## Главный репозиторий

Теперь основной репозиторий:

```txt
AniDachi/anidachi-LP
```

Локально он лежит здесь:

```txt
/Users/vladyslavhulyi/anidachi-LP-monorepo
```

Старый локальный репозиторий:

```txt
/Users/vladyslavhulyi/anidachi
```

теперь только историческая справка. Новую разработку надо вести в
`AniDachi/anidachi-LP`.

## Как устроен проект

Проект теперь собран в один monorepo.

```txt
apps/
  web/          сайт anidachi.app, авторизация, комнаты, Stripe, SEO, Supabase
  extension/    Chrome extension, overlay поверх видео, P2P, реакции, чат
  api/          Cloudflare Worker + Durable Objects, live-комнаты и WebSocket
  demo/         локальная тестовая HTML5 video страница

packages/
  protocol/     общие типы, Zod-схемы, события комнат, sync math

docs/           документация, планы, архитектура, release notes
infra/          локальная/dev инфраструктура
scripts/        скрипты сборки и release-процессов
```

Сайт, расширение, API и protocol теперь живут рядом. Это значит, что изменения можно
делать согласованно и не держать разные части проекта в разных репозиториях.

## Три главные части системы

### 1. Website / control plane

Папка:

```txt
apps/web
```

Это сайт `anidachi.app`.

Он отвечает за:

- логин пользователей;
- профили;
- durable room records;
- invite links;
- memberships;
- планы/подписки;
- Stripe;
- Supabase;
- API для создания комнат;
- auth handoff для расширения;
- SEO/landing/content pages;
- в будущем сохранение прогресса просмотра.

Важно: сайт не должен заниматься live-синхронизацией просмотра каждую секунду.
Он хранит долговечные данные и выдает токены/доступы.

### 2. Cloudflare Worker / live plane

Папка:

```txt
apps/api
```

Это realtime backend.

Он отвечает за:

- WebSocket;
- live room state;
- кто сейчас в комнате;
- host playback state;
- реакции;
- live chat;
- P2P signaling;
- camera/voice status;
- ICE servers для WebRTC.

Live state живет в Durable Object. Его не надо писать в Postgres каждую секунду.

Worker не должен доверять данным пользователя “на слово”. Пользователь должен
подключаться с room token, который выдает сайт.

### 3. Chrome Extension / runtime plane

Папка:

```txt
apps/extension
```

Это то, что работает в браузере поверх YouTube/Crunchyroll/видеоплеера.

Расширение отвечает за:

- поиск video element;
- адаптеры YouTube/Crunchyroll/generic video;
- overlay UI;
- fullscreen behavior;
- реакции;
- чат;
- кнопки и hotkeys;
- P2P камера/аудио;
- управление локальным video player;
- применение sync-состояния от host.

В расширении нельзя хранить secret keys:

- Supabase service role;
- JWT signing secret;
- Cloudflare TURN secrets;
- Stripe secrets;
- OAuth client secrets.

## Как сейчас работает комната

Упрощенно:

1. Пользователь логинится на сайте.
2. Расширение получает доступ к аккаунту через website auth flow.
3. Пользователь открывает видео.
4. Расширение определяет источник видео.
5. Пользователь нажимает `Create room`.
6. Сайт создает durable room record и выдает room token.
7. Расширение подключается к Cloudflare Worker по WebSocket.
8. Worker держит live-комнату в Durable Object.
9. Host отправляет play/pause/seek и состояние просмотра.
10. Остальные участники получают sync events.
11. Реакции и чат идут через Worker.
12. Видео/аудио участников идет через P2P WebRTC, а Worker используется для signaling.
13. Если прямое P2P-соединение не проходит, WebRTC может использовать TURN fallback.

Важно: само видео фильма/серии не передается через Anidachi. Передаются только события,
сообщения, presence и P2P камера/аудио пользователей.

## Production и staging

Есть два основных окружения.

### Production

Это публичный продукт.

```txt
Website: https://www.anidachi.app
API:     https://anidachi-api-production.vladislav-gul7.workers.dev
WS:      wss://anidachi-api-production.vladislav-gul7.workers.dev
```

Production должен быть стабильным. Нельзя тестировать сырые изменения прямо в
production.

### Staging

Это внутреннее тестовое окружение для нас.

Актуальный staging URL надо смотреть в:

```txt
docs/development-environments.md
```

Staging закрыт паролем. Пароль не хранится в git.

Staging нужен, чтобы:

- проверить сайт;
- проверить логин;
- проверить расширение;
- проверить комнаты;
- проверить P2P;
- проверить баги до production.

## Как должна вестись разработка

Нормальный flow:

```txt
feature branch -> PR в staging -> тестирование -> PR из staging в main -> production
```

Правила:

- `main` = production.
- `staging` = общая тестовая ветка.
- новые фичи делаем в отдельных ветках;
- обычно ветку создаем от `staging`;
- сначала открываем PR в `staging`;
- после тестов делаем release PR из `staging` в `main`;
- `main` нельзя ломать;
- generated folders и zip-файлы не коммитим.

Docs-only изменения можно иногда делать PR напрямую в `main`, если команда согласна и
это не влияет на runtime.

## Как работать с расширением

У расширения один код, но разные сборки.

Staging extension должен смотреть на staging website/API/WS.

Production extension должен смотреть на production website/API/WS.

Нельзя случайно отправить другу production zip, который смотрит на staging, или staging
zip, который смотрит на production.

Перед тем как делиться расширением, надо проверить debug panel в расширении:

- build id;
- adapter;
- media mode;
- web base;
- API base;
- WS base.

## Что проверять перед важным merge

Минимальный ручной checklist:

```txt
1. Открыть сайт.
2. Залогиниться.
3. Разлогиниться.
4. Залогиниться через расширение.
5. Открыть YouTube или Crunchyroll.
6. Создать комнату.
7. Скопировать invite.
8. Открыть invite со второго профиля/устройства.
9. Проверить, что участники видны.
10. Проверить реакции.
11. Проверить чат.
12. Проверить play/pause/seek sync.
13. Проверить P2P камеру в обе стороны.
14. Проверить push-to-talk audio.
15. Проверить fullscreen overlay.
16. Проверить, что debug panel показывает нужное окружение.
```

P2P пока считается отдельной зоной риска. Если один тест прошел, это еще не значит,
что P2P полностью production-ready.

## Что у нас уже зафиксировано по release

Миграция в monorepo зафиксирована здесь:

```txt
docs/releases/2026-06-04-monorepo-migration.md
```

Там записано:

- какой PR был смержен;
- какой merge commit;
- какой release tag;
- какие production URL;
- что было проверено;
- какие follow-up задачи остались.

## Какие документы читать человеку

Если человек подключается к проекту, читать в таком порядке:

1. `README.md` — короткий обзор проекта и команды.
2. `docs/team-guide-ru.md` — этот документ на русском.
3. `docs/development-environments.md` — как устроены staging/production.
4. `docs/developer-handoff.md` — английский handoff для разработчика/ИИ.
5. `docs/architecture.md` — архитектура MVP и стек.
6. `docs/experimental-features.md` — P2P и экспериментальные функции.
7. `docs/releases/2026-06-04-monorepo-migration.md` — что было сделано в release.

## Какие документы читать ИИ

Если задачу будет делать другая ИИ, ей надо сначала дать понять, что проект уже
организован и есть правила.

Лучший стартовый набор:

```txt
README.md
docs/developer-handoff.md
docs/development-environments.md
docs/architecture.md
docs/experimental-features.md
docs/site-extension-integration-notes.md
docs/shared-watch-progress-tracker.md
docs/releases/2026-06-04-monorepo-migration.md
```

Если задача про P2P:

```txt
docs/experimental-features.md
docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md
apps/extension/src
apps/api
packages/protocol
```

Если задача про комнаты/auth/site:

```txt
docs/site-extension-integration-notes.md
docs/development-environments.md
apps/web
apps/api
packages/protocol
apps/web/supabase/migrations
```

Если задача про Crunchyroll:

```txt
docs/crunchyroll-adapter-notes.md
apps/extension/src
```

Если задача про прогресс просмотра:

```txt
docs/shared-watch-progress-tracker.md
docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md
```

## Как формулировать задачу для ИИ

Хороший формат:

```txt
Прочитай README.md, docs/team-guide-ru.md, docs/developer-handoff.md и
docs/development-environments.md.

Работай в репозитории AniDachi/anidachi-LP.
Не трогай production напрямую.
Сначала изучи текущий код и существующие паттерны.
Сделай изменения в отдельной ветке.
Не коммить секреты и build artifacts.
После изменений запусти релевантные проверки.
Обнови документацию, если меняешь архитектуру, окружения или workflow.

Задача: ...
```

## Что нельзя делать

Нельзя:

- пушить сырые изменения прямо в `main`;
- коммитить `.env`, zip, unpacked extension folders, `.output`, `.next`;
- хранить secrets в расширении;
- смешивать staging и production endpoints;
- менять auth/room/P2P без понимания всей цепочки;
- чинить P2P “на глаз” без логов и проверок;
- делать большие refactor вместе с маленькой продуктовой задачей;
- превращать продукт в screen sharing или streaming backend.

## Что можно делать спокойно

Можно:

- делать feature branches;
- открывать PR в staging;
- обновлять docs вместе с кодом;
- добавлять тесты;
- улучшать UI/UX расширения;
- улучшать adapter logic;
- улучшать room lifecycle;
- улучшать P2P, если есть четкая диагностика;
- добавлять Supabase migrations через нормальный review.

## Главная мысль

Мы теперь не работаем как “локальный эксперимент в папке”.

Anidachi теперь устроен как нормальный продукт:

```txt
единый репозиторий -> staging -> проверка -> production
```

Если придерживаться этого процесса, можно спокойно работать вдвоем, подключать ИИ,
делать новые фичи и не ломать публичный продукт.

