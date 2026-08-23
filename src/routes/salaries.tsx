import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search, Building2, TrendingUp, Loader2, Info } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { salaryExplorer, listOccupations } from "@/modules/salaries/functions";
import { searchCompanies } from "@/modules/companies/functions";

export const Route = createFileRoute("/salaries")({
  head: () => ({
    meta: [
      { title: "Salary Explorer · DeskBuz" },
      {
        name: "description",
        content:
          "Filter salary data by occupation, geography, employer, and seniority — with source and sample size shown for every figure.",
      },
    ],
  }),
  component: SalaryExplorerPage,
});

type OccupationOption = { id: string; title: string };
type CompanyOption = { id: string; name: string; slug: string };

function OccupationPicker({
  value,
  onChange,
}: {
  value: OccupationOption | null;
  onChange: (v: OccupationOption | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listFn = useServerFn(listOccupations);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["occupation-search", q],
    queryFn: () => listFn({ data: { q } }),
    enabled: open,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">
          {value.title}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="e.g. Software Developers"
          className="pl-9"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (data?.occupations.length ?? 0) > 0 && (
        <ul className="absolute left-0 right-0 top-11 z-30 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover py-2 shadow-2xl">
          {data!.occupations.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-secondary"
              >
                {o.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompanyPicker({
  value,
  onChange,
}: {
  value: CompanyOption | null;
  onChange: (v: CompanyOption | null) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const search = useServerFn(searchCompanies);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data } = useQuery({
    queryKey: ["explorer-company-search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length > 0,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Any employer"
          className="pl-9"
        />
      </div>
      {open && debounced.length > 0 && (data?.companies.length ?? 0) > 0 && (
        <ul className="absolute left-0 right-0 top-11 z-30 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover py-2 shadow-2xl">
          {data!.companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-secondary"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SalaryExplorerPage() {
  const explorerFn = useServerFn(salaryExplorer);
  const [occupation, setOccupation] = useState<OccupationOption | null>(null);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [minExp, setMinExp] = useState("");
  const [maxExp, setMaxExp] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: [
      "salary-explorer",
      occupation?.id,
      company?.slug,
      country,
      region,
      city,
      minExp,
      maxExp,
    ],
    queryFn: () =>
      explorerFn({
        data: {
          occupationId: occupation?.id,
          companySlug: company?.slug,
          country: country || undefined,
          region: region || undefined,
          city: city || undefined,
          minExperienceYears: minExp ? Number(minExp) : undefined,
          maxExperienceYears: maxExp ? Number(maxExp) : undefined,
        },
      }),
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Toaster position="top-center" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Salary Explorer
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Filter by occupation, geography, employer, and seniority. Every
            figure below shows its source, licence, and sample size —
            government/third-party data and DeskBuz community reports are never
            blended together.
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Occupation</Label>
              <OccupationPicker value={occupation} onChange={setOccupation} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Employer</Label>
              <CompanyPicker value={company} onChange={setCompany} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Country (ISO-2)</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="US, GB…"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Region / State</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. CA"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Austin"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Experience (years)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={minExp}
                  onChange={(e) => setMinExp(e.target.value)}
                  placeholder="Min"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  value={maxExp}
                  onChange={(e) => setMaxExp(e.target.value)}
                  placeholder="Max"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isFetching && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isFetching &&
          data &&
          !data.coverage.hasBenchmarks &&
          !data.coverage.hasCommunityData && (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-none" />
              <p>
                No data matches these filters yet — neither ingested
                government/third-party benchmarks nor DeskBuz community reports.
                This isn't an error: coverage genuinely doesn't exist for every
                combination (in particular, there is no open employer-level
                salary dataset for India). Try widening the filters, or{" "}
                <a href="/share-salary" className="text-primary underline">
                  share a salary
                </a>{" "}
                to help build coverage.
              </p>
            </div>
          )}

        {!isFetching &&
          data &&
          data.coverage.hasCommunityData &&
          data.communityData && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>DeskBuz Community</CardTitle>
                </div>
                <CardDescription>
                  Anonymous, moderator-approved salary reports. Sample size:{" "}
                  {data.communityData.sampleSize}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PercentileBar
                  currency={data.communityData.currency}
                  p10={data.communityData.p10}
                  p25={data.communityData.p25}
                  p50={data.communityData.p50}
                  p75={data.communityData.p75}
                  p90={data.communityData.p90}
                />
              </CardContent>
            </Card>
          )}

        {!isFetching && data && data.coverage.hasBenchmarks && (
          <div className="space-y-4">
            {Object.entries(groupBySource(data.benchmarks)).map(
              ([sourceName, rows]) => (
                <Card key={sourceName}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-lg">{sourceName}</CardTitle>
                      <Badge variant="secondary">{rows[0].sourceLicence}</Badge>
                    </div>
                    <CardDescription>{rows[0].occupationTitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupByGeoEmployer(rows).map((group) => (
                      <div
                        key={group.key}
                        className="rounded-xl border border-border p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {[
                              group.employerName,
                              group.city,
                              group.region,
                              group.country,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                          <span>
                            Sample: {group.sampleSize ?? "—"} · Confidence:{" "}
                            {group.confidence}
                          </span>
                        </div>
                        <PercentileBar
                          currency={group.payCurrency}
                          p10={group.p10}
                          p25={group.p25}
                          p50={group.p50}
                          p75={group.p75}
                          p90={group.p90}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function PercentileBar({
  currency,
  p10,
  p25,
  p50,
  p75,
  p90,
}: {
  currency: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}) {
  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;
  return (
    <div className="grid grid-cols-5 gap-2 text-center text-xs">
      {[
        ["p10", p10],
        ["p25", p25],
        ["p50", p50],
        ["p75", p75],
        ["p90", p90],
      ].map(([label, val]) => (
        <div
          key={label as string}
          className={label === "p50" ? "rounded-lg bg-primary/10 py-2" : "py-2"}
        >
          <div className="uppercase text-muted-foreground">{label}</div>
          <div
            className={
              label === "p50"
                ? "font-bold text-primary"
                : "font-medium text-foreground"
            }
          >
            {fmt(val as number)}
          </div>
        </div>
      ))}
    </div>
  );
}

type BenchmarkRow = {
  id: string;
  percentile: string;
  payAmount: string;
  payCurrency: string;
  country: string;
  region: string | null;
  city: string | null;
  employerName: string | null;
  sampleSize: number | null;
  confidence: string;
  sourceName: string;
  sourceLicence: string;
  sourceUrl: string;
  occupationTitle: string;
};

function groupBySource(rows: BenchmarkRow[]): Record<string, BenchmarkRow[]> {
  const out: Record<string, BenchmarkRow[]> = {};
  for (const r of rows) {
    (out[r.sourceName] ??= []).push(r);
  }
  return out;
}

function groupByGeoEmployer(rows: BenchmarkRow[]) {
  const groups = new Map<
    string,
    {
      key: string;
      country: string;
      region: string | null;
      city: string | null;
      employerName: string | null;
      payCurrency: string;
      sampleSize: number | null;
      confidence: string;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    }
  >();
  for (const r of rows) {
    const key = [r.country, r.region, r.city, r.employerName].join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        country: r.country,
        region: r.region,
        city: r.city,
        employerName: r.employerName,
        payCurrency: r.payCurrency,
        sampleSize: r.sampleSize,
        confidence: r.confidence,
        p10: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
      });
    }
    const g = groups.get(key)!;
    (g as unknown as Record<string, number>)[r.percentile] = Number(
      r.payAmount,
    );
  }
  return Array.from(groups.values());
}
