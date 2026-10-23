# Family Tree with AI — Features

**Detailed design, data model and flows:** [ARCHITECTURE.md](ARCHITECTURE.md) (diagram: [architecture.svg](architecture.svg)) · **Step-by-step build plan and progress:** [BUILD_PLAN.md](BUILD_PLAN.md)

The owner's requirements come first, then the decisions agreed for them, under the same headings in the same order.

## Requirements

This is a Family Tree Web Application that can be accessed via Web.

### Tech stack & deployment

- Want to have the deployed for free and update done after git repo change/commit
- Can have only Google Auth for Sign Up / Sign In
- The data should be persistent and independentent to code. Mongodb for DB?
- Auto adjust persons on addition of new once
- Some sample images available in @samples for reference how it should look. It should more look like @"samples/Sample Family Tree.png"
  - male / female border light blue / light pink
  - For living onces their is not mentioning of present, but passed one have end year
- Add Google Tag Manager (container GTM-KZDLK4PQ) to see who visits the site, on the landing page only. (Added 2026-10-22.)

### Data model

- Sheets with Person name, ping two sheets that are under Father's and Mother's name.
- Main sheets are the Father's and Mother's.
- If some one joins our family via marriage, create a Separate sheet with new person to track their parents/cousins/etc (not available in main trees). But it have same chagnes below the tree like children, their children tree in both sheets.
- If asked explicitly display the person in a particular sheet add it.

### Sharing & permissions

- The tree's should be Google Email specific. So If I create only I can see, any other person sign up can create his tree's. An email can invite another email with permission of View/Maintain/Admin. So the invited person can see the shared trees and the trees he creates, etc.
- if some one enter the family tree URL and they don't have access they should have option to request option and one having access can provide access to the request.

### Photos

- Allow Image upload for the person name
- To have an eye icon that is used hide the photos of every person and display only initials. This may be usefully when taking a png of the tree and want to share with someone without revealing the faces. (added 2026-10-20)

### AI chat behaviour

- Should have AI Chat bottom right.
  - Will go with Claude Haiku 5.5 (`claude-haiku-5-5`) for the chat.
  - Where we can ask like `"<Person A> married into <Person B>"`

### Import / export

- Import/export existing or new sheet

### Everyone

- A place where all persons and all their relations are displayed, like a network graph of everyone. (Added 2026-10-20.)

### Landing page and search engines

- Easy to find on Google: the repository's About text and topics, and on the live site a title, description, robots.txt, sitemap, link-preview picture and icon that search engines and chat apps use; Google Search Console's verification tag on the home page. (Added 2026-10-22.)
- A real professional, full landing page that helps people find the app on Google. (Added 2026-10-22.)
- A social preview picture for the GitHub repository, following GitHub's template: space left around the edges. (Added 2026-10-22.)

### A production look

- Every page and component with the same production feel as the landing page: good UI and UX, look and feel, smoothness. For example, the Members and Settings links in the header don't look professional. (Added 2026-10-23.)

## Decisions (agreed 2026-10-18, and at each build step since)

### Tech stack & deployment

- App: Next.js + TypeScript. UI and API live in one repo and deploy together.
- Hosting: Vercel Hobby (free, personal non-commercial use).
  - Every push to main deploys to production; every branch/PR gets a preview URL.
  - Chosen over Render free: Render sleeps after 15 min idle (30-60s wait on next visit) and has only 0.1 CPU.
