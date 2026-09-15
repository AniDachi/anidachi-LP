# Staging Release Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Work sequentially; do not start parallel implementation or promotion without a separate instruction.

**Goal:** Исправить подтвержденные ошибки новой версии staging, сохранить работающий продукт и подготовить проверяемый выпуск сайта и ZIP через обычный PR в main.

**Architecture:** Сохраняем новый дизайн и существующие владельцы состояния. Общий компонент меню снова отвечает за навигацию и безопасный выход; единый источник метаданных отвечает за установочный ZIP. Новая отправка ссылки использует существующие CRM/Gmail и атомарное хранилище, без новой очереди рассылок или отдельной платформы.

**Tech Stack:** Node 22.23.1, pnpm 11.2.2, Next.js 15.5.23, React, WXT 0.20.26, Vitest, node:test/tsx, существующие Vercel Blob, Gmail, GitHub Actions, Vercel и Cloudflare.

**Spec:** [Текущее состояние](../../current-development-state.md), [каналы расширения](../../extension-release-channels.md), [личная история и тарифы, уточнение D01](2026-09-08-personal-history-and-plans-mvp.md), [навигация кабинета](../specs/2026-09-10-account-mvp-navigation-design.md) и реестр подтвержденных отклонений ниже. Этот план восстанавливает согласованные контракты, а не вводит новую модель продукта.

**Дата:** 2026-09-15. **Статус:** повторная проверка завершена; реализация этапов не начата. Запись плана не означает разрешение на merge, отправку писем или публикацию ZIP.

**Уточнение 2026-09-16:** по просьбе пользователя добавлены полный реестр измененных файлов и обязательная проверка их влияния. Повторная проверка известных замечаний завершена; полное построчное ревью всех 164 файлов и финальная регрессия еще не завершены и не считаются выполненными по наличию этого плана.

## Global Constraints

