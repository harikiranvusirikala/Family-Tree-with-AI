# Ideas for next features

Candidate add-ons, suggested on 2026-10-21 after ★ Everyone, full dates and the phone and tablet work were done (the Analytics entry was added on 2026-10-22). None of these is agreed or planned yet: each one, if chosen, gets its own BUILD_PLAN.md section and open questions first, as usual.

They are weighted toward what builds on the app as it is (★ Everyone's Wheel, full dates, the assistant, shared editing). Sizes are rough: S is about a day of work, M a couple of days, L more.

## Top three picks

**1. "This is me" (S–M).** Link your Google account to your own card.
- The Wheel opens with you in the middle; "Centre on me" becomes possible.
- Panels can say how someone is related to you ("your Babai").
- Your card is marked on every sheet.

FEATURES.md already names this as "could come later", and the Wheel's kinship engine does most of the work. It's the suggested first pick: small, and it makes the Wheel personal.

**2. Birthdays and anniversaries (M).** This follows on from full dates. *Built 2026-10-21 without the reminders: marriage dates, then ★ Everyone's Upcoming, the dashboard's next 30 days and ages (BUILD_PLAN.md).*
- An "Upcoming" list on the dashboard and in ★ Everyone: birthdays this month, with ages ("turns 40").
- An age in the panel ("39 years", "would have been 80").
- Marriage dates on couples, so wedding anniversaries show too.
- Reminders by email or WhatsApp could come later.

**3. Change history with undo (M).** As more relatives edit, this makes shared editing safe.
- Show who changed what and when (the records already note who changed them).
- Undo any past change, not just a delete in the last 10 seconds.
- Since every change goes through one write path, a log is straightforward.

## Family and culture

- **Relationship finder (S):** "How is Arjun related to Maria?" for any two people, in Telugu or English names. It reuses the Wheel's engine.
- **Telugu names (M):** an optional name in Telugu script beside the English one, shown with the తె toggle. Find someone would match either.
- **More details per person (S–M):** nicknames ("Chinna", "Pedda"), gotram, native place (ooru), occupation. Nicknames would also help Find someone.
- **Memories (M–L):** a short life story, more photos per person, and a simple timeline (born, married, moved, died).

## The assistant

- **Answers about relations and dates (S):** "Who are Steve's cousins?" or "When is Amma's birthday?", answered with the kinship engine, in Telugu names if wanted.
- **Voice input on phones (S):** speak a question instead of typing.

## Collaboration and safety

- **Merge duplicates (M):** combine two records of the same person, which imports and several editors will produce. Their parents, couples and sheets are joined.
- **Suggestions from Viewers (M):** Viewers propose a change, and Maintainers approve it on the same proposal card the assistant uses.
- **Privacy for living people (S–M):** hide living people's full birth dates from Viewers, or mark someone private.
- **Email notifications (M):** for invites, access requests and reminders. This needs an email service; Resend's free tier is already noted in FEATURES.md.

## Output and sharing

- **A family book or poster (M–L):** a printable PDF with photos, sheet by sheet, or a large poster of ★ Everyone's Tree.
- **Install on the phone (S–M):** add to the home screen, and read the tree offline.
- **A read-only share link (M):** for relatives without a Google account. This needs a security decision first: who can make one, and when it expires.

## Analytics

- **Google Analytics inside the app (S–M):** today Google Tag Manager runs on the landing page only (the owner's choice, 2026-10-22). Once an Analytics tag is added in GTM's own dashboard (no code change: the landing page's policy already allows Analytics), it sees visitors, where they came from and Sign in with Google clicks, but nothing after sign-in. If the owner asks for numbers from inside the app (active users, who opens Ask AI, the Wheel or Export), GTM moves to every page:
  - GTM's two snippets (`src/components/GoogleTagManager.tsx`) go in the root layout (`src/app/layout.tsx`) instead of the landing page, so GTM loads once and stays through the app's in-page navigation (the sheet tabs change the address with `pushState`); in Analytics, turn on "page changes based on browser history events".
  - The Content Security Policy: the GTM and Analytics sources on every path, not only "/" (`headerRules` in `src/server/security-headers.ts`, which `next.config.ts` uses), still only when `GTM_ID` is set.
  - Ids stay out of Google: page addresses carry group, sheet and person ids (`/g/{groupId}/s/{sheetId}?person=…`), so send a cleaned path such as `/g/:group/s/:sheet` (a dataLayer value or a GTM variable), and leave Analytics' form-interaction and site-search measurement off.
  - Cookies and consent: Analytics sets cookies on signed-in pages too, so visitors in the EU would need a consent banner (Consent Mode).
  - The landing page's privacy section and questions then say that signed-in pages are measured, and what isn't sent.
  - Trust: anyone with access to the GTM container can run scripts on pages with family names, dates and photos, so its access stays with the owner.
  - To compare first: Vercel Web Analytics (no cookies, its script served by the site itself, beside the Speed Insights the app already uses), which keeps Google off the family pages.

## Loose ends already in the docs

- Hide one extra person from a sheet (open since step 6; ARCHITECTURE.md §15, question 5).
- Copy photos when importing into another group (§15, question 7).
- Clean up uploaded photos that were never saved (§15, question 6).
- Fix the flaky phone test properly: check that the page sees a touch screen before measuring (BUILD_PLAN.md, the README screenshots section's notes).
