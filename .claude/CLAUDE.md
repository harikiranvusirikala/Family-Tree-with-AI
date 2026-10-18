# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Start here

Three docs drive all work. Read the relevant parts before changing anything:

- **[BUILD_PLAN.md](BUILD_PLAN.md)**: the 12-step build plan and its Progress table. Steps 1–3 exist (skeleton; sheet view, ELK.js layout and the tree canvas; MongoDB and `applyOperations`). Sign-in, groups and permissions are still planned.
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: the blueprint (code layout §4, data model §5, sheet rules §6, layout §7, permissions §8, flows F1–F12, AI chat §10, environments §12, env vars §13, open questions §15). Folder names, collections and function names come from here.
- **[Features.txt](Features.txt)**: the owner's requirements plus the agreed DECISIONS section.

## Working agreement with the owner

- Build one BUILD_PLAN step at a time. At the end of a step, stop: show the test results and a short "try this" list, and wait for the owner's OK.
- After the OK: commit to a `step-N-<name>` branch. The sandbox blocks github.com, so the owner pushes it (CI runs and Vercel builds a preview) and merges to `main` after checking the preview. `main` deploys production. Before starting the next step, check that local `main` has the merge.
- When a step settles a design question, update ARCHITECTURE.md (the relevant section and §15), Features.txt DECISIONS, and the BUILD_PLAN Progress table in the same commit.
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

- **Port binding is sandboxed.** The Claude Code sandbox on this machine blocks opening local ports, so `npm run build` (Turbopack spawns a worker on a port) and `npm run test:e2e` fail inside it with `Operation not permitted`. The owner allowlists them as `exact_match`, so run them exactly as written, on their own: no `cd …&&`, no `timeout` prefix, nothing chained.
- **No Google Fonts.** The network proxy blocks `fonts.googleapis.com`, so `next/font/google` breaks the local build. The app uses the system font stack; self-host any font from an npm package instead.
- **Playwright browser.** Playwright's own browser download is blocked, so locally it runs against the installed Google Chrome (`channel: "chrome"` unless `CI`). CI installs Playwright's Chromium.
- **Slow npm.** Installs through the private registry mirror can take several minutes; use long timeouts.
- **Harmless warning:** `next build` reports that it "ignored package-lock.json in /Users/harikiran.v01". That's a stray lockfile in the home folder, outside the repo; ignore it.
- **MongoDB needs the allowlist too.** The sandbox blocks MongoDB's DNS SRV lookup and TCP connections, and allowing a domain doesn't help because the driver doesn't use the web proxy. `npm run db:ping`, `db:setup`, `seed` and `test:db` are allowlisted `exact_match` like build/e2e, so run them exactly as written. If one is refused, ask the owner to run it.
- **Session environment = `.env.local` at startup.** This session's environment is loaded from `.env.local` when it starts. Node's `--env-file`, `process.loadEnvFile` and Next.js never override variables that are already set, so after the owner edits `.env.local`, the session must be restarted before commands see the change.

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
- **Single write path.** Manual edits, confirmed AI proposals and imports all become an `Operation[]` (§10, with temporary IDs like `new:1`) applied by `applyOperations(groupId, ops, actor)` in one transaction. Don't add other write paths.
- **Permissions:**
  - Every server action, route handler and data load calls `requireRole(groupId, minRole)` itself. Layouts don't re-run on every navigation, and server actions can be called directly, so a check in a layout isn't enough.
  - Repository functions require `groupId`.
  - The role is read from the database on each request, never stored in the session.
  - "No access" looks identical whether or not a group exists.
  - Only Admins and the Owner grant access, by invite or access request.
- **The AI never writes.** Proposal tools collect operations and save nothing. The user confirms on a `ProposalCard`, and the confirmed batch goes through the normal `applyOperations` server action, so it is re-validated and permission-checked there. Tools are filtered by role (Viewers get read tools only), and there is no delete tool.
- **Photos** go straight from the browser to Cloudinary under `groups/{groupId}/`. Store the Cloudinary `photoId` (public ID), not a URL.
- **Databases** live in one Atlas cluster: `familytree_dev` (local), `familytree_preview` (Vercel previews), `familytree` (production), plus a throwaway `familytree_test_<run-id>` per test run.

