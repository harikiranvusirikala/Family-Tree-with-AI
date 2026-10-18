# Build Plan

**Design:** [ARCHITECTURE.md](ARCHITECTURE.md) · **Requirements and decisions:** [Features.txt](Features.txt) · **Started:** 2026-10-18

The app is built in small steps. Each step ends with its tests passing, a check by the owner, and a deploy. ARCHITECTURE.md is the blueprint: section numbers (§) and flow numbers (F) below refer to it.

## Progress

| Step | What | Status |
|---|---|---|
| 0 | Prerequisites | Done 2026-10-18: npm token, sandbox allowlist, Atlas access. Accounts are created as each step needs them |
| 1 | Project skeleton and auto-deploy | Done 2026-10-18 (merged to `main`). Live at https://family-tree-with-ai.vercel.app |
| 2 | Sheet view and tree layout | Done 2026-10-18 (merged to `main`). ELK.js chosen; see the step 2 notes |
| 3 | Database and the single write path | Done 2026-10-18 (merged to `main`). See the step 3 notes |
| 4 | Google sign-in (F1) | Owner OK'd and committed 2026-10-18 on `step-4-sign-in` (lint, typecheck, unit, db and e2e tests pass). Vercel variables set. Waiting for push and merge to `main`. Still to do: publish the Google app (see step 4) |
| 5 | Groups, roles and opening a sheet (F2, F5) | Not started |
| 6 | Editing the tree by hand (F6) | Not started |
| 7 | Photos (F8) | Not started |
| 8 | Members, invites and access requests (F3, F4) | Not started |
| 9 | AI chat (F7) | Not started |
| 10 | Import and export (F9, F10) | Not started |
| 11 | Nightly backup and hardening (F12) | Not started |

## How we work

