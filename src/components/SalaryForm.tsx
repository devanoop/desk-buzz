import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { searchCompanies } from "@/modules/companies/functions";
import { submitSalaryReport } from "@/modules/salaries/functions";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";

type InitialCompany = { name: string; slug: string } | null;

export function SalaryForm({ initial }: { initial: InitialCompany }) {
  const navigate = useNavigate();
  const submit = useServerFn(submitSalaryReport);
  const { user, loading, requireAuth } = useAuth();

  useEffect(() => {
    if (!loading && !user)
      requireAuth({
        redirectTo: window.location.pathname + window.location.search,
      });
  }, [loading, user, requireAuth]);

  const [company, setCompany] = useState<{ name: string; slug: string } | null>(
    initial,
  );
  const [jobTitle, setJobTitle] = useState("");
  const [experience, setExperience] = useState<string>("");
  const [ctc, setCtc] = useState<string>("");
  const [location, setLocation] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          companySlug: company!.slug,
          jobTitle,
          experienceYears: Number(experience),
          country: "IN",
          city: location,
          payAmount: Number(ctc) * 100000, // LPA -> raw INR
          payCurrency: "INR",
          payPeriod: "annual",
        },
      }),
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you! Your salary report has been added.");
      setTimeout(() => {
        navigate({ to: "/companies/$slug", params: { slug: company!.slug } });
      }, 1600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      requireAuth({
        redirectTo: window.location.pathname + window.location.search,
      });
      return;
    }
    if (!company) return toast.error("Please select a company");
    if (!jobTitle.trim()) return toast.error("Job title is required");
    const exp = Number(experience);
    if (!Number.isFinite(exp) || exp < 0 || exp > 60)
      return toast.error("Enter a valid years of experience");
    const lpa = Number(ctc);
    if (!Number.isFinite(lpa) || lpa <= 0)
      return toast.error("Enter a valid annual CTC in lakhs");
    mutation.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <div className="animate-scale-in rounded-full bg-primary/10 p-6">
            <CheckCircle2
              className="h-16 w-16 text-primary"
              strokeWidth={1.75}
            />
          </div>
          <h1 className="mt-6 animate-fade-in text-3xl font-bold text-foreground">
            Salary shared
          </h1>
          <p className="mt-2 animate-fade-in text-muted-foreground">
            Thanks for adding to the transparency. Taking you back…
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navbar />
      <Toaster position="top-center" />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {company ? (
          <Link
            to="/companies/$slug"
            params={{ slug: company.slug }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to {company.name}
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-gradient-to-br from-primary/5 via-card to-card px-6 py-8 sm:px-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Anonymous · 100% private
            </div>
            <h1 className="mt-2 text-3xl font-bold text-foreground">
              Share your salary
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Help others negotiate fairly. Takes under 30 seconds.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-7 px-6 py-8 sm:px-10">
            <Field
              label="Company"
              required
              icon={<Building2 className="h-3.5 w-3.5" />}
            >
              {initial ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {initial.name}
                  </div>
                </div>
              ) : (
                <CompanyPicker selected={company} onSelect={setCompany} />
              )}
            </Field>

            <Field
              label="Designation"
              required
              icon={<Briefcase className="h-3.5 w-3.5" />}
            >
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. QA Engineer, Frontend Developer"
              />
            </Field>

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Total experience (years)"
                required
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              >
                <Input
                  type="number"
                  min={0}
                  max={60}
                  step={0.5}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 3"
                />
              </Field>

              <Field
                label="Annual CTC (Lakhs per annum)"
                required
                icon={<Banknote className="h-3.5 w-3.5" />}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={ctc}
                    onChange={(e) => setCtc(e.target.value)}
                    placeholder="e.g. 12.5 for 12,50,000 INR"
                    className="pl-7 pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    LPA
                  </span>
                </div>
              </Field>
            </div>

            <Field
              label="Job location"
              icon={<MapPin className="h-3.5 w-3.5" />}
            >
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bangalore, Remote"
              />
            </Field>

            <div className="space-y-4 border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                By submitting, you agree to our{" "}
                <Link to="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
                .
              </p>
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Posted anonymously · No personal data collected.
                </p>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={mutation.isPending || !company}
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Share Salary
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function CompanyPicker({
  selected,
  onSelect,
}: {
  selected: { name: string; slug: string } | null;
  onSelect: (c: { name: string; slug: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const search = useServerFn(searchCompanies);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["salary-company-search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length > 0,
  });

  const companies = data?.companies ?? [];

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium text-foreground">
            {selected.name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect({ name: "", slug: "" })}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a company..."
          className="pl-9"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && debounced.length > 0 && companies.length > 0 && (
        <ul className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover py-2 shadow-2xl">
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ name: c.name, slug: c.slug });
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {c.name}
                  </div>
                  {c.industry && (
                    <div className="text-xs text-muted-foreground">
                      {c.industry}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open &&
        debounced.length > 0 &&
        !isFetching &&
        companies.length === 0 && (
          <div className="absolute left-0 right-0 top-11 z-30 rounded-lg border border-border bg-popover p-4 text-center text-sm text-muted-foreground shadow-2xl">
            No companies match "{debounced}"
          </div>
        )}
    </div>
  );
}