- Работа по одному завершенному блоку: `codex/* -> PR -> staging -> приемка`. Начинать с этапа 1. Перед следующим блоком зафиксировать результат и оставшиеся ошибки.
- До выпуска покрыть весь список измененных/удаленных файлов по реестру ниже, включая связи с неизмененными потребителями. Перед первой правкой подтвердить границы риска; каждый следующий блок закрывает свой файловый срез. Любая новая ошибка добавляется в реестр и получает отдельный fix/gate.
- Не переносить весь staging в main после каждого небольшого исправления: вместе с ним попадут еще не принятые части редизайна. Финальный promotion — отдельный шаг после приемки.
- Не push напрямую в main, не force-push, не сбрасывать и не откатывать чужие изменения. При обновлении веток сохранять обе стороны обычным merge с проверкой результата.
- Не менять комнаты, протокол, медиаместа, defaults, голос, историю, Stripe-объекты, Supabase-данные и rollout-флаги для решения ошибок сайта. Новая необходимость в этих областях требует отдельного описания причины и проверок.
- Production extension ID: `gpkolofebdhfpapbbgdkdkmlmjfidgmn`; staging: `ndkfphbchhfephdodcpehdcoclojagje`; local: `nkinhhgigcflmfhilmcakbkongcpkfnl`. Стабильные публичные ключи сохраняются.
- Release builds: узкие разрешения; `site-presence` отдельно от overlay. Логотип в `web_accessible_resources` доступен только видеоплатформам. Не добавлять `unsafe-eval` и не возвращать динамическую компиляцию Zod.
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
| F01 | P1, CI и исходник: новый `site-presence.content.ts` добавляет сайт, валидатор/тесты ожидают только видео | Проверять каждый content script по его назначению; не расширять overlay или WAR | 1 |
| F02 | P1, исходник: валидатор сначала требует staging `manifest.key`, затем отвергает любой ключ | Сохранить стабильный staging ID, отклонять чужой ключ. Текущий CI падает раньше этой проверки | 1 |
| F03 | P1, команды: удален `build:extension:staging:local-broad`; новая broad-команда передает env, который скрипт сбрасывает | Восстановить команду и настоящий `--broad`, отдельную папку local-broad | 1 |
| F04 | P2, исходник и импорты: desktop/mobile logout обходят `anidachi:before-sign-out`, не проверяют `response.ok` | Защита Save / Discard / Stay до запроса logout; ошибка выхода не уводит со страницы | 2 |
| F05 | P2, повторно подтверждено живым `/extension`: меню содержит только Friends и Sign out | Вернуть быстрый вход в кабинет, историю, подписку, профиль и помощь | 2 |
| F06 | P2, live DOM и CSS: при 700 px нет доступа к аккаунту; исходник оставляет scroll lock после скрытия mobile drawer | Непрерывная навигация на границах 640/768 px; закрытие и снятие блокировки при смене режима | 2 |
| F07 | P1 для публичной установки, live: ZIP-кнопка disabled. Код расходится: `available` по env, download дополнительно ищет файлы | Согласовать метаданные, реальный источник ZIP и публичную выдачу, проверить байты | 3, 6 |
| F08 | P2, исходник: installed-ветка скрывает download, хотя popup ведет туда обновляться; старый ZIP не имеет presence | Скачать/обновить можно независимо от обнаружения. Отсутствие ответа не доказывает отсутствие расширения | 3 |
| F09 | P2, исходник: CRM read-modify-write сохраняет старый снимок контактов | Использовать существующий `mutateContacts`, проверить конфликт с параллельной правкой | 4A |
| F10 | P2, исходник: публичная отправка Gmail без cooldown/dedupe/ограничения по источнику и получателю | Прикладная защита с атомарным состоянием, без зависимости от непроверенного firewall | 4B |
| F11 | P2, исходник: полный отказ CRM + Gmail выглядит `Saved`; чтение Gmail tokens вне обработчика ошибки | Правдивый результат доставки; контролируемые JSON-ошибки; не обещать несуществующую очередь | 4C |
| F12 | P2, pricing и контракт D01: Free описан как `No personal history or Resume` | Отделить сохраненную историю от права новой записи/редактирования | 5 |
| F13 | Согласованность: CWS review/publisher verification заявлены без подтверждения; на части compare-страниц прежние обещания async | Нейтральный фактический текст; недоступные функции явно будущие | 5 |
| F14 | Процесс: удален `graph:update:code`, изменены обходящие wrapper aliases; AGENTS и quality gates требуют прежний flow | Вернуть команду через существующий `scripts/graphify-code-update.mjs` и связанные aliases | 1 |

### Что проверено и что еще не доказано

- [x] Повторно сверены refs, измененные плоскости, CI и исходники перечисленных причин. Повторно открыты staging `/extension` и `/account/billing`: ZIP недоступен, меню урезано, подписка Plus Active загружается.
- [x] В предыдущей проверке того же SHA загружались YouTube/Crunchyroll, счетчики вместимости, сезоны, Resume. Выбор сезона и Cancel возвращали исходный прогресс без сохранения в БД.
- [x] Старый рабочий `components/account-menu.tsx` сохранился. Его можно подключить обратно и стилизовать, не переписывая auth/history.
- [x] `SuccessInstallNext` сейчас нигде не импортирован: его спорная фраза не считается действующей ошибкой checkout. Автоматически подключать компонент в рамках исправлений нельзя.
- [ ] Реальный logout с несохраненным черновиком: пока подтвержден кодом, сессию пользователя при аудите не отзывали. Сначала компонентные тесты, затем контролируемая staging-приемка.
- [ ] Scroll lock после resize: обработчики подтверждены кодом, реальная прокрутка колесом/тачем требует проверки после исправления; прежняя проба PageDown не является достаточным доказательством.
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

## Этап 1. Восстановить выпуск расширения

