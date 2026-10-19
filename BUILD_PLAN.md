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
| 4 | Google sign-in (F1) | Done 2026-10-18 (merged to `main`). Real Google sign-in checked on production; indexes set up in `familytree_preview` and `familytree`. See the step 4 notes |
| 5 | Groups, roles and opening a sheet (F2, F5) | Done 2026-10-18 (merged to `main`). §15 question 3 settled: our own collections. Google sign-in through the OAuth proxy checked on its preview. See the step 5 notes |
| 6 | Editing the tree by hand (F6) | Done 2026-10-18 (merged to `main`). See the step 6 notes |
| 7 | Photos (F8) | Done 2026-10-19 (merged to `main`). See the step 7 notes |
| 8 | Members, invites and access requests (F3, F4) | Done 2026-10-19. Indexes set up in `familytree_preview` and `familytree`. See the step 8 notes |
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
| Vercel, Production | `MONGODB_URI`, `MONGODB_DB=familytree`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (own value), `BETTER_AUTH_URL=https://family-tree-with-ai.vercel.app`, `OAUTH_PROXY_SECRET` (same value as Preview), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Vercel, Preview | `MONGODB_URI`, `MONGODB_DB=familytree_preview`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (a different value), `OAUTH_PROXY_SECRET` (same value as Production), the same three `CLOUDINARY_*` as Production. No `BETTER_AUTH_URL`: the app uses Vercel's `VERCEL_BRANCH_URL` and `VERCEL_URL` |
| Vercel, Development | Nothing; local work uses `.env.local` |
| GitHub Actions secret | `MONGODB_URI` for a separate read/write test user (repo → Settings → Secrets and variables → Actions) |

- Later steps add `ANTHROPIC_API_KEY`, `CHAT_MODEL`, `CHAT_DAILY_LIMIT` (step 9) to both Production and Preview, and `MONGODB_BACKUP_URI`, `BACKUP_ENCRYPTION_KEY` (step 11) as GitHub secrets.
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
- An npm registry token that installs `@swc/helpers`, `better-auth`, `@xyflow/react` and `create-next-app` through the mirror.
- The commands that need ports or MongoDB allowlisted in the sandbox as `exact_match` (see How we work).
- A MongoDB Atlas cluster reachable from the owner's machine (`npm run db:ping`).
- A clean session environment: no stale `.env` file, and VS Code's `python.terminal.useEnvFile` off. Tools never override variables that are already set, so a stale file's empty values would win over `.env.local`.
- Accounts are created when their step arrives: Vercel (step 1), MongoDB Atlas (step 3), a Google Cloud OAuth client (step 4), Cloudinary (step 7), an Anthropic API key (step 9).

## Step 1: Project skeleton and auto-deploy
- **Owner:** import the GitHub repo into Vercel (Hobby plan).
- **Build:**
  - Next.js 16.4 from `create-next-app` (TypeScript, App Router, Tailwind v4, ESLint, `src/`), React 19, Vitest and Playwright.
  - `.env*` in `.gitignore`; `.env.example` lists every variable in §13.
  - README with setup steps, a CI workflow, and a placeholder landing page at `src/app/page.tsx`.
  - §15 question 1 resolved: Admins and the Owner approve access requests.
- **Tests:** a unit test of the landing page, a Playwright smoke test of `/`, `npm run build`, and CI.
- **Done when:** a push to `main` updates https://family-tree-with-ai.vercel.app and a branch push gets its own preview URL.
- **Step 1 notes (2026-10-18):**
  - Cache Components and Partial Prefetching are on in Next.js 16.4, so database and cookie reads in pages go inside `<Suspense>`.
  - `create-next-app` refuses a folder that already has files, so the project was generated in a scratch folder and copied in.
  - `.npmrc` keeps `package-lock.json` free of registry download URLs: a mirror locally, the public registry on Vercel and CI, and no internal hostnames in the repo. It also sets `legacy-peer-deps=false`, which surfaced a real conflict (`@types/node` 20 vs Vitest 5), fixed by moving to Node 24 types.
  - The system font stack replaces `next/font/google` (blocked locally).
  - Playwright runs against the installed Chrome locally and its own Chromium on CI.
  - `npm audit`'s 5 "high" findings are in dev tooling only (`braces`); runtime dependencies have none.
  - `vercel.json` pins the framework to Next.js (`dce3c66`, after step 3). The dashboard had detected "Other", so Vercel treated the app as a static site and failed with "No Output Directory named "public" found".

## Step 2: Sheet view and tree layout
- **Build:**
  - `src/tree/sheet-view.ts`: `buildSheetView()` following §6: ancestors, then descendants of every ancestor, then partners (not their parents), then extras.
  - `src/tree/layout/`: the `LayoutEngine` interface from §7 and the ELK.js `layered` adapter. Partners are grouped into side-by-side blocks, and hearts are placed by the shared `placeUnions()`. Only `layoutEngine` in `index.ts` names the engine.
  - `src/components/tree/`: `FamilyCanvas` (React Flow with pan, zoom, minimap and fit to screen), `PersonNode` (round photo or initials, light-blue or light-pink border, name, years) and `UnionNode` (♥, or a broken heart for divorced).
  - `/dev/tree`: a layout playground over the fixture, with controls to change the root, show or hide the in-law parents, and add a child.
- **Tests:**
  - **Sheet view (unit), the worked examples from §6:**
    - The Cruz sheet rooted at Alexander Cruz includes Timothy Cruz, Amy Harolds, all their descendants, and partners such as Jerry Willow, Taylor Humes, Arjun Patel and Emma Young. It excludes Cynthia Willow and Fred Lambert.
    - Jerry Willow's sheet includes his parents and the same Jake, Olivia and Timothy Cruz records.
    - The Cruz sheet plus the 4 in-law parents as extras contains all 36 people.
  - **Layout (unit):**
    - No cards overlap, and each generation sits in one row.
    - Children are below their parents' heart, and partners sit beside it.
    - Steve Cruz's two couples and the Alexander + Jerry couple both work.
    - Adding a child lays the sheet out again with no overlaps.
    - Siblings with no family of their own are eldest first.
    - A generated 300-person tree stays under 400 ms locally (1500 ms on CI).
    - Living people show `1985` and people who have died `1945 – 2022`.
  - **Visual:** the e2e test saves `test-results/screenshots/tree.png` of the 36-person sheet, compared by eye with the sample image.
