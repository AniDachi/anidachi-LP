## Background and Motivation

**(Active — 2026-09-21)** Owner said **execute** on the SEO rank + expand plan (`seo_rank_expand_plan_50af6223`). CWS is live. Executor shipping freeze-safe enrich-in-place on `staging`: Part 1a CWS truth, 1b CTR titles, 1c CR stack, 1d anime/listicle, 2a screenshare cluster, 2b/2c/2d alias coverage. No new URLs. Do not commit unless asked.

**(Active — 2026-09-14)** Owner asked how to teach overlay usage + important settings after install. Planner recommendation: do **not** add a new SEO URL. Add a short “Use it on the player” section on existing `/extension` (`#using`) plus rewrite homepage How it works step 4 away from async. In-overlay first-run tips later. Awaiting owner pick before Executor builds.

**(Active — 2026-09-13)** Homepage live/async demo overlay restyle to match the current extension overlay (room rail, people rows, camera switch, reaction grid, composer). Marketing chrome from the account-language restyle stays. Executor implementing.

**(Prior — 2026-09-13)** Landing page restyle to the account visual language (cream primary, sparse orange, no glow). Planner plan `landing_page_restyle`. Homepage + shared chrome; restyle in place; conversion copy/JSON-LD frozen. Executor implementing.

**(Prior — 2026-08-20)** Domain ranking plan is two-part. Part 1: referring domains (CWS, Edge, PH, directories). Part 2 (owner): contest YouTube head terms (`youtube watch party` 880, `watch youtube together` 720, `watch videos together` 260, `watch youtube with friends` / how-to 210) on existing URLs. Owner excluded `netflix party youtube` and `teleparty youtube` from Part 2. Plan: `domain_ranking_levers_f395607f.plan.md`. Canvas: `anidachi-youtube-underserved-keywords.canvas.tsx`. URL freeze still in force.

**(Prior — 2026-08-16)** GSC spike analysis (Planner → Executor): why Search clicks/impressions jumped. Window is late-May / June 2026, not August. Canvas: `anidachi-gsc-spike-analysis.canvas.tsx`. Measurement only; URL freeze still in force.

**(Prior — 2026-08-14)** Pre-store Chrome sideload conversion: public `/extension` zip + Load unpacked; primary CTAs install-first; Stripe is upgrade-after-room. Executor completing remaining plan todos (extension-plane + analytics docs). Do not edit the plan file. SEO URL freeze still in force.

**(Prior — 2026-08-14)** Homepage link-preview picture (Telegram/iMessage/Discord). Owner graphic now at `apps/web/app/opengraph-image.png` (1200×630); generated `opengraph-image.tsx` removed. Same URL; no title/canonical/path changes. Executor mode.

**(Prior — 2026-08-11)** AniDachi SEO audit remediation (Addy Osmani skill + freeze Phase 2 + owner-approved 5 commercial guides). Plan: `anidachi_seo_audit_9d0fb571.plan.md`. Hard gate: no URL path/slug/redirect/canonical-retarget on ranked pages (new URLs only via owner exception).

**(Prior — 2026-08-03)** Keyword enrichment **implementation** (Executor): FAQ/meta/snippet/internal-link enrich-in-place on approved batch. **No URL structure changes** (freeze). Awaiting user spot-check + Planner confirm.

**(Prior — 2026-08-02)** Keyword positioning & enrichment from 16 GSC page exports + YouTube cluster. Plan: `keyword_enrichment_analysis`. Canvas: `anidachi-keyword-enrichment.canvas.tsx`. Analysis only.

**(Prior — 2026-08-02)** Full SEO analysis (GSC + GA4 + Amplitude) via Composio; deliver canvas report + freeze-safe backlog. Plan: `full_seo_analysis`.

**(Prior — 2026-07-28)** SEO Trust & Authority plan: pause URL growth, portfolio audit, entity trust, agent rewrite. Plan: user-approved `seo_trust_authority` plan.

**(Prior — 2026-07-26)** SEO agent critical fixes (YT + CR parity) — completed, awaiting Planner confirm.

## High-level Task Breakdown

### Overlay usage guide (Planner 2026-09-14)

Do not ship a new `/guides/...` URL (SEO freeze; this is post-install help, not a ranking page).

Owner chose **A** (2026-09-14): `/extension#using` only. Do not rewrite homepage How it works (that is B). Do not add in-overlay first-run tips (that is C).

1. On `/extension`, after install steps, add `#using`: 4–5 short live-sync steps (bubble → detect/create → invite → Layout drag → Voice PTT). List only the settings that change the watch: Layout, Voice (PTT vs open mic), Interface auto-hide. Keep install steps as they are. **Executor shipped pointing mocks; awaiting owner spot-check.**
2. Rewrite homepage How it works step 4 (currently async) to the overlay loop. Demo already shows Layout/Voice. **Out of scope for A.**

Later (extension plane): 3 dismissable first-run tips in the overlay after first room. Highest leverage, more work.

Not recommended: Discord-only pin; dumping every Interface toggle; a long PDF/manual.

### Domain ranking + YouTube heads (Planner 2026-08-20)

Plan file: `domain_ranking_levers_f395607f.plan.md`. Same freeze: no new marketing URLs.

**Part 1 — referring domains**

1. Baseline Ahrefs/Moz DR/DA + referring domains.
2. Public Chrome Web Store listing; Website = `https://www.anidachi.app`; title/short description name YouTube watch party + Crunchyroll watch party.
3. Microsoft Edge Add-ons (same Website).
4. SaaSHub + AlternativeTo + Crunchbase.
5. Product Hunt only after CWS one-click install.
6. 5–10 editorial pitches (CR/anime → compare URLs; YouTube roundups → `/watch-youtube-together` with head-term anchors).

**Part 2 — chart heads (owner 2026-08-20: take on Teleparty)**

1. Enrich `/watch-youtube-together` as sole owner of `youtube watch party` (880), `watch youtube together` (720), `watch youtube with friends` (210).
2. Enrich `/guides/how-to-watch-youtube-with-friends` for `how to watch youtube with friends` (210).
3. Own `watch videos together` (260) on pillar + apps roundup; YouTube + Crunchyroll only.
4. Recrawl pillar after CWS. Skip `netflix party youtube`, `teleparty youtube`, W2G brand vanity, movies/Prime, YT Music, Messenger, android/phone/YT TV/Shorts.

Success: first GSC impressions on `youtube watch party` / `watch youtube together`, then clicks. Lags Part 1 by weeks.

### GSC spike analysis (Executor 2026-08-16)

1. Pull remaining GSC daily page overlay, brand/non-brand weekly, GA4 organic landings, URL Inspection, Amplitude sessions (include Feb–Apr GSC already pulled).
   - Success: WAT/CR/OVA daily series, brand share, GA4 landings May–Jul, inspect 4 URLs, Amplitude DAU.
2. Ship canvas `anidachi-gsc-spike-analysis.canvas.tsx` (weekly trend, two-engine split, query table, timeline).
   - Success: canvas in managed canvases dir; no site/code mutations.
3. Append findings + lessons to this scratchpad.
   - Success: Background, status, executor note, Lessons updated.

### Pre-store sideload conversion (Executor 2026-08-14)

1. Artifact + `/extension` hub + download/email APIs.
   - Success: hub renders; zip 503 until `EXTENSION_ZIP_URL` is set; no zip in git/public.
2. Rewire primary CTAs to `/extension`; Stripe/survey demoted except `/pricing` paid cards.
   - Success: hero/nav/sticky/free card go to install hub.
3. Room /success /account /join /pricing activation copy.
   - Success: no Store homepage; room uses `?next=/room/{id}`.
4. Enrich-in-place HowTo/FAQ + SoftwareApplication + SEO agent CTA path.
   - Success: install HowTos name `/extension`, not `/pricing`.
5. Production packed `key`, site-presence ping script, popup update copy, release-channel docs.
   - Success: production-only `key`; ping on anidachi.app; staging has no packed key; no broad matches.
6. Conversion metrics + env/secrets for zip vars.
   - Success: docs name install events; `.env.example` lists zip vars.

### Homepage OG / link preview (Executor 2026-08-14)

1. Restyle `apps/web/app/opengraph-image.tsx` to the dark homepage look (logo + wordmark, hero headline with orange “Fix that.”, CR + YouTube subcopy). Keep 1200×630 PNG.
   - Success: no Crunchyroll-only claim; layout matches landing (dark, brand orange, logo row).
2. Run `pnpm --filter @anidachi/web check`. Ask user to confirm the picture locally / after deploy (Telegram cache may need `@webpagebot`).
   - Success: check passes; user says the preview looks right.

### AniDachi SEO audit (Planner → Executor 2026-08-11)

1. Install Addy Osmani `seo` skill; fix critical product-truth + root title/OG + home HowTo.
2. Sync SEO agent + guidelines + freeze docs (15 genre hubs, www origin, URL stability, winner queue, exit criteria).
3. P0 / Phase 2 enrich mid CTAs + home FAQ dual-platform (same URLs only).
4. Attempt `seo:portfolio`; document OAuth blocker if needed.
5. Verify check/build; zero SEO route rename/delete of ranked URLs.
6. Owner-approved 5 commercial long-tail guides + inbound wiring.
   - Success: check/build pass; no false AniDachi CR-only claims; freeze docs include URL stability.

### Full SEO Analysis (Executor 2026-08-02)

1. Connect Amplitude + resolve GA4 `properties/531363877` + GSC `sc-domain:anidachi.app`.
2. Pull GSC 28d/90d/prior (date, query, page, query×page, device, country, sitemaps).
3. Pull GA4 channels, organic landings, funnel events, devices.
4. Pull Amplitude event taxonomy + ordered CTA→checkout funnel.
5. Join/synthesize winners, CTR traps, cannibalization, backlog.
6. Ship canvas `anidachi-seo-analysis.canvas.tsx` + scratchpad notes.

### SEO Trust & Authority (Executor 2026-07-28) — historical

1. **Portfolio baseline** — freeze note + `seo:portfolio` audit + first-touch landing path through checkout.
2. Technical trust cleanup (force-index freshness, SearchAction, CWV, internal links).
3. Entity trust surfaces (About / editorial / contact / security + schema).
4. Consolidate/enrich from portfolio evidence (needs live GSC run).
5. Authority program (real benchmark — blocked until measurements exist).
6. Rewrite SEO agent + guidelines.

## Project Status Board

### SEO rank + expand execute (Executor 2026-09-21)

- [x] 1a CWS truth pass (public HowTo/body/security/terms/agent; hub sideload UI left)
- [x] 1b title/meta on teleparty compare, watch-party-starter, pricing, Discord SS compare
- [x] 1c CR pillar + CR how-to (does/can answers, Teleparty inline, two-account FAQ, dateModified)
- [x] 1d anime pillar FAQ aliases, LDR verdict+CTA (async labeled planned), listicle start-here strip
- [x] 2a CR screenshare cluster owner page (DRM, black-screen FAQ, HowTo workaround, inbound links)
- [x] 2b YouTube how-to + apps roundup + does-YT / group-watch / LDR dateModified + aliases
- [x] 2c Discord companion on remaining Discord guides (CR+YT hybrid, switch-from-Go-Live, YT screenshare)
- [x] 2d watch-party-app aliases on YT apps roundup
- [x] 2f paste pack in `docs/current-development-state.md` + `CWS_LISTING_TITLE` / short description constants
- [x] Ops: local `GOOGLE_ADS_CUSTOMER_ID=8078204641` (was 5723352650)
- [x] Fix homepage HowTo step 1 UI ↔ `howToSteps` mismatch (`how-it-works.tsx`)
- [ ] Owner: rotate leaked Blob token, then persist `PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN`
- [ ] Owner: CWS listing fields, Product Hunt, Edge, directories, editorial pitches
- [ ] After production deploy: Search Console Request indexing
- [ ] Re-measure GSC + Amplitude 28d after ship

