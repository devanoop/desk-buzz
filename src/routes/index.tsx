import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CompanySearch } from "@/components/CompanySearch";
import { Toaster } from "@/components/ui/sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowRight, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPopularCompanies,
  listHighestPaying,
} from "@/modules/companies/functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeskBuz — Anonymous company reviews & salary insights" },
      {
        name: "description",
        content:
          "Discover real reviews and salary insights from employees. Search any company and join the conversation anonymously on DeskBuz.",
      },
      {
        property: "og:title",
        content: "DeskBuz — Anonymous company reviews & salary insights",
      },
      {
        property: "og:description",
        content:
          "Discover real reviews and salary insights from employees. Search any company on DeskBuz.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(popularQuery),
      context.queryClient.ensureQueryData(highestPayingQuery),
    ]);
  },
  component: Index,
});

const popularQuery = queryOptions({
  queryKey: ["popular-companies"],
  queryFn: () => listPopularCompanies({ data: { limit: 12 } }),
});

const highestPayingQuery = queryOptions({
  queryKey: ["highest-paying-companies"],
  queryFn: () => listHighestPaying({ data: { limit: 6 } }),
});

function LogoBadge({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-base font-bold text-foreground"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function Index() {
  const { data: popular } = useSuspenseQuery(popularQuery);
  const { data: highestPaying } = useSuspenseQuery(highestPayingQuery);
  const [industry, setIndustry] = useState("All");

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const c of popular.companies) if (c.industry) set.add(c.industry);
    return ["All", ...Array.from(set).sort()];
  }, [popular.companies]);

  const visibleCompanies = useMemo(
    () =>
      industry === "All"
        ? popular.companies
        : popular.companies.filter((c) => c.industry === industry),
    [popular.companies, industry],
  );

  const topRated = useMemo(
    () =>
      [...popular.companies]
        .filter((c) => c.avgRating != null)
        .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
        .slice(0, 5),
    [popular.companies],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Toaster position="top-center" />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-secondary/50 to-transparent" />

        {/* Hero */}
        <section className="mx-auto flex max-w-7xl flex-col items-center px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            100% anonymous reviews &amp; salaries
          </div>

          <h1 className="max-w-3xl text-center text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Find out what it's really like to
            <span className="block text-primary">work anywhere.</span>
          </h1>

          <p className="mt-5 max-w-xl text-center text-base text-muted-foreground sm:text-lg">
            Real reviews and salary insights from real employees. Search any
            company to get the inside scoop.
          </p>

          <div className="mt-10 flex w-full justify-center">
            <CompanySearch />
          </div>

          <dl className="mt-16 grid w-full max-w-2xl grid-cols-3 divide-x divide-border border-y border-border py-6 text-center">
            <div>
              <dt className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                100%
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Anonymous
              </dd>
            </div>
            <div>
              <dt className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Sourced
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Government + community data
              </dd>
            </div>
            <div>
              <dt className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Free
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Always, no paywall
              </dd>
            </div>
          </dl>
        </section>

        {/* Popular companies */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Popular Companies
            </h2>
            <p className="text-sm text-muted-foreground">
              Ranked by community review volume — every rating shown comes from
              real, moderator-approved reviews.
            </p>
          </div>

          {industries.length > 1 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Browse by Industry Sector
              </h3>
              <div className="flex flex-wrap gap-2">
                {industries.map((ind) => {
                  const active = ind === industry;
                  return (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => setIndustry(ind)}
                      className={cn(
                        "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary",
                      )}
                      aria-pressed={active}
                    >
                      {ind}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCompanies.map((c) => (
              <Card
                key={c.slug}
                className="flex h-full flex-col transition-shadow hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <LogoBadge name={c.name} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle className="truncate text-lg">{c.name}</CardTitle>
                    {c.industry && (
                      <Badge variant="secondary">{c.industry}</Badge>
                    )}
                  </div>
                  {c.avgRating != null && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      {c.avgRating.toFixed(1)}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reviews</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                      {c.reviewCount}
                    </span>
                  </div>
                  <Link
                    to="/companies/$slug"
                    params={{ slug: c.slug }}
                    className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View salaries &amp; reviews
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
            {visibleCompanies.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                {popular.companies.length === 0
                  ? "No companies have reviews yet — be the first to add one via search above."
                  : "No companies listed in this sector yet."}
              </p>
            )}
          </div>
        </section>

        {/* Top rated / Highest salaries */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">Top Rated Companies</CardTitle>
                </div>
                <CardDescription>
                  Highest employee-rated employers, by real approved reviews.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {topRated.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No rated companies yet.
                  </p>
                )}
                {topRated.map((c, i) => (
                  <Link
                    key={c.slug}
                    to="/companies/$slug"
                    params={{ slug: c.slug }}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-secondary"
                  >
                    <span className="w-5 text-sm font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <LogoBadge name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {c.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.reviewCount} reviews
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      {c.avgRating!.toFixed(1)}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">
                    Highest Average Salaries
                  </CardTitle>
                </div>
                <CardDescription>
                  From community-submitted, moderator-approved salary reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {highestPaying.companies.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No salary reports yet.
                  </p>
                )}
                {highestPaying.companies.map((s, i) => (
                  <Link
                    key={s.slug}
                    to="/companies/$slug"
                    params={{ slug: s.slug }}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-secondary"
                  >
                    <span className="w-5 text-sm font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <LogoBadge name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {s.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.sampleSize} report{s.sampleSize === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-semibold text-foreground">
                      {s.currency} {s.avgPay.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