**Files — Modify:** `scripts/validate-extension-artifact.mjs`, `apps/extension/test/release-channel-build.test.ts`, `package.json`, `docs/extension-release-channels.md`. Проверить потребителей в `apps/extension/wxt.config.ts`, `apps/extension/entrypoints/content.tsx`, `apps/extension/entrypoints/site-presence.content.ts`, `scripts/build-extension-staging.sh`, `scripts/build-extension-public.sh`; менять их только при доказанном расхождении контракта.

**Interfaces:** вход валидатора остается `--channel staging|production --dir <artifact>`; успех — exit 0, ошибка — nonzero с конкретным нарушением. Production/staging build scripts принудительно задают свои endpoints и permissions. Результат нужен этапам 3 и 6.

- [ ] Дополнить fixtures: отдельные `content-scripts/content.js` и `content-scripts/site-presence.js`, корректные matches обоих каналов. Отрицательные случаи: overlay на сайте, presence на чужом домене, production с staging key, staging с production key, лишний WAR/широкий wildcard. Фикстура staging со своим ключом обязана проходить.
- [ ] Проверять роли скриптов, а не только объединение доменов. Контракт:

  ```js
  const siteMatches = channel === "production"
    ? ["https://www.anidachi.app/*", "https://anidachi.app/*"]
    : ["https://staging.anidachi.app/*"];
  const roles = new Map([
    ["content-scripts/content.js", { matches: videoHosts, allFrames: true }],
    ["content-scripts/site-presence.js", { matches: siteMatches, allFrames: false }],
  ]);
  const observed = new Set();
  for (const script of manifest.content_scripts ?? []) {
    const entry = script.js?.[0];
    const role = roles.get(entry);
    if (!role || script.js.length !== 1 || observed.has(entry)) {
      throw new Error("Unexpected or duplicate content script");
    }
    const actual = [...(script.matches ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify([...role.matches].sort()) ||
        (script.all_frames ?? false) !== role.allFrames ||
        script.run_at !== "document_start") {
      throw new Error(`Unexpected content script scope: ${entry}`);
    }
    observed.add(entry);
  }
  if (observed.size !== roles.size) throw new Error("Missing content script");
  ```

  `videoHosts` — существующий точный список валидатора; production/staging host permissions и WAR проверяются независимо и не расширяются этим кодом.

- [ ] Заменить поздний запрет любого staging key на единую проверку точного channel ID. Не удалять публичные ключи и не добавлять site-домены в overlay/WAR ради прохождения проверки.
- [ ] Восстановить команды; broad-алиас не должен перезаписывать обычный staging:

  ```json
  {
    "build:extension:staging:local-broad": "bash scripts/build-extension-staging.sh --broad",
    "build:extension:staging:broad": "pnpm build:extension:staging:local-broad",
    "graph:baseline": "pnpm graph:update:code",
    "graph:update": "pnpm graph:update:code",
    "graph:update:code": "node scripts/graphify-code-update.mjs"
  }
  ```

- [ ] Выполнить `pnpm --filter @anidachi/extension exec vitest run test/release-channel-build.test.ts`, затем extension check/test и build/validate staging и production. Tests вызывают реальные сборки: не запускать их одновременно с ручным build в той же папке.
- [ ] Запустить `pnpm dev:check`, записать docs/Graphify/rollback; commit `fix(extension): restore channel artifact validation`, PR только в staging. Проверить новый CI целиком, включая ранее пропущенные шаги. Новые ошибки CI сначала диагностировать отдельным пунктом; не маскировать skip/ослаблением assertions.

**Приемка:** оба узких артефакта валидны; local-broad остается отдельным локальным артефактом; стабильные ID, `jitless`, production React, icons и endpoints сохранены. Сайт не получает overlay, видеоплатформы продолжают получать его. Ничего не публиковать пользователям из feature/staging как окончательный production ZIP.

## Этап 2. Вернуть вход в кабинет и защиту редактирования