### Overlay usage `#using` (Executor 2026-09-14 — owner chose A)

- [x] Copy source `apps/web/lib/extension-using-guide.ts` (bubble → Create room → Layout → Voice V → Interface Auto hide)
- [x] Render `OverlayUsingGuide` on desktop install, already-installed, and mobile `/extension`
- [x] Quiet `#using` jump from pin step; second HowTo JSON-LD for overlay use
- [x] Install-guide-level pointing mocks (cream hit rings on overlay glass: bubble, Create room, copy, Layout/Apply, Voice+V, Auto hide)
- [x] Extra `#using` steps: Invite friends, People radio seat buttons, Reactions 1–0 (no emoji frame), Layout Video/Chat settings, Interface pills, Room defaults; orange tab underlines removed
- [x] Interface step: animated showcase (cursor → edge glow → bubble / speaking pills) matching extension Interface preview; toggles drive the loop
- [x] Layout step: animated showcase (drag cams → drag chat → enlarge Camera size → Apply pulse)
- [x] Pause Layout + Interface preview loops when off-screen (`useInView`)
- [ ] Owner spot-check `/extension#using` mocks — then Planner marks A complete

### Homepage demo overlay = current extension (Executor 2026-09-13)

- [x] Live overlay mock: bubble + mini-panel + people + settings + room rail + cams + chat + composer
- [x] Layout editor beat (grid + Video/Chat + Apply) with player ghost preview
- [x] Layout drag choreography (cameras then chat) + pointer-drag on the grid
- [x] Async demo bubble matches overlay bubble
- [ ] Web check + owner visual QA (`/#demo` desktop + 390) — check passed; owner will inspect locally; do not start the web server

### Landing restyle to account language (Executor 2026-09-13)

- [x] Opt-in `ani-tokens.css` + `data-ani-theme="account"` (no `--primary` rewrite)
- [x] Cream pill CTA variant wired on nav/hero/sticky/mid-page/skip-link
- [x] Home sections restyled in place (copy frozen, no glow)
- [x] Nav + footer chrome
- [x] Sitewide surfaces: shadcn/brand aliases, SEO layout/blocks, install hub, auth, forms, survey (no glow)
- [x] Quiet leftover orange washes: `/pricing`, `/contact`, `/feature-requests`, `/join/complete`, `/success` (+ survey glow border)
- [x] Remove public plan survey (pricing “Not sure yet?” + sitewide modal/APIs)
- [x] Live-product copy: `/join` → `/login`; no waitlist/early-access/pre-launch/soft-launch in public copy; Start Plus/Pro; signup count rephrased
- [x] Chrome Store pending note on `/extension` (review + publisher verification; calm tone)
- [ ] Owner visual QA: `/`, `/pricing`, `/extension`, a CR + YT guide, leftover `/join` URLs → `/login`. Signup count only shows when CRM `waitlist-stats` count > 0 (local was 0).

### Wipe waitlist / referral / Early access (Executor 2026-09-14)

- [x] Confirm account overview has no Early access / Copy referral UI (`AccountWaitlistCard` already deleted)
- [x] Remove `.ac-referral` CSS from `account.css`
- [x] Delete `survey-lead.ts` + tests (upsert / getAccountWaitlistStatus / referral credit)
- [x] Slim `survey-lead-shared.ts` (no ref codes, positions, referral URLs)
- [x] Remove empty `app/api/waitlist/` dirs
- [x] CRM tab labels: Waitlist → Signups / historical survey (keep lead read/export)
- [x] Keep `GET /api/waitlist-stats` + hero signup count (not waitlist UX)
- [ ] Owner hard-refresh `/account` — confirm Early access row is gone; Planner marks wipe complete

### Scoped launch fixes (Executor 2026-09-14)

- [x] Room `extension-check` → `/extension` (with `?next=/room/...` when safe), not Chrome Web Store
- [x] Async kept, labeled coming soon (how-it-works, home FAQ, demo toggle, layout/footer/JSON-LD)
- [x] Pricing-copy: async no longer a paid differentiator; `PRICING_ROOM_SIZE_RANGE` (Free 4 / Plus 6 / Pro 15)
- [x] Watch slug + 5 genre hubs + anime-club FAQ: room size + async coming soon
- [ ] Owner smoke: open a room without extension; homepage FAQ async answer; one `/watch/[slug]` lead


### Domain ranking + YouTube heads (Planner 2026-08-20)

- [x] Part 2 chart queries mapped to existing URLs (plan + canvas)
- [ ] Part 1: Ahrefs/Moz baseline
- [ ] Part 1: CWS listing (Website + YT/CR watch party copy)
- [ ] Part 1: Edge Add-ons
- [ ] Part 1: SaaSHub / AlternativeTo / Crunchbase
- [ ] Part 1: Product Hunt after CWS
- [ ] Part 1: 5–10 editorial pitches
- [ ] Part 2: enrich YouTube pillar for 880/720/210 heads — Executor done, awaiting user QA (2026-08-20)
- [ ] Part 2: enrich how-to head — Executor done, awaiting user QA (2026-08-20)
- [ ] Part 2: watch videos together (pillar + apps roundup) — Executor done, awaiting user QA (2026-08-20)
- [x] Part 2: Netflix Party YT + Teleparty YT hijacks — owner excluded (2026-08-20)
- [ ] Planner mark complete after user review of plan

### GSC spike analysis (Executor 2026-08-16)

- [x] Remaining GSC/GA4/Amplitude slices + URL Inspection
- [x] Canvas `anidachi-gsc-spike-analysis.canvas.tsx`
- [x] Scratchpad notes
- [ ] User review canvas + Planner confirm

### Pre-store sideload conversion (Executor 2026-08-14)

- [x] Artifact hub + download/latest/email routes (zip unpublished until Blob env)
- [x] CTA rewire to `/extension` (survey intercept removed from marketing CTAs)
- [x] Room/success/account/join/pricing activation surfaces
- [x] Copy/schema/SEO agent install path
- [x] Production packed key + site-presence content script + unpacked update copy/docs
- [x] Analytics events already in hub; CONVERSION_METRICS + env/secrets updated
- [ ] User manual QA (hero → `/extension`, zip 503 or download, room `?next=`, mobile copy/email)
- [x] Local zip placed: `artifacts/anidachi-chrome-extension-0.1.0.zip` from owner `AniDachi-0.1.0.zip` (gitignored). `/api/extension/download` streams it. Blob copy uploaded for production env.
- [ ] Owner: set `EXTENSION_ZIP_*` on Vercel production so www.anidachi.app serves the zip (local already works)
- [ ] Planner mark complete after QA

### Homepage OG image (Executor 2026-08-14)

- [x] Restyle `opengraph-image.tsx` to match dark landing + Crunchyroll/YouTube
- [x] Web `check` passes
- [x] Replaced generated card with owner graphic (`public/opengraph-image.png`, 1200×630; served by `app/opengraph-image.tsx`)
- [x] User visual confirm (2026-08-14) — owner saw local `/opengraph-image`
- [x] Sitewide: guides/compare/pillars/trust pages use the same OG card; `/watch/[slug]` still uses anime posters (brand card if no poster)
- [x] Commit/push on `staging` (`d856b93` — OG card only; sideload WIP left uncommitted)
- [ ] Planner mark complete after deploy + Telegram `@webpagebot` refresh

### AniDachi SEO audit (Executor — awaiting Planner confirm)

- [x] Install Addy Osmani seo skill (local `.agents/skills/seo`, untracked)
- [x] Critical truth: movies LDR FAQ, root title/OG, home HowTo
- [x] Agent + guidelines + freeze docs (URL stability, winner queue, exit criteria)
- [x] P0/Phase2 enrich: mid CTAs on commercial winners; home FAQ leads with CR+YT
- [x] `seo:portfolio` blocked — Google OAuth insufficient scopes (reconnect Kreatli CRM Google)
- [x] Web `check` + `build` pass; no ranked URL rename/delete
- [x] Home dual-platform from Compare onward (compare table, features, pricing, social proof, survey)
- [x] **Owner-approved 5-page commercial batch (2026-08-11):** netflix-party-for-crunchyroll, best-way-to-watch-youtube-with-friends, teleparty-not-working-youtube, how-to-watch-crunchyroll-together-without-screen-share, does-rave-work-with-youtube + guide-links + parent inbounds
- [x] **Visual redesign (2026-08-12 Executor):** shared `seo-guide-blocks` + applied to all 5; same URLs/SEO truth; `web check` + Impeccable detect clean
- [x] **Landing redesign (2026-08-12 Executor):** brand-first hero, strip eyebrows, asymmetric features, cleaner how-to/FAQ/demo; product truth/IA preserved; `web check` + detect clean
- [x] **Design rollout + feature requests (2026-08-12 Executor):** pillars + top 4 compares + commercial guides + SeoPageLayout/CTA/pricing chrome; `/feature-requests` page+API (CRM/Blob+email); footer/contact/freeze note; check + localhost smoke OK
- [x] **CRM tab mapping (2026-08-12 Executor):** Contact form → Contacts; Feature requests → Survey leads (no waitlist pollution)
- [x] **CRM dedicated tabs (2026-08-12 Executor):** added **Contact forms** + **Feature requests** tabs (Blob JSONL source of truth); Contacts/Survey leads restored to outreach vs survey_lead
- [ ] Planner/manual QA confirm (design + content)

### Keyword Enrichment Implementation (2026-08-03) — Executor

- [x] CR pillar FAQ/snippet/meta + Watch2Gether note (no H1/URL/canonical change)
- [x] CR how-to two-people / Discord / screen-share FAQs + meta
- [x] Discord guide “stream anime on discord” meta/FAQ
- [x] Anime pillar friends/website FAQs + LDR handoff to `/best-apps-watch-anime-together-long-distance`
- [x] vs Teleparty Teleparty×CR meta/FAQ/short answer
- [x] YouTube P0: extension, Teleparty-YT, Discord screenshare, pillar links
- [x] `pnpm --filter @anidachi/web check` + build passed
- [ ] User manual spot-check → Planner confirm

### Keyword Enrichment Analysis (2026-08-02)

- [x] Parse 16 GSC exports → 12 joined path keyword maps
- [x] Diff vs live title/H1/FAQ
- [x] YouTube cluster P0–P2 matrix (19 routes)
- [x] Cannibalization map
- [x] Canvas delivered — awaiting user verify / Planner confirm

### Full SEO Analysis (2026-08-02)

- [x] Connect Amplitude + confirm GA4/GSC properties
- [x] Pull GSC 28d/90d/prior + sitemaps + URL inspect samples
- [x] Pull GA4 organic/funnel (custom dims not registered — gap noted)
- [x] Pull Amplitude funnel (1375 → 325 → 9 → 2 uniques)
- [x] Join/synthesize portfolio + backlog
- [x] Canvas delivered — awaiting user verify / Planner confirm

### SEO Trust & Authority

- [x] Task 1: Portfolio baseline + first-touch attribution (Executor — awaiting user verify)
- [x] Task 2: Technical trust cleanup — safe subset (awaiting user verify)
- [x] Task 3: Entity trust surfaces — additive pages + byline (awaiting user verify)
- [x] Task 4: Consolidate/enrich — top-5 enrich-in-place (user verified 2026-07-28)
- [x] Task 5: Authority program — **cancelled / ignored** by owner (2026-07-28); no benchmark/outreach for now
- [x] Task 6: Rewrite SEO agent + guidelines (user verified via overall plan progress)

