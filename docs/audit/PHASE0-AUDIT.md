# Phase 0 — Read-Only Codebase Audit

**Subject:** DeskBuz (repo root: `DeskBuz_ Your Company Insights`)
**Audit date:** 2026-08-23
**Method:** Full read of every source file, migration, and config in the repo. No files were modified for this audit.

---

## 1. Stack inventory

| Layer | Choice | Version | Notes |
|---|---|---|---|
| UI runtime | React | 19.2.0 | Current major. |
| App framework | TanStack Start | 1.167.50 | SSR + server functions, file-based routing via TanStack Router 1.168.25. |
| Build | Vite | 7.3.1 | Configured through `@lovable.dev/vite-tanstack-config` 2.5.3 — a closed preset that bundles the TanStack Start plugin, React plugin, Tailwind plugin, path aliases, and Cloudflare-targeted Nitro. The actual Vite config in this repo is 8 lines; all real behavior is hidden inside that package. |
| Server build | Nitro | `3.0.260603-beta` | **Pinned to a beta/pre-release version.** Per the comment in `vite.config.ts:2`, Nitro's default build target is **Cloudflare Workers**, not Node/Docker. This directly conflicts with Phase 1's Railway/Render/Fly target and will need explicit reconfiguration. |
| Styling | Tailwind CSS | 4.2.1 | CSS-first `@theme inline` config in `src/styles.css`, no `tailwind.config.js`. |
| Component kit | shadcn/ui ("new-york" style, `components.json`) | — | 45 primitives generated into `src/components/ui/`; **only 11 are actually imported anywhere in the app** (see §2). |
| Data/auth backend | Supabase JS | 2.107.0 | Postgres + Auth + RLS. No self-hosted DB layer. |
| Auth broker | `@lovable.dev/cloud-auth-js` | 1.1.2 | Wraps Google/Apple/Microsoft OAuth through Lovable's own hosted broker (`src/integrations/lovable/index.ts`), then hands a session to Supabase. This is a **hard dependency on the Lovable platform for social login** — it will not function once the app leaves Lovable Cloud, independent of which Supabase project is used. |
| Forms/validation | Zod 3.24.2 | — | Used consistently in every server function input validator. |
| Language | TypeScript | 5.8.3 | Strict-ish; `tsc --noEmit` currently passes clean. |
| Lint/format | ESLint 9 (flat config) + Prettier 3.7 | — | Present and configured. |
| Package manager | **Ambiguous** | — | Both `bun.lock` (180 KB) and `package-lock.json` (321 KB) are committed, plus a `bunfig.toml`. Nothing in `package.json` declares `packageManager` or `engines`. Two contributors using different tools will silently drift on transitive versions. |
| Node version | **Unpinned** | — | No `.nvmrc`, no `engines.node`. Verified working on Node 22.19.0 in this audit environment; nothing in-repo enforces or documents that requirement. |

**Flagged as unmaintained / risky to keep as-is:**
- `nitro@3.0.260603-beta` — pre-release, and its default deploy target (Cloudflare) is wrong for the Phase 1 constraints.
- Dual lockfiles (`bun.lock` + `package-lock.json`) — pick one, delete the other, commit `packageManager` in `package.json`.
- `@lovable.dev/cloud-auth-js` and `@lovable.dev/mcp-js`-adjacent tooling — fine while on Lovable, a rewrite blocker the moment the app leaves that platform (see §6, §9).

**Declared but dead dependencies** (present in `package.json`, zero non-generated-primitive usage — see §2 for the mechanism): `react-hook-form`, `@hookform/resolvers`, `embla-carousel-react`, `recharts`, `input-otp`, `vaul`, `react-resizable-panels`, `react-day-picker`, `cmdk`. All forms in this app (`ReviewForm`, `SalaryForm`, admin forms) are hand-rolled with `useState`, not `react-hook-form`, despite it being installed.

---

## 2. Repository map

```
src/
  components/            Shared app components (Navbar, Footer, forms, auth)
  components/ui/         45 shadcn primitives — only 11 used (see below)
  hooks/                 1 hook (use-mobile)
  integrations/lovable/  Lovable OAuth broker wrapper
  integrations/supabase/ Supabase clients (browser, server/service-role), generated DB types, auth middleware
  lib/                   Server functions (*.functions.ts), moderation rules, error plumbing
  routes/                File-based routes (TanStack Router) — one file per URL
  routeTree.gen.ts        Auto-generated, 355 lines — do not hand-edit
  router.tsx, server.ts, start.ts   App bootstrap / SSR entry / global middleware wiring
  styles.css             Tailwind v4 theme tokens
supabase/
  config.toml            Points at project ref kdlcnqyksajwnyjvvmnu (Lovable-managed, not confirmed reachable from outside Lovable Cloud)
  migrations/             9 SQL files, full schema history
public/robots.txt
```