**Files — Modify:** `apps/web/components/account-menu.tsx`, `apps/web/components/nav-bar-client.tsx`, `apps/web/app/globals.css`, `apps/web/lib/account-menu-client.test.ts`. **Create:** `apps/web/lib/nav-bar-client.test.ts`. **Consumers to verify:** `apps/web/app/account/layout.tsx`, `apps/web/app/account/profile/profile-client.tsx`, `apps/web/app/account/watch-library/history-browser.tsx`, `apps/web/lib/use-body-scroll-lock.ts`.

**Interfaces:** сохранить экспорт `UserMenu({user: NavUser, compact?: boolean, onOpen?: () => void})` и `AccountEntryLink({onClick?: () => void})`. Публичный navbar и account layout используют одну реализацию, при необходимости через совместимый re-export. Контракт выхода остается отменяемым событием `CustomEvent<() => Promise<void>>("anidachi:before-sign-out")`; только разрешенный callback вызывает `/api/auth/logout`.

- [ ] В тесте меню монтировать экспорт, реально используемый `nav-bar-client`/кабинетом; не ограничиваться старым изолированным компонентом. Использовать существующие `mount/open/act` helpers, добавить наблюдение за реальным кликом:

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

- [ ] Подключить сохраненный `account-menu.tsx`, адаптировать его оформление к новым токенам. Удалить дублирующие desktop/mobile обработчики logout. Сохранить кликабельный вход `/account` и shortcuts Watch Library, Friends & Groups, Subscription, Profile, Help.
- [ ] Проверить Stay — ноль logout requests; Discard — один; Save — выход только после успешного сохранения; ошибка Save сохраняет сессию и черновик; HTTP 500/сеть при logout оставляют экран с повтором. Повторные быстрые клики не выполняют callback дважды.
- [ ] В navbar устранить промежуток 640–767 px: одинаковый breakpoint для mobile/desktop либо общий compact account control. При уходе с mobile закрыть drawer и снять lock через cleanup. Escape, переход по ссылке, потеря/возврат focus и длинное имя не ломают навигацию.
- [ ] Проверить `nav-bar-client.test.ts` с mock `matchMedia`: открытие при 390 px, resize к 700/768, снятие wheel/touch/key listeners. В браузере проверить 390, 639, 640, 700, 767, 768 и 1280 px; реальную прокрутку после resize. Одной проверки CSS display недостаточно.
- [ ] Выполнить `pnpm --filter @anidachi/web exec tsx --test lib/account-menu-client.test.ts lib/nav-bar-client.test.ts lib/account-navigation-client.test.ts`, затем web check/test. Commit `fix(web): restore account navigation and guarded sign out`, PR в staging, приемка меню с черновиком истории и профиля.

**Приемка:** новый дизайн сохранен; кабинет доступен со всех размеров сайта, unsaved guard перехватывает настоящий logout до отзыва сессии. История и billing API не изменены.

## Этап 3. Согласовать установку, обновление и источник ZIP

**Files — Modify:** `apps/web/lib/extension-artifact.ts`, `apps/web/app/api/extension/latest/route.ts`, `apps/web/app/api/extension/download/route.ts`, `apps/web/app/extension/page.tsx`, `apps/web/components/extension-install-hub.tsx`, `apps/web/lib/extension-presence.ts`, `docs/environment-and-secrets-matrix.md`. **Create:** `apps/web/lib/extension-artifact.test.ts`, `apps/web/lib/extension-install-hub-client.test.ts`. Проверить `apps/extension/src/popup-app.tsx` и `apps/web/lib/install-cta.ts` как потребителей.

**Interfaces:** сохранить `getExtensionArtifact(): ExtensionArtifact`, `toPublicExtensionArtifact(): PublicExtensionArtifact` и существующие поля/маршруты. `available` означает корректно настроенную выдачу; успешность текущей доставки отдельно проверяется HTTP/байтами. Presence — только подсказка UX, не доказательство авторизации, версии или entitlement.