### SEO agent critical fixes (Executor — awaiting Planner confirm)

- [x] Agent CR parity + language/CTA/tag rules
- [x] Truth: compare + P0 CR FAQs (YouTube where product-true)
- [x] CR conversion pages (how-to, Teleparty alts, Discord SS)
- [x] Pseo CR crumbs + free page enrichment
- [x] CWS → `/pricing` on CR pillar + key how-tos

## Executor's Feedback or Assistance Requests

- **Executor (2026-09-21 how-it-works HowTo mismatch):** Confirmed Bug 1. Homepage visible step 1 said “via the install page” while `howToSteps` JSON-LD used `INSTALL_HOWTO_STEP_TEXT` only. Aligned both to `INSTALL_HOWTO_STEP_TEXT_VIA_HUB` + CR/YT session note; UI links `/extension`; `howToSteps` maps from `steps`. `pnpm --filter @anidachi/web check` passed. Please spot-check `/#how-it-works` and view-source HowTo step 1 before commit.

- **Executor (2026-09-21 SEO rank+expand, full pass):** On-site Parts 1a–1d and 2a–2d are in the working tree. 2f paste pack is in `docs/current-development-state.md` (Store title/short description, PH/Edge/directory/pitch instructions). Local Ads customer set to `8078204641`. Did **not** persist the leaked Blob token — rotate it first. 2e new URLs not shipped (freeze). Indexing and 28d re-measure wait on production. Please spot-check then say if I should commit on `staging`.

- **Executor (2026-09-19 Session Replay):** Re-enabled via `initAll()` with `sessionReplay.sampleRate: 1` in `apps/web/lib/amplitude.ts`. Privacy copy updated. Local test needs `NEXT_PUBLIC_AMPLITUDE_API_KEY` in `apps/web/.env.local`. Please restart `pnpm dev:web`, open http://localhost:3003/, click around, then check Amplitude Session Replay (allow a few minutes). Look for `sr-client-cfg.amplitude.com` plus replay upload traffic, not only `api2.amplitude.com`.

- **Executor (2026-09-15 Amplitude zip download):** Click handler existed (`extension_zip_download`) but Amplitude never ingested it (taxonomy only had `extension_clicked`). Wired server HTTP on `/api/extension/download`, flush-on-click with shared `insert_id`, and Amplitude no longer gated on gtag. Needs `NEXT_PUBLIC_AMPLITUDE_API_KEY` (or `AMPLITUDE_API_KEY`) on the host. Please click **Download AniDachi (.zip)** on `/extension` then check Amplitude Live for `extension_zip_download`.

- **Executor (2026-09-15 zip download):** Placed owner `AniDachi-0.1.0.zip` at gitignored `artifacts/anidachi-chrome-extension-0.1.0.zip` (687 KB). `/api/extension/download` streams it locally; same bytes uploaded to Vercel Blob. Local `/extension` now shows **Download AniDachi (.zip)** instead of “publishing shortly”. Zip is **not** in git. Production still needs `EXTENSION_ZIP_*` on Vercel. Please hard-refresh http://localhost:3003/extension and click the zip button.

- **Executor (2026-09-14 compare + hub rewrite):** Homepage `#compare` and `#features` are live-only now. Compare: own player, drag layout, overlay chat, hold V, media seats, title detection; Host lock dropped; install CTA + How to Watch Together link. Hub: live sync / overlay layout / PTT+seats; async featured card + guide link removed. Please QA http://localhost:3003/#compare and `/#features`.

- **Executor (2026-09-14 Layout cams + wording):** Layout preview cams are now extension-style green circles (`rounded-full`, teal glass, orange selected border); chat uses blue layout-preview shell. Heading → **Watch on the player** (link: Then watch on the player). Please hard-refresh `#using` Layout.

- **Executor (2026-09-14 Layout animated showcase):** Layout step now loops drag cameras → drag chat → enlarge Camera size (Normal→XL) → Apply pulse, same spirit as the Interface preview. `pnpm --filter @anidachi/web check` passed. Please hard-refresh http://localhost:3003/extension#using and scroll to Layout (step 6).

- **Executor (2026-09-14 Interface animated showcase):** Interface step now embeds the looping preview from the extension (cursor to top-right → bubble reveal; Smart pills on speak/hover). Auto hide / Always visible and Smart / Always visible below the stage drive the animation. `pnpm --filter @anidachi/web check` passed. Please hard-refresh http://localhost:3003/extension#using and scroll to Interface.

- **Executor (2026-09-14 overlay usage A — polish):** Media seats use white/outline radio buttons; emoji hit-ring removed; Layout shows Video (Camera size) + Chat (Live/History); new Invite a friend step (person-plus + Friends & groups). Please hard-refresh http://localhost:3003/extension#using.

- **Executor (2026-09-14 overlay usage A):** `/extension` now has **Use it on the player** after the six install steps (`#using`). Live sync only: bubble → Create room → Layout drag → Voice (hold **V**) → Interface Auto hide. Same section on already-installed and mobile. Please open http://localhost:3003/extension#using and confirm before Planner marks this done. Homepage How it works is unchanged (that is B).

- **Executor (2026-09-14 compare = live sync):** Homepage `#compare` no longer claims async. Rows are own player, drag layout, overlay chat, PTT, detection, host lock. Homepage FAQ still sells async — say if you want that stripped too.

- **Executor (2026-09-14 pricing/extension copy):** Removed the two intro banners on `/pricing`. Distilled `/extension` to a short Store line + 5 scannable steps; FAQ collapsed. Please refresh both pages.

- **Executor (2026-09-14 Pricing nav):** Nav Pricing now always goes to `/pricing` (desktop, tablet, mobile drawer) instead of homepage `/#pricing`. Terms “pricing page” link matches. Please click Pricing from `/`.

- **Executor (2026-09-14 CWS pending note):** `/extension` now explains the Store gap as Chrome’s standard listing review plus publisher verification — not a warning. Same FAQ JSON-LD. Please refresh http://localhost:3003/extension and check the intro + first FAQ.

- **Executor (2026-09-14 homepage follow-ups):** Hero count now shows the live CRM number (local empty store was hiding it; localhost falls back to production `waitlist-stats` → 828). Nav “How It Works” → **Pricing**. Compare table rewritten around async, overlay cams/PTT, episode-pinned chat, detection, history vs Teleparty/CR Party/Discord. `/extension` restyled to cream account language (logo row, ani tokens, no amber). `pnpm --filter @anidachi/web check` passed. Please refresh `/` and `/extension`.

- **Executor (2026-09-14 survey prune):** Removed the public plan survey. `/pricing` no longer has “Not sure yet? Get early access”. Deleted modal/provider, `PricingSurveyLink`, `/api/subscribe-interest`, `/api/waitlist-position`, unused Discord walkthrough. `/join` waitlist + CRM waitlist tab remain (historical survey tags still parse). `pnpm --filter @anidachi/web check` passed. Please QA http://localhost:3003/pricing and `/` — Plus/Pro still say “Get early access” as Stripe checkout labels.

- **Executor (2026-09-14 leftover washes):** Quieted orange washes on `/pricing` (install banner + footer links), `/contact` + `/feature-requests` (removed radial overlay; cream fields/CTAs), `/join/complete` + `/success` (quiet panels, numbered pills, Discord save). Survey step-7 glow border / recommended badge / refund wash also quiet. Checks stay sparse `ani-progress`. Overlay demo, CRM, Blou, account filled orange untouched. `pnpm --filter @anidachi/web check` passed. Please QA http://localhost:3003/pricing, `/contact`, `/feature-requests`, `/join/complete`, `/success`. Planner should not mark the restyle complete until you confirm.

- **Executor (2026-09-13 sitewide brand):** Remaining marketing/product chrome now uses the account language (cream actions, canvas/panel/line, no glow orbs). Shared SEO layout + guide blocks, `/extension` hub, auth shell, contact/feature forms, plan survey, success/join CTAs. `--primary` still orange for CRM/Blou. Overlay demo unchanged. Typecheck passed. Please spot-check `/extension`, a guide, `/about`, `/pricing`, `/login`.

- **Executor (2026-09-13 layout drag):** Layout beat now *shows* drag: cameras slide inward/up, then chat slides toward the top of the grid; dashed ghosts on the player follow. Cameras and chat are also pointer-draggable in the preview (grab cursor). Caption: “Drag cameras and chat on the grid…”. Typecheck passed. Refresh `http://localhost:3003/#demo` and watch the Layout step (or drag the green cameras / blue chat yourself).

- **Executor (2026-09-13 layout setup):** Layout beat is in the live demo: Settings → Layout shows the 16:9 grid, Video/Chat toggle, camera-size slider, Revert/Apply, and dashed camera/chat ghosts on the player. People list hides while Layout is open so the editor stays on screen; the loop holds that beat ~3.6s. `pnpm --filter @anidachi/web check` passed. Owner will QA locally — do not start the web server. Spot-check `/#demo` Live: step rail includes Layout; after Create room the panel should show the grid editor + ghosts, then Friends join.

- **Executor (2026-09-13 demo overlay):** Homepage live demo now matches the current extension overlay (account header + camera switch, People rows, Reactions/Layout/Interface/Voice tabs, reaction-key grid, right-edge room rail, cam stack, stacked live chat, composer). Async bubble uses the same overlay bubble. `pnpm --filter @anidachi/web check` passed. Please visually QA `/` demo (desktop + phone) at http://localhost:3003/#demo then Planner can mark complete.

- **Executor (2026-09-13):** Landing restyle is in the working tree (not committed). `pnpm --filter @anidachi/web check` passed. Browser: `/` desktop cream hero + pricing cards; 390 stacked CTAs; `/extension` and `/pricing` pick up cream nav. Please visually QA `/` at http://localhost:3003 then Planner can mark complete.

- **Executor (2026-08-20):** Part 2 enrich-in-place shipped locally (same URLs). Pages: `/watch-youtube-together`, `/guides/how-to-watch-youtube-with-friends`, `/guides/best-apps-to-watch-youtube-together`. `pnpm --filter @anidachi/web check` + `build` pass. Please spot-check titles, H1s, install CTAs (`/extension` not `/pricing`), and the “watch videos together” YouTube+Crunchyroll (not Netflix) notes. Then Planner can mark the three Part 2 tasks complete. Part 1 (CWS/Edge/directories) still owner ops. Recrawl the pillar after CWS is live.

- **Executor (2026-08-20):** Owner said execute. Enriching Part 2 in place on existing URLs (pillar → how-to → apps roundup). No new paths. Part 1 (CWS/Edge/directories/PH/pitches) still owner ops. Please spot-check `/watch-youtube-together` after this wave before Planner marks the pillar task complete.

- **Planner (2026-08-20):** Part 2 added to domain ranking plan. Owner: contest Keyword Planner product-true heads (`youtube watch party`, `watch youtube together`, `watch videos together`, `watch youtube with friends` / how-to). Owner excluded `netflix party youtube` and `teleparty youtube` from Part 2. Freeze unchanged (no new marketing URLs). Please review Part 2 before Executor enrich.

- **Executor (2026-08-19 directories):** 20 free, relevant submit targets for AniDachi backlinks. Canvas: `anidachi-free-backlink-directories.canvas.tsx`. Website on every form: `https://www.anidachi.app`. Alternatives: Teleparty, Watch2Gether, Rave. Skipped Uneed (free queue closed 17 Aug 2026), AI dirs, spam farms, Chrome Web Store ($5 — still do it). Product Hunt: draft now, launch after CWS. Highest-leverage free listing is Microsoft Edge Add-ons. Please review the canvas; no site code changed.