- **One step at a time.** At the end of each step, all tests are run and the owner gets a short "try this" list. Once the owner approves, the step is committed to a `step-N-<name>` branch.
- **Pushing:** the Claude Code sandbox blocks github.com, so the owner pushes the branch (`git push -u origin step-N-<name>`). CI runs, Vercel builds a preview against `familytree_preview`, the owner checks it and merges to `main`, which deploys the live site. Each new step starts by checking that local `main` has the merge.
- **Databases:** one free Atlas cluster. `familytree_dev` for local development, `familytree_preview` for Vercel previews, `familytree` for the live site (§12). Tests use throwaway `familytree_test_<time>_<label>` databases that remove themselves.
- **Test data:** `test/fixtures/cruz-young.ts` holds the 36 people from the sample tree image (names, genders and years only). It covers a same-sex couple, a divorce and remarriage, and in-law parents. Only this invented data is used until permissions exist (step 5). `npm run seed` loads it into `familytree_dev`.
- **Design changes:** when a step settles a design question, ARCHITECTURE.md (the relevant section and §15) and Features.txt are updated in that step's commit, and the Progress table here gets a note.
- **Sandbox (owner's machine):**
  - Commands that open local ports or reach MongoDB fail in the sandbox, so the owner allowlists them as `exact_match` (in the Claude Code sandbox dashboard → Tools): `npm run build`, `npm run test:e2e`, `npm run test:db`, `npm run db:ping`, `npm run db:setup`, `npm run seed`. They're run exactly as written. Anything else that needs ports or the database runs in the owner's terminal.
  - Allowing a domain doesn't help MongoDB: the driver uses its own protocol, not the web proxy.
  - Still blocked: github.com (the owner pushes), Google Fonts, and Playwright's browser download (local e2e uses the installed Chrome).
  - The session loads `.env.local` when it starts. After `.env.local` changes, restart the session before running commands.

## Environments and secrets

| Where | Variables |
|---|---|
| `.env.local` (local, git-ignored) | Everything in [.env.example](.env.example). `MONGODB_DB=familytree_dev`, `BETTER_AUTH_URL=http://localhost:3000` |
| Vercel, Production | `MONGODB_URI`, `MONGODB_DB=familytree`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (own value), `BETTER_AUTH_URL=https://family-tree-with-ai.vercel.app`, `OAUTH_PROXY_SECRET` (same value as Preview) |
| Vercel, Preview | `MONGODB_URI`, `MONGODB_DB=familytree_preview`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (a different value), `OAUTH_PROXY_SECRET` (same value as Production). No `BETTER_AUTH_URL`: the app uses Vercel's `VERCEL_BRANCH_URL` and `VERCEL_URL` |
| Vercel, Development | Nothing; local work uses `.env.local` |
| GitHub Actions secret | `MONGODB_URI` for a separate read/write test user (repo → Settings → Secrets and variables → Actions) |

- Later steps add `CLOUDINARY_*` (step 7) and `ANTHROPIC_API_KEY`, `CHAT_MODEL`, `CHAT_DAILY_LIMIT` (step 9) to both Production and Preview, and `MONGODB_BACKUP_URI`, `BACKUP_ENCRYPTION_KEY` (step 11) as GitHub secrets.
- Secrets are marked Sensitive in Vercel.
- Vercel variables only reach new deployments, so redeploy (or push) after changing them.

## How every step is tested

- **Unit tests (Vitest, `npm test`):** pure logic, no network: sheet view, layout, operation rules (`planOperations`), and later `requireRole`, email normalisation, AI tool handlers and GEDCOM.
- **Database tests (Vitest + Atlas, `npm run test:db`):** `*.db.test.ts` files for transactions, persistence and group isolation. Each file gets its own throwaway database.
- **End-to-end tests (Playwright, `npm run test:e2e`):** a production build of the app. Each run seeds its own throwaway database with the sample family and removes it afterwards. From step 4, signed-in tests use a Playwright fixture that creates users and sessions directly in the run's database (Better Auth's `testUtils` plugin). The app itself has no test-login route.
- **CI (GitHub Actions):** lint, type-check, `npm test`, `npm run test:db` and e2e on every push, using the `MONGODB_URI` secret.
- **Every step:** `npm run lint && npm run typecheck && npm test && npm run test:db && npm run test:e2e` pass locally, CI is green on the branch, and the "try this" list passes on the Vercel preview before merging.
- Code additions beyond §4: `test/` (fixtures, database helpers, seed), `e2e/`, `scripts/` (`db:ping`, `db:setup`, `seed`), and `src/app/dev/*` pages. The dev pages return 404 unless run with `npm run dev` or built with `ENABLE_DEV_PAGES=1` (the e2e tests do this), so they never appear on Vercel.

## Step 0: Prerequisites
- [x] npm registry token refreshed. `@swc/helpers`, `better-auth`, `@xyflow/react` and `create-next-app` all install.
- [x] Commands that need ports or MongoDB allowlisted in the sandbox (see How we work).
- [x] MongoDB Atlas cluster reachable from the owner's machine (`npm run db:ping`).
- [x] Stale environment fixed. An old `.env` file plus VS Code's `python.terminal.useEnvFile` setting had loaded empty values into the session, and tools never override variables that are already set. Both were removed and the session restarted.
- Accounts the owner creates when their step arrives: Vercel (step 1, done), MongoDB Atlas (step 3, done), a Google Cloud OAuth client (step 4, done), Cloudinary (step 7), an Anthropic API key (step 9).

## Step 1: Project skeleton and auto-deploy
- **Build:**
  - `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/`), plus Vitest and Playwright.
  - `.env*` added to `.gitignore`; `.env.example` lists every variable in §13.
  - README with setup steps, a CI workflow, and a placeholder landing page at `src/app/page.tsx`.
  - Mark §15 question 1 resolved (Admins and the Owner approve access requests).
