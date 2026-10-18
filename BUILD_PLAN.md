# Build Plan

**Design:** [ARCHITECTURE.md](ARCHITECTURE.md) · **Requirements and decisions:** [Features.txt](Features.txt) · **Started:** 2026-10-18

The app is built in small steps. Each step ends with its tests passing, a check by the owner, and a deploy. ARCHITECTURE.md is the blueprint: section numbers (§) and flow numbers (F) below refer to it.

## Progress

| Step | What | Status |
|---|---|---|
| 0 | Prerequisites | npm fixed 2026-10-18; accounts are created as each step needs them |
| 1 | Project skeleton and auto-deploy | Owner OK'd 2026-10-18; pushed `step-1-skeleton`. Waiting for CI, the Vercel import and the merge to `main` |
| 2 | Sheet view and tree layout | Not started |
| 3 | Database and the single write path | Not started |
| 4 | Google sign-in (F1) | Not started |
| 5 | Groups, roles and opening a sheet (F2, F5) | Not started |
| 6 | Editing the tree by hand (F6) | Not started |
| 7 | Photos (F8) | Not started |
| 8 | Members, invites and access requests (F3, F4) | Not started |
| 9 | AI chat (F7) | Not started |
| 10 | Import and export (F9, F10) | Not started |
| 11 | Nightly backup and hardening (F12) | Not started |

## How we work

- **One step at a time.** At the end of each step, all tests are run and the owner gets a short "try this" list. Once the owner approves, the step is committed to a `step-N-<name>` branch and pushed. Vercel builds a preview against `familytree_preview`, the owner checks it, and the branch is merged to `main`, which deploys the live site.
- **Databases:** one free Atlas cluster. `familytree_dev` for local development, `familytree_preview` for Vercel previews, `familytree` for the live site (§12). Each test run gets a throwaway `familytree_test_<run-id>`, dropped afterwards.
- **Test data:** `test/fixtures/cruz-young.ts` holds the 34 people from the sample tree image (names, genders and years only). It covers a same-sex couple, a divorce and remarriage, and in-law parents. Only this invented data is used until permissions exist (step 5).
- **Design changes:** when a step settles a design question, ARCHITECTURE.md (the relevant section and §15) and Features.txt are updated in that step's commit, and the Progress table here gets a note.
- **Network:** the Claude Code sandbox on the owner's machine may block some calls (`github.com` push, `*.mongodb.net`, `api.anthropic.com`, `ui.shadcn.com`). The owner decides whether to allow the specific domain. Otherwise they run that command in their own terminal; GitHub Actions also runs every test.

## How every step is tested

- **Unit tests (Vitest):** pure logic: `src/tree/*` (sheet view, layout), `requireRole` rules, email normalisation, operation validation, AI tool handlers, GEDCOM. No network.
- **Integration tests (Vitest + Atlas):** repositories and `applyOperations` against a fresh `familytree_test_<run-id>` database.
- **End-to-end tests (Playwright, Chromium):** the real app against the test database. Sign-in uses a test-only login, enabled only by `E2E_TEST_LOGIN=1` and never set on Vercel. A test checks that it returns 404 without the flag.
- **CI (GitHub Actions, from step 1):** lint, type-check, unit, integration and e2e on every push. The test database URI is a repo secret.
- **Every step:** `npm run lint && npm run typecheck && npm test && npm run test:e2e` pass locally, CI is green on the branch, and the "try this" list passes on the Vercel preview before merging.
- Code additions beyond §4: `test/fixtures/`, `e2e/`, and `src/app/dev/*` pages. The dev pages return 404 unless run with `npm run dev`, so they never appear on Vercel.

## Step 0: Prerequisites
- [x] npm registry token refreshed. `@swc/helpers`, `better-auth`, `@xyflow/react`, `relatives-tree` and `create-next-app` all install.
- Accounts the owner creates when their step arrives: Vercel (step 1), MongoDB Atlas (step 3), a Google Cloud OAuth client (step 4), Cloudinary (step 7), an Anthropic API key (step 9).

## Step 1: Project skeleton and auto-deploy
- **Build:**
  - `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/`), plus Vitest and Playwright.
  - `.env*` added to `.gitignore`; `.env.example` lists every variable in §13.
  - README with setup steps, a CI workflow, and a placeholder landing page at `src/app/page.tsx`.
  - Mark §15 question 1 resolved (Admins and the Owner approve access requests).
- **Tests:** a unit test runs, a Playwright smoke test opens `/`, `npm run build` succeeds, CI passes.
- **Owner:** import the GitHub repo into Vercel (Hobby plan).
- **Done when:** a push to `main` updates the live `*.vercel.app` URL and a branch push gets its own preview URL.

## Step 2: Sheet view and tree layout (the riskiest part; no database yet)
- **Build:**
  - `src/tree/sheet-view.ts`: `buildSheetView()` following §6: ancestors, then descendants of every ancestor, then partners (not their parents), then extras.
  - `src/tree/layout/`: the `LayoutEngine` interface from §7, with two adapters, relatives-tree and ELK.js `layered` (unions as their own nodes).
  - `src/components/tree/`: `FamilyCanvas` (React Flow with pan, zoom, minimap and fit to screen), `PersonNode` (round photo or initials, light-blue or light-pink border, name, years) and `UnionNode` (♥, or a broken heart for divorced, children ordered by birth year).
  - `/dev/layout` shows any sheet from the fixture, with a switch between the two engines.
