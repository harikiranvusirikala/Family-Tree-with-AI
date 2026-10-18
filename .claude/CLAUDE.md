# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Start here

Three docs drive all work. Read the relevant parts before changing anything:

- **[BUILD_PLAN.md](BUILD_PLAN.md)**: the 12-step build plan and its Progress table. Steps 1–6 exist (skeleton; sheet view, ELK.js layout and the tree canvas; MongoDB and `applyOperations`; Google sign-in; groups, roles and sheet pages; editing by hand). Still planned: photos (7), members, invites and access requests (8), AI chat (9), import/export (10), backups and hardening (11). Each built step has notes recording deviations and bugs found; read them before touching that area.
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: the blueprint (code layout §4, data model §5, sheet rules §6, layout §7, permissions §8, flows F1–F12, AI chat §10, environments §12, env vars §13, open questions §15). Folder names, collections and function names come from here.
- **[Features.txt](Features.txt)**: the owner's requirements plus the agreed DECISIONS section.

## Working agreement with the owner

- Before building a step, its BUILD_PLAN section must be detailed and agreed. The owner may expand it themselves (step 4); otherwise draft it there, with open questions, and ask (step 6). Check the plan's library claims in the installed `node_modules` source and record any deviation in that step's notes.
- Build one BUILD_PLAN step at a time. At the end of a step, stop: show the test results and a short "try this" list, and wait for the owner's OK. A bug the owner finds gets a test that reproduces it, checked to fail without the fix.
- After the OK: commit to a `step-N-<name>` branch. The sandbox blocks github.com, so the owner pushes it (CI runs and Vercel builds a preview) and merges to `main` after checking the preview. `main` deploys production. Before starting the next step, check that local `main` has the merge.
- When a step settles a design question, update ARCHITECTURE.md (the relevant section and §15), Features.txt DECISIONS, this file, and the BUILD_PLAN Progress table in the same commit. BUILD_PLAN step sections describe the step; status lives only in the Progress table.
- When a step adds indexes, the owner runs `MONGODB_DB=familytree_preview npm run db:setup` and `MONGODB_DB=familytree npm run db:setup` in their terminal before merging.
- The AI chat model is `claude-haiku-5-5`, chosen by the owner to keep costs near zero. Don't switch models without asking.

## Commands

```bash
npm run dev                 # dev server, port 3000
npm run lint
npm run typecheck           # `next typegen` first: global types like LayoutProps<"/"> are generated
npm test                    # unit tests only, no database (npm run test:watch for watch mode)
npx vitest run src/app/page.test.tsx      # one test file
npx vitest run -t "landing page"          # tests matching a name
npm run build
npm run test:e2e            # Playwright: builds, then serves on port 3100 (dev uses 3000)
npx playwright test e2e/home.spec.ts      # one e2e file (also builds first); owner's terminal only, not allowlisted
npm run test:db             # *.db.test.ts integration tests against Atlas
npx vitest run --config vitest.db.config.mts src/server/operations/apply.db.test.ts   # one db file; owner's terminal only
npm run db:ping             # check the MONGODB_URI / MONGODB_DB connection
npm run db:setup            # create indexes (idempotent)
npm run seed                # sample family into MONGODB_DB, group 000000000000000000000001; view at /dev/tree/db
```

Scripts in `scripts/` are `.mts` (top-level await) and run with `node --import tsx --env-file-if-exists=.env.local`. Don't use the `tsx` CLI: it opens a local IPC pipe that the sandbox blocks.

## Environment gotchas (owner's machine)

