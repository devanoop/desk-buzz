## THE PROMPT

You are working on **Desk Buzz**, an employer-review and salary-transparency application (a Glassdoor-style product). Your job is to audit the existing codebase and then rebuild it into a deployable, data-backed application.

Work in phases. **Stop at the end of each phase and wait for my approval before starting the next.** Do not skip ahead.

---

### PHASE 0 — Read-only codebase audit

Do not modify, create, or delete any file in this phase. Read only.

Produce a written audit at `docs/audit/PHASE0-AUDIT.md` covering:

1. **Stack inventory** — languages, frameworks, runtime versions, package managers, build tooling. Flag anything unmaintained or past end-of-support.
2. **Repository map** — directory structure with a one-line purpose for each top-level folder. Identify dead code, duplicated logic, and vendored dependencies.
3. **Data model** — every entity, its fields, and relationships. Reconstruct the schema from migrations/ORM models. Note missing indexes, absent constraints, and denormalisation.
4. **Routes & API surface** — every endpoint or page route, its method, auth requirement, and what it does. Mark which are dead or unreachable.
5. **Authentication & authorisation** — how identity works today, session/token handling, password storage, whether roles exist, and every place an authz check is missing.
6. **Existing salary/review functionality** — what already works, what is stubbed, what is broken.
7. **Data sources** — where any current salary or company data comes from. Is it seeded, scraped, manually entered, or absent?
8. **Configuration & secrets** — every environment variable, and any secret committed to the repo (list file and line; do not print the secret value).
9. **Deployment state** — Dockerfiles, CI config, host-specific files, build scripts. Is this currently deployable anywhere?
10. **Test coverage** — what tests exist and what they actually cover.
11. **Security findings** — injection risks, missing rate limits, IDOR, unvalidated input, XSS surfaces, exposed admin routes. Ranked by severity.
12. **Verdict** — for each subsystem: `keep`, `refactor`, or `rewrite`, with one sentence of reasoning.

End the audit with a **Top 10 issues** list ranked by risk.

**STOP. Wait for my review.**

---

### PHASE 1 — Target architecture

Based on the audit, propose the target architecture in `docs/audit/PHASE1-ARCHITECTURE.md`. Constraints:

- Must run on a **single small container plus one managed Postgres instance**. No Kubernetes, no message broker, no separate search cluster, no Redis unless you justify why Postgres cannot do the job.
- Prefer a **modular monolith** over microservices.
- Total monthly hosting cost target: **under USD 20** at low traffic.
- Must deploy to **Railway** as the primary target, with **Render** and **Fly.io** as documented alternates.
- Full-text search via Postgres `tsvector`. Do not add Elasticsearch.
- Background jobs via a Postgres-backed queue or a scheduled task, not a separate worker service, unless justified.

Include: chosen stack with reasoning, module boundaries, the full target ER diagram, and a migration path from the current schema (with a data-preservation plan if there is existing data worth keeping).

**STOP. Wait for my approval of the architecture before writing code.**

---

### PHASE 2 — Salary data ingestion layer

Build a **source-agnostic ingestion pipeline**. Every salary record must carry provenance. Never blend sources into an undifferentiated number.

**Required schema for salary records:**

| Field                                      | Notes                                                        |
| ------------------------------------------ | ------------------------------------------------------------ |
| `source_id`                                | FK to a `data_sources` table                                 |
| `source_licence`                           | e.g. `public-domain-usgov`, `OGL-3.0`, `CC-BY-4.0`           |
| `source_url`                               | Where it was fetched from                                    |
| `ingested_at`                              | Timestamp                                                    |
| `country`, `region`, `city`                | Geography                                                    |
| `occupation_code`, `occupation_title`      | Normalised                                                   |
| `employer_name`, `employer_id`             | Nullable — only some sources are employer-level              |
| `pay_amount`, `pay_currency`, `pay_period` | Normalised to annual for display                             |
| `percentile`                               | p10/p25/p50/p75/p90 where the source provides a distribution |
| `sample_size`                              | Nullable                                                     |
| `confidence`                               | Derived: `high` / `medium` / `low`                           |

**Sources to implement adapters for.** Before writing each adapter, fetch the source's current landing page and confirm the download URL, file format, and licence terms are still what I've described — these change between release years. Record what you find in `docs/data-sources.md`.

