# Family Tree with AI

A web app where a family builds its tree together. People are added by hand or by chatting with an AI assistant, laid out automatically, and shared privately with relatives through their Google accounts.

- **Requirements and decisions:** [Features.txt](Features.txt)
- **Design (data model, permissions, flows):** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Build plan and progress:** [BUILD_PLAN.md](BUILD_PLAN.md)

Built with Next.js (TypeScript), Tailwind CSS, MongoDB Atlas, Better Auth (Google sign-in), Cloudinary and the Claude API, hosted on Vercel.

## Getting started

Requires Node.js 24 or newer.

```bash
npm install
cp .env.example .env.local   # fill in values as each build step needs them
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types, then runs the TypeScript compiler |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | End-to-end tests (Playwright). Builds the app and serves it on port 3100 |

The end-to-end tests use your installed Google Chrome locally, and Playwright's own Chromium on CI.

## Deployment

Vercel deploys automatically from GitHub:

- A push to `main` updates production.
- A push to any other branch gets its own preview URL.

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, type-check, unit tests and end-to-end tests on every push.

Secrets live only in `.env.local` (git-ignored), Vercel environment variables and GitHub Secrets. [.env.example](.env.example) lists them all.

## npm registry

`.npmrc` keeps `package-lock.json` free of registry download URLs. Each machine then installs from its own configured registry: a private mirror on a work machine, the public npm registry on Vercel and CI.
