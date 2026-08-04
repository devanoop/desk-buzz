import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moderateReview, MIN_PROS_CHARS, MIN_CONS_CHARS } from "@/lib/review-moderation";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

type CompanyLookupRow = {
  id: string;
  name: string;
  slug: string | null;
  industry?: string | null;
  description?: string | null;
  website?: string | null;
};

type CompanyProfileRow = CompanyLookupRow & {
  slug: string;
  industry: string | null;
  description: string | null;
  website: string | null;
};

const slugifyCompany = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const compactCompanyKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const companyAcronym = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toLowerCase();

const COMPANY_ALIASES: Record<string, string[]> = {
  tcs: ["Tata Consultancy Services"],
};

const canonicalCompanySlug = (company: CompanyLookupRow) =>
  slugifyCompany(company.slug?.trim() || company.name);

const escapeIlike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const editDistance = (a: string, b: string) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_unused, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }

  return dp[a.length][b.length];
};

const similarityScore = (a: string, b: string) => {
  if (!a || !b) return 0;
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 0 : 1 - editDistance(a, b) / longest;
};

const scoreCompanyMatch = (company: CompanyLookupRow, lookup: string) => {
  const targetSlug = slugifyCompany(lookup);
  const targetCompact = compactCompanyKey(lookup);
  const nameGuessCompact = compactCompanyKey(lookup.replace(/[-_+]+/g, " "));
  const rowSlug = slugifyCompany(company.slug ?? "");
  const rowSlugCompact = compactCompanyKey(company.slug ?? "");
  const rowNameCompact = compactCompanyKey(company.name ?? "");
  const rowAcronym = companyAcronym(company.name ?? "");

  if (!targetCompact) return 0;
  if (rowSlug && rowSlug === targetSlug) return 120;
  if (rowNameCompact === targetCompact || rowNameCompact === nameGuessCompact) return 118;
  if (rowAcronym && rowAcronym === targetCompact) return 116;

  if (targetCompact.length >= 3) {
    if (rowSlugCompact.includes(targetCompact)) return 100;
    if (rowNameCompact.includes(targetCompact)) return 96;
    if (rowSlugCompact && targetCompact.includes(rowSlugCompact)) return 90;
    if (rowNameCompact && targetCompact.includes(rowNameCompact)) return 88;
  }

  if (targetCompact.length >= 4) {
    const similarity = Math.max(
      similarityScore(targetCompact, rowNameCompact),
      similarityScore(targetCompact, rowSlugCompact),
    );
    if (similarity >= 0.82) return Math.round(similarity * 80);
  }

  return 0;
};

