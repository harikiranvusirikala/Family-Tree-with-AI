# Family Tree with AI — Features

**Detailed design, data model and flows:** [ARCHITECTURE.md](ARCHITECTURE.md) (diagram: [docs/architecture.svg](docs/architecture.svg)) · **Step-by-step build plan and progress:** [BUILD_PLAN.md](BUILD_PLAN.md)

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
- UI: Tailwind CSS + shadcn/ui.
- AI chat: Claude API via `@anthropic-ai/sdk` with tool calling, model `claude-haiku-5-5`.
  - Model name kept in an environment variable so it can be switched without code changes.
  - Set a monthly spend limit in the Anthropic Console.
- All keys (MongoDB, Google, Cloudinary, Anthropic) live in Vercel environment variables, never in code.
- Cost: $0/month except AI chat usage (Haiku 5.5: roughly under $1/month at ~200 messages).

### Data model

- Each person is stored exactly once. Sheets are views, not copies: a sheet = a root person + their ancestors and descendants + any people explicitly added to it. A child added once shows up on every sheet that reaches them (Father's, in-law) - nothing to sync. The exception is a mother's sheet, which leaves out her children with the father: they're on his.
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
- Adding parents offers "Create their own sheet" for the mother, unchecked by default: a tab for her side of the family (her parents, brothers and sisters), without her children with the father, who are on his side. The father isn't offered one. (Owner requests after step 11.)
- Renaming a person renames their sheet when it still has its given title, "<Name>'s family"; a title of your own stays.
- The person panel has "Go to <sheet title>" for each sheet rooted at that person, apart from the one open, for everyone, Viewers included. (Owner request after step 11.)
- A person who is a sheet's root can't be deleted.
- Deleted people count as absent: after deleting someone's parents, new parents can be added; Undo still restores them.
- Tabs: "+ New sheet", rename, pin, move left/right and delete (buttons, not drag-and-drop). Pinned tabs come first.
- Deleting a sheet keeps everyone on it. Pinned sheets (the father's and mother's) can't be deleted until unpinned, nor can the last sheet. A partner's sheet is deleted first, then the partner can be.
- Hiding an extra person from a sheet is left for later.

### Phones and tablets (after the final check)

- The app works on phones and tablets as well as computers, mainly in phone browsers. Computers keep their layout.
- Phones switch sheets with a sheet picker: the open sheet's title, opening a list of every sheet.
- Below 1024 px (phones and tablets) the sheet's tools (Export, Import… and the sheet's own options) are in one ⋯ menu, with the eye that hides photos just before it in the sheet row (bigger, with no circle around it), and Ask AI is a round button over the tree.
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
- Hide photos (added after step 11): an eye button at the end of the sheet tabs, before Export, shows initials instead of every photo on the cards, in the person panel, and in a saved or printed picture. It saves nothing and anyone can use it; it lasts until the next visit.

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

### Backups and hardening (step 11)

- Nightly backup at 02:47 India time: a Node script with the MongoDB driver (not mongodump), reading production (familytree) with a read-only database user. Every collection except sessions and verifications (sign-in leftovers; after a restore everyone signs in again). Encrypted with AES-256-GCM; each run is trial-restored inside the runner, then kept 90 days as a GitHub Actions artifact. Photos stay in Cloudinary.
- The encryption key is a GitHub secret and is also kept in the owner's password manager.
- One fixed Content Security Policy for the whole site, allowing inline scripts (no nonces, so pages keep their prebuilt shell), plus the usual security headers.
- A smoke test checks the live site as a signed-out visitor after every production deployment, and by hand.
- Dependabot alerts on (emails about known vulnerabilities), no automatic update pull requests.
- Sign-up stays open to any Google account, who can then create groups (the owner's choice after step 11's review; ARCHITECTURE.md §11).

### First build step

- Done in step 2 (ELK.js chosen). Was: spike the tree layout using the people from samples/Sample Family Tree.png, before building the rest - it is the riskiest part.