- **Step 2 notes (2026-10-18):**
  - ELK.js was chosen over relatives-tree (§15 question 2), after building both behind the same interface and running the same tests on each. relatives-tree dropped the 4 in-law parents (it only draws the root's own relatives) and separated Steve from Sammie; ELK passed every structural test.
  - Sibling order: strict birth order would add crossing lines, and the sample image isn't in birth order either. Siblings with families of their own keep the crossing-free position; the rest are re-packed eldest first. A test checks this on the sample (Carrie, Carlo, Tay; Amelia, Jake, Timothy; Taylor, Anna).
  - Speed: about 30 ms for 100 people and about 250 ms for 300, so the planned 200 ms target was missed. The faster placement option (Brandes–Köpf) looked lopsided, so the speed test is a regression guard instead.
  - The minimap needed fixed node sizes: controlled React Flow nodes aren't measured, and the minimap skips nodes without a size.
  - The playground is `/dev/tree` so it doesn't clash with Next.js `layout.tsx` files. Cards use the system serif font (Google Fonts is blocked on the work network).

## Step 3: Database and the single write path
- **Owner:** create the Atlas M0 cluster, allow network access from `0.0.0.0/0`, and create separate database users per §11. The connection string goes in `.env.local` (never committed). CI needs a `MONGODB_URI` repository secret for a separate read/write test user (repo → Settings → Secrets and variables → Actions).
- **Build:**
  - `src/server/db.ts`: one shared client, reused across requests and serverless invocations; `openDatabase(name)` for tests and scripts.
  - `src/server/operations/`: `applyOperations(database, groupId, ops, actor)` = zod (`schema.ts`), then the pure planner `planOperations` (`plan.ts`) against the group's records, then bulk writes, all in one transaction.
    - Temporary ids (`new:1`) resolve in order. Errors name the failing change ("Change 3: …").
    - Rules: references must exist in the same group; a couple has 1–2 different people and can't be created twice; a person has at most one set of parents and can't become their own ancestor; a death year can't be before the birth year. Repeating `addChild` or `addToSheet` changes nothing.
    - Writes set the audit fields. `restorePerson` undoes a soft delete; `createSheet` can pin.
  - `src/server/repositories/`: document types (`documents.ts`, every content record has `groupId`), `loadGroupTree` (documents → the tree types, without deleted people), and `ensureIndexes` for the ��5 indexes.
  - Scripts (`.mts`, run with `node --import tsx`): `db:ping`, `db:setup` (indexes) and `seed` (the sample family into `familytree_dev` through `applyOperations`). `/dev/tree/db` draws it from the database.
- **Tests:**
  - Unit (23): one batch recreates the whole sample family with the same sheet views; every rule rejects bad batches with the failing change's number; the schema rejects malformed input.
  - Database (7): a batch with temporary ids is applied all-or-nothing; invalid batches change nothing; soft delete and undo work; groups are isolated; two concurrent edits to the same couple both land; indexes exist.
  - E2E: the seeded family renders from the database: 36 people on "Cruz family", 32 on "Jerry Willow's family".
- **Step 3 notes (2026-10-18):**
  - Validation lives in the operations (zod), not on the documents. Documents are only written through `applyOperations`, so they are typed in TypeScript.
  - IDs: documents use `ObjectId`; tree types and operations use 24-character hex strings. Conversion happens only in `loadGroupTree` and `planOperations`, through `toObjectId()`, whose `InvalidIdError` callers treat as "not found".
  - `npm test` is unit tests only and works offline; `npm run test:db` runs the `*.db.test.ts` files against Atlas. Each test file and each e2e run gets its own `familytree_test_<time>_<label>` database.
  - The app's database user can't drop databases (read/write only), so tests empty their database collection by collection. Leftovers older than an hour are cleared at the start of each run.
  - The `tsx` command itself opens a local pipe that the sandbox blocks, hence `node --import tsx`.
  - The seeded sample family lives in a fixed group, `000000000000000000000001`, in `familytree_dev`. `/dev/tree/db` reads it inside `<Suspense>` after `await connection()`, so the build never touches the database.

## Step 4: Google sign-in (F1)
- **Owner:**
  - A Google OAuth client with the redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://family-tree-with-ai.vercel.app/api/auth/callback/google`, and the sign-in variables in `.env.local`.
  - Vercel variables for Production and Preview (see Environments and secrets), including `OAUTH_PROXY_SECRET`, which must be the same in both. Vercel's system variables must be exposed ("Automatically expose System Environment Variables"). Set them before pushing: Better Auth won't start without `BETTER_AUTH_SECRET`.
  - Google Auth Platform → Audience: publish the app. While it is in Testing, only listed test users can sign in. The app asks only for name, email and photo, so Google doesn't need to review it.
  - `npm run db:setup` against `familytree_preview` and `familytree` (`MONGODB_DB` set to each), for the TTL indexes and step 3's indexes.
  - Check that the Vercel function region (default `iad1`, Washington) is close to the Atlas cluster. If not, set `regions` in `vercel.json`, since every signed-in page reads the database.
- **Build:**
  - `src/server/auth.ts` (Better Auth 1.7.10, Google only) and `api/auth/[...all]/route.ts`. The settings are in `auth-options.ts`, without `server-only`, so the e2e fixture can build an identical instance (same cookie names and signatures).
    - MongoDB adapter on the shared client, so Better Auth's own writes use transactions. Collections `users`, `sessions`, `accounts` and `verifications` (`usePlural: true`); user ids are `ObjectId`s. Renaming these later would mean moving data.
    - `lazyDatabase()` in `db.ts` hands the adapter a client that connects on first use, so the build never touches the database.
    - Base URL and trusted origins come from the pure `authUrls(env)`: `BETTER_AUTH_URL` locally and in production; on previews, exactly `VERCEL_BRANCH_URL` and `VERCEL_URL`. Never `*.vercel.app`, which would trust anyone's Vercel app.
    - Google with `prompt: "select_account"`, so a shared family computer can switch accounts. `user.validateUserInfo` refuses an email Google hasn't verified, because step 8 matches invites by email.
    - Sessions last 30 days (Better Auth's default is 7) and are extended while in use. Server code reads the session with `disableRefresh`; only `/api/auth/get-session` (the user menu's `useSession()`) extends it, because it can set the cookie.
  - **Preview sign-in (§15 question 4): Better Auth's `oAuthProxy` plugin**, on Vercel only, with `productionURL` from `VERCEL_PROJECT_PRODUCTION_URL` and its own `secret` (`OAUTH_PROXY_SECRET`). Production exchanges the Google code but creates no user, then hands the encrypted profile back to the preview, which signs in against `familytree_preview`. The databases and `BETTER_AUTH_SECRET` stay separate, and Google keeps just the two redirect URIs. It works once production runs the plugin, so step 5's preview is the first that can sign in with Google.
  - `src/proxy.ts` (Next.js 16's middleware), deciding with the pure `proxyDecision()` in `src/server/proxy-rules.ts`. It only checks that a session cookie is present, with no database read:
    - Deny by default, so later pages are covered without being listed. Public: `/`, `/api/auth/*` (the Google callback arrives without a session), `/dev/*`, `/_next/*` and static files.
    - A signed-out page load gets a real 307 to `/?returnTo=<path and query>`. API calls and POSTs get 401.
    - It never redirects *because* a cookie is present, so a stale cookie can't bounce between `/` and `/dashboard`.
    - It's a convenience, not security. Pages, server actions and routes still check for themselves (§8).
  - `src/server/permissions.ts`: `getUser()` (user or null) and `requireUser()` (redirects to `/`). Route handlers use `getUser()` and answer 401. Neither uses `use cache: private`, because roles must be read fresh on each request.
  - `safeReturnTo()` (pure): same-site paths only, so no `//…`, `/\…`, other origins or control characters. Anything else, and `/` itself, becomes `/dashboard`.
  - The landing page stays static. "Sign in with Google" reads `returnTo` when clicked and passes it as `callbackURL`. Failures (consent cancelled, sign-in expired) come back to `/` with a plain message, keeping `returnTo`.
  - `/dashboard` (a placeholder until step 5) and a user menu with initials, name and Sign out. Signing out ends with a full page load of `/`.
  - `ensureIndexes` adds TTL indexes on `sessions.expiresAt` and `verifications.expiresAt`, so expired rows don't fill the 512 MB cluster. Better Auth creates its other indexes on first write; repeating them under another name would fail.
  - **Test-only sign-in without a route in the app:** the Playwright fixture `signIn(page, name)` creates a fresh user and session in the run's database with Better Auth's `testUtils` and adds the signed cookie. Parallel tests never share a user. ESLint forbids importing `testUtils` under `src/`, so there is no backdoor to guard (no `E2E_TEST_LOGIN`).
  - `playwright.config.ts` gives the web server `BETTER_AUTH_URL=http://localhost:3100` (otherwise `.env.local`'s port 3000 leaks in and Better Auth rejects the origin), a fresh `BETTER_AUTH_SECRET` per run shared with the fixture, and placeholder Google credentials.
- **Tests (77 unit, 7 database and 10 e2e tests in the suite after this step):**
  - Unit:
    - `safeReturnTo`: a path with a query is kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…`, a tab trick, `/` and empty give `/dashboard`.
    - `authUrls` for local, e2e, preview and production, with no wildcard origins.
    - The proxy's decision for public paths, pages, API routes and POSTs.
  - Database: the TTL indexes exist.
  - E2E:
    - Signed out, `/dashboard?tab=x` answers 307 to `/?returnTo=%2Fdashboard%3Ftab%3Dx` (checked without following redirects).
    - "Sign in with Google" posts `callbackURL=/dashboard?tab=x` and is sent to `accounts.google.com` with `redirect_uri=http://localhost:3100/api/auth/callback/google`. The test stops there and never contacts Google. With `returnTo=https://evil.example` it posts `/dashboard`.
    - A failed sign-in comes back with a plain message.
    - Signed in through the fixture, `/dashboard` shows the user's name. Sign out leads to `/`, and `/dashboard` redirects again.
    - A garbage session cookie on `/dashboard` ends on `/` once, with no redirect loop.
- **Owner checks:**
  - On `npm run dev`: a real Google sign-in and sign-out; the account chooser with a second Google account; `/dashboard?x=1` opened while signed out comes back after signing in. Use `localhost`, not `127.0.0.1`: Google and the cookies treat them as different sites.
  - Right after merging: a real sign-in on production.
  - On step 5's preview: Google sign-in through the proxy.
- **Step 4 notes (2026-10-18):**
  - Checked in the Better Auth 1.7.10 source before building: `oAuthProxy` takes its own `secret` and production creates no user; the Mongo adapter uses transactions when given the client; `validateUserInfo` gets Google's fresh `emailVerified` on every sign-in, not only the first; Better Auth defines no index on `expiresAt`, so the TTL indexes don't clash.
  - Why `disableRefresh`: Better Auth's `nextCookies` plugin skips the refresh only for client-side navigations (the `RSC` header). On a full page load a Server Component would extend the session in the database while the cookie write failed silently, and the next `get-session` would then see a fresh session and not refresh the cookie either. `nextCookies` isn't used: sign-in and sign-out run in the browser.
  - The fixture's Better Auth instance leaves out `validateUserInfo` (`testUtils` creates users outside a request, where the hook can't run) and passes real `ObjectId`s (its generated ids would be stored as strings). Cookie names and signatures don't depend on either.
  - The sign-in button and user menu stay disabled until React has hydrated (`useHydrated`), so an early click isn't silently lost and the e2e tests don't flake.
  - Sign out uses `location.replace("/")`: a full page load, and the signed-in page leaves the Back history. (ESLint's Next.js rule flags `location.assign` with a relative path.)
  - Initials rather than the Google photo: `next/image` would need `remotePatterns` and uses Vercel's image quota. `initials()` lives in `src/components/initials.ts`, shared with the cards.
  - Next.js's route announcer also has `role="alert"`, so tests filter alerts by text.
  - Better Auth rate-limits `/sign-in/*` in production builds to 3 attempts per 10 seconds per IP, and the e2e server is a production build, so signed-in tests use the fixture, not the button.

## Step 5: Groups, roles and opening a sheet (F2, F5, §8)
- **Owner:**
  - Choose how groups are stored (§15 question 3); see the notes.
  - `npm run db:setup` against `familytree_preview` and `familytree`, for the membership indexes.
- **Build:**
  - Our own `groups` and `memberships`, with indexes unique `{groupId, userId}` and `{userId}`.
  - `src/server/roles.ts` (pure): `RANK`, `MIN_ROLE` (the §8 table), `can(role, action)` and `NoAccessError`.
  - `requireRole(groupId, min)` in `permissions.ts` = `requireUser()` + `roleInGroup()` from `repositories/groups.ts`. A malformed id, a made-up group, a deleted group, a non-member and a too-low role all give the same `NoAccessError`. Pages show one identical "You don't have access to this family tree" page; server actions return a message.
  - Dashboard: My groups (Owner), Shared with me (other roles), and the create form.
  - F2: group name, father's and mother's names, and optionally "Add me as their child" (name and gender). `createGroup` writes the group, the owner membership, both parents, their couple, the child and two pinned sheets ("<Father>'s family", "<Mother>'s family") in one transaction, through the same planner as `applyOperations` (`parseOperations` + `applyInTransaction`). Then it opens the father's sheet.
  - `/g/[groupId]` opens the first pinned sheet. The sheets load the whole group once, and tabs switch in the browser with `history.pushState`, which Next.js's router follows (F5). Pinned tabs come first.
  - `/g/[groupId]/settings` (Owner only): rename, and delete (a soft delete, confirmed by typing the group's name). Transfer ownership comes in step 8, with members.
  - `groupChanged(groupId)` (`src/server/group-changed.ts`): server actions that change a group revalidate the dashboard and the group's pages.
- **Tests (131 unit, 13 database and 13 e2e tests in the suite after this step):**
  - Unit: all 48 cells of the §8 role × action table; the new-group operations and their validation.
  - Database: `createGroup` writes everything in one go, and a failing batch leaves no group or membership; the same `NoAccessError` for a non-member, a made-up group and a malformed id; a too-low role is refused; one membership per user per group; rename and soft delete.
  - E2E:
    - A new user sees an empty dashboard → creates a group → lands on the father's sheet with both tabs. Switching tabs sends no request. Back and the header link show the new group.
    - A second user sees nothing of the first user's groups, and the "no access" text is identical on six URLs (real and made-up groups, sheets and settings).
    - Rename and delete show everywhere, including pages the browser kept.
- **Owner checks:** on `npm run dev`, create a group (with yourself as the child), switch tabs and go Back, return to the dashboard by the header link and by Back, rename and delete it, and open your sheet's URL from a second Google account.
- **Step 5 notes (2026-10-18):**
  - §15 question 3: our own `groups`, `memberships` and `invites`, chosen by the owner. The organization plugin (checked in the 1.7.10 source) does allow invites without email, which was the plan's test, but:
    - it creates the organization and owner in its own transaction, so F2 couldn't be one transaction with the family;
    - accepting an invite compares emails in lowercase only (F3 also ignores gmail dots and `+tags`);
    - it allows several owners, and only stops the last one leaving (§8: exactly one Owner);
    - it adds about 40 `/api/auth/organization/*` endpoints that change members outside `requireRole`;
    - it requires a unique `slug`.
  - `roleInGroup` holds the database part of `requireRole`, so database tests can check "no access" without a request.
  - The §8 table is `MIN_ROLE`, and the unit test spells out all 48 cells, so a change to `MIN_ROLE` has to match it.
  - `/g/[groupId]` redirects inside `<Suspense>`, so the redirect is streamed rather than a 307. `export const instant = false` doesn't change that: it only switches off Next.js's instant-navigation checks.
  - Found in the owner's check: after creating a group, Back (or the header link) showed the dashboard from before, with no groups. The browser keeps pages it has shown and Back/Forward reuses them; `groupChanged()` fixes it. The e2e tests go back with Back and the header link instead of reloading, and were checked to fail without the fix.
  - Next.js 16 keeps recently visited pages in the DOM, hidden (React Activity), so e2e tests locate inputs with `getByRole`, which skips hidden elements; `getByLabel` doesn't.
  - The "no access looks the same" test compares `textContent`. `innerText` changed with timing: React briefly holds streamed content in a hidden element, where `innerText` loses its line breaks.

## Step 6: Editing the tree by hand (F6)
- **Owner:** review the detailed plan and decide its open questions (see Decisions).
- **Build:**
  - **One write action.** `applyChangesAction(groupId, ops)` in `src/app/g/[groupId]/actions.ts`: `requireUser()`, then `applyGroupChanges` (`roleInGroup(…, maintain)`, then `applyOperations`), then `groupChanged(groupId)`. The role check sits in the repository function so a database test can call it as a Viewer.
    - It returns `{ idMap }` or `{ error }`: "You don't have permission to change this tree" for a Viewer, a non-member or a made-up group alike, or the planner's reason as a sentence (without "Change 2:", because one form is one batch).
  - **New operations** (§10, UI only, never offered to the AI):
    - `addPartner { unionId, personId }`: gives a single parent a partner, the "other parent". The couple must have one partner; the new partner must be a different person, not already their partner, and not one of the couple's descendants.
    - `updateSheet { sheetId, set: { title?, pinned? } }`: rename, pin and unpin.
    - `reorderSheets { sheetIds }`: the group's whole tab order, listing every sheet exactly once. Pinned tabs still show first.
  - **New rules:** a person who is a sheet's root can't be deleted ("Jerry Willow is the root of the sheet Jerry Willow's family"). Deleted people count as absent, the way the browser shows them: a couple whose partners are all deleted isn't anyone's parents (a child given new parents leaves it), and a new partner can take a deleted partner's place.
  - **Form → operations builders**, pure, in `src/tree/edits.ts`. They run in the browser, are unit-tested, and the server re-validates everything:
    - Add parents. With no parents: one or two new people, their couple, then `addChild`. With one parent: a new person, then `addPartner`.
    - Add partner: a new person and a couple (married or divorced), plus `createSheet` "<Name>'s family" when "Create their own sheet" is checked.
    - Add child: to the chosen couple. A person with no couple gets a single-parent couple first, reused for the next child.
    - Edit details (only what changed; an empty year is cleared), married/divorced, delete and restore, new sheet, show on another sheet, rename, pin and move a tab.
  - **UI** (`src/components/tree/edit/`):
    - Clicking a card (or Enter on it) opens the **person panel** on the right: name, years, and parents, partners and children as links. Maintain and up also get:
      - Edit details (name, gender, birth and death year).
      - Add parents, or "Add the other parent" when there is one.
      - Add partner, with married or divorced and "Create their own sheet".
      - Add child. With several couples, choose the other parent ("with Taylor Humes", or "on their own").
      - Show on another sheet.
      - Delete, with "Name deleted. Undo" for 10 seconds.
    - Clicking a heart opens the **couple panel**: Married or Divorced, the children, and Add child.
    - Tabs get "+ New sheet" (choose a person; the title defaults to "<Name>'s family") and a menu on the current tab: Rename, Pin/Unpin, Move left, Move right. These are buttons, not drag-and-drop, so they work from the keyboard and in tests.
    - Form errors show in the panel; the server's reason shows above the canvas. While a change saves, the buttons are disabled. Forms use the server's zod rules (names, years).
    - Viewers see the panels with no edit controls, no "+ New sheet" and no tab menu. Hiding these is for convenience; the server action is the real check.
  - The sheets are drawn by the layout `src/app/g/[groupId]/s/layout.tsx`, which loads the group and checks the role itself; the `[sheetId]` page renders nothing.
  - E2E fixtures (until step 8 adds invites): `sampleGroup(owner)` creates a group with the sample family and its two sheets ("Cruz family" with the in-law parents, and "Jerry Willow's family"), and `addMember(groupId, user, role)` gives another test user a role.
- **Tests (152 unit, 14 database and 20 e2e tests in the suite after this step):**
  - Unit:
    - Planner rules for `addPartner`, `updateSheet` and `reorderSheets` (a missing or repeated sheet is refused), the root rule, and deleted parents (both deleted, one deleted, a couple with nobody left).
    - The builders against the sample family, through what the browser draws (`toGroupTree`): a child under Jake and Taylor shows on both sheets; a married-in partner gets a sheet rooted at them; the other parent uses `addPartner`; add parents, delete them, add again; edit, divorce, delete and Undo; tab order.
  - Database: a Viewer's or a non-member's `applyGroupChanges` gets `NoAccessError` and writes nothing; a Maintainer's change goes through with their id in the audit fields.
  - E2E:
    - Add a child under Jake and Taylor. Without a reload, "Cruz family" shows 37 people and "Jerry Willow's family" shows 33.
    - Add a partner for Amelia Young who married in, with "Create their own sheet" checked by default. A new tab "Rohan Mehta's family" appears, showing the two of them.
    - Edit Taylor Humes's death year; delete Alex Cruz, then Undo (35, then 36 people); deleting Alexander Cruz, the Cruz sheet's root, is refused.
    - Add parents to Timothy Cruz (1880), delete both, add parents again, then replace one with "Add the other parent".
    - Mark Steve Cruz and Arham Chopra divorced: their heart turns into a broken heart.
    - Create a sheet for Emma Young, pin it and move it left; the order is still there after a reload.
    - A Viewer sees the tree with no edit controls.
- **Owner checks:** on `npm run dev`, build a few generations of your own family: add parents, partners and children; edit details; delete and Undo; delete parents and add them again; switch tabs and keep editing; create a sheet for someone who married in; pin and reorder tabs.
- **Decisions (owner, 2026-10-18):**
  1. Deleting someone who is a sheet's root is refused, with a message naming the sheet.
  2. "Create their own sheet" is checked by default when adding a partner.
  3. Deleting a sheet and hiding an extra person from a sheet are left for later (ARCHITECTURE.md §15 question 5).
- **Step 6 notes (2026-10-18):**
  - Found in the owner's check: after deleting both parents, adding parents again failed with "already has parents". Deleted people stay in their couples (so Undo restores them fully), and the server still counted the couple while the browser showed no parents. The deleted-people rule above fixes it; the planner test fails with the old rule, and tests at all three levels follow the owner's steps.
  - The sheets moved from the `[sheetId]` page into a layout. A tab switch changes `[sheetId]` with `pushState`, and the next save's refresh rendered a new page, remounting the editor (an open panel or menu closed). The layout stays mounted. An unknown sheet id shows the first sheet and corrects the address bar.
  - React Flow turns off pointer events on nodes it thinks are inert (not draggable, selectable or clickable), so the canvas swallowed clicks on the cards' own buttons. With editing on, the canvas gives React Flow a no-op `onNodeClick`; the buttons do the work, so the cards also open from the keyboard.
  - Click handlers and the selection reach the cards through a React context, not node data, so selecting someone doesn't lay the sheet out again.
  - `OperationError` carries `reason` (the message without "Change N:"). `loadGroupTree` is split into the query and the pure `toGroupTree`, which `test/planning.ts` uses to turn planned documents into what the browser draws. The year rule has readable messages ("Enter a year from 1000 on").
  - Sheet menu items close the menu at once; the change shows when it's saved. Renaming a tab to its current title sends nothing (an empty batch would be refused).
  - Locally each save is a transaction plus a re-render against the remote M0 cluster, measured at 1–5 s with four test workers, so e2e assertions wait up to 15 s and tests up to 60 s.

## Step 7: Photos (F8)
- **Owner:**
  - Review the detailed plan and decide its open questions (see Decisions).
  - Create a free Cloudinary account. From Console → Settings → API Keys, copy the cloud name, API key and API secret.
  - Put the three `CLOUDINARY_*` variables in `.env.local`, then restart the Claude Code session so it sees them.
  - Add the same three to Vercel Production and Preview (the secret marked Sensitive). Previews and production share the account; photos are kept apart by group id and tagged with the database name.
  - No GitHub secret: the e2e tests use placeholder values and a stand-in for Cloudinary. No new indexes, so no `db:setup`.
- **Build:**
  - **No Cloudinary package.** The app makes two calls, so `src/server/cloudinary.ts` signs them with `node:crypto` and sends them with `fetch`. The signature is SHA-1 over the parameters sorted by name, joined as `key=value&…`, with the API secret appended (`signParams`, pure).
  - **Signing an upload:** the server action `signPhotoUploadAction(groupId)` in `src/app/g/[groupId]/actions.ts` calls `requireUser()`, then `signPhotoUpload(db, groupId, userId, config)` in `src/server/photos.ts` (`roleInGroup(…, maintain)` plus the signature). A Viewer, a non-member and a made-up group all get "You don't have permission to change this tree". The signed parameters:
    - `public_id`: `groups/{groupId}/` plus 22 random characters, chosen by the server. The full path is in the public ID, so it works in either of Cloudinary's folder modes.
    - `timestamp`, and `tags`: the database name (`familytree_dev`, `familytree_preview`, `familytree`), so local and preview photos can be found and deleted in Cloudinary's Media Library.
    - `allowed_formats`: JPEG, PNG, WebP and HEIC (iPhone photos).
    - `transformation`: `c_limit,w_1600,h_1600`, so Cloudinary stores at most 1600 px on the long side.
  - **The browser uploads straight to Cloudinary** (`POST https://api.cloudinary.com/v1_1/{cloud}/image/upload`, the file plus the signed parameters), checks the returned `public_id` is the one it was given, then saves it with `applyChangesAction(setPhotoOps(...))`. Large photos never pass through Vercel.
  - **`setPhoto { personId, photoId }`**, through the single write path:
    - zod: `photoId` looks like `groups/<24-hex id>/<random>` (`PHOTO_ID`), or `null` to remove the photo.
    - Planner rule: the photo must be in this group's folder ("That photo isn't in this group's folder"). A deleted person can't be given one. Setting the photo a person already has changes nothing.
    - The plan lists `unusedPhotoIds`: photos replaced or removed in this batch that no person in the group uses any more, deleted people included (so Undo still has their photo). `ApplyResult` carries them.
    - `applyChangesAction` deletes them from Cloudinary with Next.js's `after()`, once the transaction has committed, so the save doesn't wait. The request is a signed `destroy` with `invalidate`, which also clears Cloudinary's CDN copy. A failed delete is logged, never shown, and the save stands.
  - **Showing photos:**
    - `photoUrl(cloudName, photoId)` in `src/components/tree/photo.ts`: `https://res.cloudinary.com/{cloud}/image/upload/c_thumb,g_face,w_168,h_168/f_auto,q_auto/{photoId}`. That's a face crop at twice the card's 84 px circle, in the best format and quality for the browser. The panel uses the same URL, so each photo downloads once.
    - `PersonPhoto` (cards and the panel): the round photo inside the blue or pink border, as a plain `<img>`. Initials show when there is no photo, photos aren't set up, or the photo fails to load.
    - The cloud name isn't secret. The sheets layout reads it at request time (`cloudinaryConfig()`) and hands it down through `CloudNameContext`. Without it (the dev pages, or missing variables), cards show initials and the photo buttons are hidden.
  - **Person panel**, with the photo at the top. Maintain and up also get `PhotoControls`:
    - "Add photo" or "Change photo" opens a file picker. The browser checks the file first (`photoFileProblem`): JPEG, PNG, WebP or HEIC, up to 10 MB (Cloudinary's free-plan limit for images). Anything else gets a message and is never uploaded.
    - While it uploads, the panel shows "Uploading photo…" and its buttons are disabled. Errors, including Cloudinary's reason, show in the panel.
    - "Remove photo" asks for confirmation: the photo is deleted from Cloudinary, so there's no Undo.
    - Viewers see the photo with no buttons.
  - Builder `setPhotoOps(personId, photoId | null)` in `src/tree/edits.ts`.
  - Kept as they are:
    - Deleting a person keeps their photo, for Undo; deleting a group keeps everything.
    - Face crop only, with no manual cropping.
    - A photo uploaded but never saved (tab closed mid-way, or the save refused) stays in Cloudinary unused. This is rare and is left for later (ARCHITECTURE.md §15 question 6).
  - **E2E stand-in for Cloudinary** (`e2e/cloudinary-stub.mts`): `playwright.config.ts` starts it on port 3101 next to the app and gives both placeholder `CLOUDINARY_*` values, with `CLOUDINARY_API_URL` pointing the app at it. Like Cloudinary, it refuses a request whose signature doesn't match (checked with its own code, not the app's), and it lists what was uploaded and deleted (`GET /calls`). Tests answer photo URLs on `res.cloudinary.com` themselves with a 1×1 PNG, so no test reaches Cloudinary.
  - Step 11's security headers must allow images from `res.cloudinary.com` and uploads to `api.cloudinary.com`.
- **Tests (180 unit, 17 database and 23 e2e tests in the suite after this step):**
  - Unit:
    - Signatures: Cloudinary's documented example gives its documented signature; parameter order doesn't matter, and a `&` in a value can't add a parameter.
    - Upload tickets: a random public ID inside `groups/{groupId}/`, the tag, formats and size limit, and every sent parameter signed.
    - Deleting, with a stubbed `fetch`: one signed `destroy` per photo. A failure is logged, not thrown; "not found" counts as deleted; without settings nothing is sent.
    - Planner:
      - A photo in another group's folder, or not in a folder, is refused; so is a deleted person.
      - Replacing or removing a photo lists the old one. One still used by another person, or by a deleted person, isn't listed. Setting the same photo again changes nothing.
      - The schema refuses a URL or a path with `..` as a photo id.
    - `setPhotoOps` against the sample family (`test/planning.ts`): the photo shows on both sheets, and Remove clears it.
    - `photoUrl`; `PersonPhoto` shows the photo, initials without one or without settings, and initials after a load error.
    - Choosing a file: JPEG, PNG, WebP and HEIC (also with no type) up to 10 MB pass; larger files, PDFs and GIFs get a message. Uploading: the signed fields are sent; Cloudinary's reason is shown; a different public ID or a network error gets a general message.
  - Database:
    - A Viewer, a non-member and a made-up group get `NoAccessError` from `signPhotoUpload`. A Maintainer gets a signature for their group's folder, tagged with the database name.
    - `applyGroupChanges` with another group's photo is refused and writes nothing.
    - Replacing a photo saves it and returns the old one to delete.
  - E2E:
    - The owner adds a photo for Jake Cruz: the stand-in accepts the signed upload, and Jake's card shows the face-cropped photo from this group's folder on both sheets, still there after a reload. Change it: the old photo is deleted. Remove it: the initials come back and that photo is deleted too.
    - A file over 10 MB, or a PDF, is refused with no request to Cloudinary.
    - A Viewer sees the photo on the card and in the panel, and no photo buttons.
- **Owner checks:**
  - On `npm run dev`:
    - Add a real photo (a phone photo, HEIC if you have one) and check the face crop on the card.
    - Change it, then check that the old one has gone from Cloudinary's Media Library.
    - Remove it.
  - On the preview: a real upload.
- **Decisions (owner, 2026-10-18):**
  1. Uploads are signed by a server action next to `applyChangesAction`, not an `api/uploads/sign` route: the same pattern as every other change.
  2. Photos are shrunk on upload to at most 1600 px; the original full-size file isn't kept.
  3. "Remove photo" as well as Change, through `setPhoto` with `null`.
  4. Face crop only for now; manual cropping can come later.
- **Step 7 notes (2026-10-18):**
  - Cloudinary's documentation site is blocked on the work network, so the signing rules were checked in the source of the `cloudinary` npm package (2.11.0, `api_sign_request` and `destroy`), unpacked in a scratch folder and not installed. Its default is SHA-1, and it encodes a `&` inside a pair. The unit test uses the worked example from Cloudinary's documentation, recomputed independently.
  - Deviation: the plan had the e2e tests intercept Cloudinary in the browser. Deleting old photos happens on the server, where the browser can't intercept, so the tests use a local stand-in instead. That also lets them check that a replaced photo really is deleted.
  - `cloudinary.ts` and `photos.ts` don't use `server-only`, so unit and database tests can import them (like `auth-options.ts`). The secret is read only from the server's environment. The Cloudinary settings are passed in explicitly, so a test can't pick up the real values from `.env.local` by accident.
  - The 10 MB limit, and the full path in the public ID working in both folder modes, come from Cloudinary's documentation as remembered. The owner's real upload checks them.

## Step 8: Members, invites and access requests (F3, F4)
- **Owner:**
  - Review the detailed plan and decide its open questions (see Decisions).
  - `npm run db:setup` against `familytree_preview` and `familytree`, for the new indexes.
  - Nothing else: invites are links to share (WhatsApp, text). No email service yet.
- **Build:**
  - **Data** (§5): `invites` and `accessRequests` in `documents.ts`, with indexes:
    - `invites`: unique `{token}`; unique `{groupId, emailNormalized}` while pending (a partial index: one pending invite per address); `{emailNormalized, status}`; `{groupId, status}`.
    - `accessRequests`: one record per person per group, unique `{groupId, userId}`; its status changes. `{groupId, status}`, and `{userId, status}` for the dashboard.
    - Better Auth's `users` gets a read-only type (`name`, `email`) for showing members and requesters.
  - **Rules, pure** (`src/server/members-rules.ts`, unit-tested):
    - `normalizeEmail`: trimmed and lowercased; for `gmail.com` (and `googlemail.com`, the same mailboxes) dots and `+tags` are ignored. `maskEmail`: `c*****@gmail.com`, always five stars, so the length isn't shown either.
    - Who may change whom (`memberChangeProblem`, `transferProblem`, `leaveProblem`): Admins and the Owner grant View, Maintain or Admin, and change or remove anyone but the Owner, other Admins included. Only the Owner transfers ownership, to any member, which makes the old Owner an Admin. Everyone but the Owner can leave.
  - **Invites (F3)**, on the members page (Admin and up):
    - Invite by email and role (View by default). A random 32-byte token, pending for 14 days. Inviting someone who is already a member says so. Inviting an email that already has a pending invite refreshes it (new role and expiry) instead of adding a second one.
    - The pending invites are listed with their link (a read-only box with Copy), role, who invited and when it expires, and Revoke.
    - The token is stored as it is, so the link can be copied again later. On its own it grants nothing: the signed-in email must match.
  - **`/invite/[token]`** (signing in first if needed: the proxy keeps the link, as in step 4):
    - Email matches: "Carla Cruz invited you to join Cruz family as Maintain", with Accept and Decline. Accept creates the membership and marks the invite accepted in one transaction, then opens the group.
    - A different account: "This invite is for c*****@gmail.com. You're signed in as …", with Sign out. No group details.
    - Unknown, expired, revoked, declined or already used: one message, "This invite link isn't valid any more".
    - Already a member: straight to the group.
  - **Access requests (F4).** The no-access page (`NoAccess`) gets the group id and shows, in order:
    - A pending invite for this email: "You've been invited", with a link to accept it.
    - A pending request: "Request sent. You'll see the tree here once an Admin approves it."
    - A denied request: "Your request was declined. An admin can still invite you." No new request.
    - Otherwise: Request access, with an optional message (up to 500 characters).
    - Real, made-up and deleted groups give the same page and the same "Request sent": a request for a group that doesn't exist is kept like a real one and stays pending. A malformed id can never be a group, so it is answered the same way and nothing is saved.
    - Asking again after being approved and later removed reopens the same record.
    - A person can have at most 20 pending requests at once, so made-up links can't fill the database. The limit message is the same for every group.
  - **Joining closes the other route:** accepting an invite approves the person's pending request for that group, and approving a request marks their pending invite accepted.
  - **Members page** `/g/[groupId]/members` (Admin and up only, since it shows email addresses): one page with three sections.
    - **Access requests:** name, email, message and date. Approve as View, Maintain or Admin (View by default), or Deny. Approving creates the membership and marks the request approved in one transaction.
    - **Members:** name, email and role. Admins and the Owner change roles and remove members (after a second click), except the Owner, whose row has no controls.
    - **Pending invites** (above).
    - Every action calls `requireRole(groupId, admin)` itself, then the rules. Members below Admin who open the page see "Only Admins and the Owner manage members", like Settings does today.
  - **A request badge** for Admins and the Owner: the "Members" link in the group's header shows the number of pending requests, and the group's row on the dashboard gets "2 access requests", linking to the members page.
  - **Dashboard:**
    - **Invitations:** pending invites for my email, with group name, role and who invited, plus Accept and Decline.
    - **My access requests:** pending and declined requests, with the date and my message. No group name: I'm not a member, and a made-up group must look the same. Approved requests show up as the group under Shared with me.
  - **Settings:**
    - Transfer ownership (Owner): choose a member, confirm by typing the group's name. The new Owner and the old Owner (now Admin) are changed in one transaction.
    - Leave this group (everyone but the Owner), after a second click. The Settings link in the group's header is now there for every member.
  - Server actions live next to their pages: `members/actions.ts`, `invite/[token]/actions.ts`, `requestAccessAction` in `g/[groupId]/actions.ts`, and Accept/Decline on the dashboard reuse the invite actions. Each checks for itself and calls `groupChanged(groupId)` after a change. Repository functions (`repositories/members.ts`, `invites.ts`, `access-requests.ts`) take the `groupId`.
  - The e2e fixture `addMember` stays, for tests that only need a role. The invite and request tests use the real flow.
  - Left for later: email notifications (Resend) and Withdraw for a pending request.
- **Tests (221 unit, 30 database and 31 e2e tests in the suite after this step):**
  - Unit:
    - `normalizeEmail` (case, spaces, gmail dots and `+tags`, googlemail.com, other domains unchanged) and `maskEmail`.
    - Who may change whom: every role pair for change role, remove, approve and transfer.
  - Database:
    - Invites:
      - Accepting creates the membership once.
      - Expired, revoked and other-email invites are refused.
      - Re-inviting refreshes rather than duplicates.
      - Inviting a member is refused.
    - Requests:
      - One pending request per person per group.
      - A made-up group's request is kept like a real one.
      - The limit of 20.
      - Approve and deny need Admin or the Owner.
      - Joining by one route closes the other.
    - Owner protections: an Admin can't change or remove the Owner. Transfer leaves exactly one Owner.
  - E2E, with two or three test users:
    - Invite → accept from the link → the group appears under Shared with me, with the right role.
    - The link opened by a different account → refused, showing only the masked address.
    - An expired or revoked link → does nothing. Decline → the invite is gone.
    - Invited users also see the invite on their dashboard, and on the no-access page.
    - Request → approve as Maintain → the requester can edit.
    - Request → deny → the requester sees "declined" on the page and the dashboard.
    - A Viewer and a Maintainer get no Members link, badge or members page; an Admin gets all three. (The database tests show their calls are refused.)
    - An Admin sees no controls on the Owner's row. The Owner transfers ownership to the Admin, then leaves the group.
    - A request for a made-up group looks the same as for a real one: the same page, "Request sent", and the same dashboard entry.
    - A changed role shows in its dropdown straight away, twice in a row (found in the owner's check).
    - The step 5 test (no access looks the same on six URLs) still passes.
- **Owner checks:** on `npm run dev` with two Google accounts:
  - Invite the second account as View. Open the link in another browser profile, accept, and check the group is under Shared with me.
  - Open one of your tree links from a third account (or after removing the second one), request access, approve it as Maintain, and check that account can edit.
  - Then on the preview: the invite flow once more.
- **Decisions (owner, 2026-10-19):**
  1. A request for a group that doesn't exist is kept like a real one (it stays pending), so the page and the dashboard can't show which groups exist. At most 20 pending requests per person.
  2. After a denial, no new request; an Admin can still invite them.
  3. Admins change and remove anyone except the Owner, other Admins included.
  4. Ownership can go to any member; the old Owner becomes an Admin.
  5. Only Admins and the Owner see the member list (it shows email addresses).
  6. Members can leave a group from Settings; the Owner must transfer ownership first.
- **Step 8 notes (2026-10-19):**
  - Found in the owner's check: after changing a member's role, the role was saved but its dropdown went back to View until a reload. React 19 resets a form after its action finishes, to each field's first default, and never updates a dropdown's default after it first renders (text boxes do get updated, so Rename was fine). The dropdown is now keyed by the saved role, so a new role brings a new dropdown. The e2e test failed without the fix.
  - Deviation: access requests are one record per person per group, unique `{groupId, userId}`, instead of a unique index on pending requests only. That makes decision 2 a lookup, and lets someone approved and later removed ask again in the same record.
  - Added: a partial unique index, one pending invite per address per group, so two invites sent at once can't both be created.
  - Repository functions check the actor's role themselves (like `applyGroupChanges`), so the database tests call them as a Viewer, a Maintainer or a stranger. The server actions add `requireUser()` and turn `NoAccessError` and `MemberError` into messages.
  - Joining by one route closes the other inside the same transaction: accepting an invite approves a pending request, and approving a request marks pending invites for that email accepted.
  - The no-access page reads its messages from `request-messages.ts`, not from the client form: anything a server component imports from a `"use client"` module becomes a client reference, not the value.
  - The dashboard's group link keeps its name and role together (a step 5 test checks it); the request badge is a separate link beside it, because links can't be nested.
  - Invite links are built in the browser from the page's address, so a preview gives preview links.

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