- Sign-in: Better Auth with Google as the only provider.
  - Previews sign in through production with Better Auth's OAuth proxy plugin (decided in step 4). Google keeps two redirect URIs (localhost and production); previews keep their own database and `BETTER_AUTH_SECRET`; the handoff uses `OAUTH_PROXY_SECRET`, the same in Production and Preview.
  - Only Google-verified email addresses can sign in (invites are matched by email).
  - Sessions last 30 days and are extended while in use. Google always shows its account chooser.
  - Signed-out visitors are sent to sign in and then back to the link they opened (returnTo).
  - E2E tests sign in through a Playwright fixture (Better Auth's testUtils) that writes sessions into the test database. The app itself has no test-login route.
- Database: MongoDB Atlas M0 (free, 512 MB).
  - M0 has no automatic backups -> nightly encrypted backup via a GitHub Actions job (artifact kept 90 days).
- Photos: Cloudinary (free tier). Never store images in MongoDB.
  - Face-aware cropping for round avatars.
  - Upload directly from the browser (avoids Vercel's request size limit).
  - Random file names (or signed URLs) so photos aren't guessable.
- Tree drawing: React Flow for the canvas (pan/zoom/minimap, custom person cards).
- Auto layout: ELK.js (layered), chosen in step 2. relatives-tree only draws the root's own relatives, so it dropped in-law parents. Siblings are eldest first where that adds no crossing lines.
- UI: Tailwind CSS (v4). shadcn/ui was planned but never needed. Works on phones, tablets and computers (after the final check).
- AI chat: Claude API via `@anthropic-ai/sdk` with tool calling, model `claude-haiku-5-5`.
  - Model name kept in an environment variable so it can be switched without code changes.
  - Set a monthly spend limit in the Anthropic Console.
- All keys (MongoDB, Google, Cloudinary, Anthropic) live in Vercel environment variables, never in code.
- Cost: $0/month except AI chat usage (Haiku 5.5: roughly under $1/month at ~200 messages).
- Support (2026-10-22): a "Buy me a coffee ☕" link to the owner's Buy Me a Coffee page, on the landing page and in the user menu, opening in a new tab. The README links to it and to GitHub Sponsors, and `.github/FUNDING.yml` gives the repository a Sponsor button with both.
  - Written into the code, not a setting: copies of the app keep the owner's link.
  - A plain link, not Buy Me a Coffee's widget script, so the Content Security Policy is unchanged.
- Google Tag Manager (2026-10-22): container GTM-KZDLK4PQ, for Google Analytics of who visits, on the landing page (the sign-in page) only.
  - Signed-in pages, with families' names, dates and photos, load no scripts from other sites and keep their Content Security Policy. Only the landing page's policy also allows Google's Tag Manager and Analytics addresses, and only when `GTM_ID` is set.
  - A setting, not written into the code: `GTM_ID`, in Vercel's Production only. Previews, local runs and tests never load Tag Manager, and copies of the app don't send their visitors to the owner's account.
  - Not when the page's address carries `?returnTo=` (the link a signed-out visitor opened: an invite's token, a group's ids). Those visits aren't counted, and the links never reach Google, whatever tags are added later.
  - No consent banner for now (an open point, ARCHITECTURE.md §15).
  - Google Analytics inside the app, if wanted later, means Tag Manager on every page: what that needs is in IDEAS.md (Analytics).

### Data model

- Each person is stored exactly once. Sheets are views, not copies: a sheet = a root person + their ancestors and descendants + any people explicitly added to it. A child added once shows up on every sheet that reaches them (Father's, in-law) - nothing to sync. The exception is a mother's sheet, which leaves out her children with the father: they're on his. In turn, their sheets stop at her: her parents and cousins are on her sheet (owner request after the full dates).
- Collections (every content record carries groupId):

  ```
  groups         { _id, name, createdBy, createdAt }
  memberships    { _id, groupId, userId, role: owner | admin | maintain | view }   (one per group+user)
  invites        { _id, groupId, email, role, invitedBy, status: pending | accepted | declined | revoked, expiresAt }
  accessRequests { _id, groupId, userId, email, message?, status: pending | approved | denied, decidedBy?, createdAt }
  persons        { _id, groupId, name, gender, birthYear, deathYear?, photoId (Cloudinary public ID) }
  unions         { _id, groupId, partnerIds: [a, b], status: married | divorced, childIds: [] }
  sheets         { _id, groupId, title, rootPersonId, pinned, extraPersonIds: [], hideChildrenOf?, deletedAt? }
  chatUsage      { _id, userId, day, count }   (per-user daily AI message cap)
  ```

- Union = a couple (the heart icon). Children hang below it. Divorced = broken heart. Mirrors GEDCOM family records, so GEDCOM import/export maps cleanly.
- "A married into B" -> new person + union + new sheet rooted at the new person.
- "Show X in sheet Z" -> add X to that sheet's extraPersonIds.
- Father's and Mother's sheets are pinned tabs. The Mother's sheet shows her side of the family, without the couple's children (for groups created after step 11's owner requests).
- No deathYear = living, shown as "1985". Otherwise "1945 - 2022".

### Sharing & permissions

- A group = a set of related trees. It is the unit of sharing (not individual sheets, because one person appears on several sheets).
- Everything a user creates is private until they invite someone.
- Dashboard shows "My groups" (created by me) and "Shared with me".
- Roles:
  - **View:** see trees, people, photos; ask the AI chat questions; export a tree picture (PNG/PDF).
  - **Maintain:** View + add/edit/delete people, photos, sheets (soft delete, undoable); AI chat can make changes; import; full data export (JSON/GEDCOM).
  - **Admin:** Maintain + invite/remove members, change roles (up to Admin).
  - **Owner:** the creator, exactly one per group. Admin + delete the group, transfer ownership. Cannot be removed by an Admin.
- Invites:
  - Shown in the app when the invited person signs in, plus a link the Admin can share (WhatsApp/text). No email service at first; Resend free tier can be added later.
  - Accepted only if the signed-in Google email matches the invited email (forwarded links grant nothing).
  - Compare emails lowercased; for gmail.com ignore dots and +tags.
- Access requests (someone opens a tree URL without access):
  - Not signed in -> Google sign-in first, then return to the same URL.
  - Signed in, no access -> "You need access" page with a "Request access" button and an optional message. The page shows nothing about the group (no name, no people) to non-members.
  - If that email already has a pending invite to the group, show "Accept invite" instead.
  - Admins and the Owner see a badge with pending requests; they approve (choosing View/Maintain/Admin, default View) or deny. Approving creates the membership. Same rule as invites: only Admin/Owner grant access.
  - The requester sees the status (pending/approved/denied) on their dashboard.
  - One pending request per person per group, so it can't be used to spam admins.
  - In-app only at first, like invites; email notifications can be added later with Resend.
- Enforcement:
  - Every API request checks membership and role on the server, scoped by groupId. Hiding buttons is not security.
  - Role is looked up per request (not stored in the session), so removing a member takes effect immediately.
  - AI chat only gets tools allowed for the user's role (View = read-only tools).
- Groups are independent. Overlapping families across groups are copied via export/import for now.
- Groups, memberships and invites are our own collections, not Better Auth's organization plugin (decided in step 5). The plugin writes in its own transaction (creating a group with its family must be one), matches invite emails by lowercase only (no gmail dot/+tag rule), allows several owners, and adds HTTP endpoints outside our role checks.
- Deleting a group is a soft delete: it disappears for everyone, and its records stay in the database.

### Editing by hand (step 6)

- Click a person to open their panel: details, and for Maintain and up Edit, Add parents, Add partner, Add child, Show on another sheet, Delete (with a 10-second Undo). Click a heart for married/divorced.
- "Create their own sheet" is checked by default when adding a partner (people who marry in get a sheet).
- Adding parents offers "Create their own sheet" for the mother: a tab for her side of the family (her parents, brothers and sisters), without her children with the father, who are on his side. The father isn't offered one. (Owner requests after step 11.)
- A mother's own sheet holds her side of the family: once she has one, the sheets that reach her through her children with the father show her but not her parents, brothers, sisters or cousins (Grandmother's parents go on Grandmother's sheet, not Father's). A mother without her own sheet keeps her side on her children's sheets, as before. It follows the sheets, not gender: any sheet that leaves out someone's children with a partner does the same. Her box in Add parents now starts checked, like a partner's (it started unchecked until then); with no mother entered it's ignored. Parents added from a sheet that won't show them go on the person's own sheet: the form says so, and saving opens it. (Owner request after the full dates, 2026-10-21.)
- Renaming a person renames their sheet when it still has its given title, "<Name>'s family"; a title of your own stays.
- The person panel has "Go to <sheet title>" for each sheet rooted at that person, apart from the one open, for everyone, Viewers included. (Owner request after step 11.)
- Someone added without a sheet can get one later: "Create their own sheet" in their panel, for anyone with no sheet of their own (Maintain and up). A woman's leaves out her children with her partner by default (her side of the family, like a mother's sheet from Add parents, which then moves off those children's sheets); a man's shows all his children; the form can change either. (Owner request after the final check.)
- Full dates (owner requests after the final check): a birth or death can have its day and month as well as its year, only together; the rest just the year. Since 2026-10-23 a day and month can be saved without a year (a birthday whose year nobody knows): written "12 Mar", shown on a card only while it's selected, and never used for sorting (people with no year sort as undated); Upcoming lists it without an age, and GEDCOM writes it as a date phrase, "(12 MAR)". Written "12 Mar 1985". Cards show only years, and full dates while selected; the person panel shows them; ★ Everyone's List has a Born column (and "Died …" under it) that sorts oldest first, youngest first or back to A to Z, also as a Sort choice on every screen. The form shows the birth's Day, Month and Year; the death's fields appear once "Has died" is checked (checked already for someone with a death year; unchecking clears them). GEDCOM and JSON keep full dates, and the assistant can record them.
- Marriage dates (owner request after the final check, 2026-10-21): a couple can have the date they married, with the rules of a birth date (the year alone, a day and month with it, or since 2026-10-23 a day and month alone). It's added and changed from the heart: the couple panel's "Married on". The tree views (every sheet and ★ Everyone's Tree) show the year above the heart, and the full date while the heart or either partner is selected; not the Network or the Wheel. The person panel's partner lines add "married 12 Mar 1985". ★ Everyone's List has a Married column after Born, one line per dated marriage (with the partner's first name for someone with several), that sorts by the first marriage: earliest first, latest first, or back to A to Z, also as Sort choices; on phones the relations line adds the year ("♥ Arham (2008)"). Divorced couples keep theirs. GEDCOM (`MARR`) and JSON keep it, and the assistant can read and propose it (`add_marriage`, `update_couple`).
- A person who is a sheet's root can't be deleted.
- Deleted people count as absent: after deleting someone's parents, new parents can be added; Undo still restores them.
- Tabs: "+ New sheet", rename, pin, move left/right and delete (buttons, not drag-and-drop). Pinned tabs come first. On computers the tab menu (⋯) comes before them, at the start of the row. Many tabs scroll sideways without a scrollbar (a mouse wheel scrolls them), and the open one is kept in view. (Owner requests after the final check.)
- Deleting a sheet keeps everyone on it. Pinned sheets (the father's and mother's) can't be deleted until unpinned, nor can the last sheet. A partner's sheet is deleted first, then the partner can be.
- Hiding an extra person from a sheet is left for later.

### Phones and tablets (after the final check)

- The app works on phones and tablets as well as computers, mainly in phone browsers. Computers keep their layout.
- Phones switch sheets with a sheet picker: the open sheet's title, opening a list of every sheet.
- Below 1024 px (phones and tablets) the sheet's tools (Export, Import… and the sheet's own options) are in one ⋯ menu, with the eye that hides photos just before it in the sheet row (the same square, bordered button as on computers since the production look; it was a bigger eye with no circle around it), and Ask AI is a round button over the tree.
- On a phone, tapping a person opens their details over the bottom half of the screen, with the tree and their card above. Tablets keep the details beside the tree.
- A sheet opens zoomed in at its root, names readable, on phones (the owner's choice) and tablets; ⛶ shows the whole tree.

### Day and night themes (between steps 8 and 9)

- Three choices in the top bar, before the profile, and on the sign-in page: Day, Night, Follow device.
- Follow device is the default; Day or Night is remembered in that browser.

### Members, invites and access requests (step 8)

- A request for a group that doesn't exist is kept like a real one (it stays pending), so nobody can tell which groups exist. At most 20 pending requests per person.
- After a request is denied, that person can't ask again; an Admin can still invite them.
- Admins can change or remove anyone except the Owner, other Admins included.
- Ownership can be transferred to any member; the old Owner becomes an Admin.
- Only Admins and the Owner see the member list (it shows email addresses).
- Members can leave a group from Settings; the Owner must transfer ownership first.
- Invites last 14 days. Inviting the same address again refreshes the invite and keeps its link.

### Photos (step 7)

- Maintain and up add, change or remove a person's photo from their panel. JPEG, PNG, WebP or HEIC (iPhone), up to 10 MB.
- Uploads go straight from the browser to Cloudinary, signed by the app for a random name in the group's folder.
- Stored at most 1600 px on the long side; cards show a face crop. Automatic face crop only, no manual cropping for now.
- Replacing or removing a photo deletes the old one from Cloudinary (Remove asks first: no Undo). Deleting a person keeps their photo, so Undo brings it back.
- Hide photos (added after step 11): an eye button at the end of the sheet tabs, before Export (on phones and tablets, just before ⋯), shows initials instead of every photo on the cards, in the person panel, and in a saved or printed picture. It saves nothing and anyone can use it; it lasts until the next visit.

### AI chat behaviour

- Built in step 9 ("Ask AI" at the end of the sheet tabs). Decided:
  - The conversation stays in the browser for the visit; a reload or New chat starts fresh.
  - The key is `CHAT_API_KEY` (not `ANTHROPIC_API_KEY`), so a Claude Code session can't pick it up.
  - Effort "medium"; the model gets the family list (up to 300 people) at the start of each chat.
  - 50 messages per person per day, across all groups; plus the monthly spend limit in the Anthropic Console.
- Tools: search_people, get_person (read); add_person, update_person, add_marriage, add_child, add_to_sheet, create_sheet (proposals). No delete tool - deleting is UI only.
- Propose, then confirm: the AI describes the change, the app shows a confirmation card, and saves only after the user clicks. Handles ambiguous names ("which Ravi?") and stops wrong edits reaching the data.
- Per-user daily message cap (`CHAT_DAILY_LIMIT`) on top of the Anthropic Console spend limit.

### Import / export

- JSON: full, lossless backup of a group.
- GEDCOM: exchange with Ancestry, FamilySearch, MyHeritage.
- PNG/PDF: picture of a sheet.
- Built in step 10. Decided:
  - Every imported file is read in the browser, with a preview before anything is saved.
  - People with no recorded sex in a GEDCOM file: choose male or female for each in the preview ("Set all to" for many).
  - PDF through the browser's print dialog ("Save as PDF"), not a PDF library.
  - At most 2,000 people per imported file.
  - Possible duplicates (same name and birth year) start as "Use existing"; "Keep both" adds them as someone new.
  - Photos come in only when a JSON file goes back into the group it came from.
  - The picture always uses the day colours on white.

### Everyone (agreed 2026-10-20; all four views built: Tree, List, Network, Wheel)

- Four views of everyone in the group, chosen from the mockups: **Tree** (one big tree drawn like a sheet), **Network** (everyone and every relation on one canvas), **Wheel** (relatives in rings around one person, each labelled with the relation) and **List** (a searchable directory with each person's relations and sheets). The households graph with a relationship finder was not chosen.
- They live in a built-in **★ Everyone** tab, the first in the sheet row (first in the phone's sheet picker, above the pinned sheets), with a switcher for the four views. It always holds everyone and can't be renamed or deleted.
- **A group still opens on its first pinned sheet**, or its first sheet when none is pinned; never on ★ Everyone.
- The first view is Network on computers and tablets (owner request, 2026-10-23; it was Tree) and List on phones; after that, the last one used on that device.
- Tapping anyone opens the same person panel as on a sheet, editing included for Maintain and up, with shortcuts: Relatives wheel, Find in list, Show on a sheet, Show in network. The selected person stays selected across views, "Find someone" works in each, and each view and person has a shareable link (the usual access rules apply).
- Viewers get all four views. Network and Wheel can be saved as pictures, like a sheet.
- The wheel starts on the selected person (or the first pinned sheet's root). A "This is me" link between a member and a person, for "Centre on me", could come later.
- Built one view at a time in the owner's order: Tree, List, Network, Wheel. Part 1 brings the tab, the Tree view and Find someone; the view switcher appears with part 2, when there's a second view. People on no sheet aren't marked in the tree; the List's "On no sheet" filter finds them.
- On ★ Everyone, someone with no sheet of their own gets "Go to <sheet>" in their panel for the first sheet that shows them. (Named like the jump to a person's own sheets; "Show on another sheet" is already the edit that adds someone to a sheet.)
- The List (part 2, agreed 2026-10-21): everyone A to Z by the name as written (first name first; no guessing which word is the family name), with parents, partners, children and the sheets that show them. Filters: Everyone, Living, Married in (a partner, no parents added, and a partner whose parents are added) and On no sheet. In the List, Find someone narrows the rows as you type. The picture and print are for drawn views, so in the List, Export has only the data files. The person panel's "Find in list" (on sheets and the Tree) opens the List at that person.
- The Network (part 3, agreed 2026-10-21): arranged with d3-force (a new library; ELK took 40 s for 300 people), the same every time, older generations towards the top. Arrows to children start at the couple's heart. Choosing someone lights up their parents, partners and children and fades everyone else. "Show in network" in the person panel (on sheets, the Tree and the List). Its picture is named "Everyone network".
- The Wheel (part 4, agreed 2026-10-21): relation names are Telugu relationship names written in English letters (Amma, Nanna, Annayya, Babai, Menamama, Attha, Bava, Vadina, Menalludu, Thodikodalu…), the owner's own choice, with a "తె | En" toggle to English names, Telugu first and remembered per device; the full table is in BUILD_PLAN.md, part 4. A man's brother's children (a woman's sister's) are "Annayya koduku", "Chelli kuthuru"; with no birth year, both names ("Annayya/Thammudu"). Couples are Wife and Husband (Bharya, Bhartha). Tapping someone opens their panel (the middle stays); "Put in the middle" moves it. The wheel shows everyone related, one ring per step; people related through nobody are counted, not drawn. Its picture is named "<Name>'s relatives".
- Upcoming (birthdays and anniversaries, an owner request agreed 2026-10-21): a fifth view listing each living person's next birthday ("Turns 41") and each married couple's next wedding anniversary ("19th anniversary"; not divorced, both partners living) over the next 12 months, nearest first, by month, with "Today", "Tomorrow" or "In 5 days" for the next 30 days. Only dates with a day and month can be shown (without a year: "Birthday" or "Anniversary", with no age or count); the end of the list says how many living people have none. Milestones get a badge: Shashtipurti (a 60th birthday), Silver (25 years married), Golden (50). The dashboard shows the next 30 days across the person's groups, linking to each group's Upcoming. The person panel shows an age ("41 years old", "About 41 years old" with only a birth year, "Died aged 77"). On phones the view switcher drops its icons so the five names fit. No reminders by email or WhatsApp, and no filter chips or calendar file (the owner's choice).

### Backups and hardening (step 11)

- Nightly backup at 02:47 India time: a Node script with the MongoDB driver (not mongodump), reading production (familytree) with a read-only database user. Every collection except sessions and verifications (sign-in leftovers; after a restore everyone signs in again). Encrypted with AES-256-GCM; each run is trial-restored inside the runner, then kept 90 days as a GitHub Actions artifact. Photos stay in Cloudinary.
- The encryption key is a GitHub secret and is also kept in the owner's password manager.
- One fixed Content Security Policy for the whole site, allowing inline scripts (no nonces, so pages keep their prebuilt shell), plus the usual security headers. Since 2026-10-22, with `GTM_ID` set, the landing page's policy also allows Google Tag Manager (Tech stack & deployment).
- A smoke test checks the live site as a signed-out visitor after every production deployment, and by hand.
- Dependabot alerts on (emails about known vulnerabilities), no automatic update pull requests.
- Sign-up stays open to any Google account, who can then create groups (the owner's choice after step 11's review; ARCHITECTURE.md §11).

### Landing page and search engines (an owner request, 2026-10-22)

- The landing page says what the app is, in this order: Sign in with Google with the app on a computer and a phone; three steps; the AI assistant (its "Priya married Ravi" conversation, drawn as text); the relatives wheel with Telugu names; the network; birthdays and anniversaries; phones; six features; privacy; eight questions and answers; a second button ("Continue with Google", a wording Google allows). It stays static.
- Its title is "Family Tree with AI: build your family tree together", with a description of about 155 characters, one canonical address (also for `?returnTo=` links), link previews for chat apps and social sites (Open Graph and an X card, a 1200 × 630 picture), and structured data (the site, the app, the questions and answers). Inside the app the name stays "Family Tree".
- Search engines read only the landing page, and only on production (robots.txt, and a sitemap listing the landing page). Previews and local builds keep them out.
- Google Search Console's code is written into the code, like the coffee link; a copy of the app puts its own there or deletes it.
- A new icon: a couple joined by a heart and their two children, drawn like the tree's cards. It is the favicon, the home-screen icon and the logo.
- GitHub's social preview keeps everything that matters 80 px in from the edges (GitHub's template); the link preview is the same picture at 1200 × 630.
- The landing page's pictures are ready-made WebP files (`npm run images`, from the README's screenshots), not optimised by Vercel, so the page uses none of Vercel's image quota. They are the day screenshots in both themes.
- Not yet decided: a domain of the app's own (ARCHITECTURE.md §15).

### A production look (an owner request, 2026-10-23)

- One visual language from the landing page through every signed-in page, in both themes and on phones, tablets and computers, built in five parts on one branch: the app shell, the dashboard, Members and Settings, the tree page's frame, then toasts, loading skeletons and fresh screenshots. Features, permissions and rules stay the same.
- The tree drawing (cards, rings, hearts, layout), the Google button and the landing page stay as they are.
- A group switcher in the header, and the group's pages (Tree, Members, Settings) as tabs with the open one underlined in the blue-to-pink gradient, the only other use of which is Ask AI's sparkle.
- The theme as one button with a menu from tablets up; on phones it and the group's pages stay in the account menu (no bottom tab bar).
- Create a group, Invite, New sheet and the type-the-name confirmations become dialogs. The family tree cards show people, couples and members counts, but no "last changed" time.
- The dashboard and the header's switcher say "group", as the rest of the app does ("New group", "Your groups"). The cards show no member avatars: only Admins and the Owner see who is in a group. (Part 2, 2026-10-23.)
- On the members page a role is a menu, each role saying what it allows; choosing one saves it straight away. Remove asks in a dialog; leaving stays in Settings. The type-the-name confirmations in Settings keep their button disabled until the name is typed. (Part 3, 2026-10-23.)
- The sheet tabs are a segmented control, and the open sheet's options a drop-down menu, still first in the row on computers. New sheet, Rename and Delete sheet open dialogs. The eye that hides photos is the same square, bordered button on phones, tablets and computers (the owner's choice). (Part 4, 2026-10-23.)
- The person and couple panels list children eldest first by birth date, then those with no birth year, A to Z (an owner request, 2026-10-23).
- On every stored sheet the tree draws each couple's children eldest first, left to right, each with their whole family; ★ Everyone's Tree keeps crossing-free lines first (an owner request, 2026-10-23).

### First build step

- Done in step 2 (ELK.js chosen). Was: spike the tree layout using the people from samples/Sample Family Tree.png, before building the rest - it is the riskiest part.
