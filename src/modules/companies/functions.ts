import { createServerFn } from "@tanstack/react-start";
import { and, avg, count, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  companies,
  occupations,
  reviews,
  salaryBenchmarks,
  salaryReports,
  dataSources,
} from "../db/schema";
import { slugify } from "./slug";
import { checkRateLimit, RATE_LIMITS } from "../auth/rate-limit";
import { getRequestIP } from "@tanstack/react-start/server";

function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

/** Autocomplete-style search, ILIKE on name — forgiving of partial/prefix input as the user types. */
export const searchCompanies = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().max(100) }).parse(data),
  )
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q)
      return {
        companies: [] as Array<{
          id: string;
          name: string;
          slug: string;
          industry: string | null;
        }>,
      };

    await checkRateLimit(
      clientIp(),
      "search-companies",
      RATE_LIMITS.searchCompanies,
    );

    const db = getDb();
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        industry: companies.industry,
      })
      .from(companies)
      .where(ilike(companies.name, `%${q}%`))
      .orderBy(companies.name)
      .limit(8);
    return { companies: rows };
  });

/**
 * "Search across companies, roles, and locations" (Phase 3) — companies and
 * occupations via Postgres full-text search (tsvector, per the Phase 1
 * architecture decision). Location search lives in the salary explorer's
 * own geography filter instead: companies have no location field in this
 * schema (only individual review/salary submissions carry a city/region),
 * so there's nothing company-level to full-text-index for "location."
 */
export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().max(100) }).parse(data),
  )
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q) return { companies: [], occupations: [] };

    const db = getDb();
    const [companyRows, occupationRows] = await Promise.all([
      db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
          industry: companies.industry,
        })
        .from(companies)
        .where(
          sql`${companies.searchVector} @@ websearch_to_tsquery('english', ${q})`,
        )
        .orderBy(
          desc(
            sql`ts_rank(${companies.searchVector}, websearch_to_tsquery('english', ${q}))`,
          ),
        )
        .limit(10),
      db
        .select({
          id: occupations.id,
          title: occupations.title,
          socCode: occupations.socCode,
        })
        .from(occupations)
        .where(
          sql`${occupations.searchVector} @@ websearch_to_tsquery('english', ${q})`,
        )
        .orderBy(
          desc(
            sql`ts_rank(${occupations.searchVector}, websearch_to_tsquery('english', ${q}))`,
          ),
        )
        .limit(10),
    ]);

    return { companies: companyRows, occupations: occupationRows };
  });

export const addCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    await checkRateLimit(clientIp(), "add-company", RATE_LIMITS.addCompany);

    const db = getDb();
    const slug = slugify(data.name);
    if (!slug)
      throw new Error("Could not derive a valid URL slug from that name.");

    const [row] = await db
      .insert(companies)
      .values({ name: data.name, slug })
      .onConflictDoNothing({ target: companies.slug })
      .returning({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
      });

    if (!row) throw new Error("A company with that name already exists.");
    return { company: row };
  });

const RATING_FIELDS = {
  overall: reviews.ratingOverall,
  compensation: reviews.ratingCompensation,
  management: reviews.ratingManagement,
  workLife: reviews.ratingWorkLife,
  culture: reviews.ratingCulture,
  careerGrowth: reviews.ratingCareerGrowth,
} as const;

