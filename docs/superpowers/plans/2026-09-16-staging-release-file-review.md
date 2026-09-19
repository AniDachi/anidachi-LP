# Реестр проверки файлов staging перед production

**Дата:** 2026-09-16; обновлено 2026-09-19. **План:** [Staging Release Repair](2026-09-15-staging-release-repair-plan.md).

**База исходного diff:** main `4b4ff88380d0a64e5216d2770d360440d3f8852b` → staging `391fb5c97a09298080c32f354eaab63d9115f22a`.
**Последняя подтвержденная приемка staging:** `1542ae14` (PR #360).
**Локальная проверка:** `codex/install-guide-real-controls`, HEAD `f9a48059` и незакоммиченные исправления, зафиксированные в L01–L03 ниже. Это не новый production-кандидат.

В реестре все 164 измененных, добавленных и удаленных файла исходного diff.
На 2026-09-19 проход по исходным изменениям завершен: у каждого пути записан
результат. «Проверено по diff» означает завершенную проверку исходника и его
назначения с указанными доказательствами, а не свежую проверку каждого экрана
на staging. F15–F18 исправлены в согласованном завершающем блоке L04 ниже.
Закрытие исходного review не заменяет отдельную приемку production/ZIP. Новые изменения пересматриваются по diff.

Этап 1 пересогласован 2026-09-16: `возвращено к main` означает полное исключение
предложенного изменения по решению владельца; `исключено` — удаление новой
непринятой части. Реестр исходных 164 файлов сохранен, остальные строки не считаются
принятыми. Подробные команды и ограничения находятся в журнале этапа 1 плана,
CI receipts — в [PR #349](https://github.com/AniDachi/anidachi-LP/pull/349), код исправления `b71b1b91`, принятый staging merge `bcd00c7d`; main остается `4b4ff883`.

Этап 2 согласован отдельно: восстановить нашу шторку аккаунта и ее оформление
из main, сохранив остальные новые элементы шапки. Восстановление общего меню,
responsive-доступа и защиты выхода проверяется отдельным файловым срезом;
остальные строки исходного редизайна остаются открытыми. Приемка этапов 2 и 4A
подтверждена PR #350 (`5a7aa839`) и #352 (`f2567844`). Перед этапом 5A закрыты
16 из 164 исходных файлов: 6 приняты после исправления, 10 возвращены/исключены.
На тот момент остальные 148 требовали завершения проверки. Актуальное состояние
приведено ниже; созданные нами тесты и журнал не увеличивают знаменатель 164.

## Сводка учета на 2026-09-19

Счетчик ниже рассчитан по **164 уникальным путям исходного diff**, а не по числу
коммитов, запусков тестов или всех прочитанных зависимостей. Новые файлы наших
исправлений учитываются отдельно. Исторические цифры в журнале не заменяют эту сводку.

| Состояние | Файлов | Что означает |
| --- | ---: | --- |
| Ранее закрыто на staging / возвращено / исключено | 24 | Прежние точные receipts сохранены; install-email helper теперь отдельно учтен как удаленный локально. |
| Проверено локально | 62 | 13 ранее принятых локальных файлов и 49 SEO-потребителей после L04; доставка и приемка staging записываются в PR этого блока. |
| Проверено по diff | 67 | Исходные изменения и назначение просмотрены, результат записан для каждого файла; границы проверки в L03. |
| Открытые замечания исходного review | 0 | F15–F18 устранены в L04; остальные решения и исключения сохранены. |
| Проверено; оставлено владельцем | 9 | Аналитика, счетчик и CRM прочитаны; сохраняются по решению владельца, без внешней/продуктовой приемки. |
| Исключено локально | 2 | Install email endpoint и ненужный lead helper удалены; до публикации удаления staging может содержать прежнюю функцию. |
| **Всего рассмотрено** | **164** | **Непросмотренных строк: 0.** Это не статус готовности всех страниц к production. |

История в личном кабинете закрыта: исходный diff форматирующий, отдельные 37
тестов редактора прошли, действующие API/алгоритмы не меняются. Email-ссылка
исключена по решению владельца; задачи 4B/4C отменены, а не «успешно реализованы».
Публикация локальных изменений, финальная приемка кандидата и hosted ZIP остаются
отдельными этапами. «Принято на staging» относится к указанному историческому SHA,
а не к свежей проверке развернутого сайта 2026-09-19.

После следующих исправлений обновлять затронутые строки и эту сводку вместе.
Не повторять уже закрытый review без нового изменения или конкретного основания.

| Группа | Проверка |
| --- | --- |
| E | Extension: runtime, channels, разрешения, совместимость старого ZIP |
| S | Shared UI: CSS/tokens/layout/Button и все классы его потребителей |
| A | Account/auth/billing UI: доступ, черновики, owner isolation, ошибки, переходы |
| I | Install: ZIP/API/room next, отсутствие ложной готовности; presence исключен |
| F | Forms/CRM/retired routes: атомарность, failures, злоупотребления, старые ссылки |
| T | Telemetry: события не блокируют действие; нет лишних PII/дублей/ложного успеха |
| C | Content/SEO: ссылки, действия, metadata/schema, честные обещания, Terms/Privacy |
| D | Docs/config/tooling: правила не противоречат коду, CI/scripts/env без секретов |

Для S/A/E/I/F обязателен анализ исполняемого поведения; `git diff -w` и зеленые
старые тесты сами по себе не являются приемкой. Для C можно объединять одинаковые
шаблонные проверки, но URL, CTA и metadata сверяются для каждого затронутого файла.
Для D не запускать runtime suites без причины; инструкция/удаленный тест не должны
незаметно ослаблять gate. Группы задают маршрут ревью, а не доказывают уровень риска.

| Статус | Git | Группа | Файл | Замечания / доказательство приемки |
| --- | --- | --- | --- | --- |
| проверено по diff | M | D | `.cursor/agents/anidachi-seo-aeo-pages.md` | L03: Правила SEO переведены с early access на установку и действующий MVP; это инструкция автора, не runtime. Будущий Async отделен от текущего продукта. |
| проверено по diff | M | D | `.cursor/scratchpad.md` | L03: Исторические заметки разработчика; не импортируются приложением и не являются источником текущих требований. |
| возвращено к main | A | E | `apps/extension/.keys/README.md` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | E | `apps/extension/AGENTS.md` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | A | E | `apps/extension/entrypoints/site-presence.content.ts` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | E | `apps/extension/src/popup-app.tsx` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | E | `apps/extension/src/popup-styles.ts` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | A | E | `apps/extension/src/site-presence.ts` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| проверено по diff | M | D | `apps/web/.env.example` | L03: Один HTTPS ZIP source и metadata после #351; публичные analytics placeholders. Исполняемого кода и новых секретов нет; реальные env не проверялись и не менялись. |
| проверено по diff | M | A | `apps/web/app/account/account.css` | L03: Удалены только стили старой referral-карточки; layout редактора истории не переписан. |
| проверено по diff | M | A | `apps/web/app/account/help/page.tsx` | L03: Ссылка установки ведет на /extension вместо watch-party-starter; остальное форматирование. Help и bug report сохранены. |
| проверено по diff | M | A | `apps/web/app/account/profile/page.tsx` | L03: Убраны загрузка waitlist status и передача старого prop; профиль/auth API не изменены. |
| проверено по diff | M | A | `apps/web/app/account/profile/profile-client.tsx` | L03: Убраны waitlist prop/type/card, остальное форматирование. Owner isolation и dirty guards сохранены; профильные тесты входят в web suite. Ручной Cancel ранее принят в #350. |
| проверено по diff | M | A | `apps/web/app/account/profile/profile.css` | L03: Форматирование прежних правил/значений, без смены поведения профиля. |
| проверено по diff | M | A | `apps/web/app/account/watch-library/watch-library-client.test.tsx` | L03: Форматирование, кавычки и числовая запись; сценарии не вырезаны. Все 37 тестов пройдены отдельной командой: этот .tsx не входит в lib/**/*.test.ts. |
| проверено по diff | M | A | `apps/web/app/account/watch-library/watch-library-client.tsx` | L03: Сравнение большого diff подтвердило форматирование, а не изменение алгоритмов. 37 тестов реального редактора пройдены отдельно; прежняя browser-приемка выбора сезона, Resume, Cancel и guards сохраняется. История закрыта. |
| проверено по diff | A | S | `apps/web/app/ani-tokens.css` | L03: Добавлена общая темная/кремовая палитра; потребители globals/layout/Button и принятые UI проверены. Это глобальные стили, а не изменение прав или API. |
| принято на staging | A | I | `apps/web/app/api/extension/download/route.ts` | PR #351, merge `876b9e94`: только настроенный HTTPS URL; GET/HEAD проверены локально и на staging. F07: фактическая публикация/bytes остаются этапу 6. |
| исключено локально | A | I | `apps/web/app/api/extension/email-install-link/route.ts` | L03: По подтвержденному решению владельца отправка install email исключена целиком. Route удален локально; вместо доработки F10/F11 — отсутствие отправки. Shared CRM/Gmail и данные не затронуты. |
| принято на staging | A | I | `apps/web/app/api/extension/latest/route.ts` | PR #351, merge `876b9e94`: общий resolver, no-store, публичные поля сохранены; реальный GET принят на staging. |
| проверено по diff | D | F | `apps/web/app/api/subscribe-interest/route.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/app/api/waitlist-position/route.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | M | F | `apps/web/app/api/waitlist-stats/route.ts` | L03: Читает новый public-signup-count вместо старой survey статистики. Счетчик оставлен по решению владельца, внешняя CRM/count сверка не проводилась. |
| проверено по diff | D | F | `apps/web/app/api/waitlist/join/route.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено локально | M | C | `apps/web/app/compare/anidachi-vs-crunchyroll-party/page.tsx` | L03: Полный diff/FAQ/schema прочитан; live/personal/future Async коррекция принята #354. Утверждения о конкуренте не подтверждены только чтением кода (F15). |
| проверено по diff | M | C | `apps/web/app/contact/page.tsx` | L03: Переоформлена страница контактов, форма/каналы обращения сохранены. |
| проверено локально | M | C | `apps/web/app/editorial-policy/page.tsx` | L03: Тексты installation/upgrade и будущего Async; нет нового runtime. Точность внешних маркетинговых/редакционных утверждений ограничена source review (F15). |
| проверено локально | A | I | `apps/web/app/extension/page.tsx` | L01: полный локальный installation-page review; видимые шаги и HowTo JSON-LD согласованы, manifest.json оставлен одной технической подсказкой. Typecheck и браузерная проверка passed. Snapshot L01 ниже; локальные исправления еще не приняты на staging, публикация ZIP отдельна. |
| проверено по diff | M | C | `apps/web/app/feature-requests/page.tsx` | L03: Обновлено оформление страницы; существующая форма и ее endpoint сохранены. |
| проверено по diff | M | S | `apps/web/app/globals.css` | L03: Подключены токены, нейтральное оформление SEO, убрана animated border; shell/account/demo использованы как потребители. Предыдущие визуальные receipts сохраняются; новый полный pixel-аудит не выполнялся. |
| проверено локально | M | C | `apps/web/app/guides/best-anime-to-watch-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/best-apps-to-watch-youtube-together/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/best-way-to-watch-youtube-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/can-you-screen-share-youtube-on-discord/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/crunchyroll-party-alternative/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/crunchyroll-watch-party-chrome-extension/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/does-teleparty-work-with-youtube/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/does-youtube-have-watch-party/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-create-an-anime-watch-party/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-host-a-crunchyroll-watch-party/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-run-an-online-anime-club/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-anime-long-distance/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-anime-with-a-group/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-anime-with-friends-in-different-time-zones/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-anime-with-friends-on-discord/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-anime-with-friends-online/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-anime-without-spoilers/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-crunchyroll-together-without-screen-share/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-crunchyroll-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/how-to-watch-youtube-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/netflix-party-for-crunchyroll/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/netflix-party-for-youtube/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/teleparty-not-working-youtube/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/youtube-group-watch/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/youtube-watch-party-chrome-extension/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/guides/youtube-watch-party-with-discord/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено по diff | D | F | `apps/web/app/join/complete/join-complete-client.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | M | F | `apps/web/app/join/complete/page.tsx` | L03: Завершение старого waitlist заменено redirect на /login; signup/referral данные не удаляются. |
| проверено по diff | D | F | `apps/web/app/join/join-client.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | M | F | `apps/web/app/join/page.tsx` | L03: Старый waitlist URL перенаправляется на /login через permanentRedirect; это не /room invitation API. |
| проверено; оставлено владельцем | M | F | `apps/web/app/kreatli-email-crm/crm-client.tsx` | L03: Historical signups labels и удаление кнопки тестового survey; существующие списки/данные CRM сохранены. Код прочитан; внутреннюю панель оставляем по решению владельца. |
| проверено локально | M | S | `apps/web/app/layout.tsx` | L03: Удален PlanSurveyProvider, подключены токены и data-ani-theme, обновлены metadata/skip link. Auth/session providers не заменены. Общий title template связан с F18. |
| проверено по diff | M | A | `apps/web/app/login/page.tsx` | L03: Изменение оформления входа; auth действия и callback flow не изменены. |
| принято на staging | M | C | `apps/web/app/page.tsx` | PR #360, merge `1542ae14`: полный исходный diff проверен — удален прежний waitlistCount prop, актуальный HomeClient его не принимает. Описание HowTo согласовано с текущим содержанием без жесткого числа шагов; запись личной истории обозначена как Plus/Pro. В браузере пять HowToStep совпадают с видимыми шагами; будущий Async не включен в доступные действия. Typecheck, CI/build и staging receipt записаны ниже. |
| принято на staging | M | C | `apps/web/app/pricing/page.tsx` | PR #353, merge `0616b0b8`: полный diff, metadata/FAQ, ссылки и CTA проверены; web checks, CI/build, deployed desktop/mobile и раскрытие FAQ прошли. |
| проверено локально | M | C | `apps/web/app/privacy/page.tsx` | L03: Продуктовые disclosures приняты #355; в L03 удалены обещания сбора/доставки install email. Contact/feature-request disclosures оставлены. Юридическое заключение не выполнялось. |
| принято на staging | M | I | `apps/web/app/room/[roomId]/extension-check.tsx` | PR #349, merge `bcd00c7d`: нейтральная справка, safe next/mobile copy; 6 client tests, desktop/mobile harness и staging receipts приняты. Join page/API неизменны. |
| проверено по diff | M | C | `apps/web/app/security/page.tsx` | L03: Полный текстовый diff прочитан; scoped disclosures/ссылки приняты #355. Это сверка описания продукта, не новый инфраструктурный penetration test. |
| принято на staging | M | A | `apps/web/app/success/checkout-session-sync.tsx` | PR #356, `ae3cc62a`: приемка завершена, прежний staging pending снят. Полный diff и consumers проверены; 10 focused tests, 658 web tests / 6 skips, typecheck/build, CI и staging smoke passed. Проверены no-session/invalid-session состояния; серверный Stripe-контракт не менялся. Реальный платежный цикл не выполнялся. |
| принято на staging | M | A | `apps/web/app/success/page.tsx` | PR #356, `ae3cc62a`: приемка завершена, прежний staging pending снят. Полный diff, metadata, key session ID, нейтральные next steps и ссылки /extension, /account, /account/billing проверены. Staging без checkout не утверждает новую оплату; invalid session показывает ошибку. Discord form/API/Stripe не менялись. |
| исключено | A | A | `apps/web/app/success/success-install-next.tsx` | Этап 1: удалено после проверки callers; сайт не определяет установку. SuccessInstallNext не был подключен к payment page. |
| проверено по diff | M | C | `apps/web/app/terms/page.tsx` | L03: Изменения текста сверены с текущим MVP; согласованная history поправка принята #354. Код страниц не меняет договор/подписку на сервере; это продуктовая, не юридическая приемка. |
| проверено локально | M | C | `apps/web/app/watch-anime-together/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-crunchyroll-together-long-distance/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-crunchyroll-together/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-fantasy-anime-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-horror-anime-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-mecha-anime-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-party-starter/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-psychological-anime-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-slice-of-life-anime-with-friends/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-youtube-together-long-distance/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch-youtube-together/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено локально | M | C | `apps/web/app/watch/[slug]/page.tsx` | L03: полный diff прочитан; CTA переведен на /extension, проверены ссылки/metadata/HowTo и потребители общего SEO layout. Общие замечания F15–F18 закрыты блоком L04; конкретные симптомы не приписываются автоматически каждой странице. |
| проверено по diff | M | A | `apps/web/components/account/account-overview.tsx` | L03: Удалена старая waitlist-карточка; остальные секции и ссылки кабинета сохранены. |
| проверено по diff | D | A | `apps/web/components/account/account-waitlist-card.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | M | A | `apps/web/components/auth-page-shell.tsx` | L03: Нейтральная тема и композиция auth-страниц; session/OAuth логика не изменена. |
| удалено; принято на staging | M | C | `apps/web/components/chrome-extension-demo-async-overlay.tsx` | PR #360, merge `1542ae14`: согласованное удаление устаревшей демонстрации; единственный потребитель — старый mobile-компонент, также удален. Проверки и границы блока ниже. |
| удалено; принято на staging | M | C | `apps/web/components/chrome-extension-demo-mobile.tsx` | PR #360, merge `1542ae14`: согласованное удаление устаревшей демонстрации; действующих импортов нет, текущие режимы используют новые адаптивные компоненты. Проверки и границы блока ниже. |
| удалено; принято на staging | M | C | `apps/web/components/chrome-extension-demo-overlay.tsx` | PR #360, merge `1542ae14`: согласованное удаление устаревшей демонстрации; использовался только двумя удаленными компонентами. Проверки и границы блока ниже. |
| принято на staging | M | C | `apps/web/components/chrome-extension-demo.tsx` | PR #360, merge `1542ae14`: приняты новые автоматические Live/History/Async, подписи, переключатель и адаптивная композиция. Локальная приемка, CI/build и staging receipt записаны ниже; реальная логика расширения не менялась. |
| проверено по diff | M | C | `apps/web/components/chrome-extension-features.tsx` | L03: Оформление существующих карточек функций; не подключает другой extension runtime. |
| проверено локально | M | C | `apps/web/components/compare-table.tsx` | L03: Полный diff/consumers прочитан; история/Resume исправлены #353. Остальные claims о конкурентах/качестве требуют фактической приемки F15. |
| проверено по diff | M | F | `apps/web/components/contact-form.tsx` | L03: Оформление на новых токенах; POST/body/success/error логика прежняя. Реальное письмо не отправлялось. |
| проверено по diff | M | F | `apps/web/components/discord-credentials-form.tsx` | L03: Визуальные классы и форматирование; submit/validation контракт сохранен. |
| проверено локально | A | I | `apps/web/components/extension-install-hub.tsx` | L01 + L03: инструкция/UI-примеры приняты; email form/state/fetch удалены. Реальный mobile component test подтверждает copy URL с /room/ return, feedback и отсутствие email form. Hosted ZIP остается этапом 6. |
| проверено по diff | M | C | `apps/web/components/faq-section.tsx` | L03: Нейтральная тема и compact-режим; управление раскрытием сохранено. Закрытый homepage FAQ принят в #360. |
| проверено по diff | M | F | `apps/web/components/feature-request-form.tsx` | L03: Оформление формы, прежний обработчик отправки сохранен. Feature request/bug report не удаляются вместе с install email. |
| проверено по diff | M | C | `apps/web/components/footer.tsx` | L03: CTA установки и будущий Async, новые токены/раскладка; destinations сверены. |
| проверено локально | M | C | `apps/web/components/hero.tsx` | L03: Главная CTA ведет на установку, старый survey исключен. В L03 email-обещание заменено копированием ссылки; сам счетчик оставлен по решению владельца. |
| проверено по diff | M | C | `apps/web/components/home-section-header.tsx` | L03: Общие классы заголовка/отступов, без продуктовых действий. |
| проверено по diff | M | C | `apps/web/components/home/home-client.tsx` | L03: Удалена старая waitlist/survey композиция; действующие homepage секции сохранены. Demo/scroll/FAQ приняты в #360; оставшийся исходный diff прочитан. |
| проверено по diff | M | C | `apps/web/components/how-it-works.tsx` | L03: Полный исходный diff свернут в принятые live шаги, личную историю и future Async; UI/тайминги ранее приняты #357–#360. Новой функции Async не добавляет. |
| проверено по diff | M | C | `apps/web/components/join-discord-button.tsx` | L03: Оформление Discord CTA; ссылка и открытие внешнего Discord сохранены. |
| проверено по diff | M | C | `apps/web/components/json-ld.tsx` | L03: Структурированные описания обновлены под установку/будущий Async; не меняет runtime комнат. |
| проверено по diff | M | C | `apps/web/components/main-app-features.tsx` | L03: Карточки описывают live sync, overlay и личную историю вместо прежнего shared/async обещания. |
| принято на staging | M | A | `apps/web/components/nav-bar-client.tsx` | PR #350, merge `5a7aa839`: production UserMenu/CSS, account shortcuts, responsive доступ, cleanup и guarded logout восстановлены. 38 целевых проверок; Space на реальном document-root и ручной Cancel приняты, CI/staging receipts в PR. |
| проверено локально | M | C | `apps/web/components/nav-pricing-button.tsx` | L02: полный diff и Navbar consumer проверены. Кнопка ведет Next Link на /extension; старый survey не открывается, платеж не создается. Отдельная ссылка Pricing сохранена. Локальная приемка не означает staging-проверку всего Navbar. |
| проверено локально | M | C | `apps/web/components/nav-pricing-link.tsx` | L02: полный diff и consumers проверены; обычный переход /extension без survey/preventDefault/payment. Проверены фактические install href в браузере. В этом блоке файл не редактировался. |
| проверено локально | A | C | `apps/web/components/overlay-interface-preview.tsx` | L01, `f9a48059`: реальный InterfaceSettingsPanel в Shadow DOM; только локальное состояние примера, без записи extension settings. Desktop/mobile, переключение и Apply проверены; focused tests/typecheck passed. Staging acceptance pending. |
| проверено локально | A | C | `apps/web/components/overlay-layout-preview.tsx` | L01, `f9a48059`: реальный OverlayLayoutEditor, локальные bounds/preview 1280x720, 4 камеры. Проверены клавиатурное перемещение, Apply и максимальный размер камер; settings не сохраняются в расширение. Staging acceptance pending. |
| проверено локально | A | C | `apps/web/components/overlay-using-mocks.tsx` | L01: реальные Voice/Room defaults/People/reactions и source-aligned статичные элементы. Исправлены видимость пилюли, контейнер иконок, ширина 324px и узкие реакции; в Media seats сохранен Heorhi Talochka. Все 10 примеров проверены локально, без реальных rooms/media/API. Staging acceptance pending. |
| проверено по diff | D | F | `apps/web/components/plan-survey/plan-survey-modal.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/components/plan-survey/plan-survey-provider.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/components/plan-survey/use-plan-survey.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/components/plan-survey/waitlist-referral-card.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/components/pre-purchase-discord-walkthrough.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/components/pricing-survey-link.tsx` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| принято на staging | M | C | `apps/web/components/pricing.tsx` | PR #353, `0616b0b8`: полный diff/consumers проверены, прежний staging pending снят. Исправлены история и обещание цены для 8+; карточки/матрица desktop/mobile приняты. Free CTA /extension, Plus/Pro planCode, checkout и error handling сохранены. Последнее локальное CTA-review повторно подтвердило неизменный платежный путь; новой покупки не выполняли. |
| проверено локально | M | C | `apps/web/components/primary-checkout-cta.tsx` | L02: полный diff/SeoBelowTitleCta consumer проверены; CTA ведет /extension, не запускает checkout. Glossary copy уточнено: longer sessions, more participants, watch history. Web typecheck passed; локальная правка еще не опубликована. |
| проверено локально | M | C | `apps/web/components/responsive-compare-table.tsx` | L03: Оформление responsive-таблицы; данные/claims приходят из compare-table и требуют отдельной фактической приемки F15. |
| проверено локально | M | C | `apps/web/components/seo-guide-blocks.tsx` | L03: Общие типографические компоненты статей; SeoGuideTitle создает h1, что важно для существующего CTA wrapper (F17). |
| проверено локально | M | C | `apps/web/components/seo-page-layout.tsx` | L03: Оформление/общие consumers TOC, CTA, mobile bar; сохранены маршруты. Найдены унаследованные F16/F17, не исправлены этим review. |
| проверено локально | M | C | `apps/web/components/social-proof.tsx` | L03: Маркетинговый текст и оформление locked-rate/социального подтверждения; runtime не меняет. Внешняя достоверность утверждений не подтверждается source review (F15). |
| проверено локально | M | C | `apps/web/components/sticky-mobile-checkout-bar.tsx` | L02: полный diff/SeoPageLayout consumer проверены. Скрытой панели добавлен inert; реальный Tab при 390x844 пропускает ее наверху и достигает кнопки после появления. Переход /extension, typecheck и diff-check passed; staging pending. |
| проверено локально | M | C | `apps/web/components/table-of-contents.tsx` | L03: Изменены визуальные классы. Прежний scroll-before-collapse дает подтвержденное смещение на mobile (F16); ревью закончено, дефект не исправлен. |
| проверено по diff | M | S | `apps/web/components/ui/button.tsx` | L03: Добавлены cream/creamOutline/creamQuiet/control и обновлены общие варианты. Button/Slot и обработчики действий не заменены; consumers и прежние UI receipts проверены. |
| проверено; оставлено владельцем | A | F | `apps/web/components/watching-together-count.tsx` | L03: Источник — waitlist-stats; скрывает нулевой счетчик. Код прочитан, по решению владельца оставлен без изменений; реальная величина аудитории не подтверждалась. |
| проверено; оставлено владельцем | M | T | `apps/web/docs/CONVERSION_METRICS.md` | L03: Документированы install funnel события. Владелец сохраняет аналитику; внешняя настройка/дашборды не проверялись. |
| проверено по diff | M | A | `apps/web/lib/account-profile-client.test.ts` | L03: Убраны waitlist props и форматирование; проверки сохранения/ошибок/owner guards сохранены и проходят в web suite. |
| проверено; оставлено владельцем | A | T | `apps/web/lib/amplitude-ids.ts` | L03: Управляет device cookie/insert UUID для событий; исходник/consumers проверены, реальные visitor IDs не читались. |
| проверено; оставлено владельцем | A | T | `apps/web/lib/amplitude-server.ts` | L03: Серверная отправка HTTP API с device/IP/UA и контролируемыми network failures. malformed cookie может прервать after callback, а не основной redirect; отмечено в ограничениях L03. Внешняя доставка не проверялась. |
| проверено; оставлено владельцем | M | T | `apps/web/lib/amplitude.ts` | L03: Browser SDK, сохранение device cookie, insert ID и flush; бизнес API не заменяются. Dashboard/consent policy этим review не приняты. |
| проверено; оставлено владельцем | M | T | `apps/web/lib/conversion-events.ts` | L03: Install events и page template типы; в L03 удалено только событие desktop_install_link_emailed. Остальная аналитика оставлена согласно решению владельца. |
| принято на staging | A | I | `apps/web/lib/extension-artifact.ts` | PR #351, merge `876b9e94`: один URL, 19 focused/compatibility tests, CI/review/smoke passed. Hosted bytes — этап 6. |
| проверено локально | A | I | `apps/web/lib/extension-install-faq.ts` | L01: общий FAQ для UI/JSON-LD проверен; отключенное расширение предлагается включить обратно, после обновления — обновить страницы видео. CWS-текст оставлен по решению владельца, это не подтверждение подачи в Store. Браузер/typecheck passed, staging pending. |
| исключено | A | I | `apps/web/lib/extension-presence.ts` | Этап 1: удалено после проверки callers; сайт не определяет установку. SuccessInstallNext не был подключен к payment page. |
| проверено локально | A | C | `apps/web/lib/extension-using-guide.ts` | L01, `f9a48059`: шаг 6 объясняет Enter для открытия поля и отправки сообщения; следующие шаги перенумерованы 7–10 и согласованы с реальными примерами. Браузер и focused tests/typecheck passed; staging pending. |
| проверено по diff | M | C | `apps/web/lib/founder-discord.ts` | L03: Изменен комментарий; URL и исполнение не меняются. |
| проверено; оставлено владельцем | M | T | `apps/web/lib/gtag.ts` | L03: Google Analytics и Amplitude вызываются независимо; ошибка отсутствия GA не должна отменять основной пользовательский переход. Внешние события не отправлялись. |
| проверено по diff | M | C | `apps/web/lib/home-faq.ts` | L03: FAQ приведен к live/личной истории и future Async; вход/установка/оплата не меняются. |
| проверено по diff | M | F | `apps/web/lib/home-survey.ts` | L03: Удалены UI-тексты старого опроса; типы и выбор рекомендованного тарифа сохранены для исторической CRM. |
| проверено по diff | A | I | `apps/web/lib/install-cta.ts` | L03: Общие CTA/путь установки и sanitizer next только для /room/; произвольные внешние redirect не допускаются. CWS copy сохранено по решению владельца. |
| проверено по diff | M | C | `apps/web/lib/internal-tool-routes.test.ts` | L03: Удаленный survey API заменен в проверке действующим internal route; тесты проходят, защита внутренних инструментов не отменена. |
| исключено локально | A | F | `apps/web/lib/kreatli-crm/desktop-install-lead.ts` | L03: Удален локально вместе с единственным caller install email. Историческая приемка CAS в #352 остается фактом, но helper больше не нужен. Существующие контакты сохранены. |
| проверено по diff | M | F | `apps/web/lib/kreatli-crm/feature-request-shared.ts` | L03: Изменен комментарий; прием и сохранение обращений не меняются. |
| проверено; оставлено владельцем | A | F | `apps/web/lib/kreatli-crm/public-signup-count.ts` | L03: Читает CRM leads; пустой local/non-Vercel fallback, production storage отдельно. Схема/данные не менялись; владелец отложил продуктовую приемку счетчика. |
| проверено по diff | D | F | `apps/web/lib/kreatli-crm/subscribe-interest-route.test.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/lib/kreatli-crm/subscribe-interest-route.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | M | F | `apps/web/lib/kreatli-crm/survey-lead-shared.test.ts` | L03: Тесты приведены к сохраненным historical lead helpers; удаленные signup handlers выведены из продукта, а не замаскированы пропуском тестов. |
| проверено по diff | M | F | `apps/web/lib/kreatli-crm/survey-lead-shared.ts` | L03: Удалены waitlist position/referral helpers; исторические leads/list/count/export сохранены. Поиск runtime-импортов и tests подтверждает оставшихся потребителей. |
| проверено по diff | D | F | `apps/web/lib/kreatli-crm/survey-lead.test.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/lib/kreatli-crm/survey-lead.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/lib/kreatli-crm/waitlist-join-route.test.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | D | F | `apps/web/lib/kreatli-crm/waitlist-join-route.ts` | L03: удален старый waitlist/survey UI, handler или его тест. Действующих imports/callers не найдено; /join и /join/complete ведут на login. Исторические CRM данные не удаляются; runtime/account проверки проходят. |
| проверено по diff | M | C | `apps/web/lib/middleware-routes.test.ts` | L03: Добавлена проверка публичного /extension; auth/staging gate код не ослаблен. |
| проверено локально | M | C | `apps/web/lib/pricing-copy.ts` | L03: Полный diff/потребители прочитаны; history/cancel/8+ corrections приняты #353. Остальные внешние comparison/marketing claims оставлены в F15, не объявлены подтвержденными. |
| проверено по diff | M | C | `apps/web/lib/pricing-tiers.ts` | L03: Матрица сверена с каноническими plan limits и history policy; цены сохранены, будущий Async отделен. Pricing tests проходят, F12 принят #353; новые entitlements не вводятся. |
| проверено по diff | M | C | `apps/web/lib/sitemap-discovery.ts` | L03: /extension исключен из discovery как noindex utility page, SEO маршруты сохранены; sitemap tests проходят. |
| проверено по diff | A | S | `apps/web/lib/use-in-view.ts` | L03: IntersectionObserver для включения декораций в видимой области, cleanup наблюдателя и локальное состояние; нет сетевых/продуктовых записей. |
| проверено локально | M | C | `apps/web/lib/watch-page-rich-content.ts` | L03: Общие HowTo переводят пользователя к /extension и установке; структурированный контент потребляется watch-страницами. Общая согласованность SEO обещаний отмечена F15. |
| проверено по diff | M | D | `docs/environment-and-secrets-matrix.md` | L03: Описаны ZIP source/metadata, публичный ключ identity и analytics env. После #351 нет поиска ZIP по папкам; документация не доказывает настройку облачных env. |
| возвращено к main | M | D | `package.json` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | I | `scripts/validate-extension-artifact.mjs` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |

## Дополнительный срез этапа 2

Runtime commit `185ac1ae`; база `bcd00c7d`. Эти файлы и потребители проверяются
в дополнение к исходному реестру 164 файлов. Остальные открытые строки не приняты.

| Файл / потребитель | Что проверено |
| --- | --- |
| `components/account-menu.tsx` | Восстановлен прежний потребитель. Единственная правка общего меню — синхронный in-flight guard и одноразовый callback: тесты воспроизвели повторные запросы и подтвердили исправление, включая ошибку и повторную попытку. |
| `components/account-menu.css` | Byte-identical с main `4b4ff883`; новый дизайн меню не добавлялся. |
| `app/account/layout.tsx` | Прежний импорт `UserMenu` из navbar теперь получает общий компонент через совместимый re-export. Сам layout не изменен. |
| `app/account/profile/profile-client.tsx` | Native confirmation несохраненного профиля снова перехватывает выход; отказ не вызывает logout. PATCH/API не изменены. |
| `app/account/watch-library/history-browser.tsx` | Настоящий редактор проверен вместе с меню: Stay / Discard / Save & leave, ожидание успешного Save и сохранение черновика при ошибке. Алгоритмы и endpoints не изменены. |
| `lib/use-body-scroll-lock.ts` | Hook не изменен; navbar закрывает drawer при переходе на desktop, route change, Escape и unmount. Проверено освобождение wheel/touch/key, а не только CSS display. |
| `lib/account-menu-client.test.ts`, `lib/nav-bar-client.test.ts`, `lib/test-helpers/account-client-dom.ts` | 34 целевые проверки реальных компонентов; DOM harness не выдается за пиксельную/браузерную приемку. |

Полный web suite: 617 passed, 6 skipped, 0 failed; typecheck и Next build passed.
`pnpm dev:check` — web/docs profiles. Фактический staging SHA, review и ручные
проверки записываются в PR этого блока. Production promotion не выполняется.

Повторное ревью выявило и проверило исправление Space activation при открытом
drawer (`20dc0692`); scroll-lock hook и CSS не меняются. Итоговые проверки:
36/36 целевых, полный web suite 619 passed / 6 skipped, web check и Next build
passed. Блокирующих замечаний повторного ревью нет; браузерная приемка pending.

Браузерная проверка preview дополнила этот результат: повторный Space оставался
заблокирован при React delegation на `document`. В `4aa7d2dd` исправлен порядок
native listeners; новые document-root тесты сначала падали, итог 38/38 и web check
passed. Повторное ревью без замечаний; точный head и окончательная приемка в #350.

## Главная страница: принято на staging, 2026-09-19

Владелец принял накопленные изменения в ветке `codex/demo-room-first-scene`,
затем согласовал перенос всего блока на staging. [PR #360](https://github.com/AniDachi/anidachi-LP/pull/360)
слит как `1542ae14ad0463ec71136521a694c09abab6e14c`; дерево слияния точно совпало
с проверенным head `a3e97b9c`. Перечисленный ниже блок закрыт как проверенный
и принятый на staging. Это не приемка всех файлов главной страницы или всего
редизайна. Старые статусы остальных строк не являются актуальным счетчиком всей
выполненной работы; их приемка требует собственных доказательств.

Vercel deployment `dpl_4sf9o13LbcwJWCC4EtbNcZJVRVwf` — Ready, alias
`staging.anidachi.app` подтвержден. CI `35430609678` / `35430611356` и
post-deploy Staging Smoke `35430718334` прошли. На развернутой странице
подтверждены три режима, описание истории, закрытый FAQ и загрузка видео без
ошибок. Повторный прогон адаптивности не выполнялся по просьбе владельца;
сохраняется локальная приемка ниже. Main остается `4b4ff883`, promotion #347
без auto-merge; production не входит в этот статус.

| Срез | Принятый результат / проверка |
| --- | --- |
| `components/chrome-extension-demo.tsx`, `chrome-extension-room-demo.*`, `chrome-extension-async-demo.*`, `chrome-extension-async-scene.tsx`, `chrome-extension-history-demo.*` | Автоматические Live, History и будущий Async; общий адаптивный плеер, согласованные подписи/имена, приглашение по ссылке и через друзей, сообщения/реакции/микрофон, плавное изменение расположения, история в отдельном меню Chrome. Вымышленные данные; нет вызовов room/history/auth API, доступа к камере, микрофону или буферу обмена. |
| `lib/use-room-demo.*`, `use-async-demo.*`, `use-history-demo.*` | Проверены последовательности, тайминги, cleanup таймеров, остановка вне видимой области и reduced motion. |
| `components/home/home-client.tsx`, `home-sections.module.css`, `lib/home-scroll-assist.*`, `use-home-scroll-assist.*` | Мягкая помощь после остановки колесика рядом с началом раздела. Длинный раздел подтягивается только при движении вниз; внутри него свободная прокрутка. Новое действие отменяет анимацию; мобильная ширина/reduced motion отключают помощь, unmount убирает обработчики. FAQ закрыт по умолчанию. |
| `components/how-it-works.tsx` | После Watch together добавлен шаг 5 про личную историю Plus/Pro, Resume через меню Chrome и управление в кабинете; Async остается будущим шагом 6. |
| `public/demo/anidachi-demo-background*`, `public/demo/cameras/*`, оба `CREDITS.md` | Локальные согласованные видео/постеры; источники и лицензии записаны рядом. Это материалы иллюстрации, не записи пользователей. |

Перед фиксацией повторены web typecheck и весь web suite: **682 passed,
6 skipped, 0 failed**. `pnpm dev:check` выполнен; профиль rooms срабатывает
на названии `room-demo`, но это иллюстрация сайта. `git diff 4b4ff883 --
apps/extension apps/api packages/protocol` пустой; room/P2P harness и сборка
расширения для этого блока не повторяются. Проверки браузера: desktop 1280x720,
mobile 390x844, ручное раскрытие FAQ, длинный блок тарифов, три режима демо;
ошибок страницы не обнаружено. Production build выполнен Vercel при публикации
PR; последующая развернутая приемка staging завершена, результаты указаны выше.

Graphify использован для навигации; связи перепроверены импортами. Полный refresh
семантического графа после локальных итераций остается отложен согласно решению
владельца в основном плане. Блок не объявляет принятыми остальные файлы редизайна.
Откат — отдельный revert PR #360 в staging; продуктовых миграций и env-изменений нет.

### Удаление неиспользуемой старой демонстрации, 2026-09-19

После отдельного согласования удалены только три компонента
`chrome-extension-demo-mobile.tsx`, `chrome-extension-demo-overlay.tsx` и
`chrome-extension-demo-async-overlay.tsx`. Повторный поиск импортов в runtime,
скриптах и тестах подтвердил изолированную цепочку: mobile импортировал оба
overlay, async-overlay импортировал overlay; внешних потребителей не осталось.
Текущий `chrome-extension-demo.tsx` использует новые Live / History / Async.
Изображения и видео не удалялись. Превью `overlay-using-mocks`,
`overlay-interface-preview` и `overlay-layout-preview` сохранены: они нужны
странице установки расширения.

После удаления: web typecheck passed, полный web suite **682 passed,
6 skipped, 0 failed**, `git diff --check` passed. На локальном `4198` после
перезагрузки проверены Live, History, Async и возврат в Live; новые сцены
отображаются, видео загружено (`readyState = 4`, media error отсутствует).
Ошибок browser console не обнаружено; есть предупреждение Next.js о будущем
поведении `scroll-behavior`, не связанное с удаленными компонентами. Страница
установки также открывается со своими превью. После этой локальной проверки
удаление принято на staging вместе с PR #360; CI/build и deployment receipt
указаны выше. Graphify refresh остается отложен вместе с общим блоком.
Откат удаления отдельно от остальных изменений — revert коммита `a3e97b9c`
через PR в staging.

## Сверка пропущенных staging receipts, 2026-09-19

Это восстановление учета уже выполненной работы, а не новые проверки runtime.
Данные PR прочитаны повторно; их merge-коммиты присутствуют в истории текущей ветки.

| Источник | Результат, перенесенный в строки реестра |
| --- | --- |
| [PR #353](https://github.com/AniDachi/anidachi-LP/pull/353), `0616b0b8` | `pricing.tsx` закрыт: полный diff/consumers и staging rendering проверены. У `pricing-copy.ts`, `pricing-tiers.ts`, `compare-table.tsx` снято ошибочное ожидание deployment, но непроверенные claims оставлены открытыми. |
| [PR #354](https://github.com/AniDachi/anidachi-LP/pull/354), `24b96de8` | Исправления Terms и Crunchyroll Party comparison приняты: web checks, CI, metadata/FAQ, desktop/mobile и staging smoke. Остальные claims и юридическая приемка не закрыты. |
| [PR #355](https://github.com/AniDachi/anidachi-LP/pull/355), `6725afb2` | Приняты конкретные disclosures Privacy/Security и skip-link Privacy; typecheck, CI, preview/staging, Tab/Enter прошли. Полная приемка исходных страниц не приписывается узкому PR. |
| [PR #356](https://github.com/AniDachi/anidachi-LP/pull/356), `ae3cc62a` | Оба success-page файла закрыты; 10 focused tests, полный web suite 658 passed / 6 skips, build/typecheck, CI и staging acceptance. No-session и invalid-session не показывают ложный успех; реальный платежный цикл отдельно. |

## Локальные проверки L01/L02, 2026-09-19

**L01 — инструкция установки и реальные UI-примеры.** База `1542ae14`, локальный
коммит `f9a48059` и последующие согласованные визуальные/текстовые исправления.
Полный web suite перед визуальной доработкой: 684 passed / 6 existing skips;
после нее — 8 focused tests и web typecheck passed. Повторять полный suite после
каждой статичной строки не требовалось. Все 10 примеров просмотрены; desktop,
390px и 360px, Enter, клавиатурный Layout/Apply, предел размера камер и отсутствие
горизонтального overflow проверены. Исправлены пропавшая пилюля, контейнер иконок,
растяжение и узкие реакции. Пользователь принял вид и продолжение работ; в одном
примере возвращено имя Heorhi Talochka. Упоминание manifest.json оставлено одной
подсказкой, видимые шаги/HowTo JSON-LD согласованы. FAQ объясняет повторное включение
расширения и обновление уже открытых видеостраниц после установки новой версии.

Реальные standalone-компоненты используются в Shadow DOM; учебное состояние
локальное. Настоящие rooms/auth/history API, media capture и настройки расширения
не меняются. На момент L01 email-ветка не входила в приемку; позже она исключена в L03 по решению владельца.
Фактическая публичная выдача ZIP — этап 6. Сохраненный CWS-текст отражает решение
владельца, а не состоявшуюся подачу в Store.

**L02 — четыре общих install CTA.** Полный исходный diff четырех строк с L02
прочитан; проверены Navbar, SeoBelowTitleCta и SeoPageLayout как потребители.
Install-ссылки ведут на `/extension`, Pricing остается отдельным маршрутом.
`Pricing.handleSubscribe` сверялся с main: endpoint/body/planCode, login/error
handling и Stripe redirect сохранены, удалены прежние survey analytics fields.
Это не полная приемка SEO-шаблона и всех статей.

На локальной `/guides/how-to-watch-youtube-with-friends` проверены шесть install
href и переход на `/extension`. При 390×844 sticky CTA появляется после прокрутки;
после согласованного добавления `inert={!visible}` скрытая панель исключена из Tab.
Реальный Tab от последнего FAQ при возвращении наверх проходит к футеру, минуя
скрытую кнопку; после появления кнопка снова доступна. Glossary copy теперь
упоминает время, участников и историю. Typecheck и diff-check прошли. Платежи,
отправка писем и запись пользовательских данных не выполнялись.

### Точный локальный снимок

Снимок 11 исходных файлов L01/L02: 10 локально проверенных и частичный install hub.
SHA-256 позволяет увидеть последующие изменения, не перенося старую проверку на
новое содержимое. В этот снимок не входят документы и граф. Дальнейший commit/PR
должен ссылаться на эти результаты и проверять свой delta; staging пока не выполнен.

| Исходный файл | SHA-256 |
| --- | --- |
| `apps/web/app/extension/page.tsx` | `13d1f8132c694f5ee9dcdb977d9025fb57fad266064a0a3c79c419353721fcba` |
| `apps/web/components/extension-install-hub.tsx` | `79e101160401ebab54fbb33e3391a8aa4e570ffbea66aaa84458ce1bc75dfd41` |
| `apps/web/components/nav-pricing-button.tsx` | `962c837ba5cc8d2951ed599104f18d3a12fd4e14f438df052f70165a922516fa` |
| `apps/web/components/nav-pricing-link.tsx` | `53e52a84827bd6bcfe5d116316562d488755dfd416f6ff71c675e39c31319a0a` |
| `apps/web/components/overlay-interface-preview.tsx` | `98c0b3a58766642b9f25119f00a931b3eb08523ac41e18a61b5bfedebc38e670` |
| `apps/web/components/overlay-layout-preview.tsx` | `68c2c34ab5564f8c77ec1b915e6b1c5b9570b5ff2ccb330844ce6e5e34233218` |
| `apps/web/components/overlay-using-mocks.tsx` | `96cddd6a1aac1593efdc521c6e439a435e700f2749bb33c9809689cb6286e586` |
| `apps/web/components/primary-checkout-cta.tsx` | `e2f8ca5eb9018975d036efbf3bb6ae0a2838291592895730355d854e9f3ad2db` |
| `apps/web/components/sticky-mobile-checkout-bar.tsx` | `fc9b51dfa9d78dbd17e60c5236471ea321759510d3d795c51de4859a6b92b658` |
| `apps/web/lib/extension-install-faq.ts` | `3e833344ef2732f25d197fba07b064df20fba12d98999fc0d3d2499b67e92c5f` |
| `apps/web/lib/extension-using-guide.ts` | `1a02c1643366470f3625eba20d2286fb8f95dcbed2640efcdd38aab37d47a3cb` |

### Дополнительные файлы наших исправлений

Не увеличивают знаменатель 164 и не подменяют исходные строки реестра:

| Файл | Проверка |
| --- | --- |
| `apps/web/components/extension-example-frame.tsx` | L01: изоляция real extension styles через Shadow DOM, нативная ширина и компактный composer; локальный DOM/browser review и typecheck. |
| `apps/web/lib/extension-using-examples.test.ts` | L01: проверки доступности примеров и локального состояния без сохранения extension preferences. Входит в recorded 8 focused tests. |
| `apps/web/types/extension-preview.d.ts` | L01: типизация импорта CSS для примеров; web typecheck прошел. |

Graphify: AST обновлялся после локальных code-only правок. Эта сверка меняет
только статусы и доказательства; semantic refresh не выполняется по уже
согласованному исключению для небольших записей учета в основном плане.
Существующие dirty graph artifacts сохранены, их актуальность по этой записи
не заявляется. Runtime tests/build/browser не повторяются ради обновления реестра.
Локальные изменения не опубликованы; push/merge/deploy в этом блоке не выполняются.

Следующая проверка: SEO-статьи и общий шаблон небольшими блоками; сначала review
и объяснение конкретных находок, затем отдельное согласование правок. Полностью
закрытые файлы не начинать заново без нового diff или обнаруженной зависимости.

## L03 — завершение прохода и исключение install email, 2026-09-19

По просьбе владельца завершен быстрый исходный diff-review оставшихся 129 строк:
сопоставлены `4b4ff883` → `391fb5c9` и текущая локальная версия после принятых fixes.
Статусы исходных 164 путей теперь отражают реальные результаты, включая удаленные
файлы. Ранее принятые UI-блоки повторно не переделывались. Новые runtime-правки
ограничены удалением отправки installation link по email, ее отдельного helper,
события, UI/Privacy/Hero текстов и добавлением целевого mobile component test.
Общие CRM/Gmail/contact/feature-request функции и уже сохраненные данные не менялись.

Доказательства текущего локального среза:

- Web typecheck passed; основной suite: **674 passed / 6 skipped / 0 failed**.
  Снижение против прежних receipts включает удаленные тесты выведенного install
  lead helper; оно не означает пропуск действующих сценариев.
- Отдельный `watch-library-client.test.tsx`: **37 passed / 0 failed**; основной
  `lib/**/*.test.ts` этот файл не включает. Проверены реальные компоненты редактора,
  owner isolation, черновики/сохранение/отмена, Free Resume, выбор и вместимость.
- Install compatibility: **7 passed / 0 failed**. Новый тест сначала воспроизвел
  оставшуюся email form, затем прошел после удаления; copy сохраняет room next и
  показывает обратную связь. Fetch в тесте запрещен. Native share не выполнялся.
- Поиск удаленных imports/callers не нашел действующих ссылок на старые survey
  handlers/компоненты и install-email runtime. Отрицательный тест оставляет только
  ожидаемую строку несуществующей email-кнопки.
- Отдельное read-only ревью email delta не обнаружило замечаний; проверяло отличие
  от снимка перед изменением, сохраняя ранее существовавший локальный WIP.
- `apps/extension`, `apps/api`, `packages/protocol`, root `package.json` и extension
  validator совпадают с защищенной main-базой `4b4ff883`. Их сборки/медиа-harness
  для удаления формы сайта не повторялись.

Логи и hashes текущих файлов находятся в игнорируемом каталоге
`.superpowers/sdd/2026-09-15-staging-release-repair-plan/closeout-2026-09-19/`:
`email-red.log`, `email-green.log`, `web-check.log`, `web-tests.log`,
`watch-library-tests.log`, `reviewed-files.json`, `before-hashes.json`.
Перед правкой сохранен точный снимок затронутых source/test файлов для сравнения.

### Оставшиеся замечания, не замаскированные закрытием файлов

| ID | Подтвержденное наблюдение | Граница дальнейшей работы |
| --- | --- | --- |
| F15 | В SEO-статьях остаются унаследованные обещания доступного Async в metadata/FAQ/HowTo/тексте. Пример: `/guides/how-to-watch-youtube-with-friends`; там же слишком широкое «YouTube does not ship a native watch party». Comparison/marketing claims нельзя подтвердить только исходниками. | Отдельно согласовать короткую правку согласованности текстов; недоступный Async обозначить будущим. Не менять сохраненный по решению владельца CWS-текст. Факты о внешних сервисах сверять с первоисточниками. |
| F16 | Mobile Contents считает позицию до закрытия раскрытого оглавления. На 390×844 после перехода к Step-by-step цель была на −115 px при нижней границе header 69 px. Логика уже была в main. | Исправить только порядок закрытия/измерения и проверить раскрытый mobile TOC; это не ошибка auto-centering главной. |
| F17 | `SeoBelowTitleCta` ищет буквальный h1; страница использует `SeoGuideTitle`. Fallback вставляет CTA между Short Answer и ответом; подтверждено desktop/mobile. Сам helper не входит в исходные 164 файла и не менялся. | Отдельно поправить размещение общего CTA, не переоформляя принятую кнопку. |
| F18 | Заголовок статьи уже содержит AniDachi, а корневой template добавляет бренд повторно. На проверенном URL title содержит `AniDachi` дважды; унаследовано из main. | Убрать дублирование в SEO metadata; URL/canonical сохранить. |

F15–F18 — общий небольшой SEO-блок, а не 49 независимых redesign задач. Строки
статей с замечаниями показывают область влияния общих шаблонов; они не утверждают,
что все четыре симптома воспроизведены на каждом URL. В этом проходе код этих
замечаний не исправлялся. В аналитике прочитан путь исключений: malformed cookie
может сорвать только отложенный analytics callback; по решению владельца код
аналитики не меняется и end-to-end доставка/consent аудит не объявляются пройденными.
Юридические документы проверены на согласованность продукта, а не как заключение юриста.

Новые browser/build/staging/production проверки не приписываются этому быстрому
проходу. Сохраняются предыдущие scoped visual receipts; внешний CRM, платежи,
комнаты, контакты и подписки не изменялись. Push/PR/merge/deploy/публикации ZIP нет.
Graph artifacts сохранены без изменений; общий semantic refresh остается
отложенным согласно действующему исключению плана и не объявляется выполненным.
Откат L03 — обратный scoped diff формы/route/helper/copy/test; он не должен
откатывать ранее существовавшие правки инструкции, CTA и graph artifacts.

## L04 — закрытие замечаний и доставка в staging, 2026-09-19

Владелец согласовал закрыть review второго разработчика и привести staging в
чистое состояние; PostHog обсуждается после этого, main/production отдельно.

- **F15:** в затронутых SEO-страницах/общем генераторе FAQ и HowTo убраны обещания
  доступного Async, сохраненных реакций, общей истории и несуществующих episode
  pins/threads/автоматической защиты от спойлеров. Текущий продукт описан как
  live-комнаты и личная история на Plus/Pro; Async явно запланирован. Исправлены
  отдельные утверждения о YouTube SharePlay и Premium-хосте Crunchyroll в Teleparty.
  Источники: [YouTube](https://support.google.com/youtube/answer/13323543?hl=en),
  [Teleparty](https://ww1.teleparty.com/support), [Watch2Gether](https://w2g.tv/en/).
  Это ограниченный проход по исходным измененным страницам, не аудит всего старого SEO-корпуса.
- **F16:** мобильное Contents сначала сворачивается, затем измеряется позиция цели.
  Реальный компонентный тест воспроизвел 812 вместо 612 до исправления и прошел
  после него; в браузере заголовок после перехода находится на 88 px от верха.
- **F17:** SeoBelowTitleCta распознает SeoGuideTitle/SeoGuideAnswer и ставит install
  CTA после полного Short Answer; сохранен вариант старого h1/intro/date.
- **F18:** браузерный title получает бренд один раз через корневой template.
  Canonical и URL сохранены. Проверен реальный заголовок YouTube guide.
- Три новых поведенческих теста прошли, web typecheck и 677 тестов прошли
  (6 существующих skips). Независимое ревью нашло остаточные устаревшие инструкции;
  они исправлены. В коде install/email/TOC/CTA новых регрессий не найдено.
- Сохраняются L01–L03: согласованные примеры настоящего интерфейса в install guide,
  копирование ссылки вместо email-формы, удаление только install-email API/helper.
- Production runtime расширения, Worker, shared protocol, billing/auth, CRM/Gmail,
  базы, env и публичный ZIP этим блоком не меняются. Граф обновляется отдельно
  по измененному коду и трем документам; остальной старый корпус не пересобирается.
- PR этого блока содержит итоговые build/CI/deployment receipts и staging acceptance.
  Rollback — revert только closeout PR; никаких миграций или восстановления данных.

**Итог review:** все 164 исходных файла рассмотрены; открытых замечаний этого
прохода нет. Полная production/ZIP приемка этапа 6 и решение о PostHog остаются
отдельными задачами и не объявляются выполненными.