- **Executor (2026-08-25 Apollo ops):** Tuesday status check (~09:41 UTC). Mailbox **active** (80/day · 20/hour · 100s). Sequence **active**. **Mon Aug 24:** 79 sent + 5 failed. **Today:** 0 sent yet, **155 scheduled** (82 T1 / 42 T2 / 17 T3 / 14 T4) — **no enroll**. Due window **12:00–15:06 UTC**; Apollo should auto-drain to daily 80. Delay flags still present (`scheduled_window_closed` 56, `daily_limit_reached` 37, `step_limit_reached` 19). Step caps still **50/day per step** (UI). Overfill is fine; leftover rolls tomorrow.
- **Executor (2026-08-20 Apollo ops):** Hourly was set to `0` and blocked all sends (`hourly_limit_reached`). User fixed to **20/hour**. Confirmed mailbox: **80/day · 20/hour · 100s delay**. Today **95** already queued (42 T1 / 15 T2 / 29 T3 / 9 T4) — **no enroll**. Due times pushed to **~17:02 UTC**; Apollo should auto-drain at ~20/hr. ~15 may roll past daily 80. Aug 19 likely sent **0** while hourly was broken.
  - **Send window:** updated default schedule `Normal Business Hours` to **24/7** (`[0,24]` all days, `skip_holidays=false`, still uses contact timezone). Was Mon–Fri 8–17.
- **Executor (2026-08-19 Apollo ops):** Mailbox limits raised to **80/day**, no hourly cap, 100s delay. Enrolled **+52** Email 1 from GSheet. Today **80/80** target: **28 follow-ups (T2+T3) + 52 new T1**. Removed `photography@bildcraft.de` + `jf@drehmoment-film.de`. **~118 eligible** remain in GSheet (~1.5 more days at 80/day new enrollments, but follow-ups will fill most of the cap).
  - **Lesson:** added `photography@` to GENERIC_PREFIX blocklist. Apollo hourly=`0` means “send nothing,” not unlimited.
- **Executor (2026-08-18 Apollo ops):** Enrolled +9 Email 1, then +22 on Mon Aug 17. Removed 2 contacts.

- **Executor (2026-08-16):** GSC spike analysis complete (measurement only). Canvas: `anidachi-gsc-spike-analysis.canvas.tsx`.
  - **Window:** week of 25 May → June. May 4.3 clicks/day + 113 imp/day → June 29.9 + 1,122. July 41.8 clicks/day; 1–14 Aug ~33/day (plateau). Discover = 0.
  - **Why not sooner:** commercial spokes did not exist until 23 Apr (`11ff625`). Pre-April GSC is brand `anidachi` + quit-smoking/Blou noise. `watch anime together` had 1 impression.
  - **Why late May:** confirmed May 2026 core update 21 May–2 Jun. WAT 36→230 imp on 29 May; CR pillar first impression that day. Site 55→133→429 imp 23–29 May.
  - **Two engines:** OVA 0 May → 10,488 Jun impressions / 2 clicks. Click growth: WAT +274, home +244, CR +121, brand query 65→211 (share 49%→23%).
  - **GA4:** organic sessions 234 → 956 → 1,417; organic share 29%→59%. Direct fell in June.
  - **Inspect:** home/WAT Google-canonical apex; CR+OVA indexed on www with user canonical still apex. CR last crawl 29 Jun.
  - Please open the canvas. Planner confirm after review. No URL/H1 changes recommended.

- **Executor (2026-08-14):** Restored the live hero counter (same `/api/waitlist-stats` CRM count as pre-launch). Copy: “Join X people already watching together today.” Also under the `/extension` zip button. Please refresh homepage + `/extension`.
- **Executor (2026-08-14 sideload):** Remaining plan todos (packed key, presence ping, analytics/env docs) are implemented. Checks: web `check` + `build`; extension `check` + 1016 tests; staging validate; production-channel validate (packed `key` present, no broad matches). Please QA: home “Download for Chrome” → `/extension`; zip button (503 until Blob env); room missing-ext → `/extension?next=/room/...`; phone copy/email. Do **not** Load unpacked a zip file — unzip first. Zip publishing is still an owner ops step (`pnpm build:extension:public`, Blob, `EXTENSION_ZIP_*`). Awaiting Planner confirm before marking the project complete.
- **Executor (2026-08-14):** Owner OG graphic is now sitewide (guides, compare, pillars, pricing, about). `/watch/[slug]` still uses the anime poster. Pushed to **`staging`** as `d856b93` (OG only; sideload WIP left uncommitted). Follow-up `ef64ac7` removed duplicate `openGraph`/`twitter` `images` keys that broke `pnpm build`. After deploy, refresh Telegram with `@webpagebot`.
- **Executor (2026-08-12):** Cleared CRM **Contacts** (outreach only), **Contact forms**, and **Feature requests** Blob archives; Survey leads kept. Hard-refresh `/kreatli-email-crm` to see zeros.
- **Executor (2026-08-12):** Added CRM tabs **Contact forms** + **Feature requests** (reads Blob JSONL). Contacts/Survey leads back to outreach vs survey only. Hard-refresh `/kreatli-email-crm` — your earlier submissions should show in the new tabs.
- **Executor (2026-08-12):** Submissions lived in Blob JSONL but CRM tabs missed them — `contacts.json` writes used private access on a public store. Fixed `BLOB_ACCESS` default to public, hardened JSONL append, restored contact into CRM. **Where to look:** `/kreatli-email-crm` → Contacts (contact form) + Survey leads (feature request). Restart local `pnpm dev:web` so env picks up. Hard-refresh CRM.
- **Executor (2026-08-12):** CRM tabs wired — **Contact form → Contacts**, **Feature requests → Survey leads** (`feature_request` segment; waitlist still only `survey_lead`). Spot-check Kreatli CRM after a test submit of each form.
- **Executor (2026-08-12):** Design rollout + `/feature-requests` shipped. Spot-check pillars, compares, `/pricing`, `/feature-requests` submit; then Planner confirm.
- **Executor (2026-08-12):** Landing page redesign (preserve brand/IA). Spot-check http://localhost:3003/ — hero brand signal, demo continuity, features asymmetry, FAQ accordion, pricing header. Then Planner confirm.
- **Executor (2026-08-12):** Redesigned the 5 commercial guides with shared blocks (`SeoGuideAnswer`, options, steps, related). Same URLs/H1 intent/FAQ/CTAs. Please spot-check visually on desktop + mobile, then Planner confirm. Optional follow-up: `$impeccable init` for PRODUCT.md.
- **Executor (2026-08-11):** SEO audit + dual-platform home + 5 commercial guides committed. Please spot-check new URLs + home Compare→FAQ. Planner confirm when QA looks good.

- **Executor (2026-08-03):** Keyword enrichment batch implemented (freeze-safe). No URL/canonical/H1 changes.
  - Pages: `/watch-crunchyroll-together`, `/guides/how-to-watch-crunchyroll-with-friends`, `/guides/how-to-watch-anime-with-friends-on-discord`, `/watch-anime-together`, `/compare/anidachi-vs-teleparty`, `/guides/youtube-watch-party-chrome-extension`, `/guides/does-teleparty-work-with-youtube`, `/guides/can-you-screen-share-youtube-on-discord`, `/watch-youtube-together`.
  - Changes: meta descriptions, FAQ aliases matching GSC queries, short-answer SERP phrasing, internal handoff links, `dateModified` → 2026-08-03.
  - Verified: web `check` + `build` OK.
  - Please spot-check a few pages in the browser (titles/FAQs look right; URLs unchanged). Then Planner can mark the batch complete.

- **Executor (2026-08-02):** Keyword enrichment analysis complete. Canvas: `anidachi-keyword-enrichment.canvas.tsx`.
  - Joined 16 GSC page exports (3mo) into 12 paths; top enrich: CR pillar does/can/is-there zero-clicks (~500 imp), Discord “stream anime on discord” (166 imp / 0.6% CTR), CR how-to two-people/Discord FAQs, anime pillar friends/website variants, vs Teleparty Teleparty×CR.
  - Cannibal: home still ranks for watch-anime-together + CR party — defer to pillars via links, not home retarget.
  - YouTube: P0 = chrome-extension (pos~3), does-teleparty-work-YT, discord screenshare, pillar; no new URLs; wait on crawl for P2 alts.
  - Please review canvas; approve an Executor enrich-in-place batch if desired (FAQ/meta only first).

- **Executor (2026-08-02):** Full SEO analysis complete (measurement only; no site mutations). Canvas: `anidachi-seo-analysis.canvas.tsx`.
  - **28d GSC:** 1,172 clicks / 40,722 impressions / 2.88% CTR / pos 9.08 · **MoM clicks +25%**
  - **90d GSC:** 2,285 clicks / 81,145 impressions
  - **vs Mar–Jun baseline** (~370 clicks / 7.3k imp): ~3.2× clicks and ~5.6× impressions in one 28d window
  - **GA4:** Organic 1,286 sessions (51% of 2,532); Direct bounce 86%
  - **Amplitude funnel:** CTA imp 1,375 → click 325 → checkout start 9 → redirect OK 2
  - **All checkout starts on `/`** — CR/pillar CTAs do not reach Stripe
  - **P0 enrich:** `/glossary/ova-meaning` (13.8k imp / 0.02% CTR), `/watch-crunchyroll-together`, CR/Discord how-tos, `/watch-anime-together` CTA→checkout gap
  - **Gaps:** register GA4 custom dims `seo_landing_path` + `metric_name`; mark key events; confirm Coverage UI (sitemap indexed=0 via API)
  - Please open the canvas and confirm; Planner should mark the analysis task complete after review. Optional next: Executor enrich-in-place for P0 list only.

- **Planner (2026-07-28):** SEO Trust plan closed for current scope. Task 5 (original benchmark + outreach) explicitly skipped by owner. Safe additive work (1–4, 6) is done. Optional later: CRM Google reconnect for local `seo:portfolio`.

## Lessons

