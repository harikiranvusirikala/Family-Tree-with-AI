# Build Plan

**Design:** [ARCHITECTURE.md](ARCHITECTURE.md) · **Requirements and decisions:** [FEATURES.md](FEATURES.md) · **Started:** 2026-10-18

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
| – | Night theme (owner request, between steps 8 and 9) | Done 2026-10-19. See its section after step 8 |
| – | Tree font and Google sign-in button (owner request, between steps 8 and 9) | Done 2026-10-19. See its section after step 8 |
| 9 | AI chat (F7) | Done 2026-10-19 (merged to `main`). Indexes set up in `familytree_preview` and `familytree`. See the step 9 notes |
| 10 | Import and export (F9, F10) | Done 2026-10-19. See the step 10 notes |
| 11 | Nightly backup and hardening (F12) | Done 2026-10-19. Backup user, GitHub secrets and Dependabot alerts set up by the owner. Checked by the owner 2026-10-20 (merged to `main`): the backup workflow run by hand (green after the health-check fix), a restore check of its file, and the production smoke test, all passed. See the step 11 notes |
| – | Hide photos (owner request, after step 11) | Done 2026-10-20. See its section after step 11 |
| – | Sheet changes: the mother's own sheet, renaming follows, delete a sheet (owner requests, after step 11) | Done 2026-10-20. See their section after step 11 |
| – | Go to a person's sheet (owner request, after step 11) | Done 2026-10-20. See its section after step 11 |
| – | Final check on the live site | Done 2026-10-20 by the owner. See its section at the end |
| – | Phones and tablets (owner request, after the final check) | Done 2026-10-20 (merged to `main`); the eye button back in the sheet row after the owner's check. See its section at the end |

## How we work

