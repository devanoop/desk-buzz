import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

// Scoped to what Phase 2 (salary ingestion) needs. Phase 3 extends this same
// file with users/sessions/reviews/etc. rather than defining a second schema.

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  description: text("description"),
  website: text("website"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const occupations = pgTable("occupations", {
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
});

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

export const salaryBenchmarks = pgTable("salary_benchmarks", {
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
});

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