- Public plan survey is gone: do not reintroduce `PlanSurveyProvider` or `/api/subscribe-interest`. Public waitlist is gone (`/join` redirects to `/login`). CRM waitlist tab can keep historical `survey_lead` rows. Plus/Pro cards say **Start Plus / Start Pro**. Signup social proof uses `/api/waitlist-stats` with “signed up on AniDachi” copy.
- Quiet leftover orange on marketing pages: `border-ani-line` + `bg-ani-panel` / `bg-ani-selected-quiet`; keep checks as sparse `text-ani-progress`. Do not invent `PRICING_REFUND_NOTE` — `/pricing` FAQ uses `PRICING_CANCELLATION_NOTE`. `FeatureRequestForm` must keep `variant` / `initialContact` for `/account/feature-requests`.
- YouTube head terms (`youtube watch party` 880, `watch youtube together` 720) are a fight on existing URLs, not a skip. Crunchyroll at pos ~6 proved a new site can rank a commercial query; YouTube needs CWS + referring domains + one hub. Do not ship a `/guides/youtube-watch-party` twin. Owner excluded `netflix party youtube` and `teleparty youtube` from Part 2. Still skip W2G brand vanity, movies/Prime, YT Music, Messenger, android/phone/YT TV/Shorts.
- AniDachi GSC “sudden traffic” in May–June 2026 is publish (23 Apr spokes) + ~4 week crawl lag + May 2026 core update scoring — not Google finding a year-old homepage. Glossary OVA impressions are a separate vanity engine (0.02% CTR) and must not be mixed with commercial clicks.
- AniDachi homepage link previews come from `apps/web/app/opengraph-image.tsx` serving `public/opengraph-image.png` (1200×630). A static `app/opengraph-image.png` 404s under Turbopack. Telegram caches the page forever until `@webpagebot` re-fetches; already-sent messages never update. Changing the OG image URL/hash (`?v=` + tsx content) is required when the bot still shows the old card.
- AniDachi: **never create a feature branch** for normal web/SEO work — commit and push on **`staging`** only (user rule 2026-08-12).
- Composio session_id from latest `COMPOSIO_SEARCH_TOOLS` must be reused (`knew` for 2026-08-16 GSC spike analysis; `ants` was 2026-08-02).
- GA4 event params are not queryable as `customEvent:*` until registered as custom dimensions in GA4 Admin.
- GSC sitemap `contents.indexed` often returns `0` even when pages are indexed — use URL Inspection + Coverage UI.
- `seo:keywords` must compare against the **full** public route inventory, not only top GSC/GA4 pages, or it invents “untapped” intents that already have URLs.
- Sitemap/`seo:portfolio` scripts must run with cwd `apps/web` (`pnpm --filter @anidachi/web`) so `discoverStaticSitemapUrlPaths` finds `app/`.
- **Owner constraint (2026-07-28):** Further SEO trust work must not impact core flows or current ranking/indexation. Additive/reversible only. No 301/noindex/URL removal, no force-index sitemap deletion while Coverage recovers, no footer/nav crawl-path shrinkage, no high-traffic H1/intent rewrites — without explicit owner approval + GSC evidence.
- First-touch `captureFirstLandingPath` must re-run on `usePathname()` changes so `/login` → guide SPA hops still attribute correctly.
- Do not commit `my-video/`, `apps/web/tmp/`, or incidental `anime-jikan-cache.json` churn from failed Jikan fetches during build.
- Pre-store Chrome: never commit extension zips or `.pem`; public zip is Blob + `EXTENSION_ZIP_URL`. Production packed `key` is production-only so unpacked IDs stay stable. Site ping is a dedicated content script — do not add anidachi.app to overlay `content.tsx` matches. Unpacked installs do not auto-update.
- **CWS live (2026-09-21):** Public SEO HowTo/body must use `INSTALL_HOWTO_STEP_TEXT` (Add to Chrome). Keep `/extension` as CTA. Leave Load unpacked only on the install hub sideload branch. Do not claim async is live — label Planned. Title/meta only on ranked pages; freeze H1/path/canonical. CTR trap: do not answer the query in the meta description (Teleparty compare previously started with “Does Teleparty work with Crunchyroll? Yes”).

## Background and Motivation (historical)

**(Active — 2026-07-26)** SEO agent critical fixes (YT + CR parity): agent playbook CR conversion stack + product-truth / mid-CTA / `/pricing` install alignment. Plan: `.cursor/plans/seo_agent_critical_fixes_a6487aa6.plan.md`.

~~YouTube SEO batch 2… conversion polish~~ (prior; completed — awaiting Planner confirm on polish QA).

## High-level Task Breakdown (historical)

### SEO agent critical fixes (Planner → Executor 2026-07-26)

1. Agent CR parity + Soft-pedal/voice/global CTA/mid-CTA/tag rules + YT map polish + `PRICING_CR_PRICING_SNIPPET`.
2. Fix AniDachi Crunchyroll-only claims on compare + P0 CR FAQs.
3. CR how-to HowTo+CTAs; Teleparty/Discord SS mid CTAs; narrow related tags.
4. Pseo CR breadcrumbs under CR pillar; enrich `crunchyroll-watch-party-free`.
5. Align CR pillar + key how-tos install steps to `/pricing` until CWS live.
   - Success: check/build pass; no “only for Crunchyroll” FAQs; CR how-to matches YT density.

### YouTube conversion polish (Executor — awaiting Planner confirm)

- [x] YouTube pricing helpers (`pricing-copy.ts`)
- [x] Enrich P0 pages + pillar Start-here list
- [x] P1 + P2 light pass (+ 3 older YT guides → `*_YOUTUBE_*` free FAQ)
- [x] SEO agent playbook update
- [x] Web check + build ✅ (2026-07-26); check re-run after FAQ swaps

### Completed (YouTube SEO batch 2 — 2026-07-26)

- [x] 10 KP-validated YouTube guide pages
- [x] guide-links + pillar wiring
- [x] web check + build

### Completed (prior watch-page batches — historical)

### Next batch (10 new watch pages)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks (`watch-anime-together`, `best-anime-to-watch-with-friends`) + bump `dateModified`
- [x] Run `npm run build`

## Key Challenges and Analysis

- Batch 2 pages are KP-valid but thin on conversion (meta promotes competitors equally; FAQ repeats “Is AniDachi free?”; agent jargon in FAQs; mid CTA underused).
- Head-term money sits on `/watch-youtube-together` (1k/720) — enrich pillar over shipping more 10/mo clones.
- SEO agent lacked KP gate, cannibalization map, and YT-specific conversion checklist → future batches risk more thin spokes.

## Executor's Feedback or Assistance Requests

- **Executor (SEO agent critical fixes):** All plan todos done. Check/build pending/complete — please confirm as Planner.
- **Manual QA checklist (agent critical fixes):**
  1. `/guides/how-to-watch-crunchyroll-with-friends` — HowToJsonLd, fold + mid CTA, `/pricing` install.
  2. `/guides/crunchyroll-watch-party-free` — conversion-class twin of YT free; CR crumbs.
  3. Compare FAQs (syncplay, netflix, rave, amazon, metastream) — not “Crunchyroll only.”
  4. Pseo CR guides (e.g. group-watch) — crumbs under Watch Crunchyroll Together.
  5. CR pillar HowTo — install via `/pricing`, not Chrome Web Store.
- **Executor (conversion polish):** Steps 1–5 done. Check + build passed. Please confirm as Planner when manual QA looks good.
- **Manual QA checklist (conversion polish):**
  1. `/watch-youtube-together` — “Start here” list + mid CTA → `/pricing`; FAQ uses YouTube-safe free answer.
  2. `/guides/youtube-watch-party-free` + Teleparty/Discord SS YT guides — CTR metas, mid CTA, no agent jargon.
  3. Rave/Kast/does-youtube + host/sync/group/without-SS — pricing snippets (not full free FAQ spam); no Crunchyroll-only FAQ text.
  4. Spot-check older YT guides (`best-apps…`, `how-to-watch-youtube-with-friends`, chrome-extension) — free FAQ mentions YouTube.
  5. After deploy: SERP title/description + pricing conversion by landing path.

### Additional batch (10 more watch pages — 2026-05-12)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks + bump `dateModified` → `2026-05-12`
- [x] Run `npm run build` ✅ (2026-05-12)

### Additional batch (10 more watch pages — 2026-05-14)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks + bump `dateModified` → `2026-05-14`
- [x] Run `npm run build` ✅ (2026-05-14)

### Additional batch (10 more watch pages — 2026-05-15)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks + bump `dateModified` → `2026-05-15` (list **86+**)
- [x] Run `npm run build` ✅ (2026-05-15)

### SEO batch — 10 high-leverage pages (2026-06-04)

**5 new watch pages** (high-traffic titles not previously in `animeList`):
- `sailor-moon` — MAL 530 — iconic magical-girl classic, nostalgic marathons
- `weathering-with-you` — MAL 38826 — Shinkai film, debate-worthy ending
- `suzume` — MAL 50265 — Shinkai film, grief + road-trip
- `my-neighbor-totoro` — MAL 523 — Ghibli classic, universal beginner entry
- `pokemon` — MAL 527 — most recognized anime franchise, nostalgic marathon

**3 new listicle guides** (new keyword buckets):
- `app/guides/best-shonen-anime-to-watch-with-friends/page.tsx` — covers action, sports, long-run shonen
- `app/guides/best-classic-anime-to-watch-with-friends/page.tsx` — 90s–2000s TV series + Ghibli/Shinkai classics
- `app/guides/best-anime-to-binge-with-friends-this-weekend/page.tsx` — complete/arc-complete series by length

**2 new glossary entries** (topical authority + AEO):
- `app/glossary/anime-filler/page.tsx` — definition, filler percentages per series, skip guide
- `app/glossary/ova-meaning/page.tsx` — OVA vs TV, OVA types, watch order for groups

**Hub/listicle wiring:**
- `best-anime-to-watch-with-friends` updated to **115+**, `dateModified` → `2026-06-04`
- `watch-anime-together` `dateModified` → `2026-06-04`
- `best-anime-to-watch-for-beginners` +1 entry (My Neighbor Totoro), **30**, `dateModified` → `2026-06-04`

**Stripe fix (bonus):** Moved module-level `new Stripe(...)` into lazy `getStripe()` helpers in 3 API routes to fix `npm run build` failure when `STRIPE_SECRET_KEY` is absent locally.

- [x] Build ✅ — 176 watch pages generated (2026-06-04)

### Additional batch (10 more watch pages — 2026-05-19)

New slugs (high-traffic + Crunchyroll group-watch intent):

- `oregairu` (My Teen Romantic Comedy SNAFU) — MAL 14813
- `ouran-high-school-host-club` — MAL 179
- `the-melancholy-of-haruhi-suzumiya` — MAL 904
- `another` — MAL 11111
- `charlotte` — MAL 28999
- `nisekoi` — MAL 20785
- `akira` — MAL 47 (Movie)
- `highschool-dxd` — MAL 11617
- `cardcaptor-sakura` — MAL 232
- `date-a-live` — MAL 15583

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Jikan cache updated: 10 new slugs cached, 0 failures
- [x] Hub backlinks: `watch-anime-together` `dateModified` → `2026-05-19`; `best-anime-to-watch-with-friends` count → **107+**, `dateModified` → `2026-05-19`
- [x] Run `npm run build` ✅ (2026-05-19) — 160 titles, 227 static pages generated

## Current Status / Progress Tracking

- Added 5 new watch slugs to `animeList` and wired hub/listicle backlinks:
  - `odd-taxi`
  - `k-on`
  - `a-silent-voice`
  - `your-name`
  - `slam-dunk`
- Added MAL ID mappings for the 5 new slugs in `lib/anime-mal-ids.ts` so watch pages can fetch poster/score via Jikan.
- Build check: `npm run build` ✅
- Next: manual spot-check a couple pages in the browser (e.g. `/watch/odd-taxi-with-friends`).

- Added 10 new watch slugs to `animeList` and wired hub/listicle backlinks:
  - `kuroko-no-basket`
  - `hajime-no-ippo`
  - `kakegurui`
  - `nichijou`
  - `the-eminence-in-shadow`
  - `rascal-does-not-dream-of-bunny-girl-senpai`
  - `spirited-away`
  - `howls-moving-castle`
  - `princess-mononoke`
  - `perfect-blue`
- Added MAL ID mappings for the 10 new slugs in `lib/anime-mal-ids.ts`.
- Hub/listicle updates:
  - `app/watch-anime-together/page.tsx` (`dateModified` → `2026-05-09`)
  - `app/guides/best-anime-to-watch-with-friends/page.tsx` (`dateModified` → `2026-05-09`, updated count to `56+`)
- Build check: `npm run build` ✅
- Spot-check: `GET /watch/nichijou-with-friends` and `GET /watch/princess-mononoke-with-friends` returned `200` on local prod server; canonical emitted as `https://anidachi.app/watch/nichijou-with-friends`.

- **Additional 10 (2026-05-12):** new slugs:
  - `initial-d`
  - `soul-eater`
  - `bungo-stray-dogs`
  - `fate-zero`
  - `hellsing-ultimate`
  - `yuri-on-ice`
  - `land-of-the-lustrous`
  - `re-creators`
  - `kabaneri-of-the-iron-fortress`
  - `barakamon`
- Hub/listicle: `watch-anime-together` + `best-anime-to-watch-with-friends` list bumped to **66+** picks; `dateModified` set to `2026-05-12`.
- Build: `npm run build` ✅; prerender output includes `/watch/soul-eater-with-friends` verified via `.next` prerender manifest (local `curl` to dev server was `404` when dev not running — use `npm start` or dev server for live HTTP checks).

