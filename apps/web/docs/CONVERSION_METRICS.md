# Conversion metrics (GA4)

## Event names (funnel)

| Event | When |
|--------|------|
| `cta_impression` | CTA block entered viewport (or hero on mount) |
| `cta_click` | User clicked a CTA that routes to `/#pricing` (or nav Pricing) |
| `checkout_session_started` | User clicked “Start paid plan” on the paid tier; API request begins |
| `checkout_redirect_success` | API returned a Stripe `url`; redirect is about to happen |
| `checkout_error` | API error, missing URL, or network exception |

Legacy `subscribe_click` was replaced by the events above for the primary checkout path.

## Parameters (all string-friendly for GA4)

- `page_path` — pathname, e.g. `/guides/how-to-watch-anime-with-friends-online`
- `page_template` — `home`, `guide`, `compare`, `anime`, `listicle`, `glossary`, `pillar`, `default` (see `inferPageTemplateFromPath`)
- `placement` — `hero`, `home_features`, `nav`, `content_above_fold`, `content_bottom`, `content_mid`, `pricing_section`, `pricing_subscribe`
- `cta_variant` — e.g. `hero_start_paid_plan`, `primary_checkout`, `pricing_tiers_visible`
- `cta_experiment` — from `NEXT_PUBLIC_CTA_EXPERIMENT_VARIANT` (default `control`)
- `price_id` — Stripe price id when relevant
- `error_step` / `message` / `status` — on `checkout_error` only

## QA checklist (post-deploy)

1. Home: hero “Start paid plan” → scrolls to pricing; GA4 debug: `cta_click` with `placement: hero`.
2. Home: pricing card → Stripe URL (or error banner on failed API).
3. Any guide: two CTA blocks fire `cta_impression` when scrolled into view; bottom block `placement: content_bottom`.
4. `/watch/...-with-friends`: mid CTA after lede has `placement: content_mid`.
5. Nav “Pricing” from a guide: `cta_click` with `placement: nav` and correct `page_path`.

## Next test hypotheses

1. **Hero copy** — Test headline emphasizing “async watchrooms” vs “Crunchyroll sync” (`NEXT_PUBLIC_CTA_EXPERIMENT_VARIANT`).
2. **Pricing card** — A/B first line under “Crunchyroll Subscriber” (who it’s for).
3. **Second CTA on long guides** — Optional `midContentSlot` in `SeoPageLayout` for one high-traffic guide only.
