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