1. **US BLS Occupational Employment and Wage Statistics (OEWS)** — US federal government work, public domain. Occupation × geography wage distributions. This is your backbone for US occupation-level data.
2. **US DOL OFLC H-1B / LCA disclosure data** — public domain, published quarterly. **Employer-level** salaries with job title and worksite. This is the only major open source that gives you "what does Company X pay for role Y," which is what makes the product useful. Note the bias clearly: it covers only visa-sponsored roles at sponsoring employers.
3. **UK ONS Annual Survey of Hours and Earnings (ASHE)** — Open Government Licence. Occupation × region, no employer detail.
4. **O\*NET** — CC BY 4.0. Use for the occupation taxonomy and title normalisation, not for pay.

**Coverage honesty requirement:** there is **no open, employer-level salary dataset for India**. MoSPI's Periodic Labour Force Survey gives broad occupation and sector bands only. Do not fabricate Indian employer salary data, do not extrapolate US figures into INR, and do not present a bare currency conversion as local market data. Where a country has no coverage, the UI must say so plainly and fall back to user-contributed submissions.

**Deliverables:**

- One adapter module per source, each independently runnable.
- An occupation-title normaliser mapping free-text titles to O\*NET/SOC codes.
- An aggregation layer computing percentiles per (occupation, geography, employer?) with a minimum sample-size threshold below which figures are suppressed rather than shown.
- Idempotent ingestion — re-running must not duplicate rows.
- A committed **sample dataset** small enough for the repo (a few thousand rows) so the app is useful immediately on first deploy, plus a full-ingest command for production.

---

### PHASE 3 — Application rebuild

**Public surface:**

- Company profiles: overview, aggregate rating, review list, salary ranges by role.
- Salary explorer: filter by occupation, geography, employer, seniority. Show the distribution and the sample size, not just a single number. Always display which source the figure came from.
- Review submission: rating dimensions (compensation, management, work-life balance, culture, career growth), pros/cons free text, employment status, job title, tenure.
- Search across companies, roles, and locations.
- Every salary figure displays its source and licence attribution inline. Every aggregate displays its sample size.

**Authentication and roles:**

- `anonymous` — read-only.
- `user` — submits own reviews and salary reports; can edit or delete their own within a defined window.
- `moderator` — approves, rejects, and redacts submissions; cannot author content.
- `admin` — everything, plus posts reviews on behalf of employees (see below).

Use email + password with a proper KDF (argon2id or bcrypt), email verification, secure session cookies, CSRF protection, and rate limiting on auth and submission endpoints.

**Admin-on-behalf submission — implement with these guardrails, they are not optional:**

- Every review row carries `submission_source` with values `self_submitted`, `admin_on_behalf`, or `imported`.
- Reviews with `admin_on_behalf` or `imported` render with a **visible badge** on the public page indicating they were not directly self-submitted. Do not hide this behind a tooltip.
- An immutable `audit_log` table records: acting admin ID, timestamp, target review ID, action, and a required free-text `justification` field the admin must fill (e.g. "transcribed from paper exit-survey, ref #1182").
- Admins cannot edit the text of a `self_submitted` review. They may only redact (which stores the original and marks the redaction in the audit log).
- Rate-limit admin-on-behalf creation and surface a count of such reviews per company on the admin dashboard.
- A company-facing "dispute this review" flow that flags a review for moderator attention.

**Admin dashboard:** moderation queue, user management, ingestion job status and history, per-company review counts split by submission source, audit log viewer.

**Also required:** structured logging, a `/health` endpoint, input validation on every write path, and tests for the auth boundary, the authz matrix, the aggregation maths, and each ingestion adapter.

---

### PHASE 4 — One-click deployment

Primary target **Railway**:

- `railway.json` (or `railway.toml`) with build and start commands and a healthcheck path.
- A Dockerfile — multi-stage, non-root user, small final image. Do not rely on buildpack auto-detection.
- Postgres provisioned as a Railway service, wired via `DATABASE_URL`.
- Migrations and the sample-data seed run automatically on release, and must be safe to re-run.
- A `Deploy on Railway` button in the README pointing at the template URL. Note in the README that this requires the repo to be public.

Alternates, both committed and both tested:

- `render.yaml` blueprint (web service + Postgres).
- `fly.toml` plus deploy instructions.

Also produce:

- `.env.example` with every variable documented and no real values.
- A README covering local setup, running ingestion, creating the first admin, and the cost expectation on each host.
- A one-command local bring-up (`docker compose up` or equivalent) that gives a working app with sample data.

---

### Standing rules for all phases

- Commit at the end of each phase with a descriptive message. Never force-push.
- If the audit contradicts something I've assumed above, say so and stop rather than working around it silently.
- Prefer boring, well-supported libraries over clever ones.
- No secrets in the repo, ever.
- If you cannot verify a data source's licence, do not ship the adapter — flag it for me instead.
- When you finish a phase, summarise what changed, what you deferred, and what you need from me.

Begin with Phase 0.