**Dead code found:**
- `src/lib/api/example.functions.ts` — Lovable-generated boilerplate (`getGreeting`). Verified zero imports anywhere else in the repo. Pure scaffolding, safe to delete.
- **34 of 45 shadcn primitives in `src/components/ui/` are imported nowhere outside that folder**: `accordion, alert, alert-dialog, aspect-ratio, avatar, breadcrumb, calendar, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, separator, sidebar, skeleton, slider, switch, table, toggle, toggle-group, tooltip`. Only `button, card, badge, dialog, input, label, select, sheet, sonner, tabs, textarea` are actually used. This is what drags in the "dead dependencies" list in §1 (`recharts` for the unused chart, `react-day-picker` for the unused calendar, etc.) — dropping the unused primitives would let those packages be removed too.
- `src/integrations/lovable/index.ts`, `src/lib/lovable-error-reporting.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/server.ts`'s `normalizeCatastrophicSsrResponse` — all exist specifically to work around **Lovable-platform-specific behavior** (h3 swallowing SSR errors, reporting exceptions to `window.__lovableEvents`). Not "dead" — they run — but they're vendor-coupling that a rewrite needs to either keep (if staying near Lovable) or strip (if going fully independent).

**Duplicated logic found:**
- **Company search/pick UI is implemented three separate times**: `src/components/CompanySearch.tsx` (homepage), `CompanyPicker` inside `src/components/ReviewForm.tsx:400-508`, and `CompanyPicker` inside `src/components/SalaryForm.tsx:313-420`. All three do the same debounced-search-then-dropdown pattern against `searchCompanies`, with near-identical JSX. Should be one shared component.
- **Slug generation is implemented twice, inconsistently**: `slugifyCompany` in `src/lib/companies.functions.ts:26-31` (used by the public `addCompany` server function, which validates via Zod) vs. `slugifyCompanyName` in `src/routes/admin.dashboard.tsx:30-40` (used by the admin "Add Company" form, which calls `supabase.from("companies").insert(...)` **directly from the browser**, bypassing `addCompany` entirely — see §5 and §11 for why that matters).
- Three near-identical route-level loading/error/not-found boilerplate blocks are repeated verbatim across `companies.$slug.index.tsx`, `companies.$slug.review.tsx`, `companies.$slug.share-salary.tsx` (the `<Navbar /><div>...</div>` error/not-found JSX).

**Vendored dependencies:** none found (no checked-in third-party source trees).

---

## 3. Data model

Reconstructed from `supabase/migrations/*.sql` (9 files, chronological) and confirmed against the generated `src/integrations/supabase/types.ts`, which is the authoritative live-schema snapshot.

### `companies`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text NOT NULL | |
| `slug` | text NOT NULL UNIQUE | |
| `industry` | text nullable | free text, not a foreign key to a taxonomy |
| `logo_url` | text nullable | **schema column exists, zero UI usage anywhere in the app** — `LogoBadge` always renders initials, never reads this field |
| `description` | text nullable | |
| `website` | text nullable | added in migration 2 |
| `created_at` | timestamptz | default `now()` |

Index: `companies_name_idx` on `lower(name)`. No index on `industry`, which `getCompanyProfile`'s peer-salary fallback filters on (`companies.functions.ts:305-322`) — fine at current scale, will matter once the companies table grows.

### `reviews`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies, `ON DELETE CASCADE` | |
| `job_title` | text NOT NULL | |
| `location` | text nullable | |
| `employment_status` | text NOT NULL | CHECK'd to `current/former/intern/contract` |
| `rating_overall` | numeric(2,1) NOT NULL | CHECK 1–5 |
| `rating_work_life`, `rating_culture`, `rating_compensation` | numeric(2,1) nullable | CHECK 1–5 each |
| `pros`, `cons` | text NOT NULL | |
| `collection_method` | text NOT NULL, default `'self-service'` | CHECK'd to `self-service/tele-calling/import/organic` — **this is the closest thing this app has to Phase 3's `submission_source` provenance field**, but it's informal (no admin badge shown on the public page for non-organic rows — see §11) |
| `verified_source_contact`, `internal_admin_notes` | text nullable | column-level `REVOKE SELECT` from `anon`/`authenticated` (migration 4) — correctly hidden from public API responses at the Postgres grant level, not just app code |
| `user_id` | uuid nullable, FK → `auth.users`, `ON DELETE SET NULL` | **added later** (migration 7); nullable, so tele-calling/imported rows have no owner and self-service rows predating this migration would also be unowned |
| `created_at` | timestamptz | |

