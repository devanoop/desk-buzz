# DeskBuz

Anonymous employer reviews and salary transparency, backed by real
government wage data (US BLS, US DOL LCA, UK ONS) with clear source and
licence attribution on every figure — never blended into an undifferentiated
number. See [docs/audit/PHASE1-ARCHITECTURE.md](docs/audit/PHASE1-ARCHITECTURE.md)
for the full architecture writeup and [docs/data-sources.md](docs/data-sources.md)
for what each data source covers and its licence.

## Deploying

### Railway (primary target)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/devanoop/desk-buzz)

The button above only works once this repository is **public** on GitHub —
Railway's one-click deploy reads directly from the repo. If it doesn't work,
deploy manually instead:

1. `railway init` (or create a project in the Railway dashboard) from this repo.
2. Add a Postgres service (`railway add` → Postgres, or from the dashboard).
   Railway wires `DATABASE_URL` into your app service automatically.
3. Set `CSRF_SECRET` on the app service: `railway variables set CSRF_SECRET=$(openssl rand -hex 32)`.
4. Deploy: `railway up`. Railway builds from the committed `Dockerfile` and
   uses `railway.json` for the start command and `/health` healthcheck.
5. Migrations and the sample-data seed run automatically on every container
   start (`docker-entrypoint.sh`) — nothing else to do.

**Cost:** Hobby plan usage-based pricing. A single small web service plus a
small Postgres instance at low traffic typically lands well under $20/month
(Railway's Hobby plan includes $5/month of usage before metered billing).

### Render (alternate)

Uses the committed `render.yaml` blueprint (Docker web service + managed
Postgres):

1. Render dashboard → **New → Blueprint**, point it at this repo.
2. Render provisions both services from `render.yaml` and generates
   `CSRF_SECRET` for you (`generateValue: true`); `DATABASE_URL` is wired
   from the Postgres service automatically.
3. Migrations and the seed run on every container start, same as Railway.

**Cost:** `starter` plan for both the web service (~$7/month) and Postgres
(~$7/month) ≈ **$14/month**. Render also offers `free` tiers for both, but
the free web service spins down on idle and the free Postgres expires after
90 days — fine for a demo, not for a real deployment.

### Fly.io (alternate)

Uses the committed `fly.toml`:

```sh
fly launch --no-deploy   # accept the existing fly.toml when prompted
fly postgres create --name deskbuz-db --vm-size shared-cpu-1x --volume-size 1
fly postgres attach deskbuz-db --app deskbuz   # wires DATABASE_URL
fly secrets set CSRF_SECRET=$(openssl rand -hex 32) --app deskbuz
fly deploy
```

**Cost:** one `shared-cpu-1x`/512MB machine plus a single-node Postgres
volume is typically **$5–15/month** depending on region and Fly's current
free allowance, comfortably under the $20/month target.

## Local development

### One-command bring-up (recommended)

```sh
docker compose up --build
```

This builds the same `Dockerfile` used in production, starts Postgres, runs
migrations, and loads the committed sample salary dataset (a few thousand
rows across BLS OEWS, DOL LCA, and ONS ASHE — see
[docs/data-sources.md](docs/data-sources.md)). The app is at
http://localhost:3000 with real, working salary/review data — no manual
seeding required. Uses a fixed dev-only `CSRF_SECRET` baked into
`docker-compose.yml`; never reuse it anywhere real.

### Without Docker

```sh
npm install
cp .env.example .env
# edit .env: point DATABASE_URL at a local Postgres, set CSRF_SECRET
npm run db:migrate
npm run ingest              # loads the committed sample dataset (idempotent)
npm run dev
```

## Creating the first admin

There's no signup-time "make me admin" option by design — a superuser role
shouldn't be grantable through a public form. Instead:

1. Sign up for a normal account through the running app (`/signup`).
2. Grant the role from the command line:
   ```sh
   npm run grant-admin -- you@example.com
   # or, running inside the Docker container:
   docker compose exec app npm run grant-admin -- you@example.com
   ```
   Pass `--role=moderator` instead of the default `admin` if that's what you
   need. The full role matrix (`anonymous` / `user` / `moderator` / `admin`)
   is documented in
   [docs/audit/PHASE1-ARCHITECTURE.md](docs/audit/PHASE1-ARCHITECTURE.md).
3. Sign in at `/admin/login` with that account.

## Running ingestion

```sh
npm run ingest                                    # all sources, seed mode (fast, no network, default)
npm run ingest -- --source=bls-oews --mode=full    # re-downloads and parses the live BLS OEWS release
npm run ingest -- --source=dol-lca --mode=full --fiscal-year=2026 --quarter=3
npm run ingest -- --source=ons-ashe --mode=full
```

Every source is independently runnable and idempotent — re-running never
duplicates rows (each ingested record carries a deterministic dedupe key).
Before running `--mode=full` against a source, re-check
[docs/data-sources.md](docs/data-sources.md): download URLs and formats for
government data releases change between release years.

## Environment variables

See [.env.example](.env.example) for the full list with descriptions.
`DATABASE_URL` and `CSRF_SECRET` are required; everything else is optional
with sane defaults.

## Tests, lint, typecheck

```sh
npm run test
npm run lint
npx tsc --noEmit
```