- **Additional 10 (2026-05-14):** new slugs:
  - `goblin-slayer`
  - `rising-of-the-shield-hero`
  - `clannad`
  - `serial-experiments-lain` (also resolves `neon-genesis-evangelion` → `related` reference that was previously dangling)
  - `ergo-proxy`
  - `black-lagoon`
  - `durarara`
  - `baccano`
  - `log-horizon`
  - `paranoia-agent`
- Hub/listicle: list bumped to **76+** picks; `dateModified` → `2026-05-14` on hub + guide.

- **Additional 10 (2026-05-15):** `danmachi`, `anohana`, `plastic-memories`, `planetes`, `claymore`, `quintessential-quintuplets`, `keep-your-hands-off-eizouken`, `kingdom`, `spice-and-wolf`, `the-devil-is-a-part-timer` — also resolves dangling `related` refs (claymore, quintuplets, eizouken, kingdom). List **86+**; `dateModified` → `2026-05-15`. Build ✅.

### Post-payment success page (Discord contact)

- Added a Discord contact block to the Stripe Checkout success page (`/success`) so subscribers can reach out via Discord in addition to email.
- Removed the bottom action buttons from `/success`.
- Added an optional Discord username field on `/success` that saves to Stripe Customer metadata (key: `anidachi_discord_contact`) using the `session_id` from the success URL.
- Build check: `npm run build` ✅

## GSC SEO Optimisation Batch (2026-06-08)

### What was done
Live GSC data (Mar 9 – Jun 5 2026) pulled via Composio. Site had ~7,300 impressions / ~370 clicks (5% blended CTR). Key findings and all changes below.

**Technical fix:**
- `apps/web/next.config.ts` — added 301 redirect `anidachi.app/* → www.anidachi.app/*` to consolidate the www/non-www PageRank split (was costing ~33% of homepage authority).

**Content / SEO changes (`dateModified` bumped to 2026-06-08 on all):**

| File | Changes |
|------|---------|
| `app/watch-anime-together/page.tsx` | Title → includes "anime watch party"; new H2 "Host an Anime Watch Party Online"; new H2 "Watch Anime Together Long Distance" (59 impressions trapped at pos 9, 0 clicks); 4 new FAQ entries |
| `app/watch-crunchyroll-together/page.tsx` | Title rewrite; 4 new FAQ entries: "Does Crunchyroll have watch party?", Teleparty, group watch; new "Crunchyroll Group Watch Tips" H2 section |
| `app/guides/how-to-watch-crunchyroll-with-friends/page.tsx` | Title → "Crunchyroll Watch Party Guide (2026)"; H1 rewrite; 5 new FAQ entries for all "does crunchyroll have…" / "can you…" variants |
| `app/glossary/ova-meaning/page.tsx` | Title → "What Does OVA Mean in Anime?" (377 imp, 0 clicks hidden gem); new "OVA Full Form" section; "Famous OVAs by Series" section (Haikyuu, AoT, Demon Slayer examples); 5 new FAQ entries |
| `app/guides/how-to-watch-anime-with-friends-on-discord/page.tsx` | Title → "How to Stream Anime on Discord & Run an Anime Watch Party"; new "Discord Anime Watch Party" section; 2 new FAQ entries |
| `app/compare/anidachi-vs-kast/page.tsx` | Title → "Best Kast Alternative for Crunchyroll Anime" |
| `app/compare/anidachi-vs-scener/page.tsx` | Title → "Best Scener Alternative for Anime Watch Parties" |
| `app/compare/anidachi-vs-syncplay/page.tsx` | Title → "Best Syncplay Alternative for Crunchyroll Anime" |
| `app/compare/anidachi-vs-discord-screen-share/page.tsx` | Title → "Crunchyroll vs Discord Screen Share" |

**Build:** `npm run build` ✅ (2026-06-08)

**Remaining (Tier 3, not done):**
- `/guides/best-anime-to-watch-with-friends` — ranks pos 18 for own keyword, needs content expansion

## Executor's Feedback or Assistance Requests

- **Planner / user:** Please manually spot-check at least 2 of the new watch URLs (e.g. `/watch/soul-eater-with-friends`, `/watch/initial-d-with-friends`) in the browser with `npm run dev` or `npm start` running; confirm `200`, layout, and canonical. Executor validated via `npm run build` + prerender manifest.

- Please manually load `/success` in your browser and confirm:
  - The “Contact via Discord” box is visible.
  - “Copy username” copies `.profun`.
  - “Open Discord profile” opens your Discord profile in a new tab/window.
  - The two buttons shown previously (Explore AniDachi / Contact Us) are gone.
  - The Discord username field appears; when arriving from Stripe (has `?session_id=...`), clicking Save shows “Saved”.

### Proposed next 10 `/watch/[slug]-with-friends` pages

Goal: expand high-intent “watch {anime} with friends” landers for titles with strong brand demand + group-watch energy, optimized to convert into the paid subscription checkout (primary CTA remains `/#pricing` on watch pages per existing template).

1. `kuroko-no-basket`
2. `hajime-no-ippo`
3. `kakegurui`
4. `nichijou`
5. `the-eminence-in-shadow`
6. `rascal-does-not-dream-of-bunny-girl-senpai`
7. `spirited-away`
8. `howls-moving-castle`
9. `princess-mononoke`
10. `perfect-blue`

### Additional batch slugs (implemented 2026-05-12)

1. `initial-d`
2. `soul-eater`
3. `bungo-stray-dogs`
4. `fate-zero`
5. `hellsing-ultimate`
6. `yuri-on-ice`
7. `land-of-the-lustrous`
8. `re-creators`
9. `kabaneri-of-the-iron-fortress`
10. `barakamon`

### Additional batch slugs (implemented 2026-05-14)

1. `goblin-slayer`
2. `rising-of-the-shield-hero`
3. `clannad`
4. `serial-experiments-lain`
5. `ergo-proxy`
6. `black-lagoon`
7. `durarara`
8. `baccano`
9. `log-horizon`
10. `paranoia-agent`

## Lessons

- If terminal output indicates vulnerabilities, run `npm audit` before continuing.

---

## Sitewide CTA → Plan-Picker Survey (Planner Notes)

### What you asked for

Analyze all CTAs across the site that currently send users to “plans/pricing” (primarily `/#pricing`) and make them **open the same plan-picking survey modal** that exists in the homepage hero (“Help me pick a plan”), instead of navigating to pricing.

### What exists today (relevant CTA surfaces found)

- **Hero survey modal** (already correct behavior): `components/hero.tsx`
  - Primary hero CTA opens the survey modal (no navigation).
- **Sitewide CTAs that currently navigate to pricing** (need to change):
  - Nav “Pricing” link: `components/nav-pricing-link.tsx` → `href="/#pricing"`
  - Nav “Pick a Plan” button: `components/nav-pricing-button.tsx` → `href="/#pricing"`
  - Home features bottom CTA: `components/main-app-features.tsx` → `href="#pricing"`
  - Footer “Pricing” link: `components/footer.tsx` → `href="/#pricing"`
  - SEO page checkout CTA blocks: `components/primary-checkout-cta.tsx` → `href="/#pricing"`
    - Rendered on SEO templates via `components/seo-page-layout.tsx` (above-fold + bottom).
- **Pricing section** (`components/pricing.tsx`) does **not** navigate; it starts Stripe checkout directly. Not part of the “redirect to plans” issue.

### Key challenges and analysis

- The survey modal currently lives _inside_ `components/hero.tsx`, so other pages/components cannot open it without:
  - prop-drilling an `openSurvey()` function everywhere, or
  - a global event bus, or
  - a dedicated React context/provider mounted in `app/layout.tsx`.
- Because the user selected **sitewide**, we need the survey modal to be available on guides/compare/watch pages too (not just `/`).
- Some CTAs are in server components (`components/footer.tsx`) today, so adding `onClick` logic requires either:
  - switching `Footer` to a client component, or
  - extracting the “Pricing” link into a small client component.

### High-level Task Breakdown (implementation plan)

1. **Extract the hero survey modal into a reusable sitewide component**
   - Create `components/plan-survey/plan-survey-modal.tsx` (client) containing:
     - modal UI + steps logic (currently in `components/hero.tsx`)
     - checkout start logic (`fetch("/api/create-checkout-session")` and redirect)
     - analytics events (`survey_opened`, `survey_step_viewed`, `survey_completed`, `survey_closed`)
   - Success criteria:
     - Modal renders identically to current hero survey.
     - Modal can open on any route (not just `/`).

2. **Add a sitewide provider/hook to open the modal from any CTA**
   - Create `components/plan-survey/plan-survey-provider.tsx` (client) that:
     - holds `survey` state + localStorage persistence (reuse `LS_KEY` + validation from `components/home/home-client.tsx`)
     - computes `recommendedTier` using `recommendedTierForSurvey(survey)` from `lib/home-survey.ts`
     - exposes `openSurvey({ placement, cta_variant })` and `closeSurvey()`
   - Mount provider once in `app/layout.tsx` so it’s globally available.
   - Success criteria:
     - Any component can call `openSurvey(...)` and the modal opens.
     - Survey answers persist across navigations (and refresh) the same way they do on `/`.

3. **Wire the homepage hero CTA to the provider (no duplicate modal)**
   - Update `components/hero.tsx`:
     - remove internal `showSurvey` state + modal rendering
     - replace “Help me pick a plan” `onClick` with `openSurvey({ placement: "hero", cta_variant: "hero_survey_recommended_plan" })`
   - Success criteria:
     - Hero CTA still opens the survey with step = 1.
     - No duplicate modals or state divergence.

4. **Convert all pricing-navigation CTAs to open the survey instead**
   - Update these CTA components to prevent navigation and open the survey modal:
     - `components/nav-pricing-link.tsx`
     - `components/nav-pricing-button.tsx`
     - `components/main-app-features.tsx` (bottom CTA currently `href="#pricing"`)
     - `components/primary-checkout-cta.tsx` (sitewide SEO CTA blocks)
     - `components/footer.tsx` (Pricing link)
       - Preferred approach: extract a tiny client component `components/footer-pricing-cta.tsx` and use it in `Footer` so the rest of the footer can stay server-rendered if desired.
   - Keep existing `trackConversion("cta_click", ...)` payloads, but change the action to “open survey”.
   - Success criteria:
     - Clicking any of these no longer changes the URL / scrolls to `#pricing`; it opens the survey modal instead.
     - Existing `cta_click` analytics still fire with the same `cta_variant` and `placement` values.

5. **Build validation**
   - Run `npm run build`.
   - Success criteria: build passes.

### Manual test checklist (post-implementation)

- From `/`:
  - Nav “Pricing” and nav “Pick a Plan” open the survey.
  - “Start paid plan” in features section opens the survey.
  - Footer “Pricing” opens the survey.
  - Hero “Help me pick a plan” opens the same survey (no regression).
- From a guide page (any `/guides/*`):
  - `PrimaryCheckoutCta` opens the survey.
  - Survey checkout still redirects to Stripe successfully.

---

## Homepage CRO Rework (Execution Summary)

### Project Status Board

- [x] Milestone 1: Home client orchestrator + survey state wiring
- [x] Milestone 2: Hero mini-survey UI + analytics events
- [x] Milestone 3: Pricing recommendation UI + message-matched CTA labels
- [x] Milestone 4: Proof proxies section + trust badges near pricing CTAs
- [x] Milestone 5: FAQ defaults expanded (top 3)
- [x] Milestone 6: `npm run build` passes

### Current Status / Progress Tracking