Index: `idx_reviews_user_company_created` on `(user_id, company_id, created_at DESC)` — used by the 6-month cooldown check in `submitReview`.

**No `edited_at`, no soft-delete/`deleted_at`, no `status` (pending/approved/rejected) column.** There is no moderation queue schema at all — every review that passes the app-layer `moderateReview()` heuristic (profanity/name/title regex, §6) is inserted and immediately public. "Approve/reject" as a workflow does not exist in the data model, only in the Phase 3 spec's aspiration.

### `salaries`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies, `ON DELETE CASCADE` | |
| `job_title` | text NOT NULL | |
| `location` | text nullable | |
| `experience_years` | numeric NOT NULL | CHECK 0–60 |
| `annual_ctc_inr` | numeric NOT NULL | CHECK > 0. **Single currency, single country, single "CTC" concept baked into the column name** — no `pay_currency`, no `pay_period`, no percentile/distribution fields. |
| `created_at` | timestamptz | |

**No `user_id` column on `salaries` at all.** Unlike `reviews`, there is no ownership model for salary submissions — a submitter (even if logged in) can never edit or delete their own salary entry, and the app can never attribute a submission to a user even for abuse investigation. This is a schema gap, not just a missing feature.

### `company_aggregates`
| Column | Type | Notes |
|---|---|---|
| `company_id` | uuid PK/FK → companies, one-to-one | |
| `benchmark_rating` | numeric nullable | |
| `source` | text nullable | free-text label (e.g. `"Archive"`, defaulted in app code — `companies.functions.ts:299`) |
| `updated_at` | timestamptz | |

This table has **no `source_url`, no licence, no ingestion timestamp, no methodology** — it's a bare number with an optional free-text label, used as the profile page's rating when no local reviews exist (`getCompanyProfile`, `ratingSource: "benchmark"`). There is no server function that writes to this table — it can currently only be populated by hand via the Supabase dashboard or a one-off script not present in this repo. Where this "benchmark" data originally came from is **undocumented**; treat every existing row as unverifiable provenance.

### `user_roles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL, FK → `auth.users`, `ON DELETE CASCADE` | |
| `role` | enum `app_role` (`admin`, `moderator`, `user`) | UNIQUE `(user_id, role)` |
| `created_at` | timestamptz | |

`moderator` is defined in the enum but **no code anywhere checks for it** — `requireSupabaseAdmin` (`admin-auth.functions.ts:14-17`) only ever calls `has_role(_role: "admin")`. The moderator role is schema-only, unused.

**No table exists for**: an admin action / audit log, a moderation queue, review disputes, ingestion job tracking, data-source provenance, or occupation taxonomy. All of these are Phase 2/3 requirements with zero current schema footprint.

---

## 4. Routes & API surface

### Pages (file-based, `src/routes/`)

| Route | Auth | Purpose |
|---|---|---|
| `/` | public | Homepage — search, **hardcoded** featured companies (see §6/§7), articles |
| `/review` | client-gated (`requireAuth`) | Standalone review form, company picked inline |
| `/share-salary` | **not gated** | Standalone salary form — see §11, this is the headline finding |
| `/companies/$slug` | public | Company profile: rating, reviews, salaries tabs |
| `/companies/$slug/review` | client-gated | Review form pre-scoped to one company |
| `/companies/$slug/share-salary` | **not gated** | Salary form pre-scoped to one company |
| `/privacy`, `/terms` | public | Static legal pages |
| `/reset-password` | public (requires valid Supabase recovery session) | Password reset — **redirects to `/admin/dashboard` on success regardless of whether the user is an admin** (`reset-password.tsx:61`), a leftover from when this was presumably admin-only |
| `/admin/login` | public | Email/password sign-in + "forgot password" |
| `/admin/dashboard` | client-gated (`AdminGuard`) | Add-company form (writes directly via browser Supabase client, not a server function) |
| `/admin/tele-calling-entry` | client-gated (`AdminGuard`) | Admin-authored review entry (`collection_method: "tele-calling"`) |
| `/sitemap.xml` | public, server handler | Dynamic sitemap; queries `companies` directly with the anon key |

