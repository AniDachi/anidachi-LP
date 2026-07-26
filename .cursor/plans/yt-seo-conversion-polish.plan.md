# YouTube SEO conversion polish + agent upgrades

## Goal

Increase **organic traffic that reaches `/pricing`** from the YouTube cluster—not more thin URLs. Scope is **enrichment of existing pages** + **SEO agent playbook updates**.

Default (locked): do **both** page polish and agent doc in one execution pass.

## Out of scope

- New guide URLs / channel listicles / glossary for the 1k head term
- Hero demo work, anime `/watch/[slug]` batches
- Editing the prior YouTube batch-10 plan file

---

## Part A — Page enrichment (conversion-first)

### Priority pages (edit these; light pass on the rest)

| Priority | Path | Why |
| -------- | ---- | --- |
| P0 | `/watch-youtube-together` | Owns 1k/720 head terms; hub for spokes |
| P0 | `/guides/youtube-watch-party-free` | “Free” → host upgrade path |
| P0 | `/guides/best-teleparty-alternatives-for-youtube` | Switcher intent (parent KW 110) |
| P0 | `/guides/can-you-screen-share-youtube-on-discord` | Pain → sync CTA |
| P1 | `/guides/rave-alternatives-for-youtube`, `/guides/kast-alternatives-for-youtube` | Competitor escape |
| P1 | `/guides/does-youtube-have-watch-party` | AEO; clean meta/FAQ |
| P2 | Remaining batch 2 guides | Leak fixes + FAQ de-dupe only |

### Shared fixes (all touched YouTube guides)

1. **Kill agent jargon in body/FAQ** — replace “soft-pedal…” with product-plain limits: full `youtube.com/watch` in desktop Chrome; not Shorts/embeds/native app.
2. **YouTube-safe pricing copy** — add `PRICING_*` helpers in `apps/web/lib/pricing-copy.ts` that mention YouTube (not Crunchyroll-only), and use them on YT pages instead of `.replace(/Crunchyroll/g, "YouTube")`.
3. **FAQ de-dupe** — full “Is AniDachi free?” only on free page + pillar (or `/pricing` link). Other guides: one sentence + link to pricing/free page.
4. **SERP CTR** — title/meta: intent answer + AniDachi outcome + soft CTA cue; competitors ranked in-body, not co-equal in meta.
5. **Conversion path** — every commercial page: hard link to pillar in answer + `/pricing` after problem or steps; add **`midContentSlot`** with checkout/primary CTA after the problem section on P0/P1 pages.
6. **`dateModified`** → honest ISO date on edited pages.

### Pillar-specific (`watch-youtube-together/page.tsx`)

- Add a visible **“Start here”** ordered resource list (How-to → Discord pain → Free → Teleparty alternatives → Host) wired as `itemList` / `ItemListJsonLd` via `SeoPageLayout` when the prop pattern matches siblings.
- Strengthen answer-first + pricing CTA; ensure batch spokes stay discoverable without cannibalizing H1 (“youtube watch party”).

### Light pass (P2 guides)

- Host / sync / group-watch / without-screen-share: jargon + FAQ de-dupe + meta polish only; no large rewrites.

### Verify

- `pnpm --filter @anidachi/web check` (and build if Executor convention requires)
- Spot-check: no Crunchyroll-only pricing on YT FAQs; mid-CTA renders; pillar itemList links resolve

---

## Part B — SEO agent upgrades

Edit `.cursor/agents/anidachi-seo-aeo-pages.md`:

1. **YouTube conversion checklist** (required for every new/edited YT guide): answer-first; problem → mechanism → `/pricing` (fold + mid on commercial intents); human product limits; unique FAQs; hard links pillar + pricing + 1 sibling; `pillar-watch-youtube` related only.
2. **KP gate before URL lock**: run `google-ads:keywords`; reject noise, volume < 10 unless twin of proven commercial CR page, and queries already owned (see map).
3. **YouTube owned-queries / anti-cannibalization map**: pillar owns head terms; how-to owns “how to watch youtube with friends/together”; no second how-to/LDR guide URL.
4. **Copy quality bans**: no agent jargon in published copy; no Crunchyroll-only pricing constants on YT pages; commercial metas lead with AniDachi outcome.
5. **Differentiation minimum** for alternatives/listicles: compare table + when-to-pick + mid CTA (reject short-answer-only).
6. **Gold-standard YT refs** table rows: Teleparty AEO, how-to, switcher listicle twin, free/host conversion pattern.
7. **Measurement note**: after YT batches, track pricing conversion by landing path; enrich winners before shipping more 10/mo clones.

---

## Execution order

1. Pricing-copy YouTube helpers
2. P0 page enrichments (pillar, free, teleparty-alts, discord SS)
3. P1 alternatives + does-youtube
4. P2 light pass on remaining batch guides
5. Agent playbook sections
6. Check/build + scratchpad QA list

## Success criteria

- P0/P1 pages have mid-funnel CTA, cleaner metas, YouTube-correct pricing FAQs, no agent jargon
- Pillar exposes a crawlable “start here” list to top spokes
- Agent doc encodes KP gate, cannibalization map, and YT conversion checklist
- Web check passes

## Todos

1. Add YouTube-safe pricing FAQ/helpers in `pricing-copy.ts`
2. Enrich pillar + free + teleparty-alts + Discord SS (metas, FAQs, mid CTA, dateModified)
3. P1 rave/kast/does-youtube; P2 light pass on remaining batch 2 guides
4. Update `anidachi-seo-aeo-pages.md` with YT conversion, KP gate, cannibalization, copy bans
5. Run web check/build; update scratchpad with QA checklist
