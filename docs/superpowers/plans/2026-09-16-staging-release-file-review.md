# Реестр проверки файлов staging перед production

**Дата:** 2026-09-16. **План:** [Staging Release Repair](2026-09-15-staging-release-repair-plan.md).

**Main:** `4b4ff88380d0a64e5216d2770d360440d3f8852b`. **Candidate staging:** `391fb5c97a09298080c32f354eaab63d9115f22a`.

В реестре все 164 измененных, добавленных и удаленных файла исходного diff.
Это список обязательного покрытия, а не утверждение, что каждый файл уже прошел
полное ревью. Найденные ранее ошибки отмечены F-ID. Статус «открыто» означает,
что приемка полного изменения файла и его влияния еще не зафиксирована.

Для каждой строки исполнитель читает diff целиком, проверяет импортирующих и
runtime-потребителей, отмечает намеренность изменения поведения и записывает
результат/доказательство в последней колонке. После исправлений статус закрывается
только со ссылкой на проверенный commit/test/manual receipt. Если файл менялся
после ревью, его проверку пересмотреть по новому diff. Удаленные файлы не пропускать.

Этап 1 пересогласован 2026-09-16: `возвращено к main` означает полное исключение
предложенного изменения по решению владельца; `исключено` — удаление новой
непринятой части. Реестр исходных 164 файлов сохранен, остальные строки не считаются
принятыми. Подробные команды и ограничения находятся в журнале этапа 1 плана,
CI receipts — в [PR #349](https://github.com/AniDachi/anidachi-LP/pull/349), код исправления `b71b1b91`, принятый staging merge `bcd00c7d`; main остается `4b4ff883`.

Этап 2 согласован отдельно: восстановить нашу шторку аккаунта и ее оформление
из main, сохранив остальные новые элементы шапки. Восстановление общего меню,
responsive-доступа и защиты выхода проверяется отдельным файловым срезом;
остальные строки исходного редизайна остаются открытыми.

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
| открыто | M | D | `.cursor/agents/anidachi-seo-aeo-pages.md` | Полное diff-review еще не зафиксировано. |
| открыто | M | D | `.cursor/scratchpad.md` | Полное diff-review еще не зафиксировано. |
| возвращено к main | A | E | `apps/extension/.keys/README.md` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | E | `apps/extension/AGENTS.md` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | A | E | `apps/extension/entrypoints/site-presence.content.ts` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | E | `apps/extension/src/popup-app.tsx` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | M | E | `apps/extension/src/popup-styles.ts` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| возвращено к main | A | E | `apps/extension/src/site-presence.ts` | По решению владельца этапа 1: diff с main 4b4ff883 пустой; новые extension/tooling изменения исключены. |
| открыто | M | D | `apps/web/.env.example` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/account.css` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/help/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/profile/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/profile/profile-client.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/profile/profile.css` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/watch-library/watch-library-client.test.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/account/watch-library/watch-library-client.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | S | `apps/web/app/ani-tokens.css` | Полное diff-review еще не зафиксировано. |
| открыто | A | I | `apps/web/app/api/extension/download/route.ts` | F07 |
| открыто | A | I | `apps/web/app/api/extension/email-install-link/route.ts` | F10, F11, F13 |
| открыто | A | I | `apps/web/app/api/extension/latest/route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/app/api/subscribe-interest/route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/app/api/waitlist-position/route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/app/api/waitlist-stats/route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/app/api/waitlist/join/route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/compare/anidachi-vs-crunchyroll-party/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/contact/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/editorial-policy/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | I | `apps/web/app/extension/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/feature-requests/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | S | `apps/web/app/globals.css` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/best-anime-to-watch-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/best-apps-to-watch-youtube-together/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/best-way-to-watch-youtube-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/can-you-screen-share-youtube-on-discord/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/crunchyroll-party-alternative/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/crunchyroll-watch-party-chrome-extension/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/does-teleparty-work-with-youtube/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/does-youtube-have-watch-party/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-create-an-anime-watch-party/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-host-a-crunchyroll-watch-party/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-run-an-online-anime-club/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-anime-long-distance/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-anime-with-a-group/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-anime-with-friends-in-different-time-zones/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-anime-with-friends-on-discord/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-anime-with-friends-online/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-anime-without-spoilers/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-crunchyroll-together-without-screen-share/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-crunchyroll-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/how-to-watch-youtube-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/netflix-party-for-crunchyroll/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/netflix-party-for-youtube/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/teleparty-not-working-youtube/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/youtube-group-watch/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/youtube-watch-party-chrome-extension/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/guides/youtube-watch-party-with-discord/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/app/join/complete/join-complete-client.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/app/join/complete/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/app/join/join-client.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/app/join/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/app/kreatli-email-crm/crm-client.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | S | `apps/web/app/layout.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/login/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/pricing/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/privacy/page.tsx` | Полное diff-review еще не зафиксировано. |
| проверено локально | M | I | `apps/web/app/room/[roomId]/extension-check.tsx` | Этап 1: нейтральная справка, safe next/mobile copy; 6 client tests и desktop/mobile harness passed, независимое ревью без замечаний. Join page/API неизменны; живой staging еще не обновлялся. |
| открыто | M | C | `apps/web/app/security/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/success/checkout-session-sync.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/app/success/page.tsx` | Полное diff-review еще не зафиксировано. |
| исключено | A | A | `apps/web/app/success/success-install-next.tsx` | Этап 1: удалено после проверки callers; сайт не определяет установку. SuccessInstallNext не был подключен к payment page. |
| открыто | M | C | `apps/web/app/terms/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-anime-together/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-crunchyroll-together-long-distance/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-crunchyroll-together/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-fantasy-anime-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-horror-anime-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-mecha-anime-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-party-starter/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-psychological-anime-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-slice-of-life-anime-with-friends/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-youtube-together-long-distance/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch-youtube-together/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/app/watch/[slug]/page.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/components/account/account-overview.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | A | `apps/web/components/account/account-waitlist-card.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | A | `apps/web/components/auth-page-shell.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/chrome-extension-demo-async-overlay.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/chrome-extension-demo-mobile.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/chrome-extension-demo-overlay.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/chrome-extension-demo.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/chrome-extension-features.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/compare-table.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/components/contact-form.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/components/discord-credentials-form.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | I | `apps/web/components/extension-install-hub.tsx` | F08 устранен в этапе 1: presence исключен; tests passed. F07, F11 и остальная часть полного diff остаются открытыми. |
| открыто | M | C | `apps/web/components/faq-section.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/components/feature-request-form.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/footer.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/hero.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/home-section-header.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/home/home-client.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/how-it-works.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/join-discord-button.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/json-ld.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/main-app-features.tsx` | Полное diff-review еще не зафиксировано. |
| исправлено локально; staging pending | M | A | `apps/web/components/nav-bar-client.tsx` | F04/F05/F06: общий production UserMenu и CSS подключены обратно; восстановлены account shortcuts, единый responsive breakpoint и cleanup drawer. Watch/Contact/Pricing/install сохранены. Проверены runtime consumers и 34 целевых сценария; живая приемка остается в PR этапа 2. |
| открыто | M | C | `apps/web/components/nav-pricing-button.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/nav-pricing-link.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | C | `apps/web/components/overlay-interface-preview.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | C | `apps/web/components/overlay-layout-preview.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | C | `apps/web/components/overlay-using-mocks.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/components/plan-survey/plan-survey-modal.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/components/plan-survey/plan-survey-provider.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/components/plan-survey/use-plan-survey.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/components/plan-survey/waitlist-referral-card.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/components/pre-purchase-discord-walkthrough.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/components/pricing-survey-link.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/pricing.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/primary-checkout-cta.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/responsive-compare-table.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/seo-guide-blocks.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/seo-page-layout.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/social-proof.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/sticky-mobile-checkout-bar.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/components/table-of-contents.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | S | `apps/web/components/ui/button.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | A | F | `apps/web/components/watching-together-count.tsx` | Полное diff-review еще не зафиксировано. |
| открыто | M | T | `apps/web/docs/CONVERSION_METRICS.md` | Этап 1 убирает только extension_detected; остальной analytics diff требует отдельного ревью. |
| открыто | M | A | `apps/web/lib/account-profile-client.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | A | T | `apps/web/lib/amplitude-ids.ts` | Полное diff-review еще не зафиксировано. |
| открыто | A | T | `apps/web/lib/amplitude-server.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | T | `apps/web/lib/amplitude.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | T | `apps/web/lib/conversion-events.ts` | Этап 1 убирает только extension_detected; остальной analytics diff требует отдельного ревью. |
| открыто | A | I | `apps/web/lib/extension-artifact.ts` | F07 |
| открыто | A | I | `apps/web/lib/extension-install-faq.ts` | F13 |
| исключено | A | I | `apps/web/lib/extension-presence.ts` | Этап 1: удалено после проверки callers; сайт не определяет установку. SuccessInstallNext не был подключен к payment page. |
| открыто | A | C | `apps/web/lib/extension-using-guide.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/lib/founder-discord.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | T | `apps/web/lib/gtag.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/lib/home-faq.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/lib/home-survey.ts` | Полное diff-review еще не зафиксировано. |
| открыто | A | I | `apps/web/lib/install-cta.ts` | F13 |
| открыто | M | C | `apps/web/lib/internal-tool-routes.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | A | F | `apps/web/lib/kreatli-crm/desktop-install-lead.ts` | F09 |
| открыто | M | F | `apps/web/lib/kreatli-crm/feature-request-shared.ts` | Полное diff-review еще не зафиксировано. |
| открыто | A | F | `apps/web/lib/kreatli-crm/public-signup-count.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/lib/kreatli-crm/subscribe-interest-route.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/lib/kreatli-crm/subscribe-interest-route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/lib/kreatli-crm/survey-lead-shared.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | F | `apps/web/lib/kreatli-crm/survey-lead-shared.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/lib/kreatli-crm/survey-lead.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/lib/kreatli-crm/survey-lead.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/lib/kreatli-crm/waitlist-join-route.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | D | F | `apps/web/lib/kreatli-crm/waitlist-join-route.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/lib/middleware-routes.test.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/lib/pricing-copy.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/lib/pricing-tiers.ts` | F12 |
| открыто | M | C | `apps/web/lib/sitemap-discovery.ts` | Полное diff-review еще не зафиксировано. |
| открыто | A | S | `apps/web/lib/use-in-view.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | C | `apps/web/lib/watch-page-rich-content.ts` | Полное diff-review еще не зафиксировано. |
| открыто | M | D | `docs/environment-and-secrets-matrix.md` | Полное diff-review еще не зафиксировано. |
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