- **Tests:** a unit test runs, a Playwright smoke test opens `/`, `npm run build` succeeds, CI passes.
- **Owner:** import the GitHub repo into Vercel (Hobby plan).
- **Done when:** a push to `main` updates the live `*.vercel.app` URL and a branch push gets its own preview URL.
- **Step 1 notes (2026-10-18):**
  - Next.js 16.4 with Turbopack, Tailwind v4 and React 19. Cache Components and Partial Prefetching are on by default, so database and cookie reads in pages go inside `<Suspense>`.
  - `create-next-app` refuses a folder that already has files, so the project was generated in a scratch folder and copied in.
  - `.npmrc` keeps `package-lock.json` free of registry download URLs: a mirror locally, the public registry on Vercel and CI, and no internal hostnames in the repo. It also sets `legacy-peer-deps=false`, which surfaced a real conflict (`@types/node` 20 vs Vitest 5), fixed by moving to Node 24 types.
  - The system font stack replaces `next/font/google` (blocked locally).
  - Playwright runs against the installed Chrome locally and its own Chromium on CI.
  - `npm audit`'s 5 "high" findings are in dev tooling only (`braces`); runtime dependencies have none.
  - After step 3, `vercel.json` pinned the framework to Next.js (`dce3c66`). The dashboard had detected "Other", so Vercel treated the app as a static site and failed with "No Output Directory named "public" found".

