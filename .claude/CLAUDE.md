# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Start here

Three docs drive all work. Read the relevant parts before changing anything:

- **[BUILD_PLAN.md](BUILD_PLAN.md)**: the 12-step build plan and its Progress table. Only step 1 (the skeleton) exists so far; most of the architecture below is still planned.
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: the blueprint (code layout §4, data model §5, sheet rules §6, layout §7, permissions §8, flows F1–F12, AI chat §10, environments §12, env vars §13, open questions §15). Folder names, collections and function names come from here.
- **[Features.txt](Features.txt)**: the owner's requirements plus the agreed DECISIONS section.

## Working agreement with the owner

- Build one BUILD_PLAN step at a time. At the end of a step, stop: show the test results and a short "try this" list, and wait for the owner's OK.
- After the OK: commit to a `step-N-<name>` branch and push it (Vercel builds a preview). Merge to `main` only after the owner checks the preview, because `main` deploys production.
- When a step settles a design question, update ARCHITECTURE.md (the relevant section and §15), Features.txt DECISIONS, and the BUILD_PLAN Progress table in the same commit.
- The AI chat model is `claude-haiku-5-5`, chosen by the owner to keep costs near zero. Don't switch models without asking.

## Commands

```bash
npm run dev                 # dev server, port 3000
npm run lint
npm run typecheck           # `next typegen` first: global types like LayoutProps<"/"> are generated
npm test                    # Vitest, single run (npm run test:watch for watch mode)
npx vitest run src/app/page.test.tsx      # one test file
npx vitest run -t "landing page"          # tests matching a name
npm run build
npm run test:e2e            # Playwright: builds, then serves on port 3100 (dev uses 3000)
npx playwright test e2e/home.spec.ts      # one e2e file (also builds first)
```

## Environment gotchas (owner's machine)

- **Port binding is sandboxed.** The Claude Code sandbox on this machine blocks opening local ports, so `npm run build` (Turbopack spawns a worker on a port) and `npm run test:e2e` fail inside it with `Operation not permitted`. The owner allowlists them as `exact_match`, so run them exactly as written, on their own: no `cd …&&`, no `timeout` prefix, nothing chained.
- **No Google Fonts.** The network proxy blocks `fonts.googleapis.com`, so `next/font/google` breaks the local build. The app uses the system font stack; self-host any font from an npm package instead.
- **Playwright browser.** Playwright's own browser download is blocked, so locally it runs against the installed Google Chrome (`channel: "chrome"` unless `CI`). CI installs Playwright's Chromium.
- **Slow npm.** Installs through the private registry mirror can take several minutes; use long timeouts.

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

## Testing conventions

- Unit tests sit next to the code as `*.test.ts(x)` under `src/`, or under `test/`. Vitest uses jsdom. `async` Server Components can't be unit-tested in Vitest, so cover them with e2e tests.
- E2E specs live in `e2e/`.
- Planned:
  - `test/fixtures/cruz-young.ts` holds the 34 people from the sample tree image: a same-sex couple, a divorce and remarriage, and in-law parents. It is the shared test data, and §6's worked examples become its assertions.
  - A test-only sign-in for Playwright, enabled only by `E2E_TEST_LOGIN=1` and never on Vercel.
  - `src/app/dev/*` pages that return 404 outside `next dev`.
- `samples/` (reference images) is git-ignored, so tests and CI must not depend on it.
