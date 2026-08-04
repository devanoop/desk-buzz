import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Loader2, Search, Star } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { searchCompanies, submitReview } from "@/lib/companies.functions";
import {
  moderateReview,
  MIN_PROS_CHARS,
  MIN_CONS_CHARS,
  MIN_COMBINED_CHARS,
} from "@/lib/review-moderation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type InitialCompany = { name: string; slug: string } | null;

const EMPTY = {
  job_title: "",
  location: "",
  employment_status: "current" as "current" | "former" | "intern" | "contract",
  rating_overall: 0,
  rating_culture: 0,
  rating_work_life: 0,
  pros: "",
  cons: "",
};

export function ReviewForm({ initial }: { initial: InitialCompany }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submitFn = useServerFn(submitReview);
  const { user, loading, requireAuth } = useAuth();
  const [company, setCompany] = useState<InitialCompany>(initial);
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!loading && !user) requireAuth({ redirectTo: window.location.pathname + window.location.search });
  }, [loading, user, requireAuth]);

  useEffect(() => {
    setCompany(initial);
  }, [initial]);

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          slug: company?.slug ?? "",
          job_title: form.job_title,
          location: form.location,
          employment_status: form.employment_status,
          rating_overall: form.rating_overall,
          rating_culture: form.rating_culture,
          rating_work_life: form.rating_work_life,
          pros: form.pros,
          cons: form.cons,
        },
      }),
    onSuccess: () => {
      toast.success(
        "Thank you! Your review has been submitted anonymously for community approval.",
      );
      // Clear local caches so newly added rows / fresh aggregates appear immediately.
      queryClient.invalidateQueries({ queryKey: ["companies-search"] });
      queryClient.invalidateQueries({ queryKey: ["review-company-search"] });
      if (company?.slug) {
        queryClient.invalidateQueries({ queryKey: ["company-profile", company.slug] });
      }
      setSubmitted(true);
      setTimeout(() => {
        if (company?.slug) {
          navigate({ to: "/companies/$slug", params: { slug: company.slug } });
        } else {
          navigate({ to: "/" });
        }
      }, 1800);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const moderation = useMemo(
    () => moderateReview({ pros: form.pros, cons: form.cons }),
    [form.pros, form.cons],
  );
  const hasContent = form.pros.trim().length > 0 || form.cons.trim().length > 0;
  const blockingIssues = hasContent ? moderation : [];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      requireAuth({ redirectTo: window.location.pathname + window.location.search });
      return;
    }
    if (!company?.slug) return toast.error("Please select a company");
    if (!form.job_title.trim()) return toast.error("Job title is required");
    if (!form.rating_overall || !form.rating_culture || !form.rating_work_life) {
      return toast.error("Please rate all three categories");
    }
    const issues = moderateReview({ pros: form.pros, cons: form.cons });
    if (issues.length > 0) {
      toast.error(issues[0].message);
      return;
    }
    mutation.mutate();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Opening your review form…</p>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <div className="animate-scale-in rounded-full bg-primary/10 p-6">
            <CheckCircle2 className="h-16 w-16 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="mt-6 animate-fade-in text-3xl font-bold text-foreground">
            Review submitted
          </h1>
          <p className="mt-2 animate-fade-in text-muted-foreground">
            Thanks for sharing — your anonymous review is now live. Taking you back…
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navbar />
      <Toaster position="top-center" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
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

        <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Anonymous review
            </p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">Share your experience</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No accounts, no tracking. Your review helps thousands of professionals.
            </p>
          </header>

          <form onSubmit={onSubmit} className="space-y-8">
            <Section title="Company">
              {initial ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-foreground">{initial.name}</div>
                </div>
              ) : (
                <CompanyPicker selected={company} onSelect={setCompany} />
              )}
            </Section>

            <Section title="About your role">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Job title" required>
                  <Input
                    value={form.job_title}
                    onChange={(e) => update("job_title", e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </Field>
                <Field label="Location">
                  <Input
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    placeholder="e.g. Bengaluru"
                  />
                </Field>
                <Field label="Employment status" required>
                  <Select
                    value={form.employment_status}
                    onValueChange={(v) =>
                      update("employment_status", v as typeof form.employment_status)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current employee</SelectItem>
                      <SelectItem value="former">Former employee</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            <Section title="Rate your experience">
              <div className="space-y-4">
                <StarRow label="Overall" value={form.rating_overall} onChange={(v) => update("rating_overall", v)} />
                <StarRow label="Culture" value={form.rating_culture} onChange={(v) => update("rating_culture", v)} />
                <StarRow label="Work-life balance" value={form.rating_work_life} onChange={(v) => update("rating_work_life", v)} />
              </div>
            </Section>

            <Section title="What did you think?">
              <p className="mb-3 text-xs text-muted-foreground">
                Pros and Cons are both required. Minimum {MIN_PROS_CHARS} characters each, {MIN_COMBINED_CHARS}+ total.
                Keep feedback about the workplace — please don't name individuals.
              </p>
              {blockingIssues.length > 0 && (
                <div
                  role="alert"
                  className="mb-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <ul className="list-disc space-y-1 pl-4">
                    {blockingIssues.slice(0, 4).map((i, idx) => (
                      <li key={idx}>{i.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Pros"
                  required
                  hint={`${form.pros.trim().length}/${MIN_PROS_CHARS} min`}
                >
                  <Textarea
                    rows={6}
                    value={form.pros}
                    onChange={(e) => update("pros", e.target.value)}
                    placeholder="What did you love about working here? Focus on culture, processes, growth, perks…"
                  />
                </Field>
                <Field
                  label="Cons"
                  required
                  hint={`${form.cons.trim().length}/${MIN_CONS_CHARS} min`}
                >
                  <Textarea
                    rows={6}
                    value={form.cons}
                    onChange={(e) => update("cons", e.target.value)}
                    placeholder="What didn't work for you? Describe the situation, not specific people."
                  />
                </Field>
              </div>
            </Section>

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
                  Posted anonymously · No personal data is collected.
                </p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={mutation.isPending || !company?.slug || blockingIssues.length > 0}
                  className="w-full sm:w-auto"
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Review
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="p-1 transition-transform hover:scale-110"
            aria-label={`${label} ${n} stars`}
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                n <= display ? "fill-primary text-primary" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function CompanyPicker({
  selected,
  onSelect,
}: {
  selected: InitialCompany;
  onSelect: (c: NonNullable<InitialCompany> | null) => void;
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
    queryKey: ["review-company-search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: debounced.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const companies = data?.companies ?? [];

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium text-foreground">{selected.name}</div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
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
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  {c.industry && <div className="text-xs text-muted-foreground">{c.industry}</div>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && debounced.length > 0 && !isFetching && companies.length === 0 && (
        <div className="absolute left-0 right-0 top-11 z-30 rounded-lg border border-border bg-popover p-4 text-center text-sm text-muted-foreground shadow-2xl">
          No companies match "{debounced}"
        </div>
      )}
    </div>
  );
}