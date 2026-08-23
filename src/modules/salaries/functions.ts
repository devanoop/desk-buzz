import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  companies,
  dataSources,
  occupations,
  salaryBenchmarks,
  salaryReports,
} from "../db/schema";
import { requireVerifiedEmail } from "../auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "../auth/rate-limit";
import { getSharedOccupationNormalizer } from "../ingestion/normalizer-instance";
import { MIN_SAMPLE_SIZE } from "../ingestion/aggregate";

async function resolveOccupationId(jobTitle: string): Promise<string | null> {
  const match = getSharedOccupationNormalizer().normalize(jobTitle);
  if (!match) return null;
  const db = getDb();
  const row = await db.query.occupations.findFirst({
    where: eq(occupations.socCode, match.socCode),
  });
  return row?.id ?? null;
}

export const submitSalaryReport = createServerFn({ method: "POST" })
  .middleware([requireVerifiedEmail])
  .inputValidator((data: unknown) =>
    z
      .object({
        companySlug: z.string().min(1),
        jobTitle: z.string().trim().min(1).max(120),
        experienceYears: z.coerce.number().min(0).max(60),
        country: z.string().trim().length(2).default("US"),
        region: z.string().trim().max(120).optional().default(""),
        city: z.string().trim().max(120).optional().default(""),
        payAmount: z.coerce.number().positive().max(100_000_000),
        payCurrency: z.string().trim().length(3),
        payPeriod: z
          .enum(["annual", "month", "week", "hour"])
          .default("annual"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.userId,
      "submit-salary",
      RATE_LIMITS.submitSalary,
    );

    const db = getDb();
    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, data.companySlug),
    });
    if (!company) throw new Error("Company not found.");

    const periodMultiplier = {
      annual: 1,
      month: 12,
      week: 52,
      hour: 2080,
    } as const;
    const annualPayNormalized =
      Math.round(data.payAmount * periodMultiplier[data.payPeriod] * 100) / 100;

    const occupationId = await resolveOccupationId(data.jobTitle);

    await db.insert(salaryReports).values({
      companyId: company.id,
      userId: context.userId,
      occupationId,
      jobTitle: data.jobTitle,
      experienceYears: String(data.experienceYears),
      country: data.country.toUpperCase(),
      region: data.region || null,
      city: data.city || null,
      payAmount: String(data.payAmount),
      payCurrency: data.payCurrency.toUpperCase(),
      payPeriod: data.payPeriod,
      annualPayNormalized: String(annualPayNormalized),
    });

    return { ok: true };
  });

const explorerFilterSchema = z.object({
  occupationId: z.string().uuid().optional(),
  companySlug: z.string().optional(),
  country: z.string().length(2).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  minExperienceYears: z.coerce.number().min(0).optional(),
  maxExperienceYears: z.coerce.number().min(0).optional(),
});

/**
 * Filters by occupation, geography, employer, seniority (Phase 3). Returns
 * ingested benchmark percentiles and community-submitted percentiles as two
 * entirely separate series, each with its own source label, licence, and
 * sample size — never merged into a single blended number, per the brief.
 */