- Homepage now uses a client orchestrator (`components/home/home-client.tsx`) that persists survey state in localStorage and scrolls to pricing on CTA.
- Hero mini-survey is live (`components/hero.tsx`) and fires `survey_answered` (via `trackEvent`) plus a `cta_click` conversion event with recommendation context.
- Pricing supports recommendation props and highlights the recommended tier (`components/pricing.tsx`). Trust indicators are shown adjacent to payment CTAs.
- “See It In Action” section now appears directly under the hero (`components/home/home-client.tsx` → `ChromeExtensionDemo` moved up).
- Removed the 3-card trust strip (“Secure checkout / No account sharing / Founding member perks”) from the homepage (`components/home/home-client.tsx`).
- FAQ supports default-open items; homepage opens 3 key questions by default (`components/faq-section.tsx`).
- Build check: `npm run build` ✅ (2026-05-11)

### Executor's Feedback or Assistance Requests

- Please refresh the homepage (`/`) and confirm:
  - “See It In Action” is immediately below the hero.
  - The trust-card section is gone (no 3 cards under “See It In Action”).

---

## Survey → Subscription Conversion (Planner Notes)

### What exists today (baseline)

- Survey lives in the hero modal: `components/hero.tsx`
  - Step 1: segment (`Friend_group_host` / `Long_distance_watch` / `Community_mod`)
  - Step 2: priority (`sync_and_no_spoilers` / `chat_and_reactions` / `async_progress` / `host_controls`)
  - Step 3: discovery (`google_search` / `reddit` / `discord` / `friend` / `other`)
  - Step 4: timing (optional) (`today` / `this_week` / `just_researching`)
  - Step 5: “Recommended for you” + 2 plan cards that can start Stripe checkout immediately
- Recommendation logic: `lib/home-survey.ts`
  - Only elevates to `anime_junkie` when `priority === "host_controls"` OR `segment === "Community_mod"`.
- Persistence: localStorage (`components/home/home-client.tsx`).
- Tracking:
  - `survey_answered` fired per answer
  - `checkout_session_started` / `checkout_redirect_success` / `checkout_error` from both hero and pricing.

### Converting mechanism goals (subscription purchase)

The survey should do more than “collect answers” — it should:

- Increase confidence (“this plan is right for me”)
- Reduce perceived risk (refund/cancel/security)
- Increase urgency at the right moments (esp. `timing === "today"`)
- Make the recommended path feel obvious (and everything else secondary)
- Capture value even when not ready to buy (esp. `just_researching`)

### High-impact survey improvements (ideas)

- **Make the recommendation feel earned (diagnosis → prescription)**
  - After Q2 (priority), show a 1-line “We’ll optimize for: \_\_\_” preview so the user sees progress toward a result.
  - In step 5, show 2–3 “Because you said X…” bullets mapping answers → features on the plan (reduces “random recommendation” feeling).

- **Reduce friction + increase momentum**
  - Allow skipping “How did you find us?” entirely OR move it after checkout begins (it’s not value to the buyer).
  - Convert step 4 (timing) to an inline micro-question on the recommendation screen (“Want to use this today?”) so it doesn’t block the payoff.

- **Personalize the CTA copy everywhere**
  - Step 5 buttons currently say “Start checkout”.
  - Replace with the existing message-matched CTA helper in `lib/home-survey.ts` (`pricingCtaLabelForTier`) so the button reads like the user’s intent (“Start hosting watchrooms”, etc.).

- **Stronger risk reducers at the exact decision point**
  - Add 2–3 micro-trust lines _directly under the Step 5 CTA button_ (not only on pricing):
    - “Secure Stripe checkout”
    - “Cancel & refund anytime in early access”
    - “No account sharing — everyone uses their own Crunchyroll”

- **Better “just researching” path (salvage non-buyers)**
  - If `timing === "just_researching"`, show a secondary conversion:
    - “Email me this plan + setup steps” (collect email) OR “Join Discord for updates + onboarding help”.
  - Keep primary CTA visible, but don’t force immediate buy; this should increase eventual purchases without lowering current ones.

- **Add one purchase-intent question that improves targeting**
  - New Q (early): “How many people will be in your watchroom most of the time?” (2–3 / 4–8 / 9+)
  - Use it to:
    - Make `Community_mod` + larger groups feel clearly “Anime Junkie” (higher-ticket justification)
    - Provide tailored copy (“Best for 6–10 friends”)

- **Make the recommended plan visually dominant**
  - On step 5, render recommended tier as the first card (or full-width), with the non-recommended option collapsed under “Compare the other plan”.
  - The page already has a dedicated `Pricing` section; step 5 can be more “decision-focused” and less like a full pricing table.

- **Urgency that matches timing (no fake countdowns)**
  - If `timing === "today"`, add: “You can be in a room in ~2 minutes.”
  - If `this_week`, add: “Set it up once, reuse for every episode.”

- **Instrument funnel drop-off by step**
  - Add events for `survey_opened`, `survey_step_viewed`, `survey_completed`, `survey_closed` with `step` + current answers to identify where users bail.
  - Use these to decide whether discovery/timing questions should be removed or moved.

### High-level Task Breakdown (next implementation batch)

1. Update survey content + flow in `components/hero.tsx`.
   - Success criteria: fewer blocking steps before showing recommendation; step 5 recommendation copy explicitly references answers; recommended CTA is primary and visually dominant.
2. Use message-matched CTA labels for step 5 purchase buttons via `pricingCtaLabelForTier`.
   - Success criteria: Step 5 CTA text changes based on survey answers (same behavior as pricing section).
3. Add “just researching” salvage path (email capture or Discord join) without harming direct checkout.
   - Success criteria: when `timing === "just_researching"`, a secondary conversion appears; primary checkout is still possible.
4. Add step-level funnel analytics events.
   - Success criteria: events emitted for open/close/step viewed/completed; payload includes `recommended_tier` and answered fields.
5. Validate build.
   - Success criteria: `npm run build` passes.

### Current Status / Progress Tracking (2026-05-12)

- Updated survey flow in `components/hero.tsx` to reduce friction:
  - Step 1: segment
  - Step 2: priority
  - Step 3: group size (optional; skip allowed)
  - Step 4: recommendation + timing/discovery (both optional; do not gate checkout)
- Added a “We’ll optimize for…” preview after priority (shown at the start of step 3).
- Recommendation CTAs now use `pricingCtaLabelForTier(...)` (message-matched CTA copy).
- Added decision-point micro trust copy directly under step-4 checkout buttons.
- Added “just researching” salvage path in step 4 (Discord contact + email plan + Discord setup guide link).
- Added step-level funnel analytics events: `survey_opened`, `survey_step_viewed`, `survey_completed`, `survey_closed`.
- Bumped localStorage key to `anidachi_home_survey_v2` in `components/home/home-client.tsx` to safely roll out the new survey schema (`group_size`).

### Site-wide SEO/AEO plan alignment (2026-05-18)

- [x] Removed `showInstallCta` / Chrome install CTA (extension not live yet)
- [x] Sitemap: genre hub priority 0.85 via `lib/sitemap-discovery.ts` (removed duplicate block in `app/sitemap.ts`)
- [x] `lib/genre-hub-links.ts` + cross-links on hub, toolkit, listicles, footer, Crunchyroll pillar
- [x] `watch-anime-together`: typo fix, genre section, `dateModified` 2026-05-18, `itemList` + `aboveFoldCta`
- [x] `npm run build` ✅
- [ ] Optional: VideoObject/trailer schema (plan tier 3); genre hub OG/Twitter images

### Survey email → CRM (2026-05-21)

- [x] `lib/kreatli-crm/survey-lead.ts` — upsert survey emails + answers into `contacts.json` / Vercel Blob
- [x] `/api/subscribe-interest` calls `upsertSurveyLead` before Gmail alert (CRM failure does not block modal)
- [x] `npm run build` ✅

**Segments:** `survey_lead`, plus `segment:…`, `priority:…`, etc. **Notes:** full survey snapshot + timestamp. Re-submits append notes and merge segments.

**View leads:** `/kreatli-email-crm` → **Survey leads** tab (contacts with `survey_lead` segment; outreach tab excludes them).

- [x] CRM tabs: **Contacts** vs **Survey leads** in `crm-client.tsx`
- [x] Survey tab shows parsed survey answers + follow-up actions (Gmail, status, notes)

### SEO batch — 10 high-traffic pages (2026-06-08)

**1 new genre hub:**
- `/watch-fantasy-anime-with-friends` — fantasy genre cluster (Frieren, HxH, Ghibli, etc.)

**4 new listicle guides:**
- `/guides/best-sports-anime-to-watch-with-friends` — 9 picks
- `/guides/best-comedy-anime-to-watch-with-friends` — 12 picks
- `/guides/best-dubbed-anime-to-watch-with-friends` — 12 picks (dub vs sub friction)

**4 new how-to / troubleshooting guides:**
- `/guides/how-to-watch-seasonal-anime-together` — simulcast weekly workflow
- `/guides/crunchyroll-watch-party-not-working` — sync/detection troubleshooting
- `/guides/how-to-run-an-online-anime-club` — Discord + recurring clubs
- `/guides/how-to-plan-an-anime-marathon-with-friends` — weekend binge planning

**2 new compare pages:**
- `/compare/anidachi-vs-rave` — missing competitor coverage
- `/compare/crunchyroll-party-vs-teleparty-for-anime` — third-party tool-shopping intent

**Infrastructure:**
- `genre-hub-links.ts` + `sitemap-discovery.ts` updated for fantasy hub
- `guide-links.ts` updated (new guides + previously missing shonen/classic/weekend binge entries)

- [x] `npm run build` ✅ — 272 static routes (2026-06-08)

### Executor's Feedback or Assistance Requests

- Please submit a test email in the hero survey and confirm the contact appears at `/kreatli-email-crm` with segment `survey_lead`.
- Production needs `BLOB_READ_WRITE_TOKEN` set (same as Gmail tokens) for CRM writes on Vercel.

### Vercel Fluid Active CPU optimization (2026-06-27)

- [x] Skip JWT middleware on public marketing routes (`lib/middleware-routes.ts`, `middleware.ts`)
- [x] Static homepage — waitlist count via client `/api/waitlist-stats` only (`app/page.tsx`)
- [x] Room waiting poll uses `GET /api/rooms/[roomId]` instead of full `router.refresh()` every 5s
- [x] Watch pages use build cache only at runtime + `force-static` (`jikan-for-watch-page.ts`, `watch/[slug]/page.tsx`)
- [x] `pnpm --filter @anidachi/web check`, `test`, and `build` pass
- [x] Nav session moved client-side (`NavBarClient` → `/api/me`); marketing routes now static (○) in build
- [x] Room waiting poll refreshes on 404 (ended/missing room)
- **Post-deploy:** confirm Vercel Usage → Active CPU drops within 48–72h (rolling 30-day window).

### Async Mode Demo — landing page (2026-07-07)

- [x] Live/Async tab toggle in `chrome-extension-demo.tsx` (default Live)
- [x] New `chrome-extension-demo-async-overlay.tsx` — 3-beat coded sequence (React → Later → Catch up)
- [x] Desktop + mobile branches with async copy, pills, step indicators
- [x] `demo_mode_selected` GA4 event on tab change
- [x] `pnpm --filter @anidachi/web check` passes; browser verified on localhost:3003
- [x] Fix duplicate "2 days later" title + double timeline dot (Async overlay)
- [x] Improve step title visibility (longer + larger)
- [x] Mobile overlay sizing pass: larger chip text/padding, clearer clock/progress bar, more readable pin card
- [x] Fix mobile overlap: move reaction moment + timeline pin upward (compact offsets)
- **Manual QA:** scroll to demo, toggle Async tab, confirm overlays read well on mobile (esp. chip/pin/clock) + timestamp pin + progress tracker animation.

