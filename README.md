# collections

Application used to manage merchandise collections at DoCSoc.

This is a Next.js Application that allows us to manage merchandise collections securely. Designed to be ran as a docker container with a Postgres DB (via the Prisma ORM).

Once deployed, it allows us to control committee member access, import items from eActivities CSV exports, and mark item as collected.

> [!NOTE]
> This app was moved here from the `collection/` folder of the [docsoc-tools](https://github.com/icdocsoc/docsoc-tools) monorepo. See [Migration notes](#migration-notes-from-docsoc-tools) below for what changed.

# ⚠️ Before going to production: remove the test auth override

> [!CAUTION]
> There is a **test-only login override** in this repo that lets anyone log in as `docsoc@ic.ac.uk` without SSO when `AUTH_OVERRIDE_TEST_LOGIN=true` is set.
> It was added to test the app after the move out of the monorepo and **must be removed before going to prod**.

Every piece of it is tagged with `AUTH_OVERRIDE`, so `grep -rn AUTH_OVERRIDE .` (excluding `node_modules`/`.next`) will find it all:

1. Delete `lib/auth-override.ts`
2. Delete the lines tagged `AUTH_OVERRIDE` in `auth.ts` and `app/auth/login/page.tsx`
3. Delete the `AUTH_OVERRIDE_TEST_LOGIN` block from `.env.local.template` and this section of the README

When enabled, the server also prints a large `AUTH_OVERRIDE ENABLED` warning on startup and the login page shows a `⚠️ TEST OVERRIDE` button.

# Quick Start

## Local

1. Install [pnpm](https://pnpm.io/installation) 12 (e.g. `npm install -g pnpm@12`) and run `pnpm install` (use the Node version in `.nvmrc`, Node 24). This also generates the Prisma client into `generated/prisma` (`postinstall`); re-run `pnpm prisma:generate` after changing `prisma/schema.prisma`.
2. Copy `.env.local.template` to `.env.local` and fill in the details
    - To test without Microsoft SSO, set `AUTH_OVERRIDE_TEST_LOGIN=true` (**test only**, see above) and use the "TEST OVERRIDE" login button
3. `pnpm prisma:deploy` to create the database tables (or `pnpm prisma:push`). The Prisma CLI reads `.env.local` via `prisma.config.ts`.
4. `pnpm dev` to start the dev server

Other scripts:

| Script                   | What it does                              |
| ------------------------ | ----------------------------------------- |
| `pnpm build`             | Production build (`output: "standalone"`) |
| `pnpm start`             | Start a production build                  |
| `pnpm lint`              | ESLint (`eslint.config.mjs`)              |
| `pnpm typecheck`         | `tsc --noEmit`                            |
| `pnpm test`              | Jest unit tests                           |
| `pnpm prisma:migrate`    | Create & apply a new migration (dev)      |
| `pnpm prisma:deploy`     | Apply pending migrations                  |
| `pnpm prisma:studio`     | Open Prisma Studio                        |

## Docker

1. Copy `.env.local.template` to `.env.local` and fill in the details
2. From the root of this repo run `docker compose -f dev.docker-compose.yml up`. This start a dev docker compose instance that has the source code _mounted_ into it: meaning you need not rebuild the docker image every time you make a change!
3. Visit `http://localhost:3000` in your browser and login with the root user you setup in the `.env.local` file
4. To run future DB migrations in docker compose run `docker exec -i $(docker ps -qf "name=docsoc-collection" | head -n1) pnpm exec prisma migrate dev --name migration-name`

# CI

`.github/workflows/ci.yml` runs on every pull request and push to `main`:

1. **Checks** (in parallel): lint, typecheck, unit tests and a Next.js build
2. **Docker image**: builds the image (layer cache in GitHub Actions) and smoke-tests it against a Postgres service
3. **Publish** (`main` only, or a manual run on `main`): pushes the image to `ghcr.io/icdocsoc/collections` (tags `latest`, `main`, `sha-<commit>`) with a signed build provenance attestation (verify with `gh attestation verify oci://ghcr.io/icdocsoc/collections:latest -R icdocsoc/collections`)

# Docker

To build the production docker image, run `docker build -t docsoc/collection .` from the root of the repo.

When running the image, set the env vars from `.env.local.template` (plus `AUTH_TRUST_HOST=true` or `AUTH_URL` for Auth.js). Migrations are not run on container start: run `pnpm exec prisma migrate deploy` against the database separately.

# What `emails/` for?

This is for sending reminder emails to those who haven't collected their merch yet. It uses the `docsoc-mailmerge` CLI (published to npm as `@docsoc/mailmerge-cli` from the docsoc-tools repo).

Usage:

```bash
cd emails
pnpm dlx tsx getUncollectedPeople.ts # outputs a JSON file to output/reminders.json
docsoc-mailmerge generate nunjucks ./data/reminders.json ./templates/reminder.njk -s json -o output -n reminders
# then send (check README in emails folder)!
```

# Migration notes (from docsoc-tools)

The application code was copied over as-is. The changes needed to make it work standalone were:

-   **Dependencies**: the app had no `package.json` of its own (it shared the monorepo root one). `package.json` now contains only the dependencies the app actually uses, and `package-lock.json` was derived from the monorepo lockfile so every package resolves to the **same version** as before. Nx and its plugins were removed.
-   **Internal libraries** were copied into the app rather than consumed as packages:
    -   `@docsoc/eactivities` (`common/eactivities/src`) → `lib/eactivities/` (including its unit tests). Imports changed from `@docsoc/eactivities` to `@/lib/eactivities`.
    -   `@docsoc/util` → only `createLogger` was used, so `common/util/src/logger.ts` → `lib/logger.ts`. Imports changed to `import createLogger from "@/lib/logger"`.
-   **Config** merged from the monorepo root and the app folder:
    -   `tsconfig.json`: root `tsconfig.base.json` + app `tsconfig.json`, minus the monorepo path aliases
    -   `.eslintrc.json`: `next` + `next/core-web-vitals` (from the app) plus the TypeScript rules that `plugin:@nx/typescript` used to provide
    -   `jest.config.js`: now uses `next/jest` instead of the Nx preset
    -   `next.config.js`: `withNx` wrapper removed (it was a no-op with `svgr: false`), everything else unchanged
    -   `.prettierrc`, `.nvmrc`: copied from the monorepo root
-   **Docker**: `Dockerfile`, `dev.docker-compose.yml` and `scripts/compose-entry.sh` updated to use `npm`/`npx prisma`/`next` directly instead of `nx`.
-   **Not yet carried over** (planned as follow-ups): CI and container image publishing (`.github/workflows/ci.yml` in docsoc-tools), the Playwright e2e skeleton (`collection-e2e`, which only had a placeholder test).

Since the move, all dependencies have been upgraded (Next.js 16, React 19, Prisma 7, Mantine 9, TanStack Table 9, ...) and the repo uses pnpm instead of npm; the config files mentioned above have changed accordingly (e.g. `eslint.config.mjs`, `jest.config.mjs`, `prisma.config.ts`).
