import { createFileRoute, Link } from "@tanstack/react-router";
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
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star, ArrowRight, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeskBuz — Anonymous company reviews & salary insights" },
      {
        name: "description",
        content:
          "Discover real reviews and salary insights from employees. Search any company and join the conversation anonymously on DeskBuz.",
      },
      { property: "og:title", content: "DeskBuz — Anonymous company reviews & salary insights" },
      {
        property: "og:description",
        content:
          "Discover real reviews and salary insights from employees. Search any company on DeskBuz.",
      },
    ],
  }),
  component: Index,
});

type Industry =
  | "IT Services / Consulting"
  | "SaaS / Product"
  | "E-commerce";

type FeaturedCompany = {
  name: string;
  slug: string;
  rating: string;
  salary: string;
  industry: Industry;
};

const FEATURED: FeaturedCompany[] = [
  { name: "Zoho", slug: "zoho", rating: "4.2", salary: "18.5 LPA", industry: "SaaS / Product" },
  { name: "Google", slug: "google", rating: "4.2", salary: "18.5 LPA", industry: "SaaS / Product" },
  { name: "Flipkart", slug: "flipkart", rating: "4.2", salary: "18.5 LPA", industry: "SaaS / Product" },
  { name: "TCS", slug: "tcs", rating: "3.8", salary: "6.2 LPA", industry: "IT Services / Consulting" },
  { name: "Wipro", slug: "wipro", rating: "3.8", salary: "6.2 LPA", industry: "IT Services / Consulting" },
  { name: "Infosys", slug: "infosys", rating: "3.8", salary: "6.2 LPA", industry: "IT Services / Consulting" },
  { name: "Amazon", slug: "amazon", rating: "4.0", salary: "16.0 LPA", industry: "E-commerce" },
  { name: "Myntra", slug: "myntra", rating: "3.9", salary: "12.4 LPA", industry: "E-commerce" },
];

const INDUSTRIES: Array<"All" | Industry> = [
  "All",
  "IT Services / Consulting",
  "SaaS / Product",
  "E-commerce",
];

const TOP_RATED = FEATURED.filter((c) => c.industry === "SaaS / Product").slice(0, 3);

const HIGHEST_SALARIES: Array<{ name: string; slug: string; salary: string; role: string }> = [
  { name: "Google", slug: "google", salary: "32.0 LPA", role: "Software Engineer · Avg" },
  { name: "Zoho", slug: "zoho", salary: "22.5 LPA", role: "Senior Engineer · Avg" },
  { name: "Flipkart", slug: "flipkart", salary: "21.8 LPA", role: "SDE-II · Avg" },
  { name: "Amazon", slug: "amazon", salary: "19.4 LPA", role: "SDE-I · Avg" },
];

type Article = { title: string; excerpt: string; body: string };

