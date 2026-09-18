# Staging Release Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work sequentially; do not start parallel implementation or promotion without a separate instruction.

**Goal:** Исправить подтвержденные ошибки новой версии staging, сохранить работающий продукт и подготовить проверяемый выпуск сайта и ZIP через обычный PR в main.

**Architecture:** Сохраняем новый дизайн и существующие владельцы состояния. Общий компонент меню снова отвечает за навигацию и безопасный выход; единый источник метаданных отвечает за установочный ZIP. Новая отправка ссылки использует существующие CRM/Gmail и атомарное хранилище, без новой очереди рассылок или отдельной платформы.

**Tech Stack:** Node 22.23.1, pnpm 11.2.2, Next.js 15.5.23, React, WXT 0.20.26, Vitest, node:test/tsx, существующие Vercel Blob, Gmail, GitHub Actions, Vercel и Cloudflare.

**Spec:** [Текущее состояние](../../current-development-state.md), [каналы расширения](../../extension-release-channels.md), [личная история и тарифы, уточнение D01](2026-09-08-personal-history-and-plans-mvp.md), [навигация кабинета](../specs/2026-09-10-account-mvp-navigation-design.md) и реестр подтвержденных отклонений ниже. Этот план восстанавливает согласованные контракты, а не вводит новую модель продукта.

**Дата:** 2026-09-15; обновлено 2026-09-18. **Статус:** этапы 1–3 и 4A приняты на staging через PR #349 (`bcd00c7d`), #350 (`5a7aa839`), #351 (`876b9e94`) и #352 (`f2567844`). По решению владельца дальнейшая доработка email отложена; выполняется этап 5A — тексты тарифов и сохраненной истории. Этапы 4B/4C не реализованы и не считаются принятыми. Main остается `4b4ff883`; реальные письма, изменение контактов и публикация ZIP при проверках не выполняются.

**Уточнение 2026-09-16:** по просьбе пользователя добавлены полный реестр измененных файлов и обязательная проверка их влияния. Повторная проверка известных замечаний завершена; полное построчное ревью всех 164 файлов и финальная регрессия еще не завершены и не считаются выполненными по наличию этого плана.

## Решение владельца 2026-09-16

Сохраняем всю папку `apps/extension`, `package.json` и release-валидатор точно как в main `4b4ff88380d0a64e5216d2770d360440d3f8852b`. Новый site-presence и постоянная ZIP-подсказка не принимаются. Сайт остается с новым дизайном, но без проверки установленного расширения. На странице комнаты прежний detector заменяется нейтральной справкой; join/auth/backend не меняются.

