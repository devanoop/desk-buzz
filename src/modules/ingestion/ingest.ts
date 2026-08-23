import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  companies,
  dataSources,
  ingestionJobs,
  occupations,
  salaryBenchmarks,
} from "../db/schema";
import type {
  AdapterRunResult,
  BenchmarkPoint,
  OccupationRecord,
} from "./types";

/**
 * Deterministic identity for one data point, used as the upsert key so
 * re-running ingestion against the same (or an overlapping) source release
 * updates existing rows instead of duplicating them — "idempotent
 * ingestion" per the brief. Hashed rather than a raw composite string only
 * to keep the unique index compact; the inputs are exactly the fields that
 * define "the same observation."
 */
export function computeDedupeKey(sourceKey: string, p: BenchmarkPoint): string {
  const parts = [
    sourceKey,
    p.country,
    p.region ?? "",
    p.city ?? "",
    p.occupationSocCode,
    (p.employerName ?? "").trim().toLowerCase(),
    p.percentile,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function ensureDataSource(input: {
  key: string;
  name: string;
  licence: string;
  url: string;
}): Promise<string> {
  const db = getDb();
  const existing = await db.query.dataSources.findFirst({
    where: eq(dataSources.key, input.key),
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(dataSources)
    .values({
      key: input.key,
      name: input.name,
      licence: input.licence,
      url: input.url,
    })
    .returning({ id: dataSources.id });
  return row.id;
}

/** Inserts any occupations not already present (by SOC code); returns socCode -> id for all of them. */
export async function upsertOccupations(
  records: OccupationRecord[],
): Promise<Map<string, string>> {
  const db = getDb();
  const result = new Map<string, string>();
  if (records.length === 0) return result;

  const existing = await db.query.occupations.findMany();
  for (const row of existing) result.set(row.socCode, row.id);

  const missing = records.filter((r) => !result.has(r.socCode));
  const BATCH = 500;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const inserted = await db
      .insert(occupations)
      .values(
        batch.map((r) => ({
          socCode: r.socCode,
          title: r.title,
          description: r.description,
          aliases: r.aliases,
        })),
      )
      .onConflictDoNothing({ target: occupations.socCode })
      .returning({ id: occupations.id, socCode: occupations.socCode });
    for (const row of inserted) result.set(row.socCode, row.id);
  }
  return result;
}

async function findCompanyIdByExactName(name: string): Promise<string | null> {
  const db = getDb();
  const row = await db.query.companies.findFirst({
    where: sql`lower(${companies.name}) = lower(${name})`,
  });
  return row?.id ?? null;
}

export interface IngestSummary {
  // Rows successfully upserted (inserted or updated) — Postgres' RETURNING
  // clause on an ON CONFLICT DO UPDATE doesn't distinguish which happened
  // per row, and the dedupeKey guarantee (not that split) is what actually
  // matters for idempotency, so this isn't tracked separately.
  processed: number;
  occupationsSkipped: number;
}

/**
 * Upserts a batch of already-normalized, already-aggregated points into
 * salary_benchmarks, keyed on dedupeKey. Occupation FKs are resolved from
 * the occupationIdBySoc map built by upsertOccupations — a point whose SOC
 * code isn't in that map is skipped and counted rather than inserted with a
 * dangling/null reference.
 */
export async function ingestBenchmarkPoints(
  sourceKey: string,
  sourceId: string,
  sourceUrl: string,
  points: BenchmarkPoint[],
  occupationIdBySoc: Map<string, string>,
): Promise<IngestSummary> {
  const db = getDb();
  let processed = 0;
  let occupationsSkipped = 0;

  // Resolve distinct employer names to companies rows once, not per point.
  const employerIdByName = new Map<string, string | null>();
  for (const name of new Set(
    points.map((p) => p.employerName).filter((n): n is string => !!n),
  )) {
    employerIdByName.set(name, await findCompanyIdByExactName(name));
  }

  const BATCH = 500;
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const rows = batch
      .map((p) => {
        const occupationId = occupationIdBySoc.get(p.occupationSocCode);
        if (!occupationId) {
          occupationsSkipped++;
          return null;
        }
        return {
          sourceId,
          sourceUrl,
          country: p.country,
          region: p.region,
          city: p.city,
          occupationId,
          employerId: p.employerName
            ? (employerIdByName.get(p.employerName) ?? null)
            : null,
          employerName: p.employerName,
          percentile: p.percentile,
          payAmount: p.payAmount.toFixed(2),
          payCurrency: p.payCurrency,
          sampleSize: p.sampleSize,
          confidence: p.confidence,
          dedupeKey: computeDedupeKey(sourceKey, p),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length === 0) continue;

    const result = await db
      .insert(salaryBenchmarks)
      .values(rows)
      .onConflictDoUpdate({
        target: salaryBenchmarks.dedupeKey,
        set: {
          sourceUrl: sql`excluded.source_url`,
          ingestedAt: sql`now()`,
          payAmount: sql`excluded.pay_amount`,
          sampleSize: sql`excluded.sample_size`,
          confidence: sql`excluded.confidence`,
          employerId: sql`excluded.employer_id`,
        },
      })
      .returning({ id: salaryBenchmarks.id });
    processed += result.length;
  }

  return { processed, occupationsSkipped };
}

export async function recordIngestionJob(input: {
  sourceId: string;
  status: "success" | "failed";
  rowsIngested?: number;
  rowsSkipped?: number;
  errorMessage?: string;
  triggeredBy: "cron" | "manual";
  startedAt: Date;
}): Promise<void> {
  const db = getDb();
  await db.insert(ingestionJobs).values({
    sourceId: input.sourceId,
    startedAt: input.startedAt,
    finishedAt: new Date(),
    status: input.status,
    rowsIngested: input.rowsIngested,
    rowsSkipped: input.rowsSkipped,
    errorMessage: input.errorMessage,
    triggeredBy: input.triggeredBy,
  });
}

export interface RunAndIngestOptions {
  sourceKey: string;
  sourceName: string;
  sourceLicence: string;
  sourceLandingUrl: string;
  occupationRecords: OccupationRecord[];
  triggeredBy: "cron" | "manual";
}

/** Full pipeline: ensure data_source + occupations exist, then upsert points, then record the job. */
export async function runAndIngest(
  adapterResult: AdapterRunResult,
  options: RunAndIngestOptions,
): Promise<IngestSummary> {
  const startedAt = new Date();
  const sourceId = await ensureDataSource({
    key: options.sourceKey,
    name: options.sourceName,
    licence: options.sourceLicence,
    url: options.sourceLandingUrl,
  });

  try {
    const occupationIdBySoc = await upsertOccupations(
      options.occupationRecords,
    );
    const summary = await ingestBenchmarkPoints(
      options.sourceKey,
      sourceId,
      adapterResult.sourceUrl,
      adapterResult.points,
      occupationIdBySoc,
    );
    await recordIngestionJob({
      sourceId,
      status: "success",
      rowsIngested: summary.processed,
      rowsSkipped: adapterResult.rowsSkipped + summary.occupationsSkipped,
      triggeredBy: options.triggeredBy,
      startedAt,
    });
    return summary;
  } catch (err) {
    await recordIngestionJob({
      sourceId,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      triggeredBy: options.triggeredBy,
      startedAt,
    });
    throw err;
  }
}
