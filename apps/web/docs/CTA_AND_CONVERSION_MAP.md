# CTA and conversion map (internal)

Quick audit reference for the sitewide paid checkout rollout.

## Surfaces

| Location | Copy (before) | Primary action | After |
|----------|----------------|----------------|--------|
| `components/hero.tsx` | Get Started | `/#pricing` | Start paid plan + `cta_impression` / `cta_click` |
| `components/main-app-features.tsx` | Get Started | `#pricing` | Start paid plan + events |
| `components/nav-bar.tsx` | Pricing | `/#pricing` | unchanged label; add `cta_click` on nav |
| `components/seo-page-layout.tsx` | Get Started | `/#pricing` | `PrimaryCheckoutCta` + template metadata |
| `components/pricing.tsx` | Start paid plan | Checkout API | `checkout_session_*` + `checkout_error` + inline error UI |
| `components/footer.tsx` | Pricing | `/#pricing` | optional click event via future pass |

## Template IDs (`page_template` in events)

- `home` — `/`
- `pillar` — `/watch-anime-together`, `/watch-crunchyroll-together`
- `guide` — `/guides/*` (incl. listicles; listicles also set placement)
- `compare` — `/compare/*`
- `anime` — `/watch/*-with-friends`
- `glossary` — `/glossary/*`
- `default` — other static marketing pages

## Placements

- `content_above_fold` — first install card, inserted when `aboveFoldCta` is set
- `content_bottom` — end-of-article install card in `SeoPageLayout`
- Cap: those two cards only. Do not add `content_mid` on marketing pages.
- `hero` — home hero button
- `home_features` — `MainAppFeatures` CTA
- `nav` — top nav “Pricing”
- `pricing_subscribe` — paid card button
- `pricing_subscribe` — errors bubble with `checkout_error`