Every client-gated page (`AdminGuard`, `AuthGatedLink`) is a **UX convenience only** — the actual authorization boundary, where it exists, is server-side (see §5).

### Server functions (`createServerFn`, called as RPC-style POST/GET, not REST resources)

| Function | File | Method | Auth middleware | Notes |
|---|---|---|---|---|
| `searchCompanies` | `companies.functions.ts:200` | GET | none | public read, unlimited |
| `addCompany` | `companies.functions.ts:223` | POST | **none** | anyone, unauthenticated, can create a company row — by product design (RLS policy is literally named "Anyone can add a company"), but combined with zero rate limiting this is an open spam vector |
| `getCompanyProfile` | `companies.functions.ts:244` | GET | none | public read; also runs the fuzzy company-name matcher (`findCompanyByFlexibleLookup`) |
| `submitReview` | `companies.functions.ts:339` | POST | `requireSupabaseAuth` | requires a valid Bearer JWT; enforces a 6-month per-user-per-company cooldown |
| `submitSalary` | `companies.functions.ts:404` | POST | **none** | **see §11 — this is the top finding of the audit** |
| `listCompaniesForAdmin` | `admin-reviews.functions.ts:5` | GET | `requireSupabaseAdmin` | |
| `submitTeleReview` | `admin-reviews.functions.ts:26` | POST | `requireSupabaseAdmin` | |
| `isCurrentUserAdmin` | `admin-auth.functions.ts:31` | GET | `requireSupabaseAuth` | used by `AdminGuard` |
| `getGreeting` | `example.functions.ts:14` | POST | none | dead example code, unreachable from any UI |

No REST/OpenAPI surface exists — everything is a TanStack Start server function invoked via generated client-side RPC calls. There is **no `/health` endpoint**.

**Dead/unreachable:** `getGreeting` (never called from any route or component).

---

## 5. Authentication & authorisation