## Server and data layer (as built)

- `src/server/db.ts`: `getDatabase()` returns the app's shared, cached client and database (from `MONGODB_URI` / `MONGODB_DB`). `openDatabase(name)` opens a separate connection to a named database, for tests and scripts; they must close it, and scripts call `closeDatabase()`. A `Database` is `{ client, db }`: the client is needed for transactions.
- IDs: MongoDB documents use `ObjectId`; everything in `src/tree/` and every `Operation` uses 24-character hex strings. Conversion happens only in `loadGroupTree` (`src/server/repositories/family.ts`, documents → `GroupTree`, with soft-deleted people removed) and in `planOperations` (refs → `ObjectId`). Use `toObjectId()` (`src/server/ids.ts`); it throws `InvalidIdError`, which callers treat as "not found".
- `applyOperations` (`src/server/operations/apply.ts`): zod (`schema.ts`), then load the group's records in a transaction, then the pure `planOperations` (`plan.ts`), then bulk writes. Throws `OperationError` with the failing change's index. It does not check permissions yet; callers will call `requireRole` first (step 5).
- `operationsFromFamily()` turns `FamilyData` with its own ids into operations with `new:<id>` temporary ids. The seed uses it now, and imports will use it in step 10.
- Database reads in pages go inside `<Suspense>` after `await connection()` (see `src/app/dev/tree/db/page.tsx`), so they happen at request time and never during the build.

## Deployment

- `vercel.json` pins the framework to Next.js. With the wrong dashboard preset, Vercel fails with "No Output Directory named "public" found".
- Vercel environment variables (owner-managed):
  - `MONGODB_DB` is `familytree` in Production and `familytree_preview` in Preview.
  - `BETTER_AUTH_URL` is set only in Production (`https://family-tree-with-ai.vercel.app`); preview URLs vary per branch.
  - `BETTER_AUTH_SECRET` differs between Production and Preview.
  - `E2E_TEST_LOGIN` is never set on Vercel.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, `npm test`, `npm run test:db` and e2e, using the `MONGODB_URI` repository secret (a read/write test user).

## Testing conventions

- Unit tests sit next to the code as `*.test.ts(x)` under `src/`, or under `test/`. Vitest uses jsdom by default; pure-logic tests start with `// @vitest-environment node`, and the database config always uses node. `async` Server Components can't be unit-tested in Vitest, so cover them with e2e tests.
- E2E specs live in `e2e/`. Each e2e run gets its own database: `playwright.config.ts` names it, `e2e/global-setup.ts` seeds the sample family into it, the web server gets it as `MONGODB_DB`, and `e2e/global-teardown.ts` removes it.
- Database integration tests are `*.db.test.ts`, run only by `npm run test:db` (`vitest.db.config.mts`). Use `createTestDatabase()` from `@test/db`, which gives each file its own database, and call `drop()` in `afterAll`. The database user can't drop databases, so test databases are emptied collection by collection (`emptyDatabase`).
- `applyOperations` rules go in the pure `planOperations` (`src/server/operations/plan.ts`) and are unit-tested there. The `.db.test.ts` tests cover transactions, persistence and group isolation.
- `test/fixtures/cruz-young.ts` holds the 36 people from the sample tree image: a same-sex couple, a divorce and remarriage, and in-law parents. It is the shared test data, and the §6 worked examples are its assertions. Import it as `@test/fixtures/...` (tsconfig alias). `test/fixtures/generated.ts` builds large synthetic families.
- `src/app/dev/*` pages (e.g. `/dev/tree`, the layout playground) return 404 unless running `next dev` or built with `ENABLE_DEV_PAGES=1`. Playwright's web server sets that flag, so e2e tests can use them.
- The tree e2e test saves `test-results/screenshots/tree.png`. View it after layout or card changes and compare with the sample image.
- Planned: a test-only sign-in for Playwright, enabled only by `E2E_TEST_LOGIN=1` and never on Vercel.
- `samples/` (reference images) is git-ignored, so tests and CI must not depend on it.
