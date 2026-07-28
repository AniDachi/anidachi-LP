# Conversion metrics (GA4)

## Event names (funnel)

| Event | When |
|--------|------|
| `cta_impression` | CTA block entered viewport (or hero on mount) |
| `cta_click` | User clicked a CTA that routes to `/pricing` (or nav Pricing) |
| `checkout_session_started` | User clicked “Start paid plan” on the paid tier; API request begins |
| `checkout_redirect_success` | API returned a Stripe `url`; redirect is about to happen |
| `checkout_error` | API error, missing URL, or network exception |

Legacy `subscribe_click` was replaced by the events above for the primary checkout path.

## Parameters (all string-friendly for GA4)

- `page_path` — pathname where the event fired, e.g. `/guides/how-to-watch-anime-with-friends-online`
- `seo_landing_path` — first-touch marketing landing path for the browser session (captured on first marketing pageview, including after client navigations from auth routes; see `lib/seo-landing-path.ts`)
- `seo_referrer` — document.referrer at first landing (when present)
- `seo_utm` — first-touch UTM query string (when present)
- `page_template` — `home`, `guide`, `compare`, `anime`, `listicle`, `glossary`, `pillar`, `default` (see `inferPageTemplateFromPath`)
- `placement` — `hero`, `home_features`, `nav`, `content_above_fold`, `content_bottom`, `content_mid`, `pricing_section`, `pricing_subscribe`
- `cta_variant` — e.g. `hero_start_paid_plan`, `primary_checkout`, `pricing_tiers_visible`
- `cta_experiment` — from `NEXT_PUBLIC_CTA_EXPERIMENT_VARIANT` (default `control`)
- `price_id` — Stripe price id when relevant
- `error_step` / `message` / `status` — on `checkout_error` only

## Web vitals (field data)

`web_vital` events fire on pagehide/visibilitychange via `lib/web-vitals-report.ts`:

- `metric_name` — `LCP` | `INP` | `CLS`
- `value` — LCP/INP in ms; CLS × 1000
- `metric_rating` — `good` | `needs-improvement` | `poor`
- `page_path`, `page_template`

Reporting only — does not change page rendering or Core flows.
## Stripe checkout metadata

`/api/create-checkout-session` stores the same attribution on the Checkout Session and Subscription:

- `seoLandingPath`
- `checkoutPagePath`
- `seoReferrer` (optional)
- `seoUtm` (optional)
- `userId`, `planCode`

Use these to attribute paid plans to first-touch SEO landings even when checkout happens on `/` or `/pricing`.

## SEO portfolio audit

```bash
pnpm --filter @anidachi/web seo:portfolio
pnpm --filter @anidachi/web seo:portfolio -- --days 28 --out ./tmp/seo-portfolio.json
```

Inventories every public sitemap route, joins GSC page/query data with GA4 sessions/channels/key events, and suggests Keep / Enrich / Merge/301 / Review. Confirm Coverage status in Search Console — the script cannot replace the Coverage report.

**Publishing freeze:** do not ship net-new SEO route batches until the current cohort completes a 30/60/90-day review using this report + GSC Coverage.

## QA checklist (post-deploy)

1. Home: hero “Start paid plan” → scrolls to pricing; GA4 debug: `cta_click` with `placement: hero`.
2. Home: pricing card → Stripe URL (or error banner on failed API).
3. Land on a guide first, then checkout from `/pricing`: GA4 `checkout_session_started` and Stripe metadata include `seo_landing_path` / `seoLandingPath` = the guide path.
4. Any guide: two CTA blocks fire `cta_impression` when scrolled into view; bottom block `placement: content_bottom`.
5. `/watch/...-with-friends`: mid CTA after lede has `placement: content_mid`.
6. Nav “Pricing” from a guide: `cta_click` with `placement: nav` and correct `page_path`.

## Next test hypotheses

1. **Hero copy** — Test headline emphasizing “async watchrooms” vs “Crunchyroll sync” (`NEXT_PUBLIC_CTA_EXPERIMENT_VARIANT`).
2. **Pricing card** — A/B first line under “Plus” (who it’s for).
3. **Second CTA on long guides** — Optional `midContentSlot` in `SeoPageLayout` for one high-traffic guide only.