**Identity provider:** Supabase Auth exclusively. Email+password (Supabase's own bcrypt-based storage, not custom), plus Google OAuth routed through the Lovable auth broker (`AuthProvider.tsx:209-225`) which then calls `supabase.auth.setSession()`. Session storage is `localStorage`-persisted, auto-refreshing (`client.ts:23-26`) — a standard Supabase JS SPA session, not an httpOnly cookie. Password reset uses Supabase's magic-link recovery flow (`admin.login.tsx:80-95`, `reset-password.tsx`).

**Password policy:** minimum 6 characters, enforced only in the UI (`AuthProvider.tsx:181`, `reset-password.tsx:44`) — below current best-practice minimums (NIST SP 800-63B suggests 8+). Whatever Supabase project-level password policy is configured is the real backstop; not verifiable from this repo.

**Two parallel authorization mechanisms exist simultaneously, and they don't agree:**

1. **App-layer, via server functions using the service-role client** (`supabaseAdmin`, imported from `client.server.ts`, which uses `SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS entirely**). `requireSupabaseAuth` middleware (`auth-middleware.ts`) validates a Bearer JWT and attaches `userId`; `requireSupabaseAdmin` (`admin-auth.functions.ts`) additionally calls the `has_role` Postgres function. This is the path `submitReview`, `submitTeleReview`, `listCompaniesForAdmin`, `isCurrentUserAdmin` all use.

2. **Database-layer, via RLS policies**, which apply only when a client calls Supabase directly with the anon/publishable key — which happens in exactly one place in this codebase: `src/routes/admin.dashboard.tsx:78`, `supabase.from("companies").insert(payload)`. This bypasses `addCompany` (the server function with Zod validation) entirely and instead depends on the RLS `INSERT` policy's raw length checks (migration `5aa092d5`).

**Consequence of running two systems:** the RLS policies (which are reasonably well-written — length checks, `internal_admin_notes IS NULL` guards, column-level `REVOKE SELECT` on sensitive review fields) are **dead code for every write that goes through a server function**, because the service-role client ignores RLS by definition. They only protect the one direct-client write path. If a future contributor adds a new server function using `supabaseAdmin` without replicating the equivalent validation in Zod, there is no RLS safety net catching it — the safety net only exists for a code path the app barely uses.

**Confirmed authorization gaps:**
- **`submitSalary` has no auth middleware at all** (`companies.functions.ts:404-435`) despite `SalaryForm.tsx` calling `requireAuth()` client-side before allowing submission. Anyone can call this server function directly with no session/token and it will succeed, because there's no `.middleware([requireSupabaseAuth])` and the write goes through the service-role client (no RLS to catch it either). This is the single biggest gap in the app — see §11.
- The `reviews` RLS `INSERT` policy (`5aa092d5-...sql:7-19`) does **not** constrain `user_id = auth.uid()`. An authenticated user calling the Supabase REST API directly with their own anon key (trivially obtainable — it ships in the client bundle) could insert a review row with an arbitrary `user_id`, impersonating another user in the `reviews.user_id` column. The app's own server-function path sets `user_id` correctly from the verified JWT (`companies.functions.ts:386`), so this is only exploitable by bypassing the app UI — but the anon key being public means that bypass costs nothing.
- `GRANT UPDATE, DELETE ON companies/reviews/salaries TO authenticated` (migration 1 & 2) is still in effect and was **never revoked**, even though no `UPDATE`/`DELETE` RLS policy was ever created for any of these tables. Currently inert (RLS denies by default absent a matching policy), but it's a live footgun: the moment anyone adds an `UPDATE` or `DELETE` policy to any of these tables for *any* reason, every authenticated user instantly gets that same privilege on *every* row, because the blanket grant is still sitting there from the first migration.
- The admin dashboard's "Add Company" form provides **no additional privilege** over the public, unauthenticated `addCompany` flow — the RLS policy it depends on is `TO anon, authenticated`, identical to what any anonymous visitor already has. `AdminGuard` here is UX only, not a security boundary, which is fine *only* because the underlying action is already intentionally public — but it means the admin dashboard doesn't actually do anything an anonymous user with `curl` couldn't already do.
- First-admin bootstrapping is entirely manual (a direct `insert into public.user_roles` via SQL console) — there is no server function, script, or documented CLI command for it anywhere in the repo.

**CSRF:** low risk by construction — auth is Bearer-token-in-header (attached client-side in `auth-attacher.ts`), not an ambient cookie, so a third-party site cannot forge these requests without already having the token. No explicit CSRF token exists, but none is architecturally necessary given this auth transport.

**Rate limiting: none, anywhere.** Not on auth endpoints, not on `addCompany`, not on `submitReview`, not on `submitSalary`, not on `submitTeleReview`, not on search. Whatever throttling exists is whatever Supabase Auth applies internally to its own endpoints — nothing in this app's code limits repeated calls to any server function.

---

## 6. Existing salary/review functionality — what actually works today

**Works, end-to-end, against the real database:**
- Company search/add (`CompanySearch`, `addCompany`) — functional, public.
- Company profile page — real query against `reviews`, `salaries`, and `company_aggregates`, with a real (if simplistic) fallback chain: local review average → benchmark rating → nothing.
- Review submission — functional, requires login, has a 6-month cooldown per (user, company), runs a **client- and server-duplicated** heuristic moderator (`review-moderation.ts`, regex-based profanity/personal-name/title detection, min 75 chars each field). This is not real moderation — it's a same-request input filter, not a queue anyone reviews afterward. If a review clears the regexes, it's live immediately and permanently (no edit, no delete, from either the user or an admin, anywhere in the codebase).
- Salary submission — functional, **no login actually enforced server-side** (see §5/§11).
- Admin tele-calling entry — functional, admin-only, writes with `collection_method: "tele-calling"` and private fields (`verified_source_contact`, `internal_admin_notes`) that are correctly hidden from public reads at the Postgres grant level.

**Stubbed or absent:**
- Moderation queue: does not exist. No `status` column, no admin UI to review/approve/reject anything already posted.
- Editing or deleting your own review/salary: not implemented in the UI or the server functions, even though `reviews.user_id` exists and could support it.
- The `collection_method`/provenance badge Phase 3 asks for ("visible badge... not behind a tooltip" for non-self-submitted content): **the public company profile page does not render `collection_method` at all** — a tele-calling-entered review looks visually identical to an organic one on `/companies/$slug`. The data exists (`reviews.collection_method`); the disclosure UI does not.
- Audit log for admin actions: no table, no writes, nothing.
- Dispute flow ("flag this review"): does not exist anywhere.
- `moderator` role: defined in the DB enum, checked by zero application code.

**Broken/misleading (not a bug in the crash sense, but functionally wrong):** the homepage's "Popular Companies in India," "Top Rated Product Companies," and "Highest Average Salaries" sections (`src/routes/index.tsx:60-85`, the `FEATURED`, `TOP_RATED`, `HIGHEST_SALARIES` constants) are **hardcoded TypeScript literals**, not queries against `companies`/`reviews`/`salaries`. Every rating (e.g. Zoho 4.2★), every salary figure (e.g. "Google · 32.0 LPA · SDE-II avg"), and every company-to-industry mapping shown on the homepage is fabricated placeholder content with no connection to the actual database. See §7 and the Top 10 list — this is the most important single finding in this audit.

---

## 7. Data sources

There is currently **no external data ingestion of any kind** — no BLS, DOL, ONS, or O\*NET adapters, no scraper, no import script, nothing resembling Phase 2's ingestion layer. Every number the app can legitimately show comes from exactly two places:

1. **User-submitted content** via `submitReview` / `submitSalary` (organic, unauthenticated-for-salary as noted).
2. **Manually admin-entered content** via `submitTeleReview` (`collection_method: "tele-calling"`) or the admin "Add Company" form.

The `company_aggregates.benchmark_rating` table (§3) is the closest thing to a third "external" source, but it has no documented origin, no source URL, no licence field, and no ingestion code anywhere in this repo — whatever rows exist there today were put in by hand, and the app labels them to the user only as `"Archive"` or whatever free-text string happens to be in the `source` column.

**The homepage's featured/top-rated/highest-salary content (§6) is not sourced from anywhere at all — it's authored copy, not data.** This matters distinctly from "we have no ingestion pipeline yet": it's not an absence of data, it's the presence of fake data presented with the same visual authority as real reviews (star ratings, LPA figures, "SDE-II · Avg" role labels) on the page most visitors will land on first.

---

## 8. Configuration & secrets

**Environment variables referenced in code:**

| Variable | Where read | Required for |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | `client.ts:8`, `client.server.ts:9`, `auth-middleware.ts:12`, `sitemap[.]xml.ts:27` | client + server Supabase connection |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | same files | anon-key client |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts:10` | service-role (RLS-bypassing) client — used by nearly every server function |
| `NODE_ENV` | `config.server.ts:21` | read but unused beyond echoing it back from the dead `getGreeting` example |

`.env` is **not committed** (confirmed: no `.env`, `.env.local`, or similar tracked in git history prior to this audit — a `.env` with blank placeholders and a `.gitignore` excluding it were added during this session's earlier local-setup work, not found pre-existing). No `.env.example` exists in the repo, which Phase 4 will need to add.

**Secrets committed to the repo: none found.** A pattern scan for common secret shapes (Stripe `sk_live_`/`sk_test_`, AWS `AKIA...`, PEM private key headers, GitHub `ghp_` tokens) across `src/`, `supabase/`, and `public/` returned zero matches. `supabase/config.toml` contains only a project *reference ID* (`kdlcnqyksajwnyjvvmnu`), which is not itself a credential.

**Config hygiene notes:**
- `config.server.ts:24` has a commented-out `stripeSecretKey` placeholder — no billing/payments code exists anywhere else in the app; this is unused scaffolding, not evidence of a real Stripe integration.
- `src/routes/sitemap[.]xml.ts:5` hardcodes `BASE_URL = "https://deskbuz.com"` — will silently produce a wrong sitemap if deployed under any other domain.
- No secrets manager, no `.env.vault`, no reference to any external secrets store — plain process-env only, which is fine for the target (Railway/Render/Fly all support env-var injection) but worth stating explicitly for Phase 4's `.env.example`.

---

## 9. Deployment state

**Not currently deployable to any host without new work.** Specifically:

- No `Dockerfile`.
- No `railway.json`/`railway.toml`, no `render.yaml`, no `fly.toml`.
- No `.github/workflows` — no CI at all (no lint-on-PR, no typecheck-on-PR, no test-on-PR, because there are no tests — see §10).
- The one deploy-relevant signal that *does* exist is a comment in `vite.config.ts:2` stating the bundled Nitro config defaults to **Cloudflare Workers** as its build target — which is a fully different runtime model (edge, no persistent filesystem, no long-lived Node process) from the single-container target Phase 1 specifies. This isn't neutral-absence, it's an active mismatch that needs to be explicitly overridden, not just filled in.
- `src/server.ts` is written against a generic `fetch(request, env, ctx)` handler shape, which is Cloudflare/Workers-style, not a Node HTTP server — reinforcing that the current build target assumption is edge, not container.

This repo was built and iterated on entirely inside Lovable Cloud, which handled hosting, env injection, and (per `integrations/lovable/`) auth brokering transparently. None of that infrastructure travels with the exported code.

---

## 10. Test coverage

**Zero.** No test framework is installed (`package.json` has no `vitest`, `jest`, `playwright`, `@testing-library/*`, or any test runner). No file matching `*.test.*` or `*.spec.*` exists anywhere in `src/`. No test script beyond `lint`/`format` in `package.json`'s `scripts`. There is nothing to describe coverage *of* — this section is a clean slate, not a gap in an existing suite.

---

## 11. Security findings, ranked by severity

**Critical**
1. **`submitSalary` has no authentication check** (`src/lib/companies.functions.ts:404`). Any anonymous request directly to this server function succeeds — the client-side `requireAuth()` gate in `SalaryForm.tsx` is cosmetic. Combined with zero rate limiting, this is directly exploitable for automated salary-data spam/pollution today, with no login required, contradicting the UI's own stated requirement.

**High**
2. **No rate limiting anywhere** — `addCompany`, `submitReview`, `submitSalary`, `submitTeleReview`, `searchCompanies`, and Supabase Auth calls are all unthrottled by this app. `addCompany` is public by design *and* unlimited, so scripted spam-company creation costs an attacker nothing.
3. **`reviews` RLS INSERT policy doesn't scope `user_id` to `auth.uid()`** (migration `5aa092d5-...sql:7-19`) — a caller hitting Supabase's REST API directly with the (public) anon key can attribute a review to any `user_id` they choose. Not exploitable through the app's own UI, but the anon key is public by nature, so "through the app's UI" isn't the actual attack surface.
4. **Stale `GRANT UPDATE, DELETE ... TO authenticated`** on `companies`, `reviews`, `salaries` (migrations 1–2, never revoked) with no matching RLS policy currently defined. Inert today; becomes a blanket-privilege-escalation trap for whoever adds the first UPDATE/DELETE policy on any of these tables without separately auditing this grant.

**Medium**
5. **No moderation queue / no edit-after-post / no delete** for reviews or salaries — once heuristic moderation passes (or is bypassed via the unauthenticated `submitSalary` path), content is permanent. Compounded by finding #1: unauthenticated users can post permanent, unremovable salary data.
6. **Admin-authored content is not visually disclosed on the public page.** `reviews.collection_method` exists and correctly distinguishes `organic` from `tele-calling`, but the company profile page renders all reviews identically regardless of this field — a direct predecessor gap to Phase 3's mandatory "visible badge" requirement.
7. **Password minimum is 6 characters**, enforced client-side only (`AuthProvider.tsx:181`, `reset-password.tsx:44`), below current best-practice guidance.
8. **`/reset-password` redirects every successful password change to `/admin/dashboard`** (`reset-password.tsx:61`) regardless of whether the user has admin access — a non-admin user resetting their password lands on a page `AdminGuard` will immediately bounce them out of. Not a security hole (the guard still enforces correctly), but it's a broken flow that suggests this page was written admin-only and never generalized.

**Low**
9. No structured logging (scattered `console.error` calls only) — fine for a single-developer prototype, will not scale to a moderation/audit workflow.
10. `src/integrations/lovable/index.ts` and friends give the Lovable platform an OAuth trust relationship baked into the client bundle — not a vulnerability per se, but worth naming explicitly as an external trust dependency during a security review.

**Not a finding, noted for completeness:** XSS surface is low — React escapes by default, and the only `dangerouslySetInnerHTML` in the codebase (`src/components/ui/chart.tsx:73`, an **unused** shadcn primitive per §2) injects static CSS custom properties, not user-controlled content. SQL injection risk is low — all database access goes through the Supabase JS query builder (parameterized), no raw SQL string concatenation anywhere in application code.

---

## 12. Verdict per subsystem

| Subsystem | Verdict | Reasoning |
|---|---|---|
| Build/deploy tooling (Vite/Nitro config) | **Rewrite** | Currently pre-wired to Cloudflare Workers via the Lovable preset; Phase 1's container+Postgres target needs a from-scratch Dockerfile/Nitro-Node config, not a patch. |
| Auth (Supabase email/password) | **Keep** | Sound foundation — proper KDF via Supabase, working session flow, working password reset. Extend, don't replace. |
| Auth (Google via Lovable broker) | **Rewrite** | Hard-coupled to Lovable Cloud; won't function standalone. Replace with direct Supabase OAuth (or drop social login) if leaving Lovable. |
| Authorization model (server-fn + RLS dual system) | **Refactor** | The server-function/service-role pattern is fine as the primary model; the parallel, weaker RLS path (used only by the admin dashboard's direct insert) should be either brought up to the same rigor or eliminated in favor of routing everything through validated server functions. |
| Data model (`companies`, `reviews`, `salaries`, `company_aggregates`, `user_roles`) | **Refactor** | Solid core shape, real gaps: no ownership on `salaries`, no moderation-status column, no audit log, no provenance fields on `company_aggregates`. Extend rather than replace. |
| Review/salary submission flows | **Refactor** | Functionally works end-to-end for reviews; salary path needs the auth fix (§11 #1) before anything else. Both need edit/delete and real moderation state added. |
| Homepage content (`FEATURED`/`TOP_RATED`/`HIGHEST_SALARIES`) | **Rewrite** | Hardcoded fabricated data presented as real. Must become live queries (or be removed) before this is a trustworthy product — see Top 10 #1. |
| UI component library (shadcn primitives) | **Refactor** | Keep the 11 actually-used primitives; delete the other 34 and their associated dependencies (`recharts`, `react-day-picker`, `embla-carousel-react`, `cmdk`, `vaul`, `input-otp`, `react-resizable-panels`) to cut real bundle weight and audit surface. |
| Company search UX (3 duplicated implementations) | **Refactor** | Consolidate into one shared component; behavior is correct, code is copy-pasted three times. |
| Admin dashboard / tele-calling entry | **Refactor** | Functional and reasonably well-guarded server-side for tele-calling; the "Add Company" form should be rewired to call `addCompany` instead of writing directly via the browser client. |
| Data ingestion (BLS/DOL/ONS/O\*NET) | **Rewrite (new)** | Does not exist. This is Phase 2 in full. |
| Legal pages (privacy/terms) | **Keep** | Substantive, India-specific (DPDP Act, IT Act intermediary status), well-written. No code changes needed, just keep them accurate as the product changes. |
| Test suite | **Rewrite (new)** | Zero tests exist; nothing to preserve. |
| CI/CD, Dockerfile, host configs | **Rewrite (new)** | None exist. This is Phase 4 in full. |

---

## Top 10 issues, ranked by risk

1. **Homepage shows fabricated company ratings and salary figures as if they were real data** (`src/routes/index.tsx`). This is the single most visible integrity problem in the product — every visitor's first impression of "real reviews and salary insights from real employees" is contradicted by the page they land on.
2. **`submitSalary` has no authentication enforcement** — anyone can post permanent salary data with no login, despite the UI implying login is required. (`companies.functions.ts:404`)
3. **No rate limiting on any write endpoint** — `addCompany`, `submitReview`, `submitSalary`, `submitTeleReview` are all open to scripted abuse.
4. **No moderation workflow exists** — content goes live immediately and permanently; there is no queue, no status field, no way to remove or edit anything once posted, by anyone, ever.
5. **RLS `reviews` INSERT policy doesn't bind `user_id` to the caller's own identity** — a direct-API caller can forge attribution.
6. **The app has no deployment path** — no Dockerfile, no CI, no Railway/Render/Fly config, and the one build-target signal present (Nitro's Cloudflare default) actively points the wrong direction for Phase 1's constraints.
7. **Zero test coverage** — no safety net for the rebuild that Phases 1–4 are about to perform.
8. **Admin-on-behalf content (`collection_method: "tele-calling"`) is not visually disclosed to the public** — reviews look identically "organic" regardless of whether an employee or an admin wrote them.
9. **Stale broad `UPDATE`/`DELETE` grants** on core tables sit inert only because no RLS policy currently exists to activate them — a live footgun for the next schema change.
10. **Significant unused surface area** — 34 of 45 UI primitives and 9 of ~15 production dependencies are dead weight, and 3 near-identical company-picker implementations exist where one would do. Not a risk in itself, but it inflates the audit surface for everything above it and should be trimmed before or during the rebuild, not after.

---

**STOP. Awaiting review before Phase 1.**
