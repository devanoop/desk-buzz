import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Globe, MapPin, Briefcase, Plus, MessageSquare, Banknote } from "lucide-react";
import { getCompanyProfile } from "@/lib/companies.functions";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StarRating } from "@/components/StarRating";
import { useAuth } from "@/components/AuthProvider";

const profileQuery = (slug: string) =>
  queryOptions({
    queryKey: ["company-profile", slug],
    queryFn: () => getCompanyProfile({ data: { slug } }),
  });

export const Route = createFileRoute("/companies/$slug/")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(profileQuery(params.slug));
    if (!data.company) throw notFound();
    const full = data as Extract<typeof data, { reviews: unknown }>;
    if (full.canonicalSlug && full.canonicalSlug !== params.slug) {
      throw redirect({
        to: "/companies/$slug",
        params: { slug: full.canonicalSlug },
        replace: true,
      });
    }
    return {
      name: full.company!.name,
      slug: full.canonicalSlug ?? full.company!.slug ?? params.slug,
      reviewCount: full.reviewCount ?? 0,
    };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.name ?? params.slug;
    const slug = loaderData?.slug ?? params.slug;
    const reviewCount = loaderData?.reviewCount ?? 0;
    const title = `${name} Employee Reviews, Culture & Salaries | DeskBuz`;
    const description = `Read anonymous, verified employee reviews, pros, cons, and work culture details for ${name} on DeskBuz. See what it's really like to work there.`;
    const url = `https://deskbuz.com/companies/${encodeURIComponent(slug)}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "profile" },
    ];
    if (reviewCount === 0) {
      meta.push({ name: "robots", content: "noindex, follow" });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CompanyPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-10 text-center text-sm text-destructive">{error.message}</div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-20 text-center">
        <h1 className="text-2xl font-bold">Company not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Back to search
        </Link>
      </div>
    </div>
  ),
});

function formatINR(amount: number) {
  const lakhs = amount / 100000;
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs.toFixed(1)} LPA`;
}

function CompanyPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(slug));
  void 0;
  const { requireAuth } = useAuth();
  const [tab, setTab] = useState("reviews");

  const c = data.company!;
  const canonicalSlug = data.canonicalSlug ?? c.slug;
  const goReview = () =>
    requireAuth({ redirectTo: `/companies/${encodeURIComponent(canonicalSlug)}/review` });
  const goSalary = () =>
    requireAuth({ redirectTo: `/companies/${encodeURIComponent(canonicalSlug)}/share-salary` });
  const reviews = data.reviews ?? [];
  const salaries = data.salaries ?? [];
  const {
    primaryRating,
    ratingSource,
    benchmarkSource,
    reviewCount,
    industrySalaryAvgInr,
    industrySalarySampleSize,
  } = data;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="border-b border-border bg-gradient-to-b from-secondary/40 to-background">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
                <Building2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {c.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {c.industry && (
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      {c.industry}
                    </span>
                  )}
                  {c.website && (
                    <a
                      href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>

            <Button size="lg" onClick={goReview}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add a Review
            </Button>
          </div>

          {/* Rating block */}
          <div className="mt-8 inline-flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm">
            {primaryRating != null ? (
              <>
                <div className="text-4xl font-bold tabular-nums text-foreground">
                  {primaryRating.toFixed(1)}
                </div>
                <div className="space-y-1">
                  <StarRating value={primaryRating} size={18} />
                  {ratingSource === "local" ? (
                    <div className="text-xs text-muted-foreground">
                      DeskBuz Rating · {reviewCount} review{reviewCount === 1 ? "" : "s"}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Market Benchmark Rating
                      {benchmarkSource && ` (via ${benchmarkSource})`}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No ratings yet — be the first to review.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="reviews" className="gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Reviews ({reviews.length})
            </TabsTrigger>
            <TabsTrigger value="salaries" className="gap-1.5">
              <Banknote className="h-4 w-4" />
              Salaries ({salaries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4">
            {reviews.length === 0 ? (
              <EmptyState
                title="No community reviews yet"
                description="No community reviews submitted yet for this office location. Be the first to add yours!"
                action={
                  <Button size="lg" onClick={goReview}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Write a Review
                  </Button>
                }
              />
            ) : (
              reviews.map((r) => (
                <article
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{r.job_title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {r.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {r.location}
                          </span>
                        )}
                        <Badge variant="secondary" className="capitalize">
                          {r.employment_status} employee
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={Number(r.rating_overall)} />
                      <span className="text-sm font-medium tabular-nums">
                        {Number(r.rating_overall).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl bg-secondary/50 p-4">
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                        Pros
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                        {r.pros}
                      </p>
                    </div>
                    <div className="rounded-xl bg-secondary/50 p-4">
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                        Cons
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                        {r.cons}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="salaries">
            {salaries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {industrySalaryAvgInr != null
                    ? `${c.industry} industry average`
                    : "Market benchmark"}
                </div>
                <div className="mt-3 text-5xl font-bold tabular-nums text-primary">
                  {industrySalaryAvgInr != null ? formatINR(industrySalaryAvgInr) : "—"}
                </div>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                  {industrySalaryAvgInr != null
                    ? `Estimated annual package based on ${industrySalarySampleSize} peer report${industrySalarySampleSize === 1 ? "" : "s"} in ${c.industry}. No verified data for ${c.name} yet.`
                    : `No salary data submitted for ${c.name} yet. Help build transparency.`}
                </p>
                <Button className="mt-6" size="lg" onClick={goSalary}>
                  Share Your Salary anonymously in LPA
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="space-y-3 md:hidden">
                  {salaries.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="break-words font-medium text-foreground">
                            {s.job_title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {Number(s.experience_years)} yr
                              {Number(s.experience_years) === 1 ? "" : "s"} exp
                            </span>
                            {s.location && <span>· {s.location}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-semibold tabular-nums text-primary">
                          {formatINR(Number(s.annual_ctc_inr))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tablet+: table */}
                <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
                  <table className="w-full">
                    <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Job Title</th>
                        <th className="px-6 py-3 font-semibold">Experience</th>
                        <th className="px-6 py-3 font-semibold">Location</th>
                        <th className="px-6 py-3 text-right font-semibold">Annual Package</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {salaries.map((s) => (
                        <tr key={s.id} className="text-sm transition-colors hover:bg-secondary/30">
                          <td className="px-6 py-4 font-medium text-foreground">{s.job_title}</td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {Number(s.experience_years)} yr
                            {Number(s.experience_years) === 1 ? "" : "s"}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{s.location ?? "—"}</td>
                          <td className="px-6 py-4 text-right font-semibold tabular-nums text-primary">
                            {formatINR(Number(s.annual_ctc_inr))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
