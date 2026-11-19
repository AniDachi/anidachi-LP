# AniDachi Landing Page Design Guidelines

Developer handoff, first written November 19, 2026.

This guide records the design patterns on AniDachi's public marketing site, with values and component references from the website source. Use it when you add or update a section that should look like part of the same site. The first part covers the homepage. [SEO and article pages](#seo-and-article-pages) covers the guide, hub, compare and German templates, which make up most of the site's pages.

[Published homepage](https://www.anidachi.app/) · [SEO content rules](seo-content-guidelines.md)

## Visual direction

- Keep the page on a near-black graphite canvas with warm ivory text. Use slightly raised graphite surfaces and fine borders where an element needs a clear boundary, such as a pricing card, navigation menu or product demo.
- Build hierarchy with type, alignment and spacing. Give each section one clear job and enough room around its headline and main content. Add a short supporting line when it helps explain the section.
- Use warm orange for a short headline accent, progress, focus or a small status cue. Use ivory for the filled primary marketing button, an outlined ivory treatment for the secondary action, and muted text for tertiary links.
- Show the product in context. The homepage demo puts AniDachi's controls over a video scene, with short captions explaining what the viewer can do.
- The site is dark only. There is no light theme and no `prefers-color-scheme` switch, so don't add light-mode styles to marketing sections.

## Design tokens

Reuse the semantic variables in [`ani-tokens.css`](../app/ani-tokens.css). The root layout sets `data-ani-theme="account"` on `<html>`, which exposes these tokens, and [`globals.css`](../app/globals.css) maps them to Tailwind classes such as `bg-ani-canvas` and `text-ani-text`.

| Role | CSS variable | Value |
| --- | --- | --- |
| Page background | `--ani-canvas` | `#0D0D0F` |
| Card or menu surface | `--ani-panel` | `#151516` |
| Dialog surface | `--ani-dialog` | `#171719` |
| Main text | `--ani-text` | `#EEE5D9` |
| Supporting text | `--ani-muted` | `#96938F` |
| Primary button fill / text | `--ani-primary` / `--ani-on-primary` | `#EEE5D9` / `#181511` |
| Primary button hover | `--ani-primary-hover` | `#FFF7EC` |
| Headline accent and progress | `--ani-progress` | `#FF9143` |
| Keyboard focus | `--ani-focus` | `#FFAD6E` |
| Divider / control border | `--ani-line` / `--ani-control-border` | `#FFFFFF12` / `#FFFFFF1F` |

Use the shared `Button` variants `cream`, `creamOutline` and `creamQuiet` for the three action levels. The `control` size has a 44 px minimum touch target and a pill shape. Menus and the main demo stage use rounded corners of about 20 px. Use Lucide for UI icons. [Shared Button](../components/ui/button.tsx) · [AniDachi logo component](../components/anidachi-logo.tsx)

### Two colour sets

The older shadcn variables still exist next to the `--ani-*` tokens, and `--primary` and `--accent` are still orange. They stay that way for the internal CRM and Blou tools.

- On marketing pages, use the `ani-*` classes (`bg-ani-primary`, `text-ani-text`, `border-ani-line`). `bg-primary` and `text-primary` give you orange, not ivory.
- Don't use the `default`, `outline` or `secondary` Button variants for marketing actions. The Discord join button keeps its own outline style and Discord blue (`#5865F2`) on purpose.
- Don't hard-code hex values in new marketing components. Some demo mock components still carry their own oranges (`#ff9b55`, `#ff8a3d`, `#ffae74`). Move them to `--ani-progress` when you next touch those files.

## Typography and spacing

| Element | Homepage pattern |
| --- | --- |
| Typeface | Geist for headings, body copy and controls. The root layout loads Geist through Next.js. |
| Hero heading | 36 px at the base breakpoint, 60 px from `md` and 72 px from `lg`, at the default root font size. Weight 600, tracking `-0.035em`, balanced wrapping. |
| Standard section heading | 30 px at the base breakpoint and 36 px from `md`, weight 600. Use [`HomeSectionHeader`](../components/home-section-header.tsx) where it fits the section. |
| Supporting copy | The hero uses 18–20 px and a `max-w-xl` measure. Standard section descriptions use 16–18 px. Keep descriptions short and use relaxed line height. |
| Width and rhythm | The hero content is centred within `max-w-3xl`. Comparison and FAQ use a 1,144 px content width. Reuse each section's existing container and responsive gutters. Shared spacing values are 4, 8, 12, 16, 24, 32 and 48 px. |

## Homepage patterns to reuse

| Section | Pattern |
| --- | --- |
| Navigation | Sticky graphite bar, subtle bottom rule, and a circular AniDachi mark with the wordmark. Use grouped menus on wide screens and the existing compact drawer on mobile and tablet. |
| Hero | Centred mark and wordmark, one headline about watching together, a short supporting sentence and two actions. The filled action starts the install flow. The outline action jumps to "How AniDachi works." |
| Product demo | A wide, rounded stage with the extension UI shown over video. Use the existing Live, History and Async selector. Keep the upcoming state explicit. Keep a readable caption and a video poster. |
| Getting started and platforms | Present setup as a short vertical sequence with numbered markers and thin connecting lines. Group supported platform links and upcoming platform marks under their own headings. |
| Comparison | Keep feature names and the AniDachi column easy to scan. The desktop table shows all alternatives. At 900 px and below, the selector shows one alternative alongside AniDachi. |
| Plans, reviews and FAQ | Explain the host and guest model before the plans. Reuse the billing toggle, plan cards and published review block. The FAQ uses two columns on desktop and a single column from 767 px down, with native disclosure controls. |

The section order and component wiring are in [`home-client.tsx`](../components/home/home-client.tsx). For the original logo and demo media, use the assets referenced by the [logo component](../components/anidachi-logo.tsx) and the [demo component](../components/chrome-extension-demo.tsx). See the [demo asset credits](../public/demo/CREDITS.md).

## Responsive behaviour and review

- Keep the hero actions stacked below `sm` and side by side when they fit.
- Keep the demo caption over the stage on desktop and below it on narrow screens. Review the narrow layout with touch input as well as a resized desktop window.
- Keep native page scrolling. The homepage uses a small scroll adjustment on fine-pointer screens that meet the viewport requirements. Keep anchor targets clear of the sticky header and respect reduced motion. [Homepage section CSS](../components/home/home-sections.module.css) · [Scroll behaviour](../lib/use-home-scroll-assist.ts)
- Before handing off a change, review the hero, menu, demo, pricing and FAQ at a phone width, a tablet width and a wide desktop width. Use the keyboard to check visible focus, disclosure controls and the skip link. Check that the layout has no horizontal overflow and that the primary action leads to the expected install flow.

## SEO and article pages

Most of the site's pages use these templates rather than the homepage layout:

- Guides: [`SeoPageLayout`](../components/seo-page-layout.tsx), about 100 pages under `/guides/`.
- Platform hubs: [`HubLandingLayout`](../components/hub-landing-layout.tsx).
- Compare pages under `/compare/`, tool pages under `/tools/`, and the German pages under `/de/`.

They use the same tokens and button levels, with the rules below.

### Article type scale

Article pages use a smaller scale than the homepage on purpose, because they are read top to bottom. The `.seo-prose` styles in [`globals.css`](../app/globals.css) set:

| Element | Article pattern |
| --- | --- |
| Page title (h1) | 36 px, 48 px from `md`, weight 600, tracking `-0.035em` |
| Section heading (h2) | 24 px, weight 600 |
| Sub-heading (h3) | 20 px, weight 600 |
| Body | Muted text, relaxed line height, `max-w-3xl` article column |

Don't raise article headings to the homepage sizes. Components placed inside an article still inherit `.seo-prose p` margins and line height, even inside `not-prose`. Reset them on the component (as `HubHero` does with `!m-0 !leading-5`) and check the result in the browser.

### Install calls to action

- Use [`HubHero`](../components/hub-hero.tsx) for the block at the top of a hub, and for the guide block shown with `aboveFoldStyle="hero"`. Use [`PrimaryCheckoutCta`](../components/primary-checkout-cta.tsx) for the card at the end of an article. A guide has at most these two install blocks, one near the top and one at the end. Don't add a middle one.
- Set `watchroom` on a guide that promotes one platform. It picks the button label and lead line from [`watchroom-cta.ts`](../lib/watchroom-cta.ts), for example "Start a Crunchyroll Watch Party".
- Send every install action through [`InstallLink`](../components/install-link.tsx), or a component that uses it. On a phone it opens the desktop install handoff instead of the Chrome Web Store, which can't install the extension on a phone.
- Keep shared data such as `WATCHROOM_CTA` in `lib/`. A server component can't read constants exported from a `"use client"` file.

### Tracking names

Conversion reports read the tracking fields on each install action, so a new section without them doesn't show up in measurement.

- `placement`: where the action sits, such as `hub_hero`, `guide_hero`, `content_above_fold` or `content_bottom`.
- `ctaVariant`: which version of the action, such as `crunchyroll_guide_hero_install` or `anime_watchroom_install`.
- `page_template`: inferred from the URL by `SeoPageLayout`, such as `guide`, `compare` or `pillar`.

Reuse an existing name when the action is the same. Pick a new, specific name when you change the design or the copy, so the old and new versions can be compared. [CTA and conversion map](CTA_AND_CONVERSION_MAP.md)

### Product, steps and platforms

- Show the product on hubs with the lazy-loaded demo (`LazyExtensionDemo`). Load demo video lazily and always give it a poster, so it doesn't slow the first paint.
- Hub install steps are defined inside `HubLandingLayout` (`InstallStepText`, and `InstallStepTextDe` for German) and aren't shared yet. Guides write their own step lists, so they look different from the hubs. If a guide needs the same install steps, move them into a shared component first rather than copying them.
- The supported platform list is written into [`upcoming-platforms.tsx`](../components/upcoming-platforms.tsx) and into hub copy. Update both on a platform launch day, together with the hub's supported or upcoming state.

### Copy and data

- Take prices and plan facts from [`pricing-copy.ts`](../lib/pricing-copy.ts), such as `PRICING_FREE20_SUMMARY`. Don't type a price or limit into a page.
- Wording, sourcing for competitor claims, and review dates follow [`seo-content-guidelines.md`](seo-content-guidelines.md).
- Add structured data with the components in [`json-ld.tsx`](../components/json-ld.tsx), such as `ArticleJsonLd`, `FAQPageJsonLd`, `HowToJsonLd` and `BreadcrumbJsonLd`. Keep it in step with what the page shows.

### German pages

German pages use the same components with `locale="de"`. German text often runs longer than English, so check buttons, table headers and the hero block at phone width for wrapping and overflow.

### Out of scope

The internal tools (`/kreatli-email-crm`, `/blou`) use the orange shadcn theme and are not covered by this guide. Account, room and checkout screens follow their own handoff in `ani-tokens.css`.