## Step 2: Sheet view and tree layout (the riskiest part; no database yet)
- **Build:**
  - `src/tree/sheet-view.ts`: `buildSheetView()` following §6: ancestors, then descendants of every ancestor, then partners (not their parents), then extras.
  - `src/tree/layout/`: the `LayoutEngine` interface from §7, with two adapters, relatives-tree and ELK.js `layered` (unions as their own nodes).
  - `src/components/tree/`: `FamilyCanvas` (React Flow with pan, zoom, minimap and fit to screen), `PersonNode` (round photo or initials, light-blue or light-pink border, name, years) and `UnionNode` (♥, or a broken heart for divorced, children ordered by birth year).
  - `/dev/tree` (named so it doesn't clash with Next.js `layout.tsx` files) shows any sheet from the fixture.
- **Tests:**
  - **Sheet view (unit), using the worked examples from §6:**
    - The Cruz sheet rooted at Alexander Cruz includes Timothy Cruz, Amy Harolds, all their descendants, and partners such as Jerry Willow, Taylor Humes, Arjun Patel and Emma Young. It excludes Cynthia Willow and Fred Lambert.
    - Jerry Willow's sheet includes his parents and the same Jake, Olivia and Timothy Cruz records.
    - The Cruz sheet plus the 4 in-law parents as extras contains all 36 people.
  - **Layout (unit, same tests run on both engines):**
    - No cards overlap, and each generation sits in one row.
    - Children are below their parents' union, and partners sit beside their union.
    - Steve Cruz's two unions and the Alexander + Jerry couple both work.
    - Adding a child re-lays out with no overlaps.
    - A generated 300-person tree lays out in under 200 ms.
    - Living people show `1985` and deceased people `1945 – 2022`.
  - **Visual:** a Playwright screenshot of the 36-person sheet, compared by eye with the sample image.
- **Decision:** keep the engine that passes and looks closer to the sample, and remove the other. Update §3, §7 and §15 question 2.
- **Step 2 notes (2026-10-18):**
  - ELK.js chosen. relatives-tree dropped the 4 in-law parents (it only draws the root's own relatives) and separated Steve from Sammie. ELK passed every structural test. Partners are grouped into side-by-side blocks (ARCHITECTURE.md §7). Only `layoutEngine` in `src/tree/layout/index.ts` names the engine.
  - Sibling order: strict birth order would add crossing lines, and the sample image isn't in birth order either. Siblings with no family of their own are now eldest first; siblings with their own families keep the crossing-free position. A test checks this on the sample (Carrie, Carlo, Tay; Amelia, Jake, Timothy; Taylor, Anna).
  - Speed: about 30 ms for 100 people and about 250 ms for 300, so the 200 ms target was missed. The faster placement option (Brandes–Köpf) looked lopsided. The test is now a regression guard: under 400 ms locally, 1500 ms on CI.
  - The minimap needed fixed node sizes: controlled React Flow nodes aren't measured, and the minimap skips nodes without a size.
  - `/dev/tree` has controls to change the root person, show or hide the in-law parents, and add a child. The e2e test saves `test-results/screenshots/tree.png`.
  - Cards use the system serif font. Google Fonts is blocked on the work network; a self-hosted font can be added later.

## Step 3: Database and the single write path
- **Owner:** create the Atlas M0 cluster, allow network access from `0.0.0.0/0`, and create separate database users per §11. Connection strings go in `.env.local` (never committed). Vercel variables: see Environments and secrets.
- **Build:**
  - `src/server/db.ts`: one client, reused across serverless invocations.
  - zod schemas for the operations (see the notes for why not per collection).
  - `src/server/repositories/`: every function requires `groupId`; soft delete via `deletedAt`; the §5 indexes are created by a script.
  - `src/server/operations/`: `applyOperations(groupId, ops, actor)` with the `Operation` type from §10.
    - Temporary IDs (`new:1`) are resolved in order.
    - Validation: a union has 1–2 partners, a person is a child of at most one union, and references must exist in the same group.
    - Writes happen in one transaction and set the audit fields.
  - `npm run seed` loads the fixture into `familytree_dev` through `applyOperations`. `/dev/tree/db` draws it from the database.
- **Tests:**
  - Unit (23): one batch recreates the whole sample family with the same sheet views; every rule rejects bad batches with the failing change's number; the schema rejects malformed input.
  - Database (7): an operations batch with temp IDs is applied all-or-nothing; invalid batches change nothing; soft delete and undo work; groups are isolated; two concurrent edits to the same couple both land; indexes exist.
  - E2E: the seeded family renders from the database: 36 people on "Cruz family", 32 on "Jerry Willow's family".
- **Step 3 notes (2026-10-18):**
  - Validation lives in the operations (zod), not on the documents. Documents are only written through `applyOperations`, so they are typed in TypeScript (`src/server/repositories/documents.ts`). `applyOperations` = zod, then a pure planner (`planOperations`, unit-tested without a database), then one transaction (ARCHITECTURE.md §10).
  - More rules than planned: no duplicate couples, nobody becomes their own ancestor, death year not before birth year. Repeating `addChild` or `addToSheet` changes nothing.
  - Added a `restorePerson` operation (Undo for delete) and an optional `pinned` on `createSheet` (F2 needs pinned sheets). Sheets got audit fields like the other records.
  - IDs: documents use `ObjectId`; tree types and operations use hex strings. Conversion happens only in `loadGroupTree` and `planOperations`.
  - Tests are split. `npm test` is unit tests only and works offline. `npm run test:db` runs the `*.db.test.ts` integration tests against Atlas. Each test file and each e2e run gets its own `familytree_test_<time>_<label>` database.
  - The app's database user can't drop databases (good: read/write only), so tests remove their database by dropping its collections. Leftovers older than an hour are cleared at the start of each run.
  - Scripts (`db:ping`, `db:setup`, `seed`) are `.mts` files run with `node --import tsx`. The `tsx` command itself opens a local pipe that the sandbox blocks.
  - Until groups exist (step 5), the sample family lives in a fixed group, `000000000000000000000001`, in `familytree_dev`. `/dev/tree/db` draws it, reading inside `<Suspense>` after `await connection()` so the build never touches the database.
  - CI needs a `MONGODB_URI` repository secret: GitHub repo → Settings → Secrets and variables → Actions. Use a separate read/write test user. (Added 2026-10-18.)

## Step 4: Google sign-in (F1)
- **Owner:**
  - Done: the Google OAuth client (redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://family-tree-with-ai.vercel.app/api/auth/callback/google`) and `.env.local`.
  - Done: Vercel variables for Production and Preview (see Environments and secrets), including `OAUTH_PROXY_SECRET`, which must be the same in both.
  - Google Auth Platform → Audience: publish the app. While it is in Testing, only listed test users can sign in. The app asks only for name, email and photo, so Google doesn't need to review it.
  - Check that the Vercel function region (default `iad1`, Washington) is close to the Atlas cluster. If not, set `regions` in `vercel.json`: from now on every signed-in page reads the database.
- **Build:**
  - `src/server/auth.ts` (Better Auth 1.7, Google only) and `api/auth/[...all]/route.ts`:
    - MongoDB adapter given the shared client, so Better Auth's own writes use transactions. Collections are `users`, `sessions`, `accounts` and `verifications` (`usePlural: true`, as in §5). Settle this before the first real user signs up; renaming later means moving data.
    - `db.ts` hands the adapter a client without connecting, so the build never touches the database.
    - Base URL and trusted origins come from a pure `authUrls(env)`: `BETTER_AUTH_URL` locally and in production; on previews, exactly `VERCEL_BRANCH_URL` and `VERCEL_URL`. Never `*.vercel.app`, which would trust anyone's Vercel app.
    - Google with `prompt: "select_account"`, so a shared family computer can switch accounts. A sign-in is refused if Google says the email isn't verified, because step 8 matches invites by email.
    - Sessions last 30 days (Better Auth's default is 7) and are extended with use. Server Components can't write cookies, so Better Auth skips the refresh there. The user menu's `useSession()` calls `/api/auth/get-session`, which does refresh. Without that, people are signed out a fixed time after signing in, however active they are.
    - The shared options live in a module without `import "server-only"`, so the e2e fixture can build an identical instance (cookie names must match).
  - **Preview sign-in (§15 question 4): Better Auth's `oAuthProxy` plugin** in Production and Preview, with `productionURL` from `VERCEL_PROJECT_PRODUCTION_URL` and its own `secret` (`OAUTH_PROXY_SECRET`). Checked in the 1.7 source: production exchanges the Google code but creates no user, then hands the encrypted profile back to the preview, which signs in against `familytree_preview`. The databases and `BETTER_AUTH_SECRET` stay separate, and Google keeps just the two redirect URIs. It only works once production runs the plugin, so the step 4 preview can't sign in with Google (see Owner checks).
  - `src/proxy.ts` (Next.js 16's name for middleware) only checks that a session cookie is present (`getSessionCookie`), with no database read:
    - Deny by default, so later pages are covered without being listed. Public: `/`, `/api/auth/*` (the Google callback arrives without a session), `/dev/*`, `/_next/*` and static files.
    - A signed-out page request gets a real 307 to `/?returnTo=<path and query>`. A `redirect()` inside `<Suspense>` would stream a client-side refresh instead. API routes and non-GET requests get 401.
    - Never redirect *because* a cookie is present: a stale cookie would bounce between `/` and `/dashboard`.
    - It's a convenience, not security. Pages, server actions and routes still check for themselves (§8).
  - `src/server/permissions.ts`: `getUser()` (user or null) and `requireUser()` (redirects to `/`). Route handlers return 401 instead of redirecting. Step 5's `requireRole` builds on these. Neither uses `use cache: private`, because the role must be read fresh on each request.
  - `safeReturnTo()` (pure): keeps same-site paths only (`/…`, but not `//…` or `/\…`). Anything else becomes `/dashboard`.
  - The landing page stays static. "Sign in with Google" is a client component that reads `returnTo` when clicked and passes it to Better Auth as `callbackURL`. `errorCallbackURL` brings failures (consent cancelled, sign-in expired) back to `/` with a plain message.
  - `/dashboard` placeholder that reads the session inside `<Suspense>`. A user menu with the name, initials and Sign out:
    - Initials rather than the Google photo through `next/image`, which would need `remotePatterns` and uses Vercel's image quota.
    - After signing out, a full page load of `/`, so no signed-in page stays in the browser's router cache.
  - `ensureIndexes` adds TTL indexes on `sessions.expiresAt` and `verifications.expiresAt`, so expired rows don't fill the 512 MB cluster. Better Auth creates its other indexes on first write. Don't repeat those: the same keys under another index name fail.
  - **Test-only sign-in without a route in the app.** Better Auth's `testUtils` plugin is used only from `e2e/`:
    - A Playwright fixture `signIn(page, name)` creates a fresh user and session in the run's database and adds the signed cookie. Parallel tests never share a user, and steps 5 and 8 get as many users as they need.
    - There is no backdoor to guard, so `E2E_TEST_LOGIN` and the step 11 check for it go away. ESLint forbids importing `testUtils` under `src/`.
  - `playwright.config.ts` gives the web server its own auth settings:
    - `BETTER_AUTH_URL=http://localhost:3100`. Otherwise `.env.local`'s port 3000 leaks in and Better Auth rejects the origin.
    - A random `BETTER_AUTH_SECRET` per run, shared with the fixture. `next start` refuses Better Auth's default secret, and CI has none.
    - Placeholder Google credentials.
  - Docs in the same commit: ARCHITECTURE.md §5 (collection names, TTL indexes), §12, §13 (add `OAUTH_PROXY_SECRET`, drop `E2E_TEST_LOGIN`) and §15 question 4; Features.txt DECISIONS; `.env.example`; CLAUDE.md.
- **Tests:**
  - Unit:
    - `safeReturnTo`: a path with a query is kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…` and empty give `/dashboard`.
    - `authUrls` for local, e2e, preview and production, with no wildcard origins.
    - The proxy's decision for public paths, pages, API routes and POSTs.
  - Database: the TTL indexes exist (extend the indexes test).
  - E2E:
    - Signed out, `/dashboard?tab=x` answers 307 to `/?returnTo=%2Fdashboard%3Ftab%3Dx` (checked without following redirects).
    - "Sign in with Google" posts `callbackURL=/dashboard?tab=x` and is sent to `accounts.google.com` with `redirect_uri=http://localhost:3100/api/auth/callback/google`. The test stops there and never contacts Google. With `returnTo=https://evil.example` it posts `/dashboard`.
    - Signed in through the fixture, `/dashboard` shows the user's name. Sign out leads to `/`, and `/dashboard` redirects again.
    - A garbage session cookie on `/dashboard` ends on `/` once, with no redirect loop.
- **Owner checks:**
  - Before merging, on `npm run dev` in the owner's terminal: a real Google sign-in and sign-out; the account chooser with a second Google account; `/dashboard?x=1` opened while signed out comes back after signing in. Use `localhost`, not `127.0.0.1`: Google and the cookies treat them as different sites.
  - Before merging: `npm run db:setup` against `familytree_preview` and `familytree` (`MONGODB_DB` set to each), so the TTL indexes and step 3's indexes exist there.
  - Right after merging: a real sign-in on production.
  - Step 5's preview is the first that can sign in with Google through the proxy. Check it there.
- **Step 4 notes (2026-10-18):**
  - Checked in the Better Auth 1.7.10 source:
    - `oAuthProxy` takes its own `secret`, and production creates no user.
    - The Mongo adapter uses transactions when given the client.
    - `user.validateUserInfo` receives Google's fresh `emailVerified` on every sign-in, not only the first.
    - Better Auth defines no index on `expiresAt`, so the TTL indexes don't clash with its own.
  - Server code reads the session with `disableRefresh`. Better Auth's `nextCookies` plugin skips the refresh only for client-side navigations (the `RSC` header). On a full page load, a Server Component would extend the session in the database while the cookie write failed silently, and the next `get-session` would see a fresh session and not refresh the cookie either. `nextCookies` isn't used at all: sign-in and sign-out run in the browser.
  - The fixture's Better Auth instance leaves out `validateUserInfo`. `testUtils` creates users outside a request, where Better Auth refuses to run the hook (`validation_context_missing`). Cookie names and signatures don't depend on it.
  - `testUtils` generates ids that aren't valid `ObjectId`s, which the adapter would store as strings. The fixture passes a real `ObjectId`.
  - The sign-in button and user menu stay disabled until React has hydrated (`useHydrated`), so an early click isn't silently lost. It also keeps the e2e tests from flaking.
  - Sign out ends with `location.replace("/")`: a full page load, and the signed-in page leaves the Back history. (ESLint's Next.js rule flags `location.assign` with a relative path.)
  - Next.js's route announcer also has `role="alert"`, so tests filter alerts by text.
  - Better Auth rate-limits `/sign-in/*` in production builds to 3 attempts per 10 seconds per IP, and the e2e server is a production build. Signed-in tests use the fixture, not the button.
  - `initials()` moved from `PersonNode` to `src/components/initials.ts`, shared with the user menu.

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
