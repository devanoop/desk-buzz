import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  pgEnum,
  unique,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Phase 2 (ingestion) tables, plus Phase 3 (application) tables in the same
// file/schema — one database, one place authorization/shape lives, per the
// Phase 1 architecture decision.

// Postgres tsvector has no first-class Drizzle column type; this is a thin
// wrapper so generated search columns below can declare one. Never written
// to directly — always populated via generatedAlwaysAs().
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

// to_tsvector(regconfig, text) and array_to_string() are only STABLE in
// Postgres's catalog, so Postgres rejects any expression that calls them
// directly inside a GENERATED ALWAYS AS (...) STORED expression with
// "generation expression is not immutable" — and critically, wrapping the
// call in your own IMMUTABLE function only hides *that* function's own
// body from the check; a non-immutable call left in one of the *arguments*
// still poisons the outer expression's computed volatility. So each
// search_vector below is a single call to a dedicated IMMUTABLE SQL
// function (deskbuz_company_search_vector / deskbuz_occupation_search_vector)
// that takes plain columns as arguments and does all the to_tsvector /
// array_to_string work inside its own body, where Postgres trusts the
// declared volatility instead of inspecting it. These functions are
// created by CREATE FUNCTION statements hand-added to the top of
// drizzle/migrations/0000_*.sql (Drizzle has no schema-builder concept of
// a function, so it can't generate them on its own).

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    industry: text("industry"),
    description: text("description"),
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Powers "search across companies" (Phase 3) — Postgres tsvector per the
    // Phase 1 architecture decision (no Elasticsearch).
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`deskbuz_company_search_vector(name, industry, description)`,
    ),
  },
  (t) => [index("companies_search_idx").using("gin", t.searchVector)],
);

export const occupations = pgTable(
  "occupations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // O*NET-SOC code, e.g. "15-1252.00" — kept in its native dotted form.
    socCode: text("soc_code").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    // Free-text titles known to map to this occupation (from O*NET's
    // sample_of_reported_titles.csv), used by the title normalizer.
    aliases: text("aliases").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Powers "search across ... roles" (Phase 3).
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): ReturnType<typeof sql> =>
        sql`deskbuz_occupation_search_vector(title, aliases)`,
    ),
  },
  (t) => [index("occupations_search_idx").using("gin", t.searchVector)],
);

export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable machine-readable id used by the CLI and adapters, e.g. "bls-oews".
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  licence: text("licence").notNull(),
  url: text("url").notNull(),
  lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
});

export const confidenceEnum = pgEnum("confidence_level", [
  "high",
  "medium",
  "low",
]);
export const percentileEnum = pgEnum("percentile_point", [
  "p10",
  "p25",
  "p50",
  "p75",
  "p90",
]);

export const salaryBenchmarks = pgTable(
  "salary_benchmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id),
    // The exact file URL this row was ingested from — distinct from
    // data_sources.url (the general landing page), since that file changes
    // every release cycle and each row should carry what actually produced it.
    sourceUrl: text("source_url").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    country: text("country").notNull(), // ISO 3166-1 alpha-2, e.g. "US", "GB"
    region: text("region"), // state / UK region
    city: text("city"),

    occupationId: uuid("occupation_id")
      .notNull()
      .references(() => occupations.id),

    employerId: uuid("employer_id").references(() => companies.id),
    // Raw employer name as reported by the source, kept even when it couldn't
    // be matched to a companies row (most sources are occupation-only anyway).
    employerName: text("employer_name"),

    percentile: percentileEnum("percentile").notNull(),
    payAmount: numeric("pay_amount", { precision: 12, scale: 2 }).notNull(),
    payCurrency: text("pay_currency").notNull(), // ISO 4217, e.g. "USD", "GBP"

    sampleSize: integer("sample_size"),
    confidence: confidenceEnum("confidence").notNull(),

    // Deterministic key over the natural identity of this data point
    // (source, geography, occupation, employer, percentile), used for
    // idempotent upserts. A plain multi-column unique constraint doesn't work
    // here because Postgres treats NULLs as distinct from each other, which
    // would let a re-run duplicate every row with a null region/city/employer.
    dedupeKey: text("dedupe_key").notNull().unique(),
  },
  (t) => [
    index("salary_benchmarks_occupation_country_idx").on(
      t.occupationId,
      t.country,
    ),
    index("salary_benchmarks_employer_id_idx").on(t.employerId),
  ],
);