export const getCompanyProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, data.slug),
    });
    if (!company) return { company: null } as const;

    const [ratingRow] = await db
      .select({
        count: count(),
        overall: avg(RATING_FIELDS.overall),
        compensation: avg(RATING_FIELDS.compensation),
        management: avg(RATING_FIELDS.management),
        workLife: avg(RATING_FIELDS.workLife),
        culture: avg(RATING_FIELDS.culture),
        careerGrowth: avg(RATING_FIELDS.careerGrowth),
      })
      .from(reviews)
      .where(
        and(eq(reviews.companyId, company.id), eq(reviews.status, "approved")),
      );

    const reviewRows = await db
      .select({
        id: reviews.id,
        jobTitle: reviews.jobTitle,
        location: reviews.location,
        employmentStatus: reviews.employmentStatus,
        employmentTenure: reviews.employmentTenure,
        ratingOverall: reviews.ratingOverall,
        ratingCompensation: reviews.ratingCompensation,
        ratingManagement: reviews.ratingManagement,
        ratingWorkLife: reviews.ratingWorkLife,
        ratingCulture: reviews.ratingCulture,
        ratingCareerGrowth: reviews.ratingCareerGrowth,
        pros: reviews.pros,
        cons: reviews.cons,
        submissionSource: reviews.submissionSource,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(
        and(eq(reviews.companyId, company.id), eq(reviews.status, "approved")),
      )
      .orderBy(desc(reviews.createdAt))
      .limit(50);

    // Salary ranges by role, from approved user-submitted reports — grouped
    // by free-text job title (these aren't normalized to occupations at
    // submission time, matching how reviews' job titles work too).
    const salaryByRole = await db
      .select({
        jobTitle: salaryReports.jobTitle,
        count: count(),
        min: sql<string>`min(${salaryReports.annualPayNormalized})`,
        median: sql<string>`percentile_cont(0.5) within group (order by ${salaryReports.annualPayNormalized})`,
        max: sql<string>`max(${salaryReports.annualPayNormalized})`,
        currency: sql<string>`mode() within group (order by ${salaryReports.payCurrency})`,
      })
      .from(salaryReports)
      .where(
        and(
          eq(salaryReports.companyId, company.id),
          eq(salaryReports.status, "approved"),
        ),
      )
      .groupBy(salaryReports.jobTitle)
      .orderBy(desc(count()));

    // Ingested benchmark data matched to this specific employer (mainly
    // DOL LCA — the only source with employer-level detail). Kept entirely
    // separate from user-submitted salaryByRole above — never blended into
    // one figure, each carries its own source/licence/sample size.
    const benchmarkRows = await db
      .select({
        id: salaryBenchmarks.id,
        occupationTitle: occupations.title,
        percentile: salaryBenchmarks.percentile,
        payAmount: salaryBenchmarks.payAmount,
        payCurrency: salaryBenchmarks.payCurrency,
        sampleSize: salaryBenchmarks.sampleSize,
        confidence: salaryBenchmarks.confidence,
        sourceName: dataSources.name,
        sourceLicence: dataSources.licence,
        sourceUrl: salaryBenchmarks.sourceUrl,
      })
      .from(salaryBenchmarks)
      .innerJoin(occupations, eq(salaryBenchmarks.occupationId, occupations.id))
      .innerJoin(dataSources, eq(salaryBenchmarks.sourceId, dataSources.id))
      .where(eq(salaryBenchmarks.employerId, company.id));

    return {
      company,
      ratingSummary: {
        count: ratingRow?.count ?? 0,
        overall: ratingRow?.overall ? Number(ratingRow.overall) : null,
        compensation: ratingRow?.compensation
          ? Number(ratingRow.compensation)
          : null,
        management: ratingRow?.management ? Number(ratingRow.management) : null,
        workLife: ratingRow?.workLife ? Number(ratingRow.workLife) : null,
        culture: ratingRow?.culture ? Number(ratingRow.culture) : null,
        careerGrowth: ratingRow?.careerGrowth
          ? Number(ratingRow.careerGrowth)
          : null,
      },
      reviews: reviewRows,
      salaryByRole: salaryByRole.map((r) => ({
        jobTitle: r.jobTitle,
        count: r.count,
        min: Number(r.min),
        median: Math.round(Number(r.median)),
        max: Number(r.max),
        currency: r.currency,
      })),
      benchmarkSalaries: benchmarkRows,
    } as const;
  });

/**
 * Real companies ranked by real review count, with a real computed rating —
 * replaces the previous version of this app's hardcoded homepage figures
 * (Phase 0 audit, top finding). On a freshly-seeded database this
 * legitimately returns an empty or short list — that's correct, not a bug;
 * there is no fallback to placeholder numbers.
 */
export const listPopularCompanies = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ limit: z.coerce.number().min(1).max(50).default(12) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        industry: companies.industry,
        reviewCount: count(reviews.id),
        avgRating: avg(reviews.ratingOverall),
      })
      .from(companies)
      .leftJoin(
        reviews,
        and(
          eq(reviews.companyId, companies.id),
          eq(reviews.status, "approved"),
        ),
      )
      .groupBy(companies.id)
      .orderBy(desc(count(reviews.id)), companies.name)
      .limit(data.limit);

    return {
      companies: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        industry: r.industry,
        reviewCount: r.reviewCount,
        avgRating: r.avgRating
          ? Math.round(Number(r.avgRating) * 10) / 10
          : null,
      })),
    };
  });

/** Real companies ranked by real average approved-salary-report pay, for the homepage's "highest salaries" panel. */
export const listHighestPaying = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ limit: z.coerce.number().min(1).max(50).default(6) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        avgPay: avg(salaryReports.annualPayNormalized),
        currency: sql<string>`mode() within group (order by ${salaryReports.payCurrency})`,
        sampleSize: count(salaryReports.id),
      })
      .from(companies)
      .innerJoin(
        salaryReports,
        and(
          eq(salaryReports.companyId, companies.id),
          eq(salaryReports.status, "approved"),
        ),
      )
      .groupBy(companies.id)
      .having(sql`count(${salaryReports.id}) >= 1`)
      .orderBy(desc(avg(salaryReports.annualPayNormalized)))
      .limit(data.limit);

    return {
      companies: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        avgPay: Math.round(Number(r.avgPay)),
        currency: r.currency,
        sampleSize: r.sampleSize,
      })),
    };
  });