Это решение заменяет первоначальный этап 1 и предложения presence/retry в этапе 3. Предыдущий PR [#348](https://github.com/AniDachi/anidachi-LP/pull/348), `f2112110`, был подготовлен и проверен, но не слит; его код не переносится в новый вариант. Его замена — PR [#349](https://github.com/AniDachi/anidachi-LP/pull/349); #348 закрыт без merge, ветка/история сохранены. Остальные блоки сайта сначала разбираются с владельцем и не реализуются автоматически.

**Уточнение этапа 2:** владелец согласовал возврат нашей шторки аккаунта из main с ее существующим оформлением и поведением, без нового редизайна. Удаляем заменяющую реализацию, восстанавливаем общую шторку в публичной шапке и кабинете, доступ на телефонах/планшетах и cleanup блокировки прокрутки. Сохраняем новые пункты и установочную кнопку остальной шапки. Локальные проверки, отдельный PR и приемка staging разрешены; перенос в main остается отдельным решением. Это уточнение отменяет прежнюю задачу адаптации шторки к новым цветовым токенам.

## Global Constraints

- Работа по одному завершенному блоку: `codex/* -> PR -> staging -> приемка`. Начинать с этапа 1. Перед следующим блоком зафиксировать результат и оставшиеся ошибки.
- До выпуска покрыть весь список измененных/удаленных файлов по реестру ниже, включая связи с неизмененными потребителями. Перед первой правкой подтвердить границы риска; каждый следующий блок закрывает свой файловый срез. Любая новая ошибка добавляется в реестр и получает отдельный fix/gate.
- Не переносить весь staging в main после каждого небольшого исправления: вместе с ним попадут еще не принятые части редизайна. Финальный promotion — отдельный шаг после приемки.
- Не push напрямую в main, не force-push, не сбрасывать и не откатывать чужие изменения. При обновлении веток сохранять обе стороны обычным merge с проверкой результата.
- Не менять комнаты, протокол, медиаместа, defaults, голос, историю, Stripe-объекты, Supabase-данные и rollout-флаги для решения ошибок сайта. Новая необходимость в этих областях требует отдельного описания причины и проверок.
- Production extension ID: `gpkolofebdhfpapbbgdkdkmlmjfidgmn`; staging: `ndkfphbchhfephdodcpehdcoclojagje`; local: `nkinhhgigcflmfhilmcakbkongcpkfnl`. Стабильные публичные ключи сохраняются.
- Release builds: узкие разрешения; новый `site-presence` исключен, runtime расширения совпадает с main. Логотип в `web_accessible_resources` доступен только видеоплатформам. Не добавлять `unsafe-eval` и не возвращать динамическую компиляцию Zod.
- Free: 30 минут своего хостинга в день; комната до 4 человек. Plus: 6 человек / 4 камеры / 6 микрофонов. Pro: 15 / 4 / 8. Доступ к поддерживаемым платформам общий; лимиты комнаты определяются хостом.
- Free сохраняет чтение, Resume и удаление уже записанной личной истории; запись и редактирование прогресса требуют Plus/Pro. История YouTube — 100 видео, Crunchyroll — 200 тайтлов; при заполнении блокируются новые записи, существующие обновляются при наличии платного доступа.
- Staging остается под парольной защитой и `noindex`; staging-ссылки и тестовые идентификаторы не попадают в production ZIP/SEO.
- Не коммитить секреты, env-файлы, ZIP, распакованные сборки, профили браузеров и временные отчеты. План не требует новых платных сервисов или обновления зависимостей.
- Реальные письма и действия с подпиской не входят в автоматические проверки: использовать заглушки, затем согласованный тестовый сценарий на staging.

## 1. Зафиксированный исходный срез

| Объект | Проверенное состояние |
| --- | --- |
| `origin/main` | `4b4ff88380d0a64e5216d2770d360440d3f8852b` |
| `origin/staging` / база плана | `391fb5c97a09298080c32f354eaab63d9115f22a` |
| Расхождение | 1 коммит только в main — merge PR #346; 2 только в staging. Само состояние BEHIND не доказывает потерю фиксов. |
| Promotion | [PR #347](https://github.com/AniDachi/anidachi-LP/pull/347), MERGEABLE / BEHIND, automerge выключен |
| Основной CI | [34991926842](https://github.com/AniDachi/anidachi-LP/actions/runs/34991926842), failure |
| Сборка расширения | [34991926748](https://github.com/AniDachi/anidachi-LP/actions/runs/34991926748), failure |
| Staging smoke | [34992262045](https://github.com/AniDachi/anidachi-LP/actions/runs/34992262045), success |
| Vercel staging | `dpl_BM4uL59tAcadfSqTaaZDaJybgTJc`, READY, alias `staging.anidachi.app`, тот же SHA |

В текущем CI: web 588 passed / 6 skipped, API unit 235 passed, extension 2032 passed / 7 failed; typecheck прошел. API Workers runtime, web lint и Worker bundle после падения тестов пропущены. Успешный Vercel build не заменяет эти проверки. Это прочитанные результаты указанного запуска, а не новый полный запуск тестов при написании плана.

`git diff origin/main origin/staging` не показывает изменений в `apps/api`, `packages/protocol`, `apps/web/lib/anidachi-auth`, `apps/web/supabase`, `.github/workflows` и `pnpm-lock.yaml`. Runtime расширения меняется только в site-presence и подсказке обновления popup. Проверенные фиксы медиамест, восстановления defaults, видимости интерфейса и server-anchored Free countdown сохранены в исходниках.

**Последний ранее выданный production ZIP:** исходный commit `4b4ff883`, 703955 bytes, SHA-256 `6eb83f3ab72187935ab54889a9562729d7b7af82e655cffa6bc2c9ced141f5fc`. Это контрольный старый артефакт для совместимости и отката, а не автоматически выбранный файл новой публикации.

### Реестр отклонений

Приоритет P1 блокирует выпуск; P2 требует исправления/явного исключения перед выпуском затронутой функции. Конфигурационная незавершенность не обозначается как доказанный баг серверной инфраструктуры.

| ID | Приоритет и доказательство | Что требуется | Этап |
| --- | --- | --- | --- |
| F01 | P1, CI и исходник: новый `site-presence.content.ts` добавляет сайт, валидатор/тесты ожидают только видео | Исключить новый site-presence и вернуть прежние release checks из main | 1 |
| F02 | P1, исходник: валидатор сначала требует staging `manifest.key`, затем отвергает любой ключ | Вернуть validator из main: стабильные ID проверяются без добавленного противоречия | 1 |
| F03 | P1, команды: удален `build:extension:staging:local-broad`; новая broad-команда передает env, который скрипт сбрасывает | Восстановить команду и настоящий `--broad`, отдельную папку local-broad | 1 |
| F04 | P2, исходник и импорты: desktop/mobile logout обходят `anidachi:before-sign-out`, не проверяют `response.ok` | Защита Save / Discard / Stay до запроса logout; ошибка выхода не уводит со страницы | 2 |
| F05 | P2, повторно подтверждено живым `/extension`: меню содержит только Friends и Sign out | Вернуть быстрый вход в кабинет, историю, подписку, профиль и помощь | 2 |
| F06 | P2, live DOM и CSS: при 700 px нет доступа к аккаунту; исходник оставляет scroll lock после скрытия mobile drawer | Непрерывная навигация на границах 640/768 px; закрытие и снятие блокировки при смене режима | 2 |
| F07 | P1 для публичной установки, live: ZIP-кнопка disabled. Код расходится: `available` по env, download дополнительно ищет файлы | Согласовать метаданные, реальный источник ZIP и публичную выдачу, проверить байты | 3, 6 |
| F08 | P2, исходник: installed-ветка скрывает download, хотя popup ведет туда обновляться; старый ZIP не имеет presence | Убрать installed-ветку и всю проверку установки; download определяется только доступностью ZIP | 1, 3 |
| F09 | P2, исходник: CRM read-modify-write сохраняет старый снимок контактов | Использовать существующий `mutateContacts`, проверить конфликт с параллельной правкой | 4A |
| F10 | P2, исходник: публичная отправка Gmail без cooldown/dedupe/ограничения по источнику и получателю | Прикладная защита с атомарным состоянием, без зависимости от непроверенного firewall | 4B |
| F11 | P2, исходник: полный отказ CRM + Gmail выглядит `Saved`; чтение Gmail tokens вне обработчика ошибки | Правдивый результат доставки; контролируемые JSON-ошибки; не обещать несуществующую очередь | 4C |
| F12 | P2, pricing и контракт D01: Free описан как `No personal history or Resume` | Отделить сохраненную историю от права новой записи/редактирования | 5 |
| F13 | Согласованность: на части compare-страниц прежние обещания async; CWS-статус принят владельцем как текст для запланированной подачи при main-релизе | Недоступные функции явно будущие; CWS-тексты сохранить по решению 2026-09-18, фактическую подачу не считать выполненной | 5 |
| F14 | Процесс: удален `graph:update:code`, изменены обходящие wrapper aliases; AGENTS и quality gates требуют прежний flow | Вернуть команду через существующий `scripts/graphify-code-update.mjs` и связанные aliases | 1 |

### Что проверено и что еще не доказано

- [x] Повторно сверены refs, измененные плоскости, CI и исходники перечисленных причин. Повторно открыты staging `/extension` и `/account/billing`: ZIP недоступен, меню урезано, подписка Plus Active загружается.
- [x] В предыдущей проверке того же SHA загружались YouTube/Crunchyroll, счетчики вместимости, сезоны, Resume. Выбор сезона и Cancel возвращали исходный прогресс без сохранения в БД.
- [x] Наш рабочий `components/account-menu.tsx` сохранился. Владелец согласовал возврат его существующего оформления и поведения, без переписывания auth/history.
- [x] `SuccessInstallNext` сейчас нигде не импортирован: его спорная фраза не считается действующей ошибкой checkout. Автоматически подключать компонент в рамках исправлений нельзя.
- [ ] Реальный logout с несохраненным черновиком: пока подтвержден кодом, сессию пользователя при аудите не отзывали. Сначала компонентные тесты, затем контролируемая staging-приемка.
- [x] До исправления воспроизведен scroll lock на staging `bcd00c7d`: открыть меню при 390 px, перейти на 700 px, PageUp не сдвигает страницу; после Escape PageUp работает. После этапа 2 нужна повторная проверка cleanup на его фактическом breakpoint.
- [ ] Нельзя подтвердить установку/обновление новой сборки, доставку письма и bytes публичного ZIP до исправления сборки/настройки выдачи. Эти приемочные шаги не заменены зелеными unit-тестами.
- [ ] Stripe checkout/cancel/restore, реальные комнаты и WebRTC в этом повторном аудите заново не выполнялись. Неизмененный код и прошлые тесты — основания для узкой приемки, не обещание отсутствия всех багов.
- [ ] Terms/Privacy проверены на согласованность с продуктом. Юридическое заключение, статус Chrome Web Store и любые новые внешние требования этим планом не подтверждаются.

## 2. Карта изменений и порядок работы

| Блок | Граница изменения | Что не включать |
| --- | --- | --- |
| 1. Сборка | release-валидатор, тесты manifest, команды package.json, документация каналов | auth, UI кабинета, ключи/секреты, runtime комнат |
| 2. Кабинет | общий account-menu, nav-bar-client, их реальные потребители и стили | алгоритмы истории, биллинг API, редизайн остальных страниц |
| 3. Установка | metadata/source ZIP, download/latest, install hub, presence UX | автообновление/автоустановка, Chrome Store submission |
| 4A–4C. Email | атомарность CRM; ограничение отправки; результат API/UI | массовая рассылка, новые CRM-сегменты сверх install, очередь писем |
| 5. Тексты | pricing, install/FAQ/compare, согласованные документы | изменение цен, лимитов, договорных обязательств без решения владельца |
| 6. Приемка staging | точный кандидат сайта + артефакт, проверка сценариев и конфигурации | production-публикация и изменения реальных подписок |
| 7. Production | проверенный promotion, артефакт из принятого main, выдача и smoke | автоматический захват новых непроверенных коммитов |

Блоки 4A, 4B, 4C — отдельные небольшие коммиты/PR, принимаемые последовательно. Остальные блоки также не объединять в один общий fix-PR. На старте каждого блока читать актуальный diff: если другой разработчик уже исправил пункт, проверить результат и снять задачу, не переписывать второй раз.

## Обязательное покрытие всего diff и регрессий

[Реестр всех 164 файлов](2026-09-16-staging-release-file-review.md) получен из точных Git-объектов main/staging, включая добавления и удаления. Его наличие не означает, что 164 файла уже приняты. Закрывать строки по факту проверки, а не одной общей отметкой о зеленом CI.

- [ ] Прочитать каждый diff целиком; отдельно определить перенос/форматирование, стиль, новое/измененное поведение и удаление. При большом форматирующем diff сравнить структуру/AST, но не считать CSS косметикой без влияния на focus/visibility/scroll.
- [ ] Для измененного общего компонента найти всех потребителей через imports/re-exports и runtime-события. Пример уже найденной связи: `nav-bar-client -> UserMenu -> before-sign-out -> profile/history editors`. Неизмененность файла редактора не доказывает сохранность этого сценария.
- [ ] Проверить удаленные waitlist/survey endpoints и компоненты: отсутствие действующих клиентов, понятные переходы со старых `/join` URL, сохранность контактов и договоренных прав ранних пользователей. Не восстанавливать и не удалять продуктовую возможность автоматически: несогласованное изменение поведения вынести отдельным решением владельцу.
- [ ] Проверить новые/измененные analytics, public signup count, формы, глобальные tokens/Button/layout, root providers, sitemap/schema и CTA. Это дополнительные зоны ревью; их не объявлять багами без воспроизведения или достаточного доказательства исходником.
- [ ] Проверить, что тесты следуют за реальными точками входа. Удаленный тест должен иметь объяснение: функция намеренно выведена из продукта либо покрытие перенесено, а не просто исчезло вместе с падающим сценарием.
- [ ] Перед promotion сверить полный diff с реестром программно: нет нового файла без строки; каждое изменение с риском поведения имеет источник, сценарий, результат и SHA. Все строки закрыты или имеют конкретное согласованное исключение. У общего компонента перечислены проверенные неизмененные потребители.

| Сценарий | Какое рабочее поведение сохраняем | Что проверяем на кандидате |
| --- | --- | --- |
| Вход и выход | Сессия владельца, вход через сайт/расширение, перехват несохраненного черновика | Реальный menu/logout, network error, refresh, смена аккаунта, возврат к нужной странице |
| История | YouTube/Crunchyroll, Resume, сезон/серии, Save/Cancel, Free read-only, лимит без удаления старого | Сохранение/повторное чтение и одинаковое состояние сайта и шторки; ошибки не теряют черновик |
| Подписки | Тариф, checkout sync, cancel-at-period-end, доступ до конца периода | Все новые CTA ведут в правильный поток; pending/error не выглядят оплатой; sandbox при behavioral change |
| Друзья и группы | Friend link, группы как списки приглашений, повторное приглашение после выхода | Обычные ссылки/уведомления/Join, late join; drawer не сбрасывает редактирование |
| Комнаты и медиа | Медиаместа по очереди, четыре камеры, mic/defaults при возврате места | Двое участников, выдача/отзыв, повторный вход, defaults; неизменные API/WS contracts |
| Лимит Free | Серверная граница суток и правдивый countdown | Окончание лимита/обновление состояния, смена клиентского времени не дает права создать комнату |
| Установка и обновление | Правильный ZIP/ID/channel, сохранение данных установленного расширения | Скачать, проверить bytes, установить/обновить, войти, refresh видео, old ZIP без presence |
| Общий дизайн | Доступность кабинета, кнопки, focus, scroll, responsive | Новые и неизмененные страницы при mobile/tablet/desktop; CSS не прячет действия/ошибки |
| Публичный сайт | Рабочие маршруты, формы, согласованные тексты, SEO | CTA каждого шаблона, старые URL, robots/canonical/sitemap, аналитика не блокирует действие |

Ревью файлов и проверки сценариев дополняют друг друга. Полные тяжелые проверки выполняются на согласованном кандидате; после маленькой правки повторяются ее затронутые сценарии. Главная приемка относится к итоговому merge tree с актуальным main, затем проверяется развернутый production и реально скачиваемый ZIP. Буквальная гарантия отсутствия всех ошибок невозможна; известные дефекты и незакрытые обязательные проверки не допускают выпуск.

## Этап 1. Сохранить production-расширение и убрать зависимость сайта от presence

**База:** staging `391fb5c9`. **Эталон:** main `4b4ff883`. **Ветка:** `codex/preserve-production-extension`. Документы плана перенесены отдельно; fix `f2112110` из PR #348 не применяется.

**Restore exactly from main:** вся `apps/extension`, `package.json`, `scripts/validate-extension-artifact.mjs`. Это отменяет шесть файлов extension diff и изменения build/Graphify aliases; существующие manifest keys, IDs, permissions, зависимости, rooms/history/media остаются прежними. Удаляется только tracked `.keys/README.md`, никакие private keys не читаются и не меняются.

**Web — Modify:** `apps/web/components/extension-install-hub.tsx`, `apps/web/app/room/[roomId]/extension-check.tsx`, `apps/web/lib/conversion-events.ts`, `apps/web/docs/CONVERSION_METRICS.md`. **Delete:** `apps/web/lib/extension-presence.ts`, `apps/web/app/success/success-install-next.tsx` (не был подключен к странице оплаты). **Create:** `apps/web/lib/extension-install-compatibility.test.ts`.

- [x] Проверить полный исходный extension diff, callers presence и current main/staging; сохранить предыдущий PR и историю.
- [x] Добавить регрессии до правки: нет запросов к расширению; даже presence reply не скрывает ZIP/инструкцию и не заменяет missing-artifact state; безопасный room next; немедленная нейтральная room help; mobile copy. На прежнем коде 5 failed / 1 passed по ожидаемым причинам.
- [x] Вернуть согласованные extension/tooling paths из main. `git diff --exit-code origin/main -- apps/extension package.json scripts/validate-extension-artifact.mjs` должен быть пустым.
- [x] Удалить detector, installed branch и analytics event; сохранить mobile/install guide, source availability и возврат `/room/...`.
- [x] Заменить прежнюю room-проверку нейтральной подсказкой с установочной ссылкой и mobile share/copy. `page.tsx`, form action, join API, auth и существующие backend-проверки не меняются. Отсутствие ответа расширения не используется как состояние пользователя.
- [x] Новые регрессии: 6/6 passed. Typecheck: 6/6 задач passed.
- [x] `pnpm check`: 6 задач passed. `pnpm test`: web 594 passed / 6 pre-existing skips, extension 2039 passed; API 235 и protocol 201 passed из неизмененного Turbo cache. Extension и web выполнены заново; extension release tests построили staging/production artifacts, оба validator passed. Web lint passed с прежними предупреждениями; новый unused import удален. Workers runtime 75/75 passed, Worker staging dry-run passed; деплоя не было.
- [x] Playwright на `127.0.0.1:4192`: desktop 1440×1000 и mobile 390×844; реальный `/extension?next=/room/test-room` сохраняет guide/download после presence reply, ссылка возврата указывает на комнату. Unavailable и room help проверены в изолированном harness из реальных компонентов/CSS; copy дает правильную ссылку, нет ping/overflow/framework overlay. Native share, реальный ZIP download, email и join/admission не выполнялись. В анонимной странице ожидаемые 401 `/api/me` и `/api/auth/refresh`; runtime JS errors не обнаружены. Browser plugin absent, использован существующий Playwright. Снимки/скрипт/results сохранены вне репозитория в `/private/tmp/anidachi-preserve-*`.
- [x] Обновить docs/реестр, независимое ревью, `pnpm dev:check`. Reviewer подтвердил точное совпадение 317 extension files + tooling с main, отсутствие runtime consumers detector и изменений join/auth/API; actionable findings нет. Все 6 regression tests повторно passed после cleanup.
- [x] Код сохранен в `b71b1b91`, PR [#349](https://github.com/AniDachi/anidachi-LP/pull/349) открыт только в staging; #348 закрыт без merge, ветка сохранена. Auto-merge выключен. Финальные CI receipts точного head записываются в PR; эта отметка не означает merge, принятый staging или production.
- [x] После отдельного согласования #349 слит в staging `bcd00c7d`. CI, Build Extension и post-deploy Staging Smoke passed; Vercel alias указывает на этот SHA. Расширение и tooling равны main. Живые install/FAQ/account страницы проверены; активной комнаты для room-help не было. ZIP остается недоступен по открытому F07. Main `4b4ff883`, promotion #347 без auto-merge. Подробная приемка записана в #349.

**Приемка:** исходники extension и tooling равны main; установленное production-расширение не получает новых функций. Новый сайт не обнаруживает установку и не скрывает загрузку по этому признаку. ZIP availability и фактическая публикация — отдельная задача F07 этапов 3/6; не выдавать артефакты с тестовым VAPID за пользовательский релиз. Согласованный staging merge и его ограничения записаны выше; main не менялся.

**Объем проверок:** `dev:check` предлагает room/P2P profile по пути room-help. Контракт комнаты, admission и media не меняются; реальный P2P/harness/двухпрофильный smoke для этого блока не повторяется. Это ограничение проверок записать в PR; живую staging-навигацию проверить после отдельного разрешения на merge.

**Rollback:** отдельный revert PR в staging. Он вернет исключенные presence/UI изменения и известные ошибки старого release gate; данные, ID и серверы не затрагиваются. Прямой reset/force-push исключен.

## Этап 2. Вернуть вход в кабинет и защиту редактирования

**Files — Modify:** `apps/web/components/nav-bar-client.tsx`, `apps/web/lib/account-menu-client.test.ts`; минимальная защита повторного выполнения callback в `apps/web/components/account-menu.tsx`, если ее необходимость подтверждена тестом. **Create:** `apps/web/lib/nav-bar-client.test.ts`. Существующий `account-menu.css` подключается без редизайна; глобальные токены не меняются. **Consumers to verify:** `apps/web/app/account/layout.tsx`, `apps/web/app/account/profile/profile-client.tsx`, `apps/web/app/account/watch-library/history-browser.tsx`, `apps/web/lib/use-body-scroll-lock.ts`.

**Interfaces:** сохранить экспорт `UserMenu({user: NavUser, compact?: boolean, onOpen?: () => void})` и `AccountEntryLink({onClick?: () => void})`. Публичный navbar и account layout используют одну реализацию, при необходимости через совместимый re-export. Контракт выхода остается отменяемым событием `CustomEvent<() => Promise<void>>("anidachi:before-sign-out")`; только разрешенный callback вызывает `/api/auth/logout`.

- [x] В тесте меню монтировать экспорт, реально используемый `nav-bar-client`/кабинетом; не ограничиваться старым изолированным компонентом. Использовать существующие `mount/open/act` helpers, добавить наблюдение за реальным кликом:

  ```ts
  let logoutRequests = 0;
  globalThis.fetch = async () => {
    logoutRequests += 1;
    return new Response(null, { status: 500 });
  };
  const stop = (event: Event) => event.preventDefault();
  window.addEventListener("anidachi:before-sign-out", stop);
  try {
    await mount(); await open();
    const button = [...container.querySelectorAll("button")]
      .find((node) => node.textContent?.trim() === "Sign out")!;
    await act(async () => button.click());
    assert.equal(logoutRequests, 0);
  } finally {
    window.removeEventListener("anidachi:before-sign-out", stop);
  }
  ```

- [x] Подключить сохраненный `account-menu.tsx` с прежним `account-menu.css`. Удалить дублирующие desktop/mobile обработчики logout. Сохранить кликабельный вход `/account` и shortcuts Watch Library, Friends & Groups, Subscription, Profile, Help; остальной новый дизайн шапки и установочная кнопка сохраняются.
- [x] Проверить Stay — ноль logout requests; Discard — один; Save — выход только после успешного сохранения; ошибка Save сохраняет сессию и черновик; HTTP 500/сеть при logout оставляют экран с повтором. Повторные быстрые клики не выполняют callback дважды. Компонентные проверки монтируют настоящие ProfileClient и HistoryBrowser; для профиля сохраняется его native confirm, для истории — Save / Discard / Stay.
- [ ] В navbar устранить промежуток 640–767 px: одинаковый breakpoint для mobile/desktop либо общий compact account control. При уходе с mobile закрыть drawer и снять lock через cleanup. Escape, переход по ссылке, потеря/возврат focus и длинное имя не ломают навигацию.
- [x] Проверить `nav-bar-client.test.ts` с mock `matchMedia`: открытие при 390 px, сохранение доступного drawer на 700/768 и закрытие на едином desktop breakpoint 1280 с освобождением wheel/touch/key listeners. Проверены Escape, route/link, отмененная навигация и unmount. На 700/768 drawer теперь остается видимым, поэтому lock снимается при закрытии или переходе в desktop, а не при этих промежуточных размерах.
- [ ] В браузере проверить 390, 639, 640, 700, 767, 768 и 1280 px; реальную прокрутку после resize. Одной проверки CSS display недостаточно.
- [x] Выполнить целевые тесты: 34/34 passed; web check passed; полный web test: 617 passed, 6 skipped, 0 failed. `next build` прошел с предупреждениями в неизмененных файлах и о вложенном worktree; catalog-cache pre-script не запускался. Runtime commit `185ac1ae` — `fix(web): restore account navigation and guarded sign out`.
- [ ] Независимое ревью, отдельный PR в staging и приемка меню с черновиком истории и профиля; точные CI/deployment receipts записать в PR.

Ревью нашло конфликт Space на кнопках шапки с document scroll lock. В `20dc0692`
добавлено узкое исключение propagation для native button activation при открытом
drawer: hook, wheel/touch и фоновые клавиши не меняются. Два теста сначала падали,
после исправления 36/36 целевых проверок прошли. Повторные web check, полный web
test (619 passed / 6 skipped) и Next build passed; повторное ревью без блокирующих
замечаний. Физическое нажатие Space в браузере остается частью staging-приемки.

Preview браузер выявил дополнительную границу: `20dc0692` не закрывал меню
повторным Space, поскольку Next делегирует React keydown на `document`, где
находится и scroll-lock listener. `4aa7d2dd` добавляет native
`stopImmediatePropagation` внутри того же узкого условия, сохраняя default
activation. Два новых document-root теста воспроизвели ошибку до исправления;
38/38 целевых проверок и web check прошли. Повторное ревью без новых замечаний.
Окончательный CI и реальная приемка записываются в PR #350; слияние до повторного
браузерного подтверждения не выполняется.

**Приемка:** наша прежняя шторка восстановлена, остальной новый дизайн шапки сохранен; кабинет доступен со всех размеров сайта, unsaved guard перехватывает настоящий logout до отзыва сессии. История и billing API не изменены.

## Этап 3. Один явно настроенный источник скачивания ZIP

**Уточнение владельца:** исправляем только выдачу ZIP. Никаких локальных источников, поиска по папкам, изменений инструкции установки/обновления или кода расширения. Публикация файла и перенос в main выполняются отдельно. Это заменяет прежний вариант этапа 3 с dev/preview path и переработкой инструкции.

**Files — Modify:** `apps/web/lib/extension-artifact.ts`, `apps/web/app/api/extension/latest/route.ts`, `apps/web/app/api/extension/download/route.ts`, `apps/web/.env.example`, `docs/environment-and-secrets-matrix.md`. **Create:** `apps/web/lib/extension-artifact.test.ts`, `apps/web/lib/extension-download-routes.test.ts`. Неизмененные потребители: `apps/web/app/extension/page.tsx`, `apps/web/components/extension-install-hub.tsx`, `apps/web/lib/install-cta.ts`; повторить существующие compatibility tests. По исходникам extension не обращается к download/latest API.

**Interfaces:** сохранить функции `getExtensionArtifact()` / `toPublicExtensionArtifact()` и публичные поля/маршруты. Внутренний `zipPath` удаляется вместе с его единственным потребителем. `available` означает корректную конфигурацию; успешность реальной доставки проверяется HTTP/байтами на этапе публикации. Presence отсутствует; сайт не определяет установку или версию расширения.

- [x] Удалить локальную выдачу и неявный поиск. Единственный источник во всех средах — public HTTPS `EXTENSION_ZIP_URL`. Legacy `EXTENSION_ZIP_PATH` игнорируется. Некорректные URL, version, SHA-256 или bytes оставляют `available:false` и download 503. SSR не скачивает и не хеширует архив.
- [x] Страница, `/latest` и `/download` используют общий resolver; URL без credentials, fragment, backslash и управляющих символов. В public JSON нет адреса источника; redirect ожидаемо раскрывает публичный URL. Отказ и метаданные не кешируются.
- [x] Добавить проверки реальных route exports: локальные архивы не перехватывают выдачу и не включают ее без URL; request query не заменяет настроенную ссылку; GET/HEAD используют одну конфигурацию; отсутствующая/ошибочная конфигурация не регистрирует успешное скачивание. Сеть и analytics подменены в тестах.
- [x] Повторить `lib/extension-install-compatibility.test.ts`: прежняя кнопка, disabled state, отсутствие presence и возврат к комнате сохранены. Базовые 6/6 passed; новые проверки до правки — 3 passed / 9 failed, после review fixes — 19/19 вместе с compatibility. Web typecheck passed. Независимое ревью выявило два узких случая: SemVer identifiers и пустой fragment `#`; оба исправлены и покрыты регрессиями.
- [x] Полный web suite: 634 passed / 6 fixture-dependent skipped / 0 failed. Next production build, web typecheck и `pnpm dev:check` (web/docs) passed.
- [x] Независимое ревью, отдельный [PR #351](https://github.com/AniDachi/anidachi-LP/pull/351) и приемка staging `876b9e94` завершены. CI, smoke и exact-deployment browser receipts записаны в PR. Публикация архива и изменение облачных env не выполнялись.

**Приемка:** все входы согласны о доступности одного заданного источника. Неподключенный ZIP остается недоступным, даже если в файловой системе лежат старые архивы. Дизайн, инструкция, FAQ, email и extension не меняются. Проверка реального hosted ZIP, его Content-Disposition, bytes, SHA и production identity остается на этапе 6; она не считается пройденной по unit-тестам.

**Graphify:** существующий граф запрошен для download/latest/resolver, связи подтверждены imports/source. Refresh отложен до общей приемки редизайна по просьбе владельца не выполнять тяжелое обновление после мелких правок. Этот этап удаляет local-file fallback без нового межплоскостного контракта; исключение и оставшаяся актуализация графа записываются в PR, старый граф не объявляется обновленным.

## Этап 4A. Убрать риск потери CRM-изменений

**Files — Modify:** `apps/web/lib/kreatli-crm/desktop-install-lead.ts`. **Create:** `apps/web/lib/kreatli-crm/desktop-install-lead.test.ts`. Использовать `apps/web/lib/kreatli-crm/store.ts` без нового snapshot writer.

**Interfaces:** сохранить `upsertDesktopInstallLead(email): Promise<{saved:boolean; reason?:string}>`. Существующий `mutateContacts<T>((contacts) => {changed:boolean; value:T})` повторяет чистую операцию над свежими данными при CAS-конфликте.

- [x] Перенести поиск/изменение контакта внутрь `mutateContacts`; ID и timestamp создать один раз до retry callback. В callback запрещены Gmail, логирование PII и другие внешние побочные эффекты.

  ```ts
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return { saved: false, reason: "invalid_email" };
  const id = randomUUID();
  const now = new Date().toISOString();
  const note = `Requested desktop install link.\nCaptured: ${now}`;
  try {
    const outcome = await mutateContacts((contacts) => {
      const current = contacts.find((contact) => normalizeEmail(contact.email) === normalized);
      if (current) {
        current.segments = [...new Set([...current.segments, DESKTOP_INSTALL_LINK_SEGMENT])];
        current.notes = current.notes.trim() ? `${current.notes.trim()}\n\n---\n${note}` : note;
        current.updated_at = now;
      } else {
        contacts.push({ id, email: normalized, company: "", first_name: "",
          segments: [DESKTOP_INSTALL_LINK_SEGMENT], notes: note, status: "active",
          next_action_date: null, created_at: now, updated_at: now });
      }
      return { changed: true, value: { saved: true } };
    });
    return outcome.value;
  } catch {
    return { saved: false, reason: "storage_failed" };
  }
  ```

- [x] Тестировать два одновременных разных адреса, повтор одного адреса с разным регистром, конкурентное изменение notes/status существующей CRM-записи, повтор CAS callback и отказ чтения/записи. Expected: оба изменения сохранены, существующий `dnc`/status не сброшен, дубля контакта нет, ошибка возвращается как `saved:false`. Добавлены missing/corrupt storage, исчерпание четырех конфликтов и локальный конкурентный путь. Тестируется реальный SDK через изолированный HTTP transport; старый код воспроизвел потерю контакта/заметок и сброс чужого `dnc`.
- [x] Локальные проверки: 11 новых сценариев, прежние store/Blob tests, web typecheck, полный web test (645 passed / 6 прежних fixture skips / 0 failed), Next production build и `pnpm dev:check` (web/docs) passed. Вместо IPC wrapper tsx используется эквивалентный `node --import tsx --test`. Реальные контакты/письма для проверки не создавались.
- [x] Независимое ревью без замечаний; [PR #352](https://github.com/AniDachi/anidachi-LP/pull/352) принят на staging `f2567844`. CI `35340144369`, smoke `35340357292` и Vercel `dpl_A3XSoRKQANRG3ms7iwDk4XboUGTQ` проверены на точном SHA. Финальные receipts записаны в PR; main не менялся.

**Приемка и ограничения:** отдельный PR фиксирует точный SHA, ревью и staging receipts. Код email endpoint/UI, общий store и Blob client не меняются; текущие проблемы ограничения отправки и результата доставки остаются 4B/4C. Graphify query `mutate contacts kreatli` использован для навигации, imports и CAS проверены в исходниках; refresh отложен до общей приемки редизайна по ранее согласованному исключению для мелких блоков. Rollback — revert только PR 4A в staging, без отката данных/env. Реальная конкурентная запись в облако и отправка письма на этом этапе не выполняются.

## Этап 4B. Ограничить публичную отправку

**Статус 2026-09-18:** отложен по решению владельца. Исследование выполнено,
код/конфигурация не изменялись. Этап 4C также остается открытым; продолжение
проверки сайта не означает приемку отправки писем для production.

**Files — Create:** `apps/web/lib/extension-install-request-limit.ts`, `apps/web/lib/extension-install-request-limit.test.ts`. **Modify:** `apps/web/lib/private-integration-blob.ts`, `apps/web/lib/private-integration-blob.test.ts`, `apps/web/app/api/extension/email-install-link/route.ts`, `docs/environment-and-secrets-matrix.md`.

**Interfaces:** `reserveInstallEmail({email:string, ip:string, nowMs:number}): Promise<{allowed:true} | {allowed:false; retryAfterSeconds:number}>`. Использовать существующий `updateKreatliCrmBlobText` с новым точным allowlisted private path `kreatli-crm/desktop-install-requests.json`. Не расширять доступ на произвольные Blob paths. Хранилище использует существующую CRM authority, новых секретов не требует.

- [ ] Сначала добавить тесты атомарного reserve с fake clock и CAS storage. Два одновременных запроса одному получателю: только один получает разрешение; повтор API на другом инстансе не обходит cooldown. Ошибка storage не разрешает Gmail.
- [ ] Операционные ограничения начального MVP: один запрос получателю в 10 минут, максимум 5 за 24 часа; источнику 10 за час; всему endpoint 100 за час. Это защита отправки, не тарифные лимиты продукта. Время только серверное; хранить hashes нормализованного адреса и trusted IP с timestamp, удалять записи старше 24 часов при mutation. Общий лимит ограничивает рост ledger максимум 2400 успешными reservations за сутки.
- [ ] Внутри CAS сначала отфильтровать устаревшие записи, затем проверить все окна; при отказе не изменять состояние. При разрешении записать reservation, и только после commit выполнить Gmail один раз. Не отправлять из retry callback. При сбое доставки reservation остается до cooldown, чтобы отказ провайдера не открывал бесконечные повторы.
- [ ] Проверять same-origin JSON, email не длиннее 254, body не больше 2 KiB по реально прочитанным байтам, `next` через существующий sanitizer. На Vercel использовать `x-vercel-forwarded-for`, проверяя единственный корректный IPv4/IPv6 через `node:net.isIP`; не доверять произвольному `Forwarded`/первому элементу клиентской цепочки. В local tests IP задается dependency injection. Нет валидного источника/доступного storage в production — контролируемая 503, без отправки.
- [ ] Проверить путь запроса до Vercel: дополнительный reverse proxy может скрыть реальный IP клиента, поэтому не считать IP-лимит единственной защитой. Сохраняются получатель/global caps. Заголовки сверены через Context7 и [официальную документацию Vercel](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for); доступ к пользовательским настройкам proxy при этом не изменялся.
- [ ] `429` содержит `Retry-After`; UI показывает время ожидания без мгновенного повторного запроса. Проверить 400/403/413/415/429/503, смену IP, повтор после границы окна, malformed ledger и CAS conflict. Все tests используют заглушки; не отправлять письма для проверки лимита.
- [ ] Выполнить `pnpm --filter @anidachi/web exec tsx --test lib/extension-install-request-limit.test.ts lib/private-integration-blob.test.ts`, web check/test. Commit `fix(web): bound public install email requests`, PR в staging. Проверить наличие нужной Blob authority по статусу, не печатая токены.

## Этап 4C. Сделать результат email честным

**Files — Modify:** `apps/web/app/api/extension/email-install-link/route.ts`, `apps/web/components/extension-install-hub.tsx`. **Create:** `apps/web/lib/extension-install-email.test.ts`. Дополнить `apps/web/lib/extension-install-hub-client.test.ts`.

**Interfaces:** ответ остается JSON; успешная пользовательская операция означает отправленное письмо. `emailed` сохранить для совместимости; статус CRM не подменяет доставку:

```ts
type InstallEmailResult =
  | { ok: true; emailed: true; saved: boolean; installUrl: string }
  | { ok: false; emailed: false; saved: boolean; error: string; retryAfterSeconds?: number };
```

- [ ] Записать table-driven tests: CRM/Gmail success-success; success-failure; failure-success; failure-failure; нет Gmail refresh token; token storage throws; rate denied; ZIP unavailable. Gmail mock вызывается максимум один раз и только после успешного reserve. CRM не является очередью на доставку.
- [ ] Чтение Gmail tokens и отправку поместить в контролируемый error path. Gmail success => 200, `emailed:true`; CRM failure при доставленном письме не ломает успех пользователя, но дает обезличенный серверный сигнал. Gmail unavailable => 503; send failure => 502, `ok:false`; `saved:true` допускается только после реального CRM commit и не рисуется как успех email.
- [ ] Убрать UI `Saved` как fallback. Тексты: `Link sent. Check your inbox.` только после доставки; при отказе `Could not send the link. Try again or copy this page's address.` Никаких обещаний будущей отправки/очереди. ZIP не опубликован — форма не обещает установку сейчас, endpoint возвращает 503 до Gmail.
- [ ] Не логировать raw email/body/tokens или полный Gmail error object, если в нем могут быть request headers. Использовать reason/code/request identifier. Формировать ссылку только из canonical origin и разрешенного room next.
- [ ] Выполнить `pnpm --filter @anidachi/web exec tsx --test lib/extension-install-email.test.ts lib/extension-install-hub-client.test.ts`, web check/test. Commit `fix(web): report install email delivery accurately`, PR в staging.

**Общая приемка email:** успешный toast соответствует отправке, отказ виден и повтор ограничен; параллельный запрос не теряет контакты; письма не зависят от предположения о внешнем firewall. Единственное реальное письмо на согласованный адрес — отдельный приемочный шаг этапа 6.

## Этап 5. Согласовать тексты с работающим MVP

**Files — Modify:** `apps/web/lib/pricing-tiers.ts`, `apps/web/lib/install-cta.ts`, `apps/web/lib/extension-install-faq.ts`, `apps/web/app/api/extension/email-install-link/route.ts`; точечные подтвержденные упоминания в `apps/web/app/compare/`. Проверить `apps/web/app/terms/page.tsx`, `apps/web/app/privacy/page.tsx`, `apps/web/app/account/billing/billing-client.tsx`, `docs/current-development-state.md`. **Create:** `apps/web/lib/pricing-tiers.test.ts` для тарифной матрицы, не для косметической пунктуации.

**Interfaces:** цены/entitlements и способы отмены остаются прежними. Разделить текстовые строки чтения и записи истории, данные лимитов брать из существующей политики.

- [x] Разделить в тарифах `Record & edit progress` и `View saved history & resume`; для второго Free доступен. Принято в PR #353 на staging `0616b0b8`: проверки матрицы, CI, deployment и desktop/mobile прошли. Отдельное уточнение такого же правила в Terms входит в 5B.
- [x] Решение владельца 2026-09-18: существующие тексты Chrome Web Store оставить, поскольку подача ZIP запланирована при выпуске в main. Это заменяет прежнее предложение нейтральной формулировки; подача в Store не выполнена этим решением и не входит в текущий блок.
- [ ] Найти `async`, `resume`, `history`, `refund`, `review`, `publisher verification` в измененных публичных страницах. Исправлять только противоречия установленному контракту: будущие async-возможности не представлены текущими; media seat не обещает камеру при заполненном лимите четырех камер; инструкции соответствуют текущему ZIP.
- [ ] Terms/Privacy: сохранить отмену продления, доступ до конца периода, отсутствие прежнего безусловного обещания возврата; технически сверить раскрытие Gmail/CRM с фактической формой. Изменение юридического содержания вне этих подтвержденных правил вынести владельцу конкретным предложением.
- [ ] Web check, `pnpm --filter @anidachi/web exec tsx --test lib/pricing-tiers.test.ts`, визуальная проверка pricing/install/terms/privacy на staging. Commit `fix(web): align launch copy with current plan behavior`, PR в staging.

### Этап 5A: история в тарифах, 2026-09-18

- Исправлены пять файлов: `pricing-tiers.ts`, `pricing-copy.ts`,
  `components/pricing.tsx`, `components/compare-table.tsx`, `app/pricing/page.tsx`.
  Free видит сохраненную историю и Resume; запись/редактирование требуют своего
  Plus/Pro. В FAQ возвращен вопрос об отмене продления вместо вопроса о возврате
  денег с несоответствующим ответом. Цены, checkout и тарифные права не меняются.
- `pricing-tiers.test.ts`: две проверки сначала воспроизвели неверное описание
  Free; после исправления все три passed, включая сверку лимитов с runtime policy
  и цен $0/$7.99/$14.99. Web typecheck, 648 tests passed / 6 прежних skips / 0 failed,
  Next production build passed. В локальной production-сборке проверены /pricing
  и /#compare при 1280x720 и 390x844: текст помещается, доступ к истории указан
  верно, FAQ раскрывает правильный ответ. Новая Stripe-сессия не создавалась.
- 2026-09-18 владелец согласовал удаление обещания индивидуальной цены для групп
  8+: оно убрано из карточки Pro, матрицы и общего FAQ. Стандартные цены, лимиты
  и priority support сохранены. Затем владелец согласовал весь описанный блок 5A
  для обновления PR #353, проверок и переноса в staging. Main остается отдельным
  решением; приемка фиксируется по фактическому deployment после merge.
  Файлы с другими непроверенными marketing claims не закрываются целиком.
  Остальные пункты этапа 5 остаются открытыми.
- Приемка точного staging SHA, CI и deployment фиксируется в отдельном PR 5A.
  Graphify использован для навигации; refresh остается отложенным до общей приемки
  по согласованному исключению для небольших блоков. Rollback: revert только PR 5A;
  данных, миграций, env и extension changes в нем нет.

### Этап 5B: Terms и сравнение с Crunchyroll Party, 2026-09-18

Владелец согласовал этот конкретный следующий блок после объяснения двух
несоответствий. Product files: только `app/terms/page.tsx` и
`app/compare/anidachi-vs-crunchyroll-party/page.tsx` в `apps/web`.

- Уточнить в Terms личный Plus/Pro для записи/редактирования и доступ к сохраненной
  истории/Resume на Free. Правила оплаты, отмены и возвратов не менять.
- На одной странице сравнения заменить обещания готового async, общей истории,
  постоянного контекста комнаты и сохраненных реакций описанием live-комнат и
  личного прогресса. Async остается явно запланированным, без срока выпуска.
- Согласовать видимый текст, таблицу, FAQ/JSON-LD, search/social metadata и дату
  изменения. Сохранить маршруты, ссылки, компоненты, CTA и их поведение.
- CWS/install/email copy и runtime, расширение, тарифные права, БД и main не менять.
  Утверждения о конкурентах и остальные SEO-страницы не считать принятыми этим блоком.
- Проверка: web typecheck, `pnpm dev:check`, проверка diff и локальной сборки,
  desktop/mobile и FAQ/metadata на точном preview/staging deployment. Отдельные
  тесты, повторяющие статичные строки, не добавлять. Результаты и независимое ревью
  записать в scoped PR; при реальном симптоме расширить только затронутую проверку.
- Graphify query предыдущего read-only review используется для навигации;
  потребители подтверждены исходником. Refresh отложен по согласованному исключению.
  Rollback: revert только PR 5B на staging; данных и env-операций нет.

## Этап 6. Приемка точного staging-кандидата и выдачи ZIP

**Files:** запись результатов в этом плане, `docs/staging-acceptance-checklist.md`, `docs/release-and-rollback-runbook.md`, `docs/environment-and-secrets-matrix.md`. Артефакты и screenshots хранить вне tracked source. Этот этап не добавляет продуктовый код.

- [ ] Обновить refs; записать точный candidate SHA, перечень принятых PR и результат `git diff origin/main <candidate>`. Для закрытых F01–F14 должна быть ссылка на commit/test или явное согласованное исключение. Любой новый коммит после проверок требует оценки своего diff и соответствующего повторного gate.
- [ ] Закрыть файловый реестр и матрицу регрессий выше на окончательном candidate. Прочитать все дополнительные fix-файлы, появившиеся после исходных 164, и повторно проверить связанные потребители.
- [ ] CI и Build Extension на candidate зеленые целиком; Vercel staging READY на том же SHA; Worker/staging smoke проверен. Миграции/Worker/protocol/Stripe env не должны неожиданно появиться в diff. `pnpm dev:check` не подменяет выполнение выбранных проверок.
- [ ] Собрать и валидировать staging ZIP для обычного тестирования; отдельно production-профиль того же candidate для проверки manifest/упаковки, пока без публичной раздачи. Страница staging не должна незаметно подключать тестера к production: staging source соответствует staging артефакту. Предрелизный production candidate используется только как явно обозначенный тест.
- [ ] Подготовить immutable hosted source, version, SHA-256, bytes; проверить их до изменения конфигурации выдачи. Не перезаписывать уже выданный ZIP по старому URL. Для нового канала/сборки использовать новый путь. Проверить `EXTENSION_ZIP_*` согласованным комплектом, доступность Blob/CDN и отсутствие защиты/секретов в публичном URL.
- [ ] Скачать через настоящую кнопку staging и проверить: HTTP-цепочку, Content-Type, filename, размер, SHA-256, целостность ZIP, manifest version/name/ID, canonical endpoints, отсутствие local-broad/dev/secrets. Header с hash не заменяет локально вычисленный hash полученных байт.

  ```bash
  shasum -a 256 <downloaded-zip>
  unzip -t <downloaded-zip>
  unzip -p <downloaded-zip> manifest.json
  ```

- [ ] Chrome AniDachi Test: fresh install и update существующей папки; вход, неизмененный ID, доступная повторная загрузка; refresh уже открытого YouTube/Crunchyroll. Сайт не проверяет установку: старый production ZIP поддерживает тот же путь продолжения/обновления, что и новый.
- [ ] Кабинет: login, меню на mobile/tablet/desktop, история обеих платформ, выбор сезона/серий, Cancel, Save в тестовой записи; сайт/шторка показывают один результат. Save / Discard / Stay при реальном выходе, HTTP error через локальную заглушку; profile navigation и возврат из `/extension?next=/room/...`.
- [ ] Billing: отображение тарифа и отмены на staging; pending/failed checkout sync не объявлен успехом новой UI-логикой. Полный sandbox checkout/cancel/restore повторять при изменении billing/auth поведения; если diff только стили/навигация, записать исключение и текущую UI-проверку. Реальные списания/отмены production не делать.
- [ ] Короткая регрессия extension: defaults после выдачи/отзыва места; room reinvite; first-install controls; список People; Free countdown не меняет серверную границу. Worker/P2P код неизменен — не повторять тяжелый harness после каждой правки текста. После final extension build провести один реальный room/media smoke с двумя участниками; расширить до harness при симптоме или изменении media plane.
- [ ] Email: mock-сценарии полностью проходят; после согласования конкретного получателя отправить одно staging письмо, проверить домен ссылки, доставку, cooldown и отсутствие двойной CRM-записи. Не отправлять письма произвольным контактам из CRM.
- [ ] Проверить staging gate/noindex, production canonical ссылки, robots/sitemap, мобильный путь, отсутствующие ZIP/env/dependency ошибки в относящихся к проверке логах. Зафиксировать незакрытые ручные проверки честно; отсутствие новых ошибок за короткий smoke не означает гарантию под любой нагрузкой.

**Условие перехода:** принят конкретный SHA и его сценарии. Ошибки ведут к отдельному узкому fix -> staging -> повтор затронутой проверки. Пока есть обязательный незакрытый пункт, полный promotion PR не мержить.

## Этап 7. Отдельный выпуск в main

**Files/operations:** итоговый promotion PR, release receipts и environment documentation. Обычная GitHub/Vercel/Worker release-цепочка; никаких прямых push в main.

- [ ] Сформировать проверяемый promotion из принятого staging. Если main содержит новый merge/фикс, включить его в candidate обычным merge, разрешить конфликты по смыслу и заново проверить итог. Не нажимать автоматическое разрешение конфликтов и не считать старый CI подтверждением нового merge tree.
- [ ] Сравнить финальный diff по плоскостям: новый дизайн/соглашение/install присутствуют; история, тарифы, отмена, media defaults, reinvite и countdown сохранены. Проверить, что PR #347 не захватил новые непроверенные изменения. Для частичного main-выпуска нужен отдельно согласованный состав зависимостей; не cherry-pick случайный UI-коммит из общей серии.
- [ ] До merge записать rollback: последний здоровый Vercel deployment; прежние `EXTENSION_ZIP_*` как несекретный release record; прежний immutable ZIP; предыдущий Worker deployment, только если он меняется. Новые DB migration или Stripe config в этом плане не предполагаются.
- [ ] Показать пользователю конкретный состав выпуска, зеленые проверки, ручную приемку и оставшиеся ограничения. Выполнить promotion после отдельного разрешения на этот проверенный выпуск, не по старому согласию на аудит/план.
- [ ] После main merge проверить CI/deploy и alias production, затем собрать финальный production ZIP из принятого main и провалидировать. Проверить его относительно candidate: допустим build identifier, остальное объяснено. Не выдавать staging ZIP под названием production.
- [ ] Публикация ZIP: только после согласованной приемки финального артефакта обновить source и version/hash/bytes вместе. Если сайт выходит раньше, оставить честное состояние недоступности; не публиковать непроверенную сборку для заполнения кнопки.
- [ ] Через production-кнопку получить файл и сверить hash/bytes/manifest с финальным артефактом; проверить вход, кабинет, историю, Subscription и обновление существующего расширения. При регрессии остановить rollout и использовать записанный rollback, не откатывая другие плоскости без причины.
- [ ] Закрыть этапы только после фактической проверки. Финальный отчет: точный SHA сайта, SHA/build ID ZIP, URL выдачи, статус main/staging/PR, ручные проверки и остаточные риски.

## Документы, Graphify и журнал исполнения

Graphify использован для навигации, важные связи перепроверены исходниками. По просьбе пользователя не запускать тяжелое обновление графа после мелких итераций refresh для черновика и пересогласованных этапов 1–2 не выполняется. Этап 1 возвращает известный production extension/tooling и удаляет зависимость UI сайта; этап 2 возвращает существующий общий компонент и совместимый re-export, проверяя прежних потребителей и event contract. Нового контракта нет. Исключение записывается в PR, граф используется только как навигация и не объявляется обновленным. При существенных изменениях кода/контрактов выполнять нужный code/semantic update по [quality gates](../../development-quality-gates.md), фиксируя его отдельно от чужих graph changes. Не запускать полный re-extract лишь потому, что восстановлена команда `graph:update:code`.

Для каждого блока дописывать одну запись: дата; branch/PR/commit; закрытые F-ID; выполненные команды и результат; staging SHA/ручная приемка; docs/Graphify status; rollback. Не переносить исторические результаты на новый SHA без проверки diff.

| Дата | Блок | Результат |
| --- | --- | --- |
| 2026-09-15 | Планирование | Повторно сверены исходники, refs, CI и живой staging. Создан отдельный worktree `codex/staging-release-repair-plan`. Продуктовый код, production, подписки, история, письма, merge/push/deploy не изменялись. Первое действие реализации — этап 1. |
| 2026-09-15 | Проверка документа | Все существующие source paths и относительные ссылки проверены; новые файлы перечислены как Create. Штатный `scripts/dev-check.mjs` выполнен под Node 22.23.1: только docs profile. Запуск через pnpm попытался автоматически установить зависимости в новом worktree и был остановлен после сетевой ошибки; runtime tests/builds не выполнялись. Tracked lockfile и продуктовый код не изменены. |
| 2026-09-16 | Полное покрытие | `git ls-remote` повторно подтвердил прежние main/staging SHA. Добавлен реестр всех 164 файлов и сквозная матрица. Известные замечания не выданы за завершенное полное ревью; открытые файловые строки должны быть приняты до promotion. |

| 2026-09-16 | Пересогласование этапа 1 | Владелец одобрил точечную отмену extension-изменений и связанных web detectors. Создана ветка `codex/preserve-production-extension` от прежнего staging; предыдущий PR #348 не слит. Новые client regression tests воспроизвели 5 отклонений и прошли после исправления; полные локальные проверки, оба release validators и desktop/mobile UI review прошли. Новая ветка сохраняет production extension полностью; код `b71b1b91`, PR #349 открыт в staging; #348 закрыт без merge. CI receipts текущего head — в #349. Main/staging deployment не выполнялся. |
| 2026-09-16 | Приемка этапа 1 | После согласования #349 слит в staging `bcd00c7d`; CI, extension build, staging smoke и Vercel alias подтверждены. Подробная ручная приемка и ее ограничения в #349. Main `4b4ff883`, auto-merge promotion #347 выключен. |
| 2026-09-16 | Реализация этапа 2 | Ветка `codex/restore-account-menu` от staging `bcd00c7d`, runtime `185ac1ae`. F04/F05/F06 исправлены локально; 24 красные целевые проверки до восстановления, 34/34 зеленые после него. Web check, полный web test (617 passed / 6 skipped), Next build и dev:check (web/docs) passed. CSS меню, редакторы и API, extension/tooling и протокол не изменены. Docs/реестр обновлены, Graphify refresh отложен по указанному исключению. Независимое ревью и staging receipt записываются в отдельном PR; rollback — revert только PR этапа 2 в staging, без DB/env действий. Main не меняется. |