- **Tests:**
  - **Sheet view (unit), using the worked examples from §6:**
    - The Cruz sheet rooted at Alexander Cruz includes Timothy Cruz, Amy Harolds, all their descendants, and partners such as Jerry Willow, Taylor Humes, Arjun Patel and Emma Young. It excludes Cynthia Willow and Fred Lambert.
    - Jerry Willow's sheet includes his parents and the same Jake, Olivia and Timothy Cruz records.
    - The Cruz sheet plus the 4 in-law parents as extras contains all 34 people.
  - **Layout (unit, same tests run on both engines):**
    - No cards overlap, and each generation sits in one row.
    - Children are below their parents' union, and partners sit beside their union.
    - Steve Cruz's two unions and the Alexander + Jerry couple both work.
    - Adding a child re-lays out with no overlaps.
    - A generated 300-person tree lays out in under 200 ms.
    - Living people show `1985` and deceased people `1945 – 2022`.
  - **Visual:** a Playwright screenshot of the 34-person sheet, compared by eye with the sample image.
- **Decision:** keep the engine that passes and looks closer to the sample, and remove the other. Update §3, §7 and §15 question 2.

## Step 3: Database and the single write path
- **Owner:** create the Atlas M0 cluster, allow network access from `0.0.0.0/0`, and create separate database users per §11. Connection strings go in `.env.local` (never committed). In Vercel, set `MONGODB_DB=familytree` for Production and `familytree_preview` for Preview.
- **Build:**
  - `src/server/db.ts`: one client, reused across serverless invocations.
  - zod schemas for every §5 collection.
  - `src/server/repositories/`: every function requires `groupId`; soft delete via `deletedAt`; the §5 indexes are created by a script.
  - `src/server/operations/`: `applyOperations(groupId, ops, actor)` with the `Operation` type from §10.
    - Temporary IDs (`new:1`) are resolved in order.
    - Validation: a union has 1–2 partners, a person is a child of at most one union, and references must exist in the same group.
    - Writes happen in one transaction and set the audit fields.
  - `npm run seed` loads the fixture into `familytree_dev` through `applyOperations`. `/dev/layout` can read from the database.
- **Tests:**
  - Integration: an operations batch with temp IDs is applied all-or-nothing; invalid batches change nothing; soft delete and undo work.
  - Integration: repositories never return another group's records.
  - E2E: the seeded sheet renders from the database.

## Step 4: Google sign-in (F1)
- **Owner:** create a Google OAuth client and register redirect URIs for localhost and the production URL. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to `.env.local` and Vercel.
- **Build:**
  - `src/server/auth.ts` (Better Auth, Google only, MongoDB adapter) and `api/auth/[...all]`.
  - Landing page with "Sign in with Google", `requireUser()`, and `returnTo` so users come back to the link they opened.
  - A `/dashboard` placeholder, a user menu with sign-out, and the test-only login.
  - Settle §15 question 4 (Google sign-in on preview deployments): try Better Auth's OAuth proxy plugin first, else a fixed branch URL.
- **Tests:** E2E: signed out → `/dashboard` redirects to sign-in → after the test login, back on `/dashboard`; `returnTo` is kept. Unit: the test login returns 404 without the flag.
- **Owner checks:** a real Google sign-in on the preview deployment.

## Step 5: Groups, roles and opening a sheet (F2, F5, §8)
- **Build:**
  - First settle §15 question 3: adopt Better Auth's organization plugin if it supports in-app invites without email, otherwise use our own `groups`/`memberships`.
  - `src/server/permissions.ts`: `requireRole` exactly as in §8, raising `NoAccessError` whether or not the group exists.
  - Dashboard showing My groups and Shared with me.
  - F2 create group: group name, father's name and mother's name (optionally yourself as their child). One transaction creates the group, the owner membership, both parents, their union and two pinned sheets.
  - `/g/[groupId]` redirects to the first pinned sheet. `/g/[groupId]/s/[sheetId]` loads the whole group once and has instant sheet tabs (F5).
  - `/g/[groupId]/settings`: rename and delete (Owner only).
- **Tests:**
  - Unit: the full §8 role × action table.
  - Integration: a non-member gets the same `NoAccessError` for an existing group and a made-up one.
  - E2E: a new user sees an empty dashboard → creates a group → lands on the father's sheet with both tabs; a second test user sees nothing from the first user's groups.

## Step 6: Editing the tree by hand (F6)
- **Build:**
  - A server action wraps `applyOperations` with `requireRole(groupId, "maintain")`.
  - UI to add a parent, partner or child, edit a person, mark a union divorced, soft delete with Undo, create a sheet, show a person on a sheet, and pin and reorder tabs.
  - The layout re-runs after each change. Viewers see no edit controls.
