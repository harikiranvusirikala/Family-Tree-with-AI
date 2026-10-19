# Family Tree with AI

A web app where a family builds its tree together. People are added by hand or by chatting with an AI assistant, laid out automatically, and shared privately with relatives through their Google accounts.

**Live:** https://family-tree-with-ai.vercel.app

- **Requirements and decisions:** [Features.txt](Features.txt)
- **Design (code layout, data model, permissions, flows):** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Build plan and progress:** [BUILD_PLAN.md](BUILD_PLAN.md)

Built with Next.js 16 (TypeScript, React 19), Tailwind CSS, React Flow and ELK.js, MongoDB Atlas, Better Auth (Google sign-in), Cloudinary and the Claude API, hosted on Vercel.

## What works so far

Steps 1–8 of 11 are built:

- **Sign in with Google.** A link opened while signed out comes back after signing in.
- **Family groups.** Create one with the father's and mother's names (and yourself as their child). It starts with two pinned sheets, "<Father>'s family" and "<Mother>'s family". The dashboard lists My groups and Shared with me. The Owner can rename or delete a group.
- **Sheets.** Each person is stored once; a sheet shows a root person's ancestors, their descendants and partners, laid out automatically like the sample tree. Switching tabs is instant.
- **Editing by hand.** Click a person to edit them, add parents, a partner (with their own sheet if they married in) or a child, show them on another sheet, or delete them (with Undo). Click a heart to mark a couple divorced. Create, rename, pin and reorder sheets.
- **Photos.** Add, change or remove a person's photo from their panel. It uploads straight to Cloudinary, and cards show a round, face-cropped thumbnail.
- **Sharing.** Admins invite relatives by email and share the link (WhatsApp, text); it works only for that Google account. Someone who opens a tree link without access can request it, and Admins approve or deny. Admins manage roles and remove people, the Owner can hand the group to someone else, and anyone else can leave.
- **Roles.** View, Maintain, Admin and Owner, checked on the server for every request. Viewers see the tree without edit controls.

Still to come: the AI chat, import and export, and nightly backups.

## Getting started

Requires Node.js 24 or newer, a MongoDB Atlas cluster, a Google Cloud OAuth client and, for photos, a free Cloudinary account.

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

Open the app at `http://localhost:3000`, not `127.0.0.1`: Google and the session cookie treat them as different sites. Keep local settings in `.env.local` only; Next.js also loads a `.env` file as a fallback for anything missing.

[.env.example](.env.example) lists every variable, including the ones later steps need (the Claude API).

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
| `npm run test:e2e` | End-to-end tests (Playwright). Builds the app, serves it on port 3100 with a throwaway seeded database, and signs test users in through a fixture (there is no test-login route in the app). Photos go to a local stand-in for Cloudinary on port 3101 |
| `npm run db:ping` | Checks the connection in `.env.local` |
| `npm run db:setup` | Creates the collections' indexes (safe to repeat) |
| `npm run seed` | Loads the sample family into `MONGODB_DB`; view it at `/dev/tree/db` |

The database and end-to-end tests need `MONGODB_URI`. The end-to-end tests use your installed Google Chrome locally and Playwright's own Chromium on CI. Against a remote Atlas cluster, each save takes a few seconds from a laptop, so the tests allow up to 15 seconds per check.

## Deployment

Vercel deploys automatically from GitHub:

- A push to `main` updates production (database `familytree`).
- A push to any other branch gets its own preview URL (database `familytree_preview`). Google sign-in on previews goes through production with Better Auth's OAuth proxy, so Google needs only the localhost and production redirect URIs.
- When a step adds indexes, run `npm run db:setup` against `familytree_preview` and `familytree` (set `MONGODB_DB` to each) before merging.

[vercel.json](vercel.json) pins the framework to Next.js, so the build doesn't depend on the Framework Preset in the Vercel dashboard. With the wrong preset, Vercel treats the app as a static site and fails with "No Output Directory named "public" found".

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, type-check, unit tests, database tests and end-to-end tests on every push, using a `MONGODB_URI` repository secret for a separate test user.

Secrets live only in `.env.local` (git-ignored), Vercel environment variables and GitHub Secrets. Which variables go where is in [BUILD_PLAN.md](BUILD_PLAN.md#environments-and-secrets) and [ARCHITECTURE.md §13](ARCHITECTURE.md#13-configuration).

## npm registry

`.npmrc` keeps `package-lock.json` free of registry download URLs. Each machine then installs from its own configured registry: a private mirror on a work machine, the public npm registry on Vercel and CI. After an install, `grep -c '"resolved"' package-lock.json` should print `0`.
