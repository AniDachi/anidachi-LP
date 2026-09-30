# Homepage comparison — local design, September 30, 2026

Owner request: make “How AniDachi compares” clear and visually consistent with
the accepted restrained website design. This changes only the homepage comparison
component and its scoped CSS. Shared comparison tables on pricing/SEO pages,
hosting explanation, installation steps and billing behavior are unchanged.

## Presentation

- Flat table, warm dark AniDachi column with one orange accent, aligned text and
  row dividers. No rounded panels, gradients or decorative badges.
- Seven short rows: platforms, playback, text chat, reactions, calls, invitations,
  watch progress. The overlapping quality/sync rows are combined into playback.
- Below 768px, keep AniDachi beside one selected competitor. Three native buttons
  expose the selected state and update all corresponding table cells together.
  All competitors remain visible on desktop. Row/column headers remain semantic.
- Sources and qualifications use a native disclosure. The pricing link retains
  its destination and existing conversion event. Reduced motion disables the
  small hover/selection transitions.

## Content review

Do not infer that a feature is absent just because product information omits it.
“Not listed” is explained in the disclosure. In particular, the previous blanket
negative reaction claims for Teleparty/Crunchyroll Party were removed.
Crunchyroll Party refers to the specific SVODExtensions listing below; several
unrelated extensions use a similar name. Discord is compared via screen sharing.
AniDachi saves history on Plus/Pro while existing saved progress is accessible
on Free; subscription and entitlement rules have not changed.

Primary sources read on September 30:

- [Teleparty support](https://dev.teleparty.com/support): own streaming access,
  chat sidebar, party links, Premium voice/video.
- [Teleparty Premium](https://dev.teleparty.com/premium): supported services,
  playback sync and custom reactions. The main www/apex pages could not be read
  by the web tool; the official public dev subdomain was accessible.
- [Crunchyroll Party listing](https://chromewebstore.google.com/detail/crunchyroll-party-watch-t/migkmndeenhgfopajdcipneifcdkjjpm): own accounts, sync, chat,
  reactions, party links. Video calls/watch history are not advertised there.
- [Discord screen sharing](https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share),
  [video calls](https://support.discord.com/hc/en-us/articles/360041721052-Video-Calls)
  and [reactions](https://support.discord.com/hc/en-us/articles/12102061808663-Reactions-and-Super-Reactions-FAQ).

## Verification and delivery

Web typecheck and changed-file ESLint pass. A local DOM interaction check cycles
all three choices and checks the selected column, row headings and pricing link.
Full web tests pass: 850 passed, six existing skips. Next dev compiled the section.
These checks do not establish rendered desktop/mobile appearance: localhost
browser automation remains blocked by the session URL policy. Visual acceptance
is with the owner on the existing port-3003 preview; no alternate browser/network
workaround was used.

Graphify was queried for navigation. Its existing unrelated-node merge guard
remains the documented update blocker; tracked graph artifacts are unchanged
(see the [annual checkpoint](paid-hosting-trial/annual-billing-2026-09-30.md)).
This is local only. No staging/main/Stripe configuration or deployment occurred.
Rollback: revert the comparison component/CSS change; no data or config recovery.