- **Port binding is sandboxed.** The Claude Code sandbox on this machine blocks opening local ports, so `npm run build` (Turbopack spawns a worker on a port) and `npm run test:e2e` fail inside it with `Operation not permitted`. The owner allowlists them as `exact_match`, so run them exactly as written, on their own: no `cd …&&`, no `timeout` prefix, no `2>&1 | grep`, nothing chained. Anything else is a different command and runs sandboxed. Rarely the exact `npm run test:e2e` is refused anyway; try again later, or ask the owner to run it.
- **No Google Fonts.** The network proxy blocks `fonts.googleapis.com`, so `next/font/google` breaks the local build. The app uses the system font stack; self-host any font from an npm package instead.
- **Playwright browser.** Playwright's own browser download is blocked, so locally it runs against the installed Google Chrome (`channel: "chrome"` unless `CI`). CI installs Playwright's Chromium.
- **Slow npm.** Installs through the private registry mirror can take several minutes; use long timeouts.
- **Harmless warning:** `next build` reports that it "ignored package-lock.json in /Users/harikiran.v01". That's a stray lockfile in the home folder, outside the repo; ignore it.
- **MongoDB needs the allowlist too.** The sandbox blocks MongoDB's DNS SRV lookup and TCP connections, and allowing a domain doesn't help because the driver doesn't use the web proxy. `npm run db:ping`, `db:setup`, `seed` and `test:db` are allowlisted `exact_match` like build/e2e, so run them exactly as written. If one is refused, ask the owner to run it.
- **Session environment = `.env.local` at startup.** This session's environment is loaded from `.env.local` when it starts. Node's `--env-file`, `process.loadEnvFile` and Next.js never override variables that are already set, so after the owner edits `.env.local`, the session must be restarted before commands see the change. Next.js also loads a `.env` file as a fallback for anything missing from `.env.local`; keep local settings in `.env.local` only (a `.env` with production values once appeared here).

## npm and the lockfile

- `.npmrc` sets `omit-lockfile-registry-resolved=true`, so `package-lock.json` has **no `resolved` URLs**. Locally npm installs from the mirror; Vercel and GitHub Actions use the public registry. After any install, `grep -c '"resolved"' package-lock.json` must print `0`. Never commit private registry hostnames.
- `.npmrc` also sets `legacy-peer-deps=false`, overriding the owner's global setting, so `npm ci` on CI accepts the lockfile. Fix peer conflicts with version changes, not `--legacy-peer-deps` or `--force`.

## Next.js setup

- Next.js 16.4 with Turbopack, Tailwind v4 (wired through the `@tailwindcss/turbopack` loader in `next.config.ts`, with no PostCSS config), and React 19.
- `cacheComponents` and `partialPrefetching` are on, so reading cookies, headers or the database in a server component follows the Cache Components rules. Check `node_modules/next/dist/docs/` before writing data-loading or auth code.

## Architecture invariants (from ARCHITECTURE.md; follow them as code is added)