- [ ] Зафиксировать одну политику: production получает immutable публичный HTTPS ZIP по `EXTENSION_ZIP_URL`; локальный путь — только явно настроенный dev/preview источник. Удалить неявный поиск ZIP по разным папкам. Локальную доступность проверять по regular file; отсутствие/невалидность source, version, SHA-256, bytes дает `available:false` и download 503. Не делать внешнюю загрузку/хеширование ZIP при каждом SSR.
- [ ] Метаданные `/latest`, страницы и `/download` берутся из одного resolver. URL только HTTPS без embedded credentials; public JSON не содержит локальных путей и auth-данных. Исправить комментарий о секретности URL: адрес публичного ZIP виден при 302, и это ожидаемо. Не использовать долгоживущие секреты/подписанные временные ссылки как источник публичной раздачи.
- [ ] Добавить metadata tests: отсутствующий источник, URL с credentials/неверной схемой, нечисловой размер, неправильный hash/version, несуществующий local file, корректный источник, отсутствие server-only полей в public JSON. Проверять фактический ответ download отдельно, а не только `available`.
- [ ] Сделать общий блок загрузки вне ветвления `detected === true`. Заголовок может быть `Download update` для обнаруженного расширения; href всегда `/api/extension/download`. При unavailable — понятный disabled state. Пример ожидаемого общего контроля:

  ```tsx
  <a href="/api/extension/download">
    {detected === true ? "Download update" : "Download for Chrome"}
  </a>
  ```

  Render этого фрагмента только при `artifact.available`; disabled state — отдельный button, а не неработающая ссылка.

- [ ] Сохранить путь продолжения `/room/...` и ручное `I already installed it`/повтор проверки: старый выданный ZIP не отвечает presence. Не показывать ложное `not installed` как факт. Проверить pending, timeout, поздний ответ, detected; installed state не прячет version/hash/инструкцию обновления.
- [ ] В инструкции обновления: сохранить папку и ID расширения, заменить файлы новой распакованной сборкой, нажать Reload в `chrome://extensions`, обновить открытые вкладки видео. Не советовать Remove/reinstall как обычное обновление. Не вводить автоматическое обновление sideload.
- [ ] Выполнить `pnpm --filter @anidachi/web exec tsx --test lib/extension-artifact.test.ts lib/extension-install-hub-client.test.ts`, web check/test и проверить UI desktop/mobile. Commit `fix(web): keep extension downloads available for installs and updates`, PR в staging. Настройку реального hosted ZIP выполнить отдельно на этапе 6.

**Приемка:** download доступен новому и существующему пользователю независимо от presence; корректный room next сохраняется, внешние/ненормализованные обходные next не принимаются. Несконфигурированный ZIP не объявляется опубликованным.

## Этап 4A. Убрать риск потери CRM-изменений

**Files — Modify:** `apps/web/lib/kreatli-crm/desktop-install-lead.ts`. **Create:** `apps/web/lib/kreatli-crm/desktop-install-lead.test.ts`. Использовать `apps/web/lib/kreatli-crm/store.ts` без нового snapshot writer.

**Interfaces:** сохранить `upsertDesktopInstallLead(email): Promise<{saved:boolean; reason?:string}>`. Существующий `mutateContacts<T>((contacts) => {changed:boolean; value:T})` повторяет чистую операцию над свежими данными при CAS-конфликте.

- [ ] Перенести поиск/изменение контакта внутрь `mutateContacts`; ID и timestamp создать один раз до retry callback. В callback запрещены Gmail, логирование PII и другие внешние побочные эффекты.

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

