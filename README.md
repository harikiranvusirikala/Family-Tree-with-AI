# Family Tree with AI

A web app where a family builds its tree together. People are added by hand or by chatting with an AI assistant, laid out automatically, and shared privately with relatives through their Google accounts.

**Live:** https://family-tree-with-ai.vercel.app

- **Requirements and decisions:** [Features.md](Features.md)
- **Design (code layout, data model, permissions, flows):** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Build plan and progress:** [BUILD_PLAN.md](BUILD_PLAN.md)

Built with Next.js 16 (TypeScript, React 19), Tailwind CSS, React Flow and ELK.js, MongoDB Atlas, Better Auth (Google sign-in), Cloudinary and the Claude API, hosted on Vercel.

## What works so far

All 11 steps are built:

- **Sign in with Google.** A link opened while signed out comes back after signing in.
- **Family groups.** Create one with the father's and mother's names (and yourself as their child). It starts with two pinned sheets, "<Father>'s family" and "<Mother>'s family". The dashboard lists My groups and Shared with me. The Owner can rename or delete a group.
- **Sheets.** Each person is stored once; a sheet shows a root person's ancestors, their descendants and partners, laid out automatically like the sample tree. Switching tabs is instant.
- **Editing by hand.** Click a person to edit them, add parents, a partner (with their own sheet if they married in) or a child, show them on another sheet, or delete them (with Undo). Click a heart to mark a couple divorced. Create, rename, pin and reorder sheets.
- **Photos.** Add, change or remove a person's photo from their panel. It uploads straight to Cloudinary, and cards show a round, face-cropped thumbnail.
- **Sharing.** Admins invite relatives by email and share the link (WhatsApp, text); it works only for that Google account. Someone who opens a tree link without access can request it, and Admins approve or deny. Admins manage roles and remove people, the Owner can hand the group to someone else, and anyone else can leave.
- **AI chat.** "Ask AI" opens an assistant beside the tree. Ask about the family, or tell it about someone new ("Priya married Ravi"): it asks when a name is ambiguous, then proposes the changes on a card, and nothing is saved until you press Confirm. Viewers can ask questions only. 50 messages per person per day.
- **Import and export.** Download a sheet or the whole group as GEDCOM (for Ancestry, FamilySearch, MyHeritage and others) or as the app's own JSON, and import either into a group or a new one, with a preview that finds possible duplicates first. Everyone can save a sheet as a picture or print it to PDF.
- **Day and night themes.** Day, Night or Follow device, from the switch in the top bar.
- **Roles.** View, Maintain, Admin and Owner, checked on the server for every request. Viewers see the tree without edit controls.
- **Nightly backups.** An encrypted backup of the live database every night, kept 90 days, each one trial-restored before it's kept (below).
- **Hardening.** Security headers on every page (a Content Security Policy among them), and a smoke test of the live site after every deployment.

## Getting started

Requires Node.js 24 or newer, a MongoDB Atlas cluster, a Google Cloud OAuth client, and optionally a free Cloudinary account (photos) and an Anthropic API key (AI chat).

```bash
npm install
cp .env.example .env.local   # then fill it in (below)
npm run db:ping              # checks the database connection
npm run db:setup             # creates the indexes (safe to repeat)
npm run seed                 # optional: the sample family, viewable at /dev/tree/db
npm run dev                  # http://localhost:3000
```

In `.env.local` you need, for now:

- `MONGODB_URI` and `MONGODB_DB=familytree_dev`.
- `BETTER_AUTH_SECRET` (for example `openssl rand -base64 32`) and `BETTER_AUTH_URL=http://localhost:3000`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The OAuth client must list `http://localhost:3000/api/auth/callback/google` as a redirect URI.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, from Cloudinary's Console (Settings → API Keys). Without them the app works, but shows initials instead of photos and offers no photo buttons.
- `CHAT_API_KEY` (an Anthropic API key; set a monthly spending limit in the Anthropic Console), `CHAT_MODEL=claude-haiku-5-5` and `CHAT_DAILY_LIMIT=50`. Without the key there's no "Ask AI". It isn't called `ANTHROPIC_API_KEY` because a Claude Code session that loads `.env.local` would use that name itself.

Open the app at `http://localhost:3000`, not `127.0.0.1`: Google and the session cookie treat them as different sites. Keep local settings in `.env.local` only; Next.js also loads a `.env` file as a fallback for anything missing.