- **One Next.js app is both UI and API.** Server-only code goes in `src/server/`. Pure tree logic goes in `src/tree/`, which runs in the browser and in unit tests with no I/O.
- **Each person is stored once; sheets are views.** A sheet stores only `rootPersonId` and `extraPersonIds`. `buildSheetView()` computes who is shown, using the §6 rules: ancestors, then descendants of every ancestor, then partners (not partners' parents), then extras. Never copy people into a sheet.
- **A union is a couple** (the ♥): 1–2 `partnerIds` plus `childIds`. A person is a child of at most one union. Unions map to GEDCOM `FAM` records.
- **Layout** goes through `layoutEngine` (`src/tree/layout/index.ts`, ELK.js). The ELK adapter groups partners into side-by-side blocks with fixed connection points, then re-packs siblings with no family of their own eldest first (ARCHITECTURE.md §7). Hearts are placed by the shared `placeUnions()`, never by an engine itself.
- **Single write path.** Manual edits, confirmed AI proposals and imports all become an `Operation[]` (§10, with temporary IDs like `new:1`) applied by `applyOperations(database, groupId, ops, actor)` in one transaction. Don't add other write paths.
- **Permissions:**
  - Every server action, route handler and data load calls `requireRole(groupId, minRole)` itself. Layouts don't re-run on every navigation, and server actions can be called directly, so a check in a layout isn't enough. A layout that loads data (the sheets layout) checks for itself; a page never relies on a layout's check.
  - Repository functions require `groupId`.
  - The role is read from the database on each request, never stored in the session.
  - "No access" looks identical whether or not a group exists.
  - Only Admins and the Owner grant access, by invite or access request.
- **The AI never writes.** Proposal tools collect operations and save nothing. The user confirms on a `ProposalCard`, and the confirmed batch goes through `applyChangesAction`, the same server action as manual edits, so it is re-validated and permission-checked there. Tools are filtered by role (Viewers get read tools only), and there is no delete tool.
- **Photos** go straight from the browser to Cloudinary under `groups/{groupId}/`. Store the Cloudinary `photoId` (public ID), not a URL.
- **Databases** live in one Atlas cluster: `familytree_dev` (local), `familytree_preview` (Vercel previews), `familytree` (production), plus a throwaway `familytree_test_<run-id>` per test run.

## Server and data layer (as built)

- `src/server/db.ts`: `getDatabase()` returns the app's shared, cached client and database (from `MONGODB_URI` / `MONGODB_DB`), connected; `lazyDatabase()` returns the same without connecting. `openDatabase(name)` opens a separate connection to a named database, for tests and scripts; they must close it, and scripts call `closeDatabase()`. A `Database` is `{ client, db }`: the client is needed for transactions.
- IDs: MongoDB documents use `ObjectId`; everything in `src/tree/` and every `Operation` uses 24-character hex strings. Conversion happens only in `toGroupTree` (`src/server/repositories/family.ts`: documents → `GroupTree`, without soft-deleted people; `loadGroupTree` is the query plus this) and in `planOperations` (refs → `ObjectId`). Use `toObjectId()` (`src/server/ids.ts`); it throws `InvalidIdError`, which callers treat as "not found".
- `applyOperations` (`src/server/operations/apply.ts`): zod (`schema.ts`), then load the group's records in a transaction, then the pure `planOperations` (`plan.ts`), then bulk writes. Throws `OperationError` with the failing change's `index` and its `reason` (the message without "Change N:"). It doesn't check permissions: its callers do (`applyGroupChanges`, and `createGroup` for the group's creator).
- Soft-deleted people stay in their couples (so Undo restores them fully), but the planner treats them as absent, exactly as `toGroupTree` shows them: a couple whose partners are all deleted isn't anyone's parents, and a new partner can take a deleted partner's place. New rules must keep the planner and `toGroupTree` agreeing, or the browser offers edits the server refuses.
- `operationsFromFamily()` turns `FamilyData` with its own ids into operations with `new:<id>` temporary ids. The seed and the e2e `sampleGroup` fixture use it, and imports will use it in step 10.
- Database reads in pages go inside `<Suspense>` after `await connection()` (see `src/app/dev/tree/db/page.tsx`), so they happen at request time and never during the build. Pages that call `requireUser`/`requireRole` read headers, which already makes them request-time.

## Groups, roles and editing (as built, steps 5–6)