- [ ] Тестировать два одновременных разных адреса, повтор одного адреса с разным регистром, конкурентное изменение notes/status существующей CRM-записи, повтор CAS callback и отказ чтения/записи. Expected: оба изменения сохранены, существующий unsubscribed/status не сброшен, дубля контакта нет, ошибка возвращается как `saved:false`.
- [ ] Выполнить `pnpm --filter @anidachi/web exec tsx --test lib/kreatli-crm/desktop-install-lead.test.ts lib/kreatli-crm/store.test.ts`, web check/test. Commit `fix(web): save install leads with atomic CRM mutations`, PR в staging. Реальные контакты/письма для проверки не создавать.

## Этап 4B. Ограничить публичную отправку

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

- [ ] Заменить Free `No personal history or Resume` на `New history recording requires Plus or Pro. Your saved history stays available.` В сравнении разделить `Record & edit progress` и `View saved history & resume`; для второго Free доступен. Проверить тестом семантические значения матрицы и текущие числовые лимиты.
- [ ] Неподтвержденный статус Chrome Store заменить нейтральным `The Chrome Web Store listing is not available yet. Download the ZIP from this page.` Не обещать сроки ревью/автообновление и не начинать Store submission как часть этого плана.
- [ ] Найти `async`, `resume`, `history`, `refund`, `review`, `publisher verification` в измененных публичных страницах. Исправлять только противоречия установленному контракту: будущие async-возможности не представлены текущими; media seat не обещает камеру при заполненном лимите четырех камер; инструкции соответствуют текущему ZIP.
- [ ] Terms/Privacy: сохранить отмену продления, доступ до конца периода, отсутствие прежнего безусловного обещания возврата; технически сверить раскрытие Gmail/CRM с фактической формой. Изменение юридического содержания вне этих подтвержденных правил вынести владельцу конкретным предложением.
- [ ] Web check, `pnpm --filter @anidachi/web exec tsx --test lib/pricing-tiers.test.ts`, визуальная проверка pricing/install/terms/privacy на staging. Commit `fix(web): align launch copy with current plan behavior`, PR в staging.

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

- [ ] Chrome AniDachi Test: fresh install и update существующей папки; вход, неизмененный ID, presence, кнопка повторной загрузки; refresh уже открытого YouTube/Crunchyroll. Старый production ZIP без presence имеет понятный ручной путь продолжения/обновления.
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

Graphify использован для навигации, важные связи перепроверены исходниками. Этот planning-only файл не меняет runtime/архитектуру. В соответствии с просьбой пользователя не запускать тяжелое обновление графа после мелких итераций, полный refresh при записи черновика не выполняется; это явное исключение только для данного документа. При существенных изменениях кода/контрактов выполнять нужный code/semantic update по [quality gates](../../development-quality-gates.md), фиксируя его отдельно от чужих graph changes. Не запускать полный re-extract лишь потому, что восстановлена команда `graph:update:code`.

Для каждого блока дописывать одну запись: дата; branch/PR/commit; закрытые F-ID; выполненные команды и результат; staging SHA/ручная приемка; docs/Graphify status; rollback. Не переносить исторические результаты на новый SHA без проверки diff.

| Дата | Блок | Результат |
| --- | --- | --- |
| 2026-09-15 | Планирование | Повторно сверены исходники, refs, CI и живой staging. Создан отдельный worktree `codex/staging-release-repair-plan`. Продуктовый код, production, подписки, история, письма, merge/push/deploy не изменялись. Первое действие реализации — этап 1. |
| 2026-09-15 | Проверка документа | Все существующие source paths и относительные ссылки проверены; новые файлы перечислены как Create. Штатный `scripts/dev-check.mjs` выполнен под Node 22.23.1: только docs profile. Запуск через pnpm попытался автоматически установить зависимости в новом worktree и был остановлен после сетевой ошибки; runtime tests/builds не выполнялись. Tracked lockfile и продуктовый код не изменены. |
| 2026-09-16 | Полное покрытие | `git ls-remote` повторно подтвердил прежние main/staging SHA. Добавлен реестр всех 164 файлов и сквозная матрица. Известные замечания не выданы за завершенное полное ревью; открытые файловые строки должны быть приняты до promotion. |