[.env.example](.env.example) lists every variable.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types, then runs the TypeScript compiler |
| `npm test` | Unit tests (Vitest); no database needed |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:db` | Database integration tests against MongoDB Atlas (`*.db.test.ts`), each file in its own throwaway database |
| `npm run test:e2e` | End-to-end tests (Playwright). Builds the app, serves it on port 3100 with a throwaway seeded database, and signs test users in through a fixture (there is no test-login route in the app). Photos go to a local stand-in for Cloudinary on port 3101, and the AI chat to a stand-in for the Claude API on port 3102 |
| `npm run test:ai-live` | One real conversation with the chat model, run by hand (costs well under a cent; needs `CHAT_API_KEY`) |
| `npm run db:ping` | Checks the connection in `.env.local` |
| `npm run db:setup` | Creates the collections' indexes (safe to repeat) |
| `npm run seed` | Loads the sample family into `MONGODB_DB`; view it at `/dev/tree/db` |
| `npm run test:smoke` | Checks the live site as a signed-out visitor: security headers, sign-in, signed-out refusals (`SMOKE_URL` for another site) |
| `npm run backup` | Writes an encrypted backup of `familytree` to `backups/` (needs `MONGODB_BACKUP_URI` and `BACKUP_ENCRYPTION_KEY`); normally run by the nightly workflow |
| `npm run restore -- <file> …` | Restores a backup (below) |

The database and end-to-end tests need `MONGODB_URI`. The end-to-end tests use your installed Google Chrome locally and Playwright's own Chromium on CI. Against a remote Atlas cluster, each save takes a few seconds from a laptop, so the tests allow up to 15 seconds per check.

## Deployment

Vercel deploys automatically from GitHub:

- A push to `main` updates production (database `familytree`).
- A push to any other branch gets its own preview URL (database `familytree_preview`). Google sign-in on previews goes through production with Better Auth's OAuth proxy, so Google needs only the localhost and production redirect URIs.
- When a step adds indexes, run `npm run db:setup` against `familytree_preview` and `familytree` (set `MONGODB_DB` to each) before merging.

[vercel.json](vercel.json) pins the framework to Next.js, so the build doesn't depend on the Framework Preset in the Vercel dashboard. With the wrong preset, Vercel treats the app as a static site and fails with "No Output Directory named "public" found".

GitHub Actions:

- [ci.yml](.github/workflows/ci.yml) runs lint, type-check, unit tests, database tests and end-to-end tests on every push, using a `MONGODB_URI` repository secret for a separate test user.
- [backup.yml](.github/workflows/backup.yml) makes the nightly backup (below).
- [smoke.yml](.github/workflows/smoke.yml) runs `npm run test:smoke` against the live site after each production deployment.

Secrets live only in `.env.local` (git-ignored), Vercel environment variables and GitHub Secrets. Which variables go where is in [BUILD_PLAN.md](BUILD_PLAN.md#environments-and-secrets) and [ARCHITECTURE.md §13](ARCHITECTURE.md#13-configuration).

## Backups

Every night at 02:47 India time (21:17 UTC), [backup.yml](.github/workflows/backup.yml) backs up the production database `familytree`. It uses a read-only database user (the `MONGODB_BACKUP_URI` secret), encrypts the file with `BACKUP_ENCRYPTION_KEY`, restores it into a throwaway MongoDB inside the runner to prove it works, and keeps it 90 days as the run's artifact. Photos aren't included; they live in Cloudinary. Run it any time from Actions → Nightly backup → Run workflow. If a run fails, GitHub emails you.

**Keep the key in your password manager.** Without it no backup can be read.

To restore, download the run's `backup-<date>` artifact, unzip it, then in your terminal (with `MONGODB_URI` in `.env.local`):

```bash
npm run restore -- familytree-<time>.ftbackup --check              # a trial: restores into a throwaway database, compares counts, empties it
npm run restore -- familytree-<time>.ftbackup familytree_restored  # into a new database
npm run restore -- familytree-<time>.ftbackup familytree --replace # over production, replacing what's there
```

It asks for the key (typing isn't shown), refuses a database that already has records unless given `--replace`, and checks every collection's count against the file. Sessions aren't backed up, so after a restore everyone signs in again.

## npm registry

`.npmrc` keeps `package-lock.json` free of registry download URLs. Each machine then installs from its own configured registry: a private mirror on a work machine, the public npm registry on Vercel and CI. After an install, `grep -c '"resolved"' package-lock.json` should print `0`.