export const jobStatusEnum = pgEnum("ingestion_job_status", [
  "running",
  "success",
  "failed",
]);
export const triggeredByEnum = pgEnum("ingestion_triggered_by", [
  "cron",
  "manual",
]);

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => dataSources.id),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: jobStatusEnum("status").notNull().default("running"),
  rowsIngested: integer("rows_ingested"),
  rowsSkipped: integer("rows_skipped"),
  errorMessage: text("error_message"),
  triggeredBy: triggeredByEnum("triggered_by").notNull().default("manual"),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash").notNull(),
  // 'argon2id' for every account created going forward. 'bcrypt' is reserved
  // for rows migrated from a legacy system, lazily upgraded to argon2id on
  // next successful login — see modules/auth/password.ts.
  passwordAlgo: text("password_algo").notNull().default("argon2id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const appRoleEnum = pgEnum("app_role", ["admin", "moderator", "user"]);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.userId, t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Only the SHA-256 hash of the session token is stored — same principle as
    // password hashing: a DB read alone can't forge a valid session cookie.
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const employmentStatusEnum = pgEnum("employment_status", [
  "current",
  "former",
  "intern",
  "contract",
]);

// Phase 3's required provenance tag — every review is exactly one of these,
// and self_submitted is the only kind an ordinary user can ever create.
export const submissionSourceEnum = pgEnum("submission_source", [
  "self_submitted",
  "admin_on_behalf",
  "imported",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
  "redacted",
]);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // Null for admin_on_behalf/imported rows, which have no submitting user.
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    jobTitle: text("job_title").notNull(),
    location: text("location"),
    employmentStatus: employmentStatusEnum("employment_status").notNull(),
    employmentTenure: text("employment_tenure"), // free text, e.g. "2 years 3 months"
    ratingOverall: numeric("rating_overall", {
      precision: 2,
      scale: 1,
    }).notNull(),
    ratingCompensation: numeric("rating_compensation", {
      precision: 2,
      scale: 1,
    }),
    ratingManagement: numeric("rating_management", {
      precision: 2,
      scale: 1,
    }),
    ratingWorkLife: numeric("rating_work_life", { precision: 2, scale: 1 }),
    ratingCulture: numeric("rating_culture", { precision: 2, scale: 1 }),
    ratingCareerGrowth: numeric("rating_career_growth", {
      precision: 2,
      scale: 1,
    }),
    pros: text("pros").notNull(),
    cons: text("cons").notNull(),
    submissionSource: submissionSourceEnum("submission_source")
      .notNull()
      .default("self_submitted"),
    status: reviewStatusEnum("status").notNull().default("pending"),
    // Pre-redaction snapshot (JSON: {pros, cons, jobTitle, ...}) — set only
    // when an admin redacts a self_submitted review. Admins can never edit
    // this text directly; redact is the only mutation available to them.
    originalText: text("original_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Self-submitted reviews can be edited/deleted by their author until this
    // timestamp; null for admin_on_behalf/imported rows (no author to edit).
    editWindowExpiresAt: timestamp("edit_window_expires_at", {
      withTimezone: true,
    }),
  },
  (t) => [
    index("reviews_company_id_idx").on(t.companyId),
    index("reviews_user_id_idx").on(t.userId),
    index("reviews_status_idx").on(t.status),
  ],
);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "resolved",
  "dismissed",
]);

export const reviewDisputes = pgTable("review_disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  // Companies have no accounts in this system — a contact (email) is how we
  // can follow up, not an authenticated identity.
  raisedByContact: text("raised_by_contact").notNull(),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Salary reports (user-submitted — distinct from ingested salary_benchmarks)
// ---------------------------------------------------------------------------

export const salaryReportStatusEnum = pgEnum("salary_report_status", [
  "pending",
  "approved",
  "rejected",
]);

export const salaryReports = pgTable(
  "salary_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    occupationId: uuid("occupation_id").references(() => occupations.id),
    jobTitle: text("job_title").notNull(),
    experienceYears: numeric("experience_years", { precision: 4, scale: 1 }),
    country: text("country").notNull().default("US"),
    region: text("region"),
    city: text("city"),
    payAmount: numeric("pay_amount", { precision: 12, scale: 2 }).notNull(),
    payCurrency: text("pay_currency").notNull(),
    payPeriod: text("pay_period").notNull().default("annual"),
    annualPayNormalized: numeric("annual_pay_normalized", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // Auto-approved by default, unlike reviews: numeric submissions carry far
    // less defamation/PII risk than free-text pros/cons, and moderation delay
    // would directly hurt this product's core value (fresh salary data).
    // Still fully subject to the same auth/validation/rate-limit boundary.
    status: salaryReportStatusEnum("status").notNull().default("approved"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("salary_reports_company_id_idx").on(t.companyId),
    index("salary_reports_occupation_id_idx").on(t.occupationId),
  ],
);

// ---------------------------------------------------------------------------
// Admin audit log — append-only. No update/delete function is ever written
// against this table anywhere in the app; enforcing that at the database
// role level (REVOKE UPDATE, DELETE) is a Phase 4 deployment hardening step.
// ---------------------------------------------------------------------------

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(), // e.g. "review.redact", "review.admin_on_behalf_create"
  targetTable: text("target_table").notNull(),
  targetId: uuid("target_id").notNull(),
  justification: text("justification").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Rate limiting — fixed-window counters, checked/incremented in the same
// transaction as the write they guard. No Redis: see Phase 1 architecture
// doc §8 for why a Postgres table is sufficient at this scale.
// ---------------------------------------------------------------------------

export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // IP address for anonymous endpoints, user id for authenticated ones.
    key: text("key").notNull(),
    endpoint: text("endpoint").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [unique().on(t.key, t.endpoint, t.windowStart)],
);