- Our own `groups` and `memberships` (not Better Auth's organization plugin). `src/server/roles.ts` (pure) has `RANK`, `MIN_ROLE` (the §8 table), `can(role, action)` and `NoAccessError`.
- `requireRole(groupId, min)` in `permissions.ts` = `requireUser()` + `roleInGroup()` from `repositories/groups.ts`, and returns `{ user, role, group }`. Pages: `requireRole(...).catch(noAccessToNull)`, then render `<NoAccess />` (identical for every no-access case). Server actions return an error message instead. Never `catch` everything: `requireUser` redirects by throwing.
- Group pages follow `src/app/g/[groupId]/settings/page.tsx`: a `<Suspense>` boundary around an async component that awaits `params`, then `requireUser()`, then `requireRole()`. The sheets are drawn by the layout `src/app/g/[groupId]/s/layout.tsx` (same pattern), so the editor stays mounted while tabs change `[sheetId]` with `pushState`; the `[sheetId]` page itself renders nothing.
- Writes that need more than content operations in the same transaction use `parseOperations` + `applyInTransaction` (see `createGroup`). Don't write persons, unions or sheets any other way.
- Editing (step 6): forms build operations with the pure helpers in `src/tree/edits.ts` and send them to `applyChangesAction` (`src/app/g/[groupId]/actions.ts`), which calls `applyGroupChanges` (`roleInGroup(…, maintain)` + `applyOperations`) and `groupChanged`. New edit types: add a builder plus a unit test against the sample family (`test/planning.ts`), and a planner rule if needed.
- The canvas is read-only unless given `actions` (`CanvasActions`: onPerson, onCouple, selectedId). Cards and hearts then render overlay buttons named "Jake Cruz, 1945 – 2022" and "Steve Cruz and Arham Chopra, married", which e2e tests click.
- Server actions live next to their page in `actions.ts`, take bound ids (`action.bind(null, groupId)`), and call `requireRole` themselves. After changing a group (or later, its members or content), call `groupChanged(groupId)` from `src/server/group-changed.ts` before returning or redirecting. It revalidates `/dashboard` and the group's pages; otherwise Back/Forward and the header link show the pages the browser kept from before the change.

## Sign-in (as built, step 4)

- `src/server/auth.ts` is the Better Auth instance (`import "server-only"`). Its settings are in `auth-options.ts`, which has no `server-only` so the e2e fixture can build an identical instance (same cookie names and signatures). Base URL and trusted origins come from the pure `authUrls(env)` in `auth-urls.ts`: exact origins only, never `*.vercel.app`.
- Better Auth gets `lazyDatabase()` from `db.ts`: the shared client, not yet connected, so importing `auth.ts` during the build never touches the database. `getDatabase()` connects it.
- Collections `users`, `sessions`, `accounts`, `verifications` (`usePlural: true`); user ids are `ObjectId`s. `ensureIndexes` adds TTL indexes on `sessions.expiresAt` and `verifications.expiresAt`; don't repeat Better Auth's own indexes there.
- `src/server/permissions.ts`: `getUser()` (user or null) and `requireUser()` (redirects to `/`). Both read the session with `disableRefresh`, because Server Components can't write cookies; only `/api/auth/get-session` (the user menu's `useSession()`) extends sessions. Route handlers use `getUser()` and answer 401. Don't use `use cache: private` for these: step 5's role must be read fresh.
- `src/proxy.ts` (Next.js 16's middleware) checks only that a session cookie is present, using the pure `proxyDecision()` in `src/server/proxy-rules.ts`. It denies by default: a new public page must be added to `PUBLIC_PATHS` there. Signed-out page loads get a 307 to `/?returnTo=…`; API calls and POSTs get 401.
- The landing page stays static: `SignInButton` reads `returnTo` when clicked and checks it with `safeReturnTo()`. Interactive auth buttons stay disabled until hydrated (`useHydrated()`), so early clicks aren't lost.
- Google sign-in on previews goes through production (Better Auth's `oAuthProxy`, enabled only on Vercel when `OAUTH_PROXY_SECRET` is set).
- Better Auth rate-limits `/sign-in/*` in production builds (3 per 10 s per IP), and the e2e server is a production build: sign in through the `signIn` fixture, not by clicking the button repeatedly.

## Deployment

- `vercel.json` pins the framework to Next.js. With the wrong dashboard preset, Vercel fails with "No Output Directory named "public" found".
- Vercel environment variables (owner-managed):
  - `MONGODB_DB` is `familytree` in Production and `familytree_preview` in Preview.
  - `BETTER_AUTH_URL` is set only in Production (`https://family-tree-with-ai.vercel.app`); previews use Vercel's `VERCEL_BRANCH_URL` and `VERCEL_URL`.
  - `BETTER_AUTH_SECRET` differs between Production and Preview.
  - `OAUTH_PROXY_SECRET` (from step 4) is the same in Production and Preview, for Google sign-in on previews.
  - Vercel's system variables (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`) must be exposed; sign-in reads them. `vercel.json` sets no `regions`, so functions run in Vercel's default `iad1`.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, `npm test`, `npm run test:db` and e2e, using the `MONGODB_URI` repository secret (a read/write test user).

## Testing conventions

- Unit tests sit next to the code as `*.test.ts(x)` under `src/`, or under `test/`. Vitest uses jsdom by default; pure-logic tests start with `// @vitest-environment node`, and the database config always uses node. `async` Server Components can't be unit-tested in Vitest, so cover them with e2e tests.
- E2E specs live in `e2e/`. Each e2e run gets its own database: `playwright.config.ts` names it, `e2e/global-setup.ts` seeds the sample family into it, the web server gets it as `MONGODB_DB`, and `e2e/global-teardown.ts` removes it.
- Database integration tests are `*.db.test.ts`, run only by `npm run test:db` (`vitest.db.config.mts`). Use `createTestDatabase()` from `@test/db`, which gives each file its own database, and call `drop()` in `afterAll`. The database user can't drop databases, so test databases are emptied collection by collection (`emptyDatabase`).
- `applyOperations` rules go in the pure `planOperations` (`src/server/operations/plan.ts`) and are unit-tested there. The `.db.test.ts` tests cover transactions, persistence, group isolation and role checks (`roleInGroup`, `applyGroupChanges`).
- `test/planning.ts` (`applyPlan`, `sampleState`, `toGroupTree`) applies operations to an in-memory group with the real planner, so edit builders can be tested against the sample family through what the browser draws, without a database.
- `test/fixtures/cruz-young.ts` holds the 36 people from the sample tree image: a same-sex couple, a divorce and remarriage, and in-law parents. It is the shared test data, and the §6 worked examples are its assertions. Import it as `@test/fixtures/...` (tsconfig alias). `test/fixtures/generated.ts` builds large synthetic families.
- `src/app/dev/*` pages (e.g. `/dev/tree`, the layout playground) return 404 unless running `next dev` or built with `ENABLE_DEV_PAGES=1`. Playwright's web server sets that flag, so e2e tests can use them.
- The tree e2e test saves `test-results/screenshots/tree.png`. View it after layout or card changes and compare with the sample image.
- Signed-in e2e tests use the `signIn(page, name)` fixture from `e2e/fixtures.ts` (import `test` and `expect` from there). It creates a fresh user and session in the run's database with Better Auth's `testUtils` and adds the signed cookie. The app has no test-login route, and ESLint forbids importing `testUtils` under `src/`. `playwright.config.ts` gives the web server `BETTER_AUTH_URL=http://localhost:3100`, a fresh `BETTER_AUTH_SECRET` per run (shared with the fixture through `E2E_AUTH_SECRET`), and placeholder Google credentials; tests stop at the redirect to Google.
- E2E fixtures in `e2e/fixtures.ts`: `signIn(page, name)`, `sampleGroup(owner)` (a group with the sample family and its two sheets) and `addMember(groupId, user, role)`.
- In e2e tests, reach pages the way people do (links, Back) as well as with `page.goto`: a full reload hides stale-page bugs. Compare text with `textContent`, not `innerText`, which changes while React moves streamed content into place.
- In e2e tests, locate inputs with `getByRole("textbox", { name })`, not `getByLabel`. Next.js 16 keeps recently visited pages in the DOM, hidden, and `getByLabel` can match their inputs; `getByRole` skips hidden elements. Filter alerts by text: Next.js's route announcer is also `role="alert"`.
- Locally each save is a transaction plus a re-render against the remote M0 cluster (1–5 s with four workers), so `playwright.config.ts` allows 15 s per assertion and 60 s per test. Wait for the change to appear rather than for a fixed time.
- `samples/` (reference images) is git-ignored, so tests and CI must not depend on it.