- **One step at a time.** At the end of each step, all tests are run and the owner gets a short "try this" list. Once the owner approves, the step is committed to a `step-N-<name>` branch.
- **Pushing:** the Claude Code sandbox blocks github.com, so the owner pushes the branch (`git push -u origin step-N-<name>`). CI runs, Vercel builds a preview against `familytree_preview`, the owner checks it and merges to `main`, which deploys the live site. Each new step starts by checking that local `main` has the merge.
- **Databases:** one free Atlas cluster. `familytree_dev` for local development, `familytree_preview` for Vercel previews, `familytree` for the live site (§12). Tests use throwaway `familytree_test_<time>_<label>` databases that remove themselves.
- **Test data:** `test/fixtures/cruz-young.ts` holds the 36 people from the sample tree image (names, genders and years only). It covers a same-sex couple, a divorce and remarriage, and in-law parents. Only this invented data is used until permissions exist (step 5). `npm run seed` loads it into `familytree_dev`.
- **Design changes:** when a step settles a design question, ARCHITECTURE.md (the relevant section and §15) and FEATURES.md are updated in that step's commit, and the Progress table here gets a note.
- **Sandbox (owner's machine):**
  - Commands that open local ports or reach MongoDB fail in the sandbox, so the owner allowlists them as `exact_match` (in the Claude Code sandbox dashboard → Tools): `npm run build`, `npm run test:e2e`, `npm run test:db`, `npm run db:ping`, `npm run db:setup`, `npm run seed`. They're run exactly as written. Anything else that needs ports or the database runs in the owner's terminal.
  - Allowing a domain doesn't help MongoDB: the driver uses its own protocol, not the web proxy.
  - Still blocked: github.com (the owner pushes), Google Fonts, and Playwright's browser download (local e2e uses the installed Chrome).
  - The session loads `.env.local` when it starts. After `.env.local` changes, restart the session before running commands.

## Environments and secrets

| Where | Variables |
|---|---|
| `.env.local` (local, git-ignored) | Everything in [.env.example](../.env.example). `MONGODB_DB=familytree_dev`, `BETTER_AUTH_URL=http://localhost:3000` |
| Vercel, Production | `MONGODB_URI`, `MONGODB_DB=familytree`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (own value), `BETTER_AUTH_URL=https://family-tree-with-ai.vercel.app`, `OAUTH_PROXY_SECRET` (same value as Preview), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CHAT_API_KEY`, `CHAT_MODEL=claude-haiku-5-5`, `CHAT_DAILY_LIMIT=50` |
| Vercel, Preview | `MONGODB_URI`, `MONGODB_DB=familytree_preview`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (a different value), `OAUTH_PROXY_SECRET` (same value as Production), the same three `CLOUDINARY_*` and three `CHAT_*` as Production. No `BETTER_AUTH_URL`: the app uses Vercel's `VERCEL_BRANCH_URL` and `VERCEL_URL` |
| Vercel, Development | Nothing; local work uses `.env.local` |
| GitHub Actions secrets | `MONGODB_URI` for a separate read/write test user (CI); `MONGODB_BACKUP_URI` and `BACKUP_ENCRYPTION_KEY` (the nightly backup, from step 11). Repo → Settings → Secrets and variables → Actions |

- Step 11 adds `MONGODB_BACKUP_URI` (a read-only user on `familytree`) and `BACKUP_ENCRYPTION_KEY` as GitHub secrets, for `.github/workflows/backup.yml`. The key is also kept in the owner's password manager.
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
  - The playground is `/dev/tree` so it doesn't clash with Next.js `layout.tsx` files. Cards used the system serif font (Google Fonts is blocked on the work network); since the polish after step 8 they use the app's sans-serif font.

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

## Between steps 8 and 9: night theme (owner request)
- **Why:** with the device in night mode, names on the tree were black on a black background, and panels stayed white.
- **Build:**
  - Three small buttons in the top bar, before the user menu, and at the top right of the sign-in page: Day, Night and Follow device (sun, moon, screen), the chosen one highlighted. Follow device is the default and switches with the device, also while a page is open (e.g. automatic night mode at sunset). Day or Night is remembered in that browser (`localStorage`; Follow device removes it), and other open tabs switch too.
  - No flash of the wrong theme: a small script in `<head>` (`src/components/theme-script.ts`, as in Next.js's "Preventing flash before hydration" guide) sets the `dark` class on `<html>` before the first paint. `globals.css` makes Tailwind's `dark:` follow that class, and sets `color-scheme` so native dropdowns, scrollbars and file pickers match.
  - Every light-only colour class got a `dark:` twin (white panels → zinc-900, near-black text → zinc-100, grey text → zinc-400, red, green and amber messages in dark tints, dark buttons → light ones).
  - The tree: React Flow's own night colours (`colorMode`: canvas, controls, minimap), darker background dots, light names and years. The blue and pink rings stay the same; the initials' circle darkens. `useTheme()` gives the theme to code that needs it as a value.
- **Tests:** e2e: with the device in night mode the app opens dark (Follow device), with light names on a dark canvas; Day wins over the device and survives a reload; Night stays dark when the device turns to day; Follow device switches as soon as the device does, with no reload; no hydration errors; the sign-in page has the switch. It saves `test-results/screenshots/night-*.png` (tree with a panel, dashboard, members, sign-in) for checking by eye.
- **Notes (2026-10-19):**
  - First built with two states (day and night); the owner asked for a third, Follow device, so a browser can go back to following the device after choosing.
  - The script lives in a plain module because the root layout, a server component, can't import values from a `"use client"` module.

## Between steps 8 and 9: tree font and Google sign-in button (owner request)
- **Tree:** names on the cards use the app's sans-serif font (semibold) instead of the system serif, so the tree matches the rest of the app.
- **Sign-in:** "Sign in with Google" follows Google's branding guidelines for the button: the standard four-colour G before the text, a 40 px pill, 14 px medium text; white with a #747775 outline by day, Google's dark theme (#131314, #8E918F outline) at night. The text stays in the app's font: Google's guidelines name Roboto, which would need self-hosting (Google Fonts is blocked locally).
- **Tests:** unchanged behaviour, so the existing tests cover it; the theme test also saves `test-results/screenshots/day-sign-in.png` next to the night one.

## Step 9: AI chat (F7, §10)
- **Owner:**
  - Review the detailed plan and decide its open questions (see Decisions).
  - In the Anthropic Console: create an API key for this app, and set a monthly spending limit (for example $5) under the organization's limits.
  - Add `CHAT_API_KEY` (the key), `CHAT_MODEL=claude-haiku-5-5` and `CHAT_DAILY_LIMIT=50` to `.env.local` (then restart the Claude Code session) and to Vercel Production and Preview (the key marked Sensitive).
  - `npm run db:setup` against `familytree_preview` and `familytree`, for the `chatUsage` index.
  - Once, in your terminal: `npm run test:ai-live` (a real call costing well under a cent).
- **Build:**
  - **The official SDK**, `@anthropic-ai/sdk` 0.135, with the model from `CHAT_MODEL` (`claude-haiku-5-5`: $0.10 / $0.50 per million input / output tokens). `src/server/ai/config.ts` reads `CHAT_API_KEY`, `CHAT_MODEL`, `CHAT_DAILY_LIMIT` and `CHAT_API_URL`, and always gives the client its key and address.
  - **`POST /api/chat`** (a route handler, because it streams): `getUser()` (401), `requireRole(groupId, view)` (one "no access" answer), then the daily cap. The answer is a stream of small JSON events: text as it's written, "Looking up Ravi…" while a tool runs, the updated proposal, and an end event carrying the turn for the browser to keep.
  - **The agent loop** (`src/server/ai/chat.ts`): stream a reply; when the model calls tools, run them (`handlers.ts`), send the results back, and repeat, until it answers. At most 8 tool rounds per message, and `max_tokens` 4096, so one message can't run up a bill; past the limit every tool call still gets a result, so the conversation stays valid.
  - **Tools** (§10), with `strict: true` so their inputs always match their schemas, offered by role: Viewers get `search_people` and `get_person` only, and the system prompt tells the model they have view-only access.
    - `search_people` (name, optionally a year) and `get_person` (parents, partners, children, sheets) read the group's current data from MongoDB.
    - The six proposal tools (`add_person`, `update_person`, `add_marriage`, `add_child`, `create_sheet`, `add_to_sheet`) save nothing. Each turns into an operation (§10), added to the pending proposal and **checked at once against the group with the real planner** (`planOperations`, which writes nothing). The model gets the new temporary id (`new:1`, `new:2`, …) to use in later calls, or the planner's reason, so it can correct itself.
    - `add_child` takes the parents' ids and finds their couple, creating one if needed (the same rule as step 6's Add child).
    - No delete tool.
  - **The conversation is append-only.** Claude Haiku 5.5 thinks before answering, and its thinking stays valid only while everything sent before it is unchanged. So:
    - The system prompt is fixed: instructions only, the same for everyone, so it can be cached.
    - The group's people (id, name, years, parents, partners) and sheets go into the conversation once, as an operator (system) message after the first question. Up to 300 people; beyond that, a note says to use `search_people`.
    - After a confirm or discard, the next request carries a short system note ("The proposal was saved: new:1 is now 65f…", or "The proposal was discarded"), instead of changing anything earlier.
    - Names and messages are data, never instructions: the prompt says so, and changes still need a click and the user's own role.
  - **Where the conversation lives:** in the browser for this visit. Each request sends the turns so far, checked for shape and size (`request.ts`: at most 60 messages; then "Start a new chat"). The model's thinking blocks go back unchanged, as the API requires.
  - **`ProposalCard`**: the pending changes in plain words (`describeOperations`, pure, in `src/tree/`): "Add Priya Sharma (female)", "Priya Sharma and Ravi Kumar (1980) are married", "New sheet "Priya Sharma's family"". **Confirm** sends them to `applyChangesAction`, the same server action as editing by hand: all or nothing, and checked again for the user's role. **Discard** clears it. Errors show on the card.
  - **`ChatWidget`**: an "Ask AI" button at the right end of the sheet tabs, opening the assistant beside the tree: messages, the proposal card, a text box (Enter sends), New chat and Close. Closing keeps the conversation. Hidden when the chat isn't set up (no key). It works in day and night themes.
  - **Daily cap**: `chatUsage` `{userId, day, count}`, one atomic increment per message the person sends, unique `{userId, day}`, and a TTL index so old rows go after 30 days. At `CHAT_DAILY_LIMIT` (50 a day across all groups): "You've reached today's limit of 50 messages."
  - **Model settings**: adaptive thinking (the default, not shown to users), effort `medium`, no temperature (Haiku 5.5 refuses one). Tool inputs aren't streamed early (`eager_input_streaming` off): they're short, and leaving it off keeps the API's `strict` check.
  - **Errors**: a refusal (`stop_reason: "refusal"`; Haiku 5.5 has no fallback model) gives "I can't help with that." Rate limits give "The assistant is busy; try again in a minute." Other API errors are logged and give "The assistant isn't available right now."
  - **E2E stand-in for the model** (`e2e/model-stub.mts`), like step 7's Cloudinary one: it answers the Messages API's streaming format with scripted turns, and lists the requests it received. `playwright.config.ts` points the app at it (`CHAT_API_URL`) with a placeholder key, so no test calls Anthropic.
  - **`npm run test:ai-live`**: one real conversation against the sample family in memory ("Who are Jake Cruz's children?", then "Add a daughter Mia to Jake and Taylor"): it checks the model looks people up, answers, and proposes the right operations, and prints the token cost.
- **Tests (245 unit, 32 database and 36 e2e tests in the suite after this step):**
  - Unit:
    - Each tool against the sample family (`test/planning.ts`): search by name and year, get_person's relations, and each proposal tool's operation. Temporary ids chain across calls (add_person, then add_marriage with `new:1`). A planner refusal comes back as an error result.
    - Role filtering: a Viewer's request offers only the two read tools.
    - The roster message: format, the 300-person cut-off, and names kept as data.
    - `describeOperations` for every operation the tools make.
    - The request check: a bad shape, too many messages, a blank or overlong question, a malformed proposal.
    - The chat loop with a stand-in client: tool results go back, thinking blocks are kept unchanged, proposals grow, the 8-round limit still answers every tool call, a refusal ends the turn; the request has no temperature and effort `medium`.
    - The settings: no key, no chat; never the ambient `ANTHROPIC_BASE_URL`.
  - Database: five messages sent at once against a limit of 3 count exactly 3; each day (UTC) and each person counts separately.
  - E2E with the stand-in:
    - "Priya Sharma married Ravi" → "Which Ravi: born 1955 or 1980?" → "1980" → a proposal card with three lines → Confirm → Priya's card and her sheet tab "Priya Sharma's family" appear.
    - The conversation goes on after Confirm: the model is told the new ids, and the stand-in (which, like the API, refuses edited conversations) accepts it.
    - Discard leaves the tree unchanged.
    - A Viewer's chat offers only the read tools, and the family list says view-only access (checked in what the stand-in received).
    - Screenshots of the panel by day and at night (`test-results/screenshots/chat.png`, `night-chat.png`).
- **Owner checks:**
  - On `npm run dev` with the real key:
    - Ask about your family ("Who are my grandparents?").
    - Add someone through the chat, confirm, and check the tree.
    - Try an ambiguous name.
  - Then on the preview: once more.
  - In the Console: check the cost of the session.
- **Decisions (owner, 2026-10-19):**
  1. The conversation lives in the browser for the visit; a reload or New chat starts fresh.
  2. The key's variable is `CHAT_API_KEY`, not `ANTHROPIC_API_KEY`, so a Claude Code session that loads `.env.local` can't pick it up for itself.
  3. Effort `medium`, the model's default.
  4. The model gets the family list (up to 300 people) at the start of each chat.
  5. A daily limit of 50 messages per person, across all groups.
- **Step 9 notes (2026-10-19):**
  - Checked in the Claude API reference and the installed SDK (0.135) before building: Claude Haiku 5.5 thinks by default (effort default `medium`), refuses `temperature` and prefill, has no server-side refusal fallback, and checks that a conversation sent back with thinking blocks hasn't been edited (enforced for accounts created from 2026-08-31). That is why the family list moved from the system prompt (which would change after every confirmed edit) to an operator message after the first question, and why the conversation is append-only. Operator (`role: "system"`) messages must follow a user message, so the server sends at most one per turn, right after the question.
  - Found while checking the session: a process started from Claude Code inherits `ANTHROPIC_BASE_URL` and `ANTHROPIC_CUSTOM_HEADERS` (Claude Code's own gateway), which the SDK reads by default. The client is always given its key, address and no auth token; the e2e web server gets those variables cleared, and `test:ai-live` removes them before starting. This also confirmed decision 2.
  - Found by the database test: two of the day's first messages sent at once both tried to create the day's row, and the loser was counted as over the limit. It now counts on the row the other created, if it has room.
  - The "Ask AI" button sits at the end of the sheet tabs rather than at the bottom right, where React Flow's minimap and the Undo notice already are.
  - Tool inputs aren't streamed early (`eager_input_streaming` off): they're short (a name, a year), and leaving it off keeps the API's `strict` check.
  - The e2e stand-in streams thinking blocks with signatures and refuses a conversation whose thinking blocks or operator messages were altered or misplaced, like the API, so the e2e tests check the append-only handling end to end.
  - Opening the assistant panel narrows the canvas without re-fitting the tree, as the person panel already does.

## Step 10: Import and export (F9, F10)
- **Owner:** review the detailed plan and decide its open questions (see Decisions). Nothing to set up: no new services, keys or indexes.
- **Build:**
  - **Pure converters**, in `src/server/import-export/` (no database, no `server-only`, so they run in the browser and in unit tests):
    - `json.ts`: our own JSON format, `{ format: "family-tree-with-ai", version: 1, exportedAt, group: { id, name }, persons, unions, sheets }`, lossless (photo ids and sheets included). The importer checks it with zod and accepts only this format.
    - `gedcom.ts`: GEDCOM 5.5.1, the version Ancestry, FamilySearch and MyHeritage all read.
      - Export: `INDI` records with `NAME First /Last/` (the last word as the surname), `SEX M|F` and `BIRT`/`DEAT` years, then `FAM` records with `HUSB`/`WIFE`/`CHIL` and `DIV` for divorced couples. A same-sex couple gets two `HUSB` or two `WIFE` lines, which GEDCOM 5.5.1 doesn't define but the major programs read.
      - Import, for files in UTF-8 or ASCII (with or without a BOM, any line endings), including long values split with `CONC`/`CONT`:
        - Kept: names, sex, birth and death years (the year is taken from dates like `12 MAR 1985`, `ABT 1900` or `BET 1900 AND 1910`), couples, children, and divorces.
        - Not kept, and the preview says so: places, full dates, notes, sources and media.
        - Repaired, with a warning in the preview: a family with no partners is skipped; a child listed in two families stays with the first (birth parents if marked); the same couple twice becomes one.
  - **Export, data** (Maintain and up, §8): `GET /api/groups/[groupId]/export?format=json|gedcom[&sheet=<id>]`. `getUser()` (401), then `roleInGroup(…, maintain)`, one 404 for every no-access case. It downloads `<group> - <sheet>.json` or `.ged`. One sheet means exactly the people and couples that sheet shows (§6); the whole group includes everyone and every sheet (sheets only in JSON: GEDCOM has none).
  - **Export, picture** (everyone): "Picture (PNG)" captures the whole current sheet, whatever the zoom, with `html-to-image` 1.11 (MIT; React Flow's `getNodesBounds` gives the area). It uses the day colours on white at twice the screen's resolution, at most 8,000 pixels on the long side, without the minimap and controls (`src/components/tree/sheet-picture.ts`). "Print or save as PDF" prints that picture from a hidden frame, so no pop-up blocker interferes.
  - **Import**, parsed in the browser (`ImportPanel`):
    1. Choose a `.json` or `.ged` file. The browser parses it and shows a preview:
       - how many people, couples and sheets;
       - what isn't kept, and any warnings;
       - **possible duplicates**: an imported person with the same name (ignoring case, accents and spaces) and the same birth year as someone already in the group. Each starts as "Use existing" (the first match; changed after the owner's check), with "Keep both" to add them as someone new. People without a birth year aren't matched.
       - **people with no recorded sex**, each needing male or female ("Set all to" when there are more than three);
       - which person the new sheet shows (GEDCOM: the first person in the file by default, which is usually the file's home person; JSON: its own sheets).
    2. **Import** sends the operations to a server action, which re-checks everything on the single write path:
       - into this group: `applyChangesAction` (Maintain and up), the same as any edit, then the new sheet opens;
       - into a new group: `importGroupAction(name, operations)` = `createGroup` with the importer as Owner, then the group opens.
    3. "Use existing" swaps the imported person for the existing one in every operation. If that breaks a rule (for example, giving the existing person a second set of parents), the planner's reason shows in the preview, and "Keep both" always works.
  - **Limits:** at most 2,000 people per file, checked in the preview and again on the server (`operationsSchema` refuses a batch adding more). The operations limit rises from 5,000 to 20,000 per batch, and the server action body limit to 4 MB (`serverActions.bodySizeLimit`; Vercel's own limit is 4.5 MB).
  - **Photos:** a JSON export keeps photo ids. Importing it back into the same group keeps them; any other group drops them, because a photo lives in its own group's Cloudinary folder (the planner refuses the rest).
  - **Where:**
    - An **Export** menu at the end of the sheet tabs: Picture (PNG), Print or save as PDF, and for Maintain and up: This sheet (JSON or GEDCOM), Whole group (JSON or GEDCOM).
    - **Import…** beside it (Maintain and up).
    - On the dashboard, under Create a family group: **Import a family file** into a new group.
- **Tests (261 unit, 34 database and 40 e2e tests in the suite after this step):**
  - Unit:
    - JSON round trip of the sample family: export, parse, and import into an empty group (`test/planning.ts`) gives the same people, couples and sheets.
    - GEDCOM round trip: the same people and couples (sheets aren't in GEDCOM).
    - A one-sheet export contains exactly the people and couples `buildSheetView` shows.
    - GEDCOM parsing:
      - names with and without slashes, and `GIVN`/`SURN`;
      - dates (`ABT`, `BET … AND`, full dates, out-of-range years);
      - missing sex, a family with no partners, a child in two families, a duplicate couple;
      - `CONC`/`CONT`, CRLF line endings, a BOM.
    - The duplicate finder and the "Use existing" swap.
    - The 2,000-person limit; and that a JSON file in another format is refused.
  - Database: importing into a new group creates the group with the importer as Owner and everything in one transaction; importing with "Use existing" links to the existing person.
  - E2E:
    - **Export:** download the whole group as GEDCOM and as JSON (Playwright's download event), check the files, then import the GEDCOM into a new group: the same 36 people appear.
    - **Import:** a small GEDCOM into the sample group with one duplicate resolved as "Use existing", then a person with no recorded sex set in the preview; the new sheet opens and the counts are right.
    - **Viewer:** downloads a PNG (a real PNG of the whole sheet, over 2,000 × 1,000 pixels), sees only the picture items in Export and no Import, and the export address answers 404.
    - The exported picture and the import preview are saved as `test-results/screenshots/sheet-picture.png` and `import-preview.png`.
    - The Export menu opens where it can be seen: every item is the topmost thing on screen at its centre (found in the owner's check).
    - Not tested automatically: the print dialog itself.
- **Owner checks:**
  - On `npm run dev`: export your family as GEDCOM and open it in another program if you have one (or re-import it into a new group).
  - If you have a GEDCOM from Ancestry, FamilySearch or MyHeritage: import it into a new group and check the preview's warnings.
  - Save a sheet as a PNG and as a PDF.
- **Decisions (owner, 2026-10-19):**
  1. Every import file is parsed in the browser; there is no import route.
  2. People with no recorded sex: chosen in the preview, one by one or with "Set all to".
  3. PDF through the browser's print dialog, no PDF library.
  4. At most 2,000 people per imported file.
  5. Photos come in only when a JSON file goes back into the group it came from.
  6. The picture always uses the day colours on white.
- **Step 10 notes (2026-10-19):**
  - Found in the owner's check: clicking Export showed nothing. The menu opened inside the sheet-tab row, which scrolls sideways, and a scrolling box also cuts off what hangs below it. The e2e tests still passed because Playwright scrolls a clipped element into view before clicking it. The buttons at the end of the row now sit outside the scrolling part, and a test checks the menu with `document.elementFromPoint`, which doesn't scroll; it failed without the fix.
  - Deviation: no `importAction`. An import into this group is an ordinary batch, so it goes through `applyChangesAction`; only a new group needs `importGroupAction` (createGroup).
  - Server actions accept 1 MB by default (checked in Next.js's docs); `serverActions.bodySizeLimit` is now 4 MB, under Vercel's 4.5 MB.
  - The picture is captured with the `dark` class removed from `<html>` and from React Flow's element (its `colorMode` adds one too), with an overlay over the page while it's made, so night mode doesn't flash. A photo that can't be fetched (for example without CORS) becomes blank instead of stopping the picture. Cloudinary's CORS headers are checked by the owner's export of a sheet with photos.
  - Changed after the owner's check: possible duplicates start as "Use existing" instead of "Keep both" (`defaultUseExisting`), so importing a family that's already partly in the group links rather than copies by default. If a link breaks a rule, the planner's reason names the person, and "Keep both" for that one works.
  - Found by the e2e test: the "Not kept" list followed the file's order; it now always reads places, dates, notes, sources, media, other facts. And the preview's message now clears when a choice changes.
  - Unit tests at first mixed two sample groups: every `sampleState()` call makes new ids, so tests build it once.

## Step 11: Nightly backup and hardening (F12, §11)
- **Owner:** review the detailed plan and decide its open questions. Then, before merging:
  1. **Atlas** → Database Access → Add New Database User: username `backup`, an autogenerated password, and under Specific Privileges only `read` on the database `familytree`. Its connection string is the app's, with this user and password.
  2. **Encryption key:** run `openssl rand -base64 32` in your terminal and save the result in your password manager. Without it no backup can be read, and nothing else keeps a copy.
  3. **GitHub** → repo → Settings → Secrets and variables → Actions: add `MONGODB_BACKUP_URI` (1) and `BACKUP_ENCRYPTION_KEY` (2).
  4. **GitHub** → Settings → Code security: turn on Dependabot alerts (question 5).
  - Nothing new in Vercel, and no new indexes.
- **Build:**
  - **Backup** (`src/server/backup/`; no `server-only`, so the scripts and tests use it):
    - `npm run backup` (`scripts/backup.mts`) reads every collection of `familytree` with the read-only user (`MONGODB_BACKUP_URI`), except `sessions` and `verifications`, and writes one file, `familytree-<date>.ftbackup`:
      - inside: a first line saying what it is (format, version, database, time, and each collection's document count and indexes), then one line per document in MongoDB's canonical Extended JSON, so ids, dates and number types come back exactly;
      - gzip-compressed, then encrypted with AES-256-GCM (Node's `crypto`) using `BACKUP_ENCRYPTION_KEY` (32 random bytes, base64). GCM also detects a damaged or altered file.
    - `npm run restore -- <file> <database>` (`scripts/restore.mts`, with `MONGODB_URI`):
      - decrypts the file, inserts every document, recreates the indexes, and checks each collection's count against the file;
      - refuses a database that already holds any of those collections, unless given `--replace` (which empties them first), so it can't overwrite production by mistake;
      - asks for the key if `BACKUP_ENCRYPTION_KEY` isn't set, without showing what you type, so the key stays out of your shell history.
    - `npm run restore -- <file> --check` restores into a throwaway `familytree_test_…_restore` database, checks the counts, and empties it.
  - **Nightly workflow**, `.github/workflows/backup.yml`:
    - **When:** daily at 21:17 UTC (02:47 India time; GitHub delays runs at the top of the hour), and by hand (Run workflow).
    - **What it does:** runs `npm run backup`, then `restore --check` into a MongoDB started inside the runner (a `mongo:8` service container). So every backup is proven to restore, without the workflow needing write access to Atlas.
    - **Where it goes:** the file is kept as an artifact for 90 days (`backup-<date>`). About 2 minutes a run; for a private repository, that's ~60 of GitHub's 2,000 free minutes a month.
    - **If it fails:** GitHub emails the person who last changed a scheduled workflow.
    - **Public repositories:** GitHub pauses scheduled workflows after 60 days without commits (it emails first); Run workflow turns them back on.
  - **Security headers** on every response, set in `next.config.ts` from a small function with unit tests:
    - **`Content-Security-Policy`:**
      - **Allowed:**
        - scripts, styles, fonts and connections from the site itself;
        - images also from `res.cloudinary.com`, plus `data:` and `blob:` (the picture export);
        - connections also to `api.cloudinary.com` (photo uploads) and `res.cloudinary.com` (the picture export fetches photos).
      - **Blocked:** plugins (`object-src 'none'`) and framing by other sites (`frame-ancestors 'none'`). `base-uri 'self'` and `form-action 'self'` limit base URLs and form submissions to the site itself.
      - **Exceptions:**
        - Inline scripts are allowed (question 3): Next.js's page data and the theme script are inline.
        - `next dev` also allows `eval`, which React's debugging needs.
        - The Claude API is called only from the server, so it isn't listed.
        - Vercel's toolbar on preview deployments loads from vercel.live, which the policy blocks. Previews work without it.
    - **The others:** `Strict-Transport-Security` (2 years), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (for older browsers), `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` turning off camera, microphone and location, and `Cross-Origin-Opener-Policy: same-origin`. No more `X-Powered-By: Next.js` (`poweredByHeader: false`).
  - **Security review** of the whole app, area by area. Each finding is either fixed in this step, with a test, or written into ARCHITECTURE.md §11 as an accepted risk:
    - **Who's calling:** every server action (16) and route handler (3) checks who's calling and their role before anything else, with one 404 for no access. A new unit test reads every `"use server"` file and route handler and fails if an exported function doesn't call `requireUser`, `requireRole` or `getUser`, so a future action can't forget.
    - **Queries and inputs:** every database query carries the group. Inputs are checked (zod or `toObjectId`) and bounded in length before use, so no `{ $gt: … }` object or huge value reaches MongoDB.
    - **Secrets:** none reaches the browser. An e2e test searches the built files in `.next/static` for the run's placeholder secrets.
    - **Cookies and cross-site requests:** sign-in cookies are `Secure`, `HttpOnly` and `SameSite=Lax` in production. Cross-site requests are refused by Next.js's origin check (server actions), Better Auth's trusted origins, and SameSite cookies (`/api/chat`).
    - **Errors and logs:** they show no internals, tokens or email addresses.
    - **The chat:** replies are shown as plain text (no HTML). Instructions hidden in names or notes can only produce proposals that a person confirms and the server re-checks.
    - **Abuse:**
      - capped: chat messages, access requests, sign-in attempts, batch and body sizes;
      - not capped: server actions have no rate limit, and trusted members could upload many photos. Recorded as accepted.
    - **Dependencies:** `npm audit` now (if the mirror answers it), plus Dependabot alerts from now on.
    - **Atlas:** one user per purpose (the app read/write, CI tests, the backup read-only), with access from anywhere (`0.0.0.0/0`), as §11 records.
  - **Production smoke test** (`smoke/production.spec.ts`, its own `playwright.smoke.config.ts`, `npm run test:smoke`). It does only what a signed-out visitor can, so it never signs in or writes anything:
    - The landing page loads with the security headers, and Sign in with Google becomes clickable (so the scripts run under the policy). The console shows no policy violations.
    - Clicking it heads to Google with production's callback; the test stops there.
    - `/dashboard` sends you to sign in; `/api/chat` and the export address answer 401; `/dev/tree` is 404.
    - It runs by hand, and automatically after each production deployment (question 4): `.github/workflows/smoke.yml`, triggered by Vercel's deployment status.
- **Tests (275 unit, 37 database and 43 e2e tests in the suite after this step):**
  - Unit:
    - Encryption round trip. A wrong key, a changed byte, a cut-off file and a non-backup file are each refused with a clear message, and so is a key that isn't 32 bytes.
    - The backup format round-trips ids, dates, nulls, nested arrays and number types exactly.
    - The security headers: the policy's sources (with the e2e stand-in's address in e2e builds), and `eval` only in development.
    - Every server action and route handler checks the caller (the new guard).
  - Database:
    - Back up a test database holding a group, members, invites, users and chat usage, and restore it into a second one. Every document and index is identical, `sessions` and `verifications` aren't included, and the counts are checked.
    - Restore refuses a database that already has data, unless given `--replace`.
  - E2E:
    - Pages and API responses carry the headers.
    - Every e2e test now fails if the browser reports a Content Security Policy violation (the fixture listens to the console). So the 40 tests check that the policy blocks nothing the app uses: uploads, the picture export, the chat, sign-in.
    - The browser enforces the policy: an image and a connection to another site are refused, and the fixture records both. Framed by another page, the app stays blank, while a page without the policy (the Cloudinary stand-in) loads in the same kind of frame.
    - No placeholder secret is in the browser's files.
  - Smoke: as above, against production.
  - The workflow itself: your run by hand (Owner checks).
- **Owner checks:**
  - After merging: GitHub → Actions → Nightly backup → Run workflow. It goes green (its trial restore passed), and the run has a `backup-<date>` artifact.
  - Download and unzip it, then in your terminal: `npm run restore -- <file> --check`. The counts match your production data (for example, the number of people).
  - Actions → Production smoke test ran after the merge's deployment and is green. Or run `npm run test:smoke` in your terminal.
  - On the live site, with the browser's developer tools → Console open: no "Content Security Policy" errors while you open a sheet, upload a photo, save a picture and chat.
  - The next morning: the scheduled backup ran by itself.
- **Decisions (owner, 2026-10-19):**
  1. The backup is a Node script with the MongoDB driver: Extended JSON and indexes, gzip, AES-256-GCM. Not `mongodump` (§F12 updated).
  2. Production (`familytree`) only, every collection except `sessions` and `verifications`; daily, kept 90 days. Photos stay in Cloudinary.
  3. One fixed Content Security Policy in `next.config.ts` that allows inline scripts; no nonces.
  4. The production smoke test runs after every production deployment, and by hand.
  5. Dependabot alerts only, no update pull requests.
- **Step 11 notes (2026-10-19):**
  - **Security review, found and fixed:**
    - The invite token reached MongoDB unchecked. A server action accepts whatever its caller sends, so a crafted call with `{ $regex: "^a" }` as the token could find others' pending invites, and their masked emails, one character at a time. It could also decline your own invites, but never join a group, since an invite only works for its email. `isInviteToken` now checks the format before any query; the database test that sends query objects failed without the fix. Every id already goes through `toObjectId`, which rejects anything that isn't a 24-character hex string.
    - Better Auth kept Google's tokens in plain text in `accounts`, so they'd be in every backup too. `encryptOAuthTokens` now encrypts new ones with `BETTER_AUTH_SECRET`; the app never uses them.
  - **Security review, checked and fine:**
    - All 16 server actions and 3 route handlers check the caller first (now enforced by `test/server-checks.test.ts`, checked to fail when one action's check was removed).
    - Repository queries carry the group; zod bounds every text field.
    - Chat replies are plain text, and chat errors are fixed messages.
    - Export file names are cleaned; upload tickets allow photo formats only.
    - Cookies are `HttpOnly`, `SameSite=Lax` and `Secure` on https (Better Auth's defaults, read in its source). Server actions check the origin.
    - `npm audit`: nothing in what the site ships.
  - **Accepted, recorded in ARCHITECTURE.md §11 and §15:**
    - open sign-up: any Google account can create groups and use the chat;
    - no rate limit on server actions;
    - the chat's history comes back from the browser;
    - a dev-only `braces` advisory via ESLint's Next.js config.
  - **The policy broke nothing:** all 40 existing e2e tests passed under the Content Security Policy at the first run, with the violation check on.
  - **Deviations:**
    - We send `Strict-Transport-Security` ourselves, and Vercel may add its own, so the smoke test only checks for two years.
    - The smoke workflow matches environments starting with `Production`, as Vercel may name them `Production – <project>`.
  - **Found in the owner's first run of the backup workflow:** "Failed to initialize container mongo:8". The trial restore's MongoDB container started, but its health check (`mongosh` inside it, 5 s per try) never reported healthy, so GitHub stopped the job. The health check is gone: the restore's driver waits up to 30 s for the server, and by then the container has been up for a minute. A workflow can't run outside GitHub, so the owner's run is the test.
  - **The framing test:**
    - Chrome logs nothing when a page refuses to be framed.
    - It also blocks a public page, including one the test makes up, from framing `localhost` at all (its local network check).
    - So the test opens the Cloudinary stand-in at `127.0.0.1` and frames both the app (refused) and the stand-in (which loads).
    - Checked to fail with `frame-ancestors` and `X-Frame-Options` removed.
  - **The restore counts records before creating the indexes,** because a TTL index (chat usage) could otherwise delete expired records before the count.
  - **Not run from here:**
    - The sandbox blocks the live site, so the smoke test's first run is the owner's (or `smoke.yml`'s).
    - The backup scripts need Atlas, outside the allowlist. `npm run test:db` runs the same backup and restore code against Atlas. The scripts' error messages and the hidden key prompt (in a pseudo-terminal) were checked here.
  - **Previews:** Vercel's toolbar on preview deployments loads from vercel.live, which the policy blocks; the previews work without it.

## After step 11: hide photos (owner request)
- **Why:** to save or print a picture of the tree and share it without showing anyone's face.
- **Build:**
  - An eye button at the end of the sheet tabs, before Export (`HidePhotosButton`), shown when photos are set up. Pressed, it hides every photo on the sheets page, and the eye gets a line through it.
  - **What it hides:** every card, and the person panel, show initials in the blue or pink ring instead. So does a picture or print of the sheet, which is made from what the canvas shows.
  - **What it doesn't change:** nothing is saved. The photos stay in Cloudinary, the photo buttons keep working, and anyone can use it, Viewers included.
  - **How long it lasts:** it stays while you switch sheets, and the page shows photos again on the next visit (a reload, or coming back to the group).
  - `PhotosHiddenContext` (next to `CloudNameContext` in `src/components/tree/photo.ts`) carries the setting from `GroupSheets` to `PersonPhoto`.
- **Tests:**
  - Unit: `PersonPhoto` shows initials while photos are hidden, and the photo again when they aren't.
  - E2E: with a photo on Jake, the eye button hides it on his card, in his panel and on another sheet, with no `<img>` left on the canvas. A picture is saved meanwhile, as `test-results/screenshots/sheet-picture-no-photos.png`, and pressing it again brings the photo back. Viewers get the button too.

## After step 11: sheet changes (owner requests)
- **Why:**
  - Adding parents gave the mother no tab of her own, unlike a partner who marries in, so her side of the family only showed on sheets that also hold the father's.
  - Her children don't need to be on her tab: they're on the father's side.
  - A renamed person's sheet kept the old name in its title.
  - Sheets couldn't be deleted, so neither could anyone who had one, such as a partner who married in.
- **Build:**
  - **The mother's own sheet:**
    - Add parents has "Create their own sheet" under the mother's fields. Checked, the same save also creates "<Mother>'s family", rooted at her, with `hideChildrenOf` set to the parents' couple.
    - The sheet shows her parents, her brothers and sisters and their families, her partner, and any children from another couple of hers. It doesn't show this couple's children (the person whose parents were added, and their brothers and sisters) or anyone below them, nor the father's parents and siblings.
    - It starts unchecked, as an option; Add partner's stays checked. Checked with no mother's name, the form asks for her name or to uncheck it.
    - "Add the other parent" offers the same box when that parent is a woman (it hides when the form's gender is Male).
    - A new group's pinned "<Mother>'s family" works the same way (`newGroupOperations`). Groups created before keep theirs as it was.
  - **A sheet that leaves out one couple's children** (§6), a new optional field:
    - `createSheet`'s `hideChildrenOf` (`SheetDoc`, `Sheet`) must be a couple its root is in (planner).
    - `buildSheetView` doesn't walk into that couple's children.
    - It survives JSON export and import (the file's couple id becomes the new couple's). GEDCOM has no sheets.
  - **Renaming follows:** a new name in Edit details also renames the person's sheets still titled "<old name>'s family" (`renameSheetsOps`); a title of your own stays. The assistant's `update_person` does the same, and its proposal card says so ("Rename the sheet …").
  - **Delete sheet:**
    - In the tab's ⋯ menu: a confirmation saying everyone on it stays. A UI-only `deleteSheet` operation, a soft delete (`deletedAt`, like people and groups).
    - Pinned sheets (the father's and mother's start pinned) can't be deleted until unpinned, and a group's last sheet can't be deleted. The menu explains which, and the planner refuses the same.
    - Deleted sheets are absent everywhere: `toGroupTree`, `firstSheetId` (the group link), the planner's checks. A deleted sheet's root can then be deleted.
    - Deleting the open sheet shows the first remaining one (the page already did this for a sheet that's gone).
  - Pinning is the guard because older groups have nothing else marking which two sheets are the father's and mother's.
- **Decisions (owner, 2026-10-20):**
  1. The mother's "Create their own sheet" starts unchecked, also now that sheets can be deleted.
  2. A new group's Mother's sheet leaves out the couple's children too, like the mother's sheets made when adding parents.
- **Tests:**
  - Unit:
    - The mother's sheet in the batch, rooted at her and hiding the parents' couple. Once both sides have parents and she has a brother, it shows her side only; the person's own sheet shows both sides. The other-parent path does the same, and the father never gets a sheet.
    - `buildSheetView`: Jerry's side without his children; Steve's sheet hiding one couple still shows the children of his other couple, and an extra.
    - Planner:
      - `hideChildrenOf` stored, and refused for a couple the root isn't in, or an unknown one;
      - `deleteSheet` refused when pinned or last; after it, the sheet is not found, isn't counted by `reorderSheets`, and its root can be deleted.
    - A rename follows the given title and leaves a custom one; the assistant's rename proposal lists the sheet too.
    - JSON keeps a sheet that hides a couple, from the whole group and from that sheet alone; a file pointing at a missing couple is refused.
  - Database: `hideChildrenOf` saved and loaded; a deleted sheet stays in the collection with `deletedAt`, leaves the tabs, and the group link opens the next sheet.
  - E2E:
    - Mother's sheet: the box starts unchecked; checked with no mother, the form asks for her name. With Grace Lee as Taylor Humes's mother, "Grace Lee's family" appears (not one for the father) with only Grace and Frank Humes. "Add the other parent" shows the box for a mother and hides it for a father. A new group's Mother's tab shows the couple without the user, its child.
    - Rename and delete: renaming Jerry Willow renames his tab. His pinned sheet can't be deleted until unpinned. Then it's deleted: the page goes to the Cruz family sheet with nobody missing, and Jerry can be deleted.

## After step 11: go to a person's sheet (owner request)
- **Why:** someone with a sheet of their own (a partner who married in, a mother with her own sheet) is easy to find on the family's sheets, but their own sheet could only be found by its tab.
- **Build:**
  - The person panel's details have a "Go to <sheet title>" button for each sheet rooted at that person, in tab order, under Parents, Partners and Children. It opens the sheet as its tab would (`pushState`), so Back returns.
  - The sheet already open isn't offered, and someone without a sheet gets no button.
  - Everyone gets it, Viewers included: it only changes the sheet shown.
  - The panel stays open on the person, who is now the open sheet's root.
- **Tests:**
  - Unit (`PersonPanel.test.tsx`): Jerry's two sheets in tab order, and the click opens the right one; not the open sheet; nothing for someone without a sheet; shown to a Viewer.
  - E2E: Jake Cruz has no button. Jerry Willow's "Go to Jerry Willow's family" opens his sheet (its URL, its tab selected, 32 people) with his panel still open and no button left, and Back returns to the Cruz family sheet. A Viewer gets it too. The night screenshot (`night-tree.png`) now shows Jerry's panel, with the button.

## Final check on the live site
1. Sign in with Google.
2. Create a group with the father's and mother's names.
3. Add family members by hand and through the chat, including someone who married in, which creates their own sheet.
4. Upload a photo.
5. Invite a second Google account as View.
6. From a third account, open a tree link → request access → approve it as Maintain.
7. Export GEDCOM, re-import it into a new group, and confirm the nightly backup ran.

## After the final check: phones and tablets (owner request)
- **Why:** the app should look good on every device, mainly phone browsers. Checked on 2026-10-20 in Chrome's iPhone 13 (390 × 844) and iPad (810 × 1080) emulation:
  - **The sheet row:** Export, Import… and Ask AI take the whole tab row on a phone. Only "Cruz fa" of the first tab shows; the other tabs, ⋯ and "+ New sheet" are pushed out of sight.
  - **The header:** the day/night switch covers Members and Settings, and the group's name is gone (on the members and settings pages it's cut to "C.").
  - **The tree:** the whole sheet is fitted to the screen, so names can't be read, and the minimap covers a third of it, also on a tablet.
  - **The panels:** the person, couple, chat and import panels keep their desktop width (320–384 px), which leaves the tree a sliver or nothing on a phone.
  - **Menus:** the Export menu opens partly off the left edge of the screen.
  - **Height:** the sheets page is `h-screen` (100vh), which on phones reaches under the browser's address bar, so the bottom of the page can be hidden.
  - The other pages (sign-in, dashboard, members, settings, no access, invite) already fit; they need the header fix and touch-sized buttons.
- **Sizes:** phone below 768 px wide (Tailwind's `md`), tablet 768–1023 px, desktop 1024 px and up (`lg`). A phone turned sideways (844 × 390) gets the tablet layout. Desktop stays exactly as it is.
- **Build:**
  - **Header on phones:** "Family Tree", the group's name (cut short with … when long) and the avatar. Members (with its requests badge), Settings, the day/night choice and Sign out move into the avatar's menu, and the avatar shows the badge too. Tablets keep today's header, without the user's name next to the avatar.
  - **Switching sheets (decision 1):** phones get a sheet picker: a full-width box with the open sheet's title and ▾. It opens the device's own list (a `<select>`) of every sheet in tab order, pinned ones first under "Pinned", and opens the one tapped. Tablets keep the tabs, which scroll sideways.
  - **The sheet's tools (decisions 2 and 5):** below 1024 px, Export (picture, print, GEDCOM, JSON) and Import… move into one menu (⋯) at the end of the sheet row, together with the sheet's own options for Maintain and up (New sheet, Rename, Pin, Move, Delete). The eye that hides photos stays in the row, just before ⋯: a bigger eye with no circle around it, like the ⋯. Ask AI becomes a round button at the bottom right of the tree. The sheet row is then just the picker (or tabs), the eye and that menu.
  - **Panels on phones (decision 3):** the person and couple panels open as a sheet over the bottom half of the screen, full width and scrolling inside, with the tree above it; the canvas moves the selected card into the part still visible. Its forms (Edit details, Add parents…) use the full height. Chat and Import open full screen with Close. Tablets keep side panels.
  - **The tree on phones and tablets (decision 4, extended to tablets; see the notes):** a sheet opens zoomed in far enough to read names (75 %), at its root person (top centre), unless the whole sheet fits at that zoom; the ⛶ button still shows the whole tree. After a change to the same sheet the view stays where it was. A selected card is moved into view: above a phone's panel, or within a tablet's tree, which the panel beside it makes narrower. Pinch to zoom and drag to move already work (React Flow handles touch). The minimap is hidden below 1024 px, and the zoom buttons are bigger on touch screens.
  - **Phone browsers and touch:**
    - `h-dvh` instead of `h-screen`, so the sheets page fits between the browser's bars.
    - Text fields use 16 px text on phones: iPhones zoom into any field with smaller text when it's tapped.
    - Buttons and links at least 44 px tall on touch screens (Tailwind's `pointer-coarse:`), as Apple and Google recommend.
    - Menus stay on screen: no wider than the screen, aligned to its edge.
    - The Undo bar and error messages stay visible above a bottom panel.
  - **The other pages:** no sideways scrolling at 360 px (the smallest common Android width); rows such as the invite form wrap.
  - Everything new gets `dark:` twins, checked with night screenshots at phone size.
  - Desktop keeps its layout and tests unchanged. The picture and print still work from the menu; how a phone saves them (Files, Photos, Downloads) is part of the owner's check.
- **Tests:**
  - **Playwright projects:** two more, in Chrome's device emulation (touch, mobile viewport): `phone` (iPhone 13, 390 × 844) runs `e2e/responsive-phone.spec.ts`, and `tablet` (iPad, 810 × 1080) runs `e2e/responsive-tablet.spec.ts`. Every existing test stays on desktop Chrome, which shows desktop is unchanged. Safari's engine (WebKit) can't be downloaded here, so the owner's check on a real phone covers it.
  - **Phone (E2E):**
    - No page scrolls sideways: sign-in, dashboard, sheets, members, settings, no access, invite, at 390 px and 360 px.
    - The avatar menu has Members, Settings, the theme choice and Sign out.
    - The picker lists both sample sheets and opens Jerry Willow's family.
    - The eye sits in the row just before ⋯, 24 px with no border, and hides and shows photos; the ⋯ menu saves a picture and opens Import… full screen, has no Hide photos, and a tap on the tree closes it. A Viewer gets the eye, and a menu with no edit items.
    - Tapping Olivia Cruz, low on the screen, opens the bottom panel and moves her card above it; so does choosing her father Jerry Willow in the panel, whose card was then above the screen. Add child takes the full height and saves, and "Go to Jerry Willow's family" works.
    - Ask AI opens the chat full screen, and Close returns to the tree.
    - The first view shows the root's name at a readable size.
    - The main buttons are at least 44 px tall, and a text field has 16 px text.
  - **Tablet (E2E):** the header with its links and theme switch, tabs, the eye before the ⋯ menu, the menu on screen, the readable first view, and the side panel with Jerry's card kept in the narrower tree; no sideways scrolling.
  - **Unit:** the picker (order, pinned group, choosing a sheet), the eye just before the ⋯ menu and not in it, and the menu (the sheet's options for Maintain and up, then the tools; an item closes it) in `SheetTabs.test.tsx`; the first view and bringing a card into view in `framing.test.ts`.
  - **Screenshots:** `phone-tree.png`, `phone-panel.png`, `phone-menu.png`, `phone-chat.png`, `night-phone-tree.png` and `tablet-tree.png`.
- **Owner checks:** on the branch's Vercel preview, on your own phone (and a tablet if you have one): sign in, open a tree, switch sheets, pinch and drag, tap people, add someone, ask the AI, save a picture, and turn the phone sideways.
- **Decisions (owner, 2026-10-20),** each the proposal over the alternatives shown:
  1. Phones switch sheets with a sheet picker, not tabs scrolling sideways.
  2. Below 1024 px the tools go into one ⋯ menu, with a round Ask AI button over the tree; not a bar at the bottom or a second row under the tabs.
  3. On a phone the person panel opens over the bottom half with the tree above, not full screen.
  4. On a phone a sheet opens zoomed in at its root with names readable, not the whole tree fitted.
  5. After checking the preview: the eye that hides photos stays in the sheet row, just before ⋯, on phones and tablets, a bigger eye (24 px) with no circle around it; the other tools stay in the menu.
- **Notes (2026-10-20):**
  - **Tablets get decision 4's first view too.** It was decided for phones, but the owner's message while planning said tablets had no easy view either: fitting the sample's Cruz family sheet into an iPad's 810 px left 5 px names, and opening a panel hid the tree's right side. Below 1024 px a sheet now opens at the readable zoom, and a selected card is kept in view. Easy to undo if the owner prefers the whole tree on tablets.
  - The first e2e run showed phones still opening with the whole tree (cards 26 px wide). React Flow's `fitView` prop fits once the cards are measured, after the canvas's own framing, and undid it. The canvas frames every sheet itself, so the prop is gone.
  - After a change to the same sheet, phones and tablets keep the view where it was: going back to the root after every save would lose the person being edited. Computers still fit the whole sheet after each change, as before.
  - The picker is the device's own `<select>` list (an iPhone's wheel, Android's list): every title in full, and nothing to position.
  - The sheet menu closes on `pointerdown` outside it: after a touch on the canvas, React Flow stops the mouse events browsers make up, so a `mousedown` listener (as in the Export menu) never heard the tap.
  - The 16 px rule for text fields is plain CSS outside Tailwind's layers, so it wins over the `text-sm` on each field.
  - Safe-area padding wasn't needed: without `viewport-fit=cover` the browsers keep the page clear of the notch and the home bar themselves, and `h-dvh` keeps it between the browser's bars.
  - The user's name beside the initials is hidden below 1024 px but kept for screen readers (`sr-only`), so the menu button still has the name (and the sign-out test still finds it).
  - Every existing (desktop) e2e test passes unchanged, and desktop screenshots look the same.