export const salaryExplorer = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => explorerFilterSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb();

    let companyId: string | undefined;
    if (data.companySlug) {
      const company = await db.query.companies.findFirst({
        where: eq(companies.slug, data.companySlug),
      });
      companyId = company?.id;
    }

    const benchmarkConditions = [
      data.occupationId
        ? eq(salaryBenchmarks.occupationId, data.occupationId)
        : undefined,
      companyId ? eq(salaryBenchmarks.employerId, companyId) : undefined,
      data.country
        ? eq(salaryBenchmarks.country, data.country.toUpperCase())
        : undefined,
      data.region ? eq(salaryBenchmarks.region, data.region) : undefined,
      data.city ? eq(salaryBenchmarks.city, data.city) : undefined,
    ].filter((c): c is NonNullable<typeof c> => !!c);

    const benchmarkRows = await db
      .select({
        id: salaryBenchmarks.id,
        percentile: salaryBenchmarks.percentile,
        payAmount: salaryBenchmarks.payAmount,
        payCurrency: salaryBenchmarks.payCurrency,
        country: salaryBenchmarks.country,
        region: salaryBenchmarks.region,
        city: salaryBenchmarks.city,
        employerName: salaryBenchmarks.employerName,
        sampleSize: salaryBenchmarks.sampleSize,
        confidence: salaryBenchmarks.confidence,
        sourceName: dataSources.name,
        sourceLicence: dataSources.licence,
        sourceUrl: salaryBenchmarks.sourceUrl,
        occupationTitle: occupations.title,
      })
      .from(salaryBenchmarks)
      .innerJoin(dataSources, eq(salaryBenchmarks.sourceId, dataSources.id))
      .innerJoin(occupations, eq(salaryBenchmarks.occupationId, occupations.id))
      .where(
        benchmarkConditions.length > 0
          ? and(...benchmarkConditions)
          : undefined,
      )
      .limit(500);

    const reportConditions = [
      eq(salaryReports.status, "approved"),
      data.occupationId
        ? eq(salaryReports.occupationId, data.occupationId)
        : undefined,
      companyId ? eq(salaryReports.companyId, companyId) : undefined,
      data.country
        ? eq(salaryReports.country, data.country.toUpperCase())
        : undefined,
      data.region ? eq(salaryReports.region, data.region) : undefined,
      data.city ? eq(salaryReports.city, data.city) : undefined,
      data.minExperienceYears != null
        ? sql`${salaryReports.experienceYears} >= ${data.minExperienceYears}`
        : undefined,
      data.maxExperienceYears != null
        ? sql`${salaryReports.experienceYears} <= ${data.maxExperienceYears}`
        : undefined,
    ].filter((c): c is NonNullable<typeof c> => !!c);

    const [communityAgg] = await db
      .select({
        count: sql<number>`count(*)::int`,
        p10: sql<string>`percentile_cont(0.1) within group (order by ${salaryReports.annualPayNormalized})`,
        p25: sql<string>`percentile_cont(0.25) within group (order by ${salaryReports.annualPayNormalized})`,
        p50: sql<string>`percentile_cont(0.5) within group (order by ${salaryReports.annualPayNormalized})`,
        p75: sql<string>`percentile_cont(0.75) within group (order by ${salaryReports.annualPayNormalized})`,
        p90: sql<string>`percentile_cont(0.9) within group (order by ${salaryReports.annualPayNormalized})`,
        currency: sql<string>`mode() within group (order by ${salaryReports.payCurrency})`,
      })
      .from(salaryReports)
      .where(and(...reportConditions));

    // Same "suppress rather than publish a shaky number" threshold the
    // ingestion aggregation layer uses — see modules/ingestion/aggregate.ts.
    const communityData =
      communityAgg && communityAgg.count >= MIN_SAMPLE_SIZE
        ? {
            sampleSize: communityAgg.count,
            currency: communityAgg.currency,
            p10: Math.round(Number(communityAgg.p10)),
            p25: Math.round(Number(communityAgg.p25)),
            p50: Math.round(Number(communityAgg.p50)),
            p75: Math.round(Number(communityAgg.p75)),
            p90: Math.round(Number(communityAgg.p90)),
          }
        : null;

    return {
      benchmarks: benchmarkRows,
      communityData,
      coverage: {
        hasBenchmarks: benchmarkRows.length > 0,
        hasCommunityData: communityData !== null,
      },
    };
  });

export const listOccupations = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().max(100).optional().default("") }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const q = data.q.trim();
    if (!q) {
      const rows = await db
        .select({ id: occupations.id, title: occupations.title })
        .from(occupations)
        .limit(20);
      return { occupations: rows };
    }
    const rows = await db
      .select({ id: occupations.id, title: occupations.title })
      .from(occupations)
      .where(
        sql`${occupations.searchVector} @@ websearch_to_tsquery('english', ${q})`,
      )
      .limit(20);
    return { occupations: rows };
  });