const ARTICLES: Article[] = [
  {
    title: "The Rise of Product-Based SaaS Roles in Chennai & Bangalore (2026)",
    excerpt:
      "South India's twin hubs are absorbing the bulk of new product engineering hiring. Here is what that means for compensation and career paths.",
    body: `Two cities now anchor India's product engineering economy: Bangalore, the long-standing capital, and Chennai, the fastest-growing challenger. Through 2026, hiring data points to a clear consolidation of SaaS and product roles around these two metros.

Bangalore retains its lead in venture-backed SaaS and global capability centers. The city's depth of senior talent — product managers, staff engineers, design leaders — makes it the default location for companies scaling past Series B.

Chennai has become the natural home for bootstrapped and profitable SaaS. Zoho's gravitational pull, combined with a lower cost base and strong engineering colleges, has produced a cluster of product companies that hire aggressively at the junior and mid levels.

For candidates, the practical takeaway is straightforward. Bangalore offers higher ceiling compensation and faster role progression. Chennai offers better work-life economics, lower attrition, and an increasingly serious senior talent pool. Both beat the traditional services-firm path on every metric that matters.`,
  },
  {
    title: "IT Services vs Product Companies: A Detailed LPA Compensation Guide",
    excerpt:
      "A side-by-side breakdown of fresher, mid-level, and senior compensation across the two dominant sectors of the Indian tech market.",
    body: `Compensation conversations in Indian tech almost always reduce to a single comparison: services versus product. Here is the honest breakdown, in LPA, observed across the 2025 hiring cycle.

Freshers. IT services firms typically offer 3.5 to 4.5 LPA for campus hires, with marginal variance across the big four. Product companies start at 12 to 25 LPA for engineering roles, with global majors and well-funded SaaS firms anchoring the top of the range.

Mid-level (3–6 years). Services engineers in this band earn 7 to 12 LPA, often after multiple promotions. Product engineers at the same experience level command 25 to 55 LPA, with stock grants that can equal or exceed cash compensation.

Senior (7–12 years). Services tech leads cluster around 18 to 28 LPA. Product staff and senior engineers earn 60 LPA to 1.2 Cr, with the upper end driven by RSU appreciation at public companies.

The gap is real, but so are the trade-offs: product roles concentrate in a handful of cities, demand stronger interview preparation, and carry higher performance expectations. Services roles offer stability, broader exposure to client domains, and clearer promotion ladders.`,
  },
  {
    title: "Demystifying Allowances: How to Calculate Take-Home Salary From Your CTC",
    excerpt:
      "Your CTC is not your take-home. A clear walkthrough of the components, deductions, and tax math that produce your monthly bank credit.",
    body: `Few financial documents are as misunderstood as the Indian offer letter. The headline CTC bundles cash, retirals, benefits, and variable pay into a single number that rarely reflects what lands in your account.

Start with fixed pay. Basic salary is typically 35 to 50 percent of CTC. HRA is usually 40 to 50 percent of basic. Special allowance absorbs the remainder of fixed cash.

Next, retirals. Employer PF contribution (12 percent of basic) and gratuity (4.81 percent of basic) sit in your CTC but are not paid out monthly. Subtract these to get your gross monthly cash.

Then deductions. Employee PF, professional tax, and income tax under the new regime all reduce your in-hand pay.

A reliable rule of thumb: in-hand monthly pay is roughly 65 to 72 percent of your fixed CTC divided by 12. Use that to sanity-check any offer before you celebrate.`,
  },
  {
    title: "Hybrid is the New Default: Office Attendance Trends Across Indian Tech (2026)",
    excerpt:
      "Three days in office has become the median policy. We look at how the largest employers are converging — and where the outliers sit.",
    body: `Two years of remote-first experimentation have settled into a remarkably consistent equilibrium. The median Indian tech employer in 2026 expects three days of office attendance per week, with the remaining days flexible.

Global capability centers lean toward three to four days, citing collaboration with overseas teams. Indian SaaS firms cluster at two to three days, with some bootstrapped product companies remaining fully remote. IT services have largely returned to four or five days, driven by client expectations and delivery model inertia.

For candidates, attendance policy is now a first-class comparison axis alongside compensation and role. Expect every serious offer conversation to surface it explicitly — and expect policies to keep tightening modestly through 2026 before stabilizing.`,
  },
];

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
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number]>("All");

  const visibleCompanies = useMemo(
    () => (industry === "All" ? FEATURED : FEATURED.filter((c) => c.industry === industry)),
    [industry],
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
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">Anonymous</dd>
            </div>
            <div>
              <dt className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                ₹ LPA
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">Real salary data</dd>
            </div>
            <div>
              <dt className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Free
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">Always, no paywall</dd>
            </div>
          </dl>
        </section>

        {/* Popular companies in India */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Popular Companies in India
            </h2>
            <p className="text-sm text-muted-foreground">
              Ratings and salary benchmarks across India's most-searched employers.
            </p>
          </div>

          {/* Industry filter pills */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Browse by Industry Sector
            </h3>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => {
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCompanies.map((c) => (
              <Card key={c.slug} className="flex h-full flex-col transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <LogoBadge name={c.name} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle className="truncate text-lg">{c.name}</CardTitle>
                    <Badge variant="secondary">{c.industry}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    {c.rating}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Avg. salary</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground">
                      {c.salary}
                    </span>
                  </div>
                  <Link
                    to="/companies/$slug"
                    params={{ slug: c.slug }}
                    className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View salaries & reviews
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
            {visibleCompanies.length === 0 && (
              <p className="col-span-full rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No companies listed in this sector yet.
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
                  <CardTitle className="text-xl">Top Rated Product Companies</CardTitle>
                </div>
                <CardDescription>Highest employee-rated SaaS & product employers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {TOP_RATED.map((c, i) => (
                  <Link
                    key={c.slug}
                    to="/companies/$slug"
                    params={{ slug: c.slug }}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-secondary"
                  >
                    <span className="w-5 text-sm font-semibold text-muted-foreground">{i + 1}</span>
                    <LogoBadge name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.industry}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      {c.rating}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">Highest Average Salaries</CardTitle>
                </div>
                <CardDescription>Baseline averages across popular roles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {HIGHEST_SALARIES.map((s, i) => (
                  <Link
                    key={s.slug}
                    to="/companies/$slug"
                    params={{ slug: s.slug }}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-secondary"
                  >
                    <span className="w-5 text-sm font-semibold text-muted-foreground">{i + 1}</span>
                    <LogoBadge name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.role}</p>
                    </div>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-sm font-semibold text-foreground">
                      {s.salary}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Articles */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              DeskBuz WorkLife &amp; Trends
            </h2>
            <p className="text-sm text-muted-foreground">
              Notes on compensation, careers, and the changing shape of Indian tech.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ARTICLES.map((a) => (
              <Card key={a.title} className="flex h-full flex-col">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit">Insights</Badge>
                  <CardTitle className="pt-3 text-base leading-snug">{a.title}</CardTitle>
                  <CardDescription className="pt-2">{a.excerpt}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button variant="outline" onClick={() => setOpenArticle(a)}>
                    Read article
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={!!openArticle} onOpenChange={(o) => !o && setOpenArticle(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {openArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl leading-tight">{openArticle.title}</DialogTitle>
                <DialogDescription>{openArticle.excerpt}</DialogDescription>
              </DialogHeader>
              <article className="mt-4 space-y-4 text-base leading-relaxed text-foreground">
                {openArticle.body.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </article>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