const findCompanyByFlexibleLookup = async <T extends CompanyLookupRow>(
  supabaseAdmin: SupabaseAdmin,
  lookup: string,
  selectColumns: string,
) => {
  const rawLookup = lookup.trim();
  if (!rawLookup) return null;

  const variants = Array.from(
    new Set(
      [
        rawLookup,
        rawLookup.toLowerCase(),
        ...(COMPANY_ALIASES[compactCompanyKey(rawLookup)] ?? []),
        slugifyCompany(rawLookup),
        rawLookup.replace(/[-_+]+/g, " "),
        compactCompanyKey(rawLookup),
      ].filter((value) => value.length >= 2),
    ),
  );

  const candidates = new Map<string, T>();
  const addCandidates = (rows?: T[] | null) => {
    (rows ?? []).forEach((row) => candidates.set(row.id, row));
  };

  const exactSlug = slugifyCompany(rawLookup);
  const { data: exactRows, error: exactErr } = await supabaseAdmin
    .from("companies")
    .select(selectColumns)
    .ilike("slug", exactSlug)
    .limit(5);
  if (exactErr) {
    console.error("[findCompanyByFlexibleLookup] exact slug lookup failed", {
      lookup: exactSlug,
      code: (exactErr as { code?: string }).code,
      message: exactErr.message,
      details: (exactErr as { details?: string }).details,
    });
  } else {
    addCandidates(exactRows as unknown as T[] | null);
  }

  const flexibleResults = await Promise.all(
    variants.flatMap((variant) => {
      const pattern = `%${escapeIlike(variant)}%`;
      return [
        supabaseAdmin.from("companies").select(selectColumns).ilike("slug", pattern).limit(10),
        supabaseAdmin.from("companies").select(selectColumns).ilike("name", pattern).limit(10),
      ];
    }),
  );

  flexibleResults.forEach(({ data, error }, index) => {
    if (error) {
      console.error("[findCompanyByFlexibleLookup] ilike lookup failed", {
        lookup: rawLookup,
        queryIndex: index,
        code: (error as { code?: string }).code,
        message: error.message,
        details: (error as { details?: string }).details,
      });
      return;
    }
    addCandidates(data as unknown as T[] | null);
  });

  if (candidates.size === 0) {
    const { data: allRows, error: allErr } = await supabaseAdmin
      .from("companies")
      .select(selectColumns)
      .order("name")
      .limit(1000);
    if (allErr) {
      console.error("[findCompanyByFlexibleLookup] full fallback lookup failed", {
        lookup: rawLookup,
        code: (allErr as { code?: string }).code,
        message: allErr.message,
        details: (allErr as { details?: string }).details,
      });
    } else {
      addCandidates(allRows as unknown as T[] | null);
    }
  }

  const best = [...candidates.values()]
    .map((company) => ({ company, score: scoreCompanyMatch(company, rawLookup) }))
    .sort((a, b) => b.score - a.score)[0];

  return best && best.score >= 60 ? best.company : null;
};

export const searchCompanies = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ q: z.string().max(100) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.q.trim();
    if (!q) {
      return {
        companies: [] as Array<{ id: string; name: string; slug: string; industry: string | null }>,
      };
    }
    const { data: rows, error } = await supabaseAdmin
      .from("companies")
      .select("id, name, slug, industry")
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(8);
    if (error) {
      console.error("[searchCompanies] db error", error);
      throw new Error("Search failed. Please try again.");
    }
    return { companies: rows ?? [] };
  });

export const addCompany = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ name: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name = data.name.trim();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .insert({ name, slug })
      .select("id, name, slug")
      .single();
    if (error) {
      console.error("[addCompany] db error", error);
      throw new Error("Unable to add company. It may already exist.");
    }
    return { company: row };
  });