- **Tests:**
  - E2E: add a child under Jake and Taylor → it appears on every sheet that reaches them; adding a partner who married in, with "create their sheet" checked, adds a new tab rooted at them; delete then Undo.
  - Integration: a Viewer calling the server action directly is rejected.

## Step 7: Photos (F8)
- **Owner:** create a Cloudinary account and add the three `CLOUDINARY_*` variables.
- **Build:**
  - `api/uploads/sign` (Maintain and up) signs uploads for the folder `groups/{groupId}` with a random public ID.
  - The browser uploads directly to Cloudinary.
  - `setPhoto` checks the ID is inside `groups/{groupId}/` and replaces `photoId`, deleting the old photo.
  - `PersonNode` shows a face-cropped thumbnail (`c_thumb,g_face`).
- **Tests:**
  - Integration: Viewers can't get a signature; a `photoId` outside the group's folder is rejected.
  - E2E: the upload flow with Cloudinary mocked.
- **Owner checks:** a real upload on the preview.

## Step 8: Members, invites and access requests (F3, F4)
- **Build:**
  - `/g/[groupId]/members` (Admin and up): list members, change roles (up to Admin), remove members, invite by email and role, copy the invite link, revoke invites, and approve or deny access requests.
  - `/invite/[token]`: accept or decline. It works only if the normalised signed-in email matches, and otherwise shows only the masked address.
  - Dashboard: pending invites and the status of my requests. A "You need access" page with Request access (it reveals nothing about the group), or "Accept invite" if one is waiting.
  - A request badge for Admins and the Owner. Only Admins and the Owner approve requests.
  - Owner protections, and transfer ownership in Settings.
- **Tests:**
  - Unit: `normalizeEmail` (case, dots and `+tags` for gmail.com only).
  - E2E with two or three test users:
    - invite → accept → the group appears under Shared with me;
    - the link opened by a different account → refused;
    - expired or revoked link → does nothing;
    - request → approve as Maintain → can edit;
    - request → deny → the requester sees "denied";
    - a Viewer and a Maintainer can't approve requests;
    - an Admin can't remove the Owner;
    - a request for a made-up group looks the same and is dropped.

## Step 9: AI chat (F7, §10)
- **Owner:** create an Anthropic API key, set a monthly spending limit, and add `ANTHROPIC_API_KEY`, `CHAT_MODEL=claude-haiku-5-5` and `CHAT_DAILY_LIMIT`.
- **Build:**
  - `ChatWidget` (bottom right) and `api/chat`, streaming through the official `@anthropic-ai/sdk`.
  - The 8 tools from §10, with `strict: true` and filtered by role. Proposal tools return temporary IDs and save nothing.
  - `ProposalCard` lists the changes in plain words. Confirm sends them through the step 6 server action (all or nothing).
  - The system prompt puts stable instructions first so they can be cached, then the role and roster. Names are treated as data.
  - `chatUsage` enforces the daily cap.
- **Tests:**
  - Unit: tool handlers, temporary-ID chaining, role filtering (Viewers get only the read tools), and the daily cap. None of these call the API.
  - E2E with a stand-in for the model: "Priya Sharma married Ravi" → "which Ravi?" → "1980" → proposal card → Confirm → Priya and her sheet tab appear.
  - `npm run test:ai-live`: a live check run once by hand, costing under a cent.

## Step 10: Import and export (F9, F10)
- **Build:**
  - `api/groups/[groupId]/export` (Maintain and up): JSON or GEDCOM, for the whole group or one sheet.
  - `api/groups/[groupId]/import`: parse into operations, preview counts and possible duplicates (same name and birth year), and choose keep both or use existing for each.
  - Imports are applied through `applyOperations`, into this group or a new one.
  - GEDCOM files over about 4 MB are parsed in the browser.
  - PNG/PDF capture of the canvas (View and up).
- **Tests:**
  - Unit: JSON and GEDCOM round trips of the fixture return the same people and unions.
  - Unit: a one-sheet export contains exactly the people that sheet shows.
  - E2E: import with one duplicate resolved; a Viewer can download a PNG but gets no data export.

## Step 11: Nightly backup and hardening (F12, §11)
- **Build:**
  - A scheduled GitHub Actions job runs `mongodump` with the read-only user (`MONGODB_BACKUP_URI`), encrypts the dump with `BACKUP_ENCRYPTION_KEY`, and keeps it as an artifact for 90 days. A restore script goes with it.
  - Security headers.
  - A check that `E2E_TEST_LOGIN` is refused when `VERCEL_ENV` is set.
  - A security review pass over the whole app.
- **Tests:** run the workflow by hand → download, decrypt and restore into a scratch database → counts match. A final e2e smoke test against production.

## Final check on the live site
1. Sign in with Google.
2. Create a group with the father's and mother's names.
3. Add family members by hand and through the chat, including someone who married in, which creates their own sheet.
4. Upload a photo.
5. Invite a second Google account as View.
6. From a third account, open a tree link → request access → approve it as Maintain.
7. Export GEDCOM, re-import it into a new group, and confirm the nightly backup ran.