### Force-Index Sitemap + Noindex Cleanup (2026-07-17)

**Background:** GSC Coverage Drilldown (`Discovered - currently not indexed`) listed 256 apex URLs. Scope B: temporary force-index sitemap for all **247** public URLs + exclude 9 noindex auth/product routes from the main sitemap.

**High-level tasks**
1. Add `apps/web/lib/force-index-urls.ts` (247 paths from 2026-07-17 GSC Table.csv).
2. Add production-only `apps/web/app/force-index-sitemap.xml/route.ts` (404 when indexing disabled).
3. Wire second sitemap in `apps/web/app/robots.ts`.
4. Expand `EXCLUDED_URL_PATHS` in `sitemap-discovery.ts`; add `robots: noindex` on `/extension/connect`.
5. Allow `/force-index-sitemap.xml` through staging/middleware/session-refresh static-asset bypasses (same as `/sitemap.xml`).

**Success criteria**
- [x] `FORCE_INDEX_URL_PATHS.length === 247` and none of the 9 noindex paths
- [x] Static discovery leaks none of the 9 noindex paths
- [x] `pnpm --filter @anidachi/web check` passes (Node 22)

**Post-deploy / GSC ops (human)**
1. Confirm `https://www.anidachi.app/force-index-sitemap.xml` returns 247 `<loc>` entries.
2. Confirm main `/sitemap.xml` omits `/login`, `/account*`, `/join*`, `/friends`, `/extension/connect`.
3. Submit `https://www.anidachi.app/force-index-sitemap.xml` in Google Search Console → Sitemaps.
4. After pages are Indexed: delete force-index route + URL list + second robots sitemap entry (cleanup PR).

### High-converting SEO batch 2 (2026-07-22) — Keyword Planner validated

**Shipped (10 new routes):**
1. `/guides/teleparty-not-working-crunchyroll`
2. `/guides/does-everyone-need-crunchyroll-premium-for-watch-party`
3. `/compare/anidachi-vs-metastream`
4. `/compare/anidachi-vs-hyperbeam`
5. `/guides/watch2gether-alternatives-for-anime`
6. `/guides/crunchyroll-watch-party-with-discord`
7. `/guides/is-crunchyroll-party-worth-it`
8. `/compare/anidachi-vs-twoseven`
9. `/guides/kast-alternatives-for-anime`
10. `/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing`

**Also:** guide-links.ts, sitemap priority bumps, hub backlinks on Teleparty/Watch2Gether/Kast/CR Party/Discord compares, CR pillar, toolkit.

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅

### High-converting SEO batch (2026-07-19) — Keyword Planner validated

**Shipped (10 new routes):**
1. `/pricing` — dedicated pricing + FAQ; footer “Pricing”; schema offer URLs; sitemap priority 0.9
2. `/guides/best-teleparty-alternatives-for-anime`
3. `/guides/can-you-screen-share-crunchyroll-on-discord`
4. `/guides/does-teleparty-work-with-crunchyroll`
5. `/guides/best-watch-party-apps-for-anime`
6. `/guides/best-way-to-watch-crunchyroll-with-friends`
7. `/guides/crunchyroll-party-alternative`
8. `/guides/how-to-host-a-crunchyroll-watch-party`
9. `/guides/rave-alternatives-for-anime`
10. `/guides/switch-from-discord-screen-share`

**Also:** `guide-links.ts` entries; hub links on Teleparty/Discord/CR Party/Rave compares, CR pillar, does-CR-have-WP, without-screen-share.

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅ (all 10 routes in build output)

### YouTube SEO agent + content plan (2026-07-25)

**Status:** Implementation complete — awaiting manual QA.

**Agent:** `.cursor/agents/anidachi-seo-aeo-pages.md` — YouTube keyword bank, platforms CR+YT, Include paths, pillar checklist, conversionTemplate includes `/watch-youtube-together`.

**Truth fixes:** home FAQ, hero, how-it-works, SoftwareApplicationJsonLd; LDR YouTube rewrite; compare matrices → Crunchyroll + YouTube.

**New routes:**
1. `/watch-youtube-together` (pillar)
2. `/guides/how-to-watch-youtube-with-friends`
3. `/guides/netflix-party-for-youtube`
4. `/guides/does-teleparty-work-with-youtube`
5. `/guides/youtube-watch-party-chrome-extension`
6. `/guides/watch2gether-alternatives-for-youtube`
7. `/guides/youtube-watch-party-with-discord`
8. `/guides/best-apps-to-watch-youtube-together`

**Enriched:** `/compare/anidachi-vs-watch2gether`, `/compare/anidachi-vs-twoseven`; rewrite `/watch-youtube-together-long-distance`.

**Wiring:** `guide-links.ts` (youtube / pillar-watch-youtube), footer, toolkit, sitemap priority 0.9, `inferPageTemplateFromPath` → pillar.

### Scalable Watch IA (2026-07-25) — siblings, no redirects

**Implemented:** Watch nav dropdown (Anime / CR / YouTube siblings); anime hub platform section (strong CR, soft YT); CR breadcrumbs under Anime; YT breadcrumbs without Anime parent; SEO agent platform×vertical rules; footer label consistency.

**No URL renames / no 301s.**

### YouTube SEO batch 2 — 10 KP-validated guides (2026-07-26)

**Status:** Implementation complete — awaiting manual QA.

**Keyword Planner (US) reconfirmed:**
| URL | Primary term | Searches/mo |
|-----|--------------|-------------|
| `/guides/does-youtube-have-watch-party` | does youtube have watch party | 20 |
| `/guides/can-you-screen-share-youtube-on-discord` | can you screen share youtube on discord | 40 |
| `/guides/rave-alternatives-for-youtube` | rave youtube | 70 |
| `/guides/youtube-group-watch` | youtube group watch | 40 |
| `/guides/how-to-host-a-youtube-watch-party` | how to host a youtube watch party | 10 |
| `/guides/how-to-sync-youtube-with-friends` | sync youtube with friends | 10 |
| `/guides/best-teleparty-alternatives-for-youtube` | teleparty youtube (parent) | 110 |
| `/guides/how-to-watch-youtube-together-without-screen-share` | related Discord SS | 40 |
| `/guides/kast-alternatives-for-youtube` | kast youtube | 10 |
| `/guides/youtube-watch-party-free` | youtube watch party free | 10 |

**Wiring:** `guide-links.ts` (+10); pillar `/watch-youtube-together` related + dateModified; soft link from `does-teleparty-work-with-youtube`. Footer unchanged (pillar-only YouTube entry).

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅

### Hero extension demo overlay restyle (2026-07-26)

**Status:** Implementation complete — awaiting manual QA.

**Scope:** Live animated mock only (Async unchanged). Highest fidelity vs latest extension overlay.

**Changes:**
- `apps/web/components/chrome-extension-demo-overlay.tsx` — green sync dot, account+Plus panel, icon actions, Settings tabs (Reactions/Layout/Voice), live chat column, message composer peek, mint speaking cams, catch-up restyle, emoji set `😂😱❤️🔥😭👀` (room rail peek removed — duplicated cam bubbles)
- `apps/web/components/chrome-extension-demo.tsx` — Live subcopy → Crunchyroll or YouTube

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅

### Executor's Feedback or Assistance Requests

- **Manual QA (compare):** Refresh `/#compare` — new rows (Platforms, Own player, Live sync, Overlay, Reactions, Friends, History); secondary link “See Free, Plus & Pro limits” → `/pricing`.
- **Manual QA (waitlist wipe):** Hard-refresh `/account` — Early access #N / Copy referral link must be gone. Confirm `/join` still redirects to `/login`. Hero “watching together” count may still appear (signup stats API, not waitlist).
- **Manual QA (YouTube batch 2):** Spot-check `/guides/does-youtube-have-watch-party`, `/guides/rave-alternatives-for-youtube`, `/guides/best-teleparty-alternatives-for-youtube`, `/guides/can-you-screen-share-youtube-on-discord` — breadcrumbs under YouTube pillar (no Anime parent), FAQ, CTA → `/pricing`, related links.
- **Manual QA (hero Live demo):** On homepage “See It In Action”, confirm Live sequence shows new panel chrome, green sync, chat/composer, cams with speaking ring (no duplicate rail); Async tab still works; check mobile width.
- **Manual QA:** Open http://localhost:3003 — confirm Watch dropdown shows three siblings; check breadcrumbs on `/watch-youtube-together`, `/watch-crunchyroll-together`, `/guides/how-to-watch-youtube-with-friends`, `/guides/does-teleparty-work-with-crunchyroll`.
- **Manual QA (Watch IA siblings):** Confirm Watch dropdown = Anime / CR / YouTube (peers). Breadcrumbs: peers (`Home → CR/YT → page`); tablet has no hamburger overlap; YT related list not polluted by anime tags.
- **Manual QA (YouTube batch):** spot-check `/watch-youtube-together`, `/guides/how-to-watch-youtube-with-friends`, `/guides/does-teleparty-work-with-youtube`, rewritten `/watch-youtube-together-long-distance` — layout, FAQ, CTA → `/pricing`, no CR-only contradictions on home.
- **Manual QA (prior commercial):** `/pricing`, `/guides/does-teleparty-work-with-crunchyroll`, `/guides/can-you-screen-share-crunchyroll-on-discord`, `/guides/best-teleparty-alternatives-for-anime` — confirm layout, FAQ, CTA → pricing/survey, no broken links.
- After deploy: confirm new URLs appear in `/sitemap.xml`; optionally submit sitemap in GSC.
- Force-index sitemap + noindex cleanup was prior work; ready for production deploy then GSC submit.
- (Prior) Please submit a test email in the hero survey and confirm the contact appears at `/kreatli-email-crm` with segment `survey_lead`.
- (Prior) Production needs `BLOB_READ_WRITE_TOKEN` set (same as Gmail tokens) for CRM writes on Vercel.
- (Apollo / outreach ops) Kreatli: widened default send window `Normal Business Hours` from `8:00-18:00` to `8:00-20:00` America/Los_Angeles (Mon–Fri) to reduce window-ended delays at ~50 emails/day.

### Lessons

- Web package `engines.node` requires **22.x**; local default Node 23 fails `pnpm --filter @anidachi/web check` until `nvm use 22`.
- GSC “Discovered – not indexed” exports can include intentionally noindex auth routes that auto-discovery still puts in `/sitemap.xml` — keep `EXCLUDED_URL_PATHS` in sync with page `robots: { index: false }`.
- Stale `.next/types` can fail `tsc` after deleting routes (e.g. `app/extension/page.tsx`); clearing `.next/types` before `pnpm check` fixes phantom module errors.
- SEO agent: after adding a YouTube conversion/KP/anti-cannibal stack, ship the **Crunchyroll twin in the same playbook pass** — otherwise CR pages drift (mid-CTA, crumbs, CWS vs `/pricing`, “Crunchyroll-only” FAQs).
- Never put agent jargon (`soft-pedal`, unexplained `provider-pinned`) in hard boundaries without an explicit “never publish” ban — agents copy it into FAQs.
- `GET /api/waitlist-stats` can return `{ count: 0 }` on a local CRM. `WatchingTogetherCount` hides until count > 0 — that is intended, not a missing component. Confirm the live number on staging/production.
- Next.js `permanentRedirect("/login")` is HTTP 308 and drops leftover `?ref=` waitlist query params.
- Account Early access / referral UI was already removed from `account-overview.tsx` in the working tree; leftover `.ac-referral` CSS + dead `survey-lead` write/status APIs still needed deletion so nothing can wire it back.