export const getCompanyProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rawSlug = data.slug.trim();
    const company = await findCompanyByFlexibleLookup<CompanyProfileRow>(
      supabaseAdmin,
      rawSlug,
      "id, name, slug, industry, description, website",
    );

    if (!company) return { company: null };
    const canonicalSlug = canonicalCompanySlug(company);

    const [
      { data: reviews, error: rErr },
      { data: salaries, error: sErr },
      { data: agg, error: aErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("reviews")
        .select(
          "id, job_title, location, employment_status, rating_overall, rating_work_life, rating_culture, rating_compensation, pros, cons, created_at",
        )
        .eq("company_id", company.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("salaries")
        .select("id, job_title, experience_years, annual_ctc_inr, location, created_at")
        .eq("company_id", company.id)
        .order("annual_ctc_inr", { ascending: false }),
      supabaseAdmin
        .from("company_aggregates")
        .select("benchmark_rating, source")
        .eq("company_id", company.id)
        .maybeSingle(),
    ]);
    if (rErr || sErr || aErr) {
      console.error("[getCompanyProfile] db error", { rErr, sErr, aErr });
      throw new Error("Unable to load company profile. Please try again.");
    }

    const reviewList = reviews ?? [];
    let primaryRating: number | null = null;
    let ratingSource: "local" | "benchmark" | null = null;
    let benchmarkSource: string | null = null;

    if (reviewList.length > 0) {
      const sum = reviewList.reduce((s, r) => s + Number(r.rating_overall), 0);
      primaryRating = Math.round((sum / reviewList.length) * 10) / 10;
      ratingSource = "local";
    } else if (agg?.benchmark_rating != null) {
      primaryRating = Number(agg.benchmark_rating);
      ratingSource = "benchmark";
      benchmarkSource = agg.source ?? "Archive";
    }

    const salaryList = salaries ?? [];
    let industrySalaryAvgInr: number | null = null;
    let industrySalarySampleSize = 0;
    if (salaryList.length === 0 && company.industry) {
      const { data: peers } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("industry", company.industry)
        .neq("id", company.id);
      const peerIds = (peers ?? []).map((p) => p.id);
      if (peerIds.length > 0) {
        const { data: peerSalaries } = await supabaseAdmin
          .from("salaries")
          .select("annual_ctc_inr")
          .in("company_id", peerIds);
        if (peerSalaries && peerSalaries.length > 0) {
          const total = peerSalaries.reduce((s, r) => s + Number(r.annual_ctc_inr), 0);
          industrySalaryAvgInr = Math.round(total / peerSalaries.length);
          industrySalarySampleSize = peerSalaries.length;
        }
      }
    }

    return {
      company,
      canonicalSlug,
      reviews: reviewList,
      salaries: salaryList,
      primaryRating,
      ratingSource,
      benchmarkSource,
      reviewCount: reviewList.length,
      industrySalaryAvgInr,
      industrySalarySampleSize,
    };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        job_title: z.string().trim().min(1).max(120),
        location: z.string().trim().max(120).optional().default(""),
        employment_status: z.enum(["current", "former", "intern", "contract"]),
        rating_overall: z.coerce.number().min(1).max(5),
        rating_culture: z.coerce.number().min(1).max(5),
        rating_work_life: z.coerce.number().min(1).max(5),
        pros: z.string().trim().min(MIN_PROS_CHARS).max(2000),
        cons: z.string().trim().min(MIN_CONS_CHARS).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const issues = moderateReview({ pros: data.pros, cons: data.cons });
    if (issues.length > 0) {
      throw new Error(issues.map((i) => i.message).join(" "));
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const company = await findCompanyByFlexibleLookup(supabaseAdmin, data.slug, "id, name, slug");
    if (!company) throw new Error("Company not found");

    const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6).toISOString();
    const { data: prior, error: priorErr } = await supabaseAdmin
      .from("reviews")
      .select("id, created_at")
      .eq("user_id", context.userId)
      .eq("company_id", company.id)
      .gte("created_at", sixMonthsAgo)
      .limit(1);
    if (priorErr) {
      console.error("[submitReview] duplicate-check error", priorErr);
      throw new Error("Unable to submit review right now. Please try again.");
    }
    if (prior && prior.length > 0) {
      throw new Error(
        "You've already reviewed this company in the last 6 months. You can post another review after that cooling-off period.",
      );
    }

    const { error } = await supabaseAdmin.from("reviews").insert({
      company_id: company.id,
      user_id: context.userId,
      job_title: data.job_title,
      location: data.location || null,
      employment_status: data.employment_status,
      rating_overall: data.rating_overall,
      rating_culture: data.rating_culture,
      rating_work_life: data.rating_work_life,
      pros: data.pros,
      cons: data.cons,
      collection_method: "organic",
    });
    if (error) {
      console.error("[submitReview] insert error", error);
      throw new Error("Unable to submit review. Please try again.");
    }
    return { ok: true };
  });

export const submitSalary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        job_title: z.string().trim().min(1).max(120),
        location: z.string().trim().max(120).optional().default(""),
        experience_years: z.coerce.number().min(0).max(60),
        annual_ctc_lpa: z.coerce.number().min(0.1).max(10000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const company = await findCompanyByFlexibleLookup(supabaseAdmin, data.slug, "id, name, slug");
    if (!company) throw new Error("Company not found");

    const annual_ctc_inr = Math.round(data.annual_ctc_lpa * 100000);

    const { error } = await supabaseAdmin.from("salaries").insert({
      company_id: company.id,
      job_title: data.job_title,
      location: data.location || null,
      experience_years: data.experience_years,
      annual_ctc_inr,
    });
    if (error) {
      console.error("[submitSalary] insert error", error);
      throw new Error("Unable to submit salary. Please try again.");
    }
    return { ok: true };
  });
