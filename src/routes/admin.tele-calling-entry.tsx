import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { searchCompanies } from "@/modules/companies/functions";
import { submitReviewAdminOnBehalf } from "@/modules/reviews/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/tele-calling-entry")({
  head: () => ({
    meta: [
      { title: "Tele-Calling Entry — Internal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <AdminGuard redirectPath="/admin/tele-calling-entry">
      <TeleCallingEntry />
    </AdminGuard>
  ),
});

const EMPTY = {
  companySlug: "",
  companyLabel: "",
  jobTitle: "",
  location: "",
  employmentStatus: "current" as "current" | "former" | "intern" | "contract",
  employmentTenure: "",
  ratingCompensation: "",
  ratingManagement: "",
  ratingWorkLife: "",
  ratingCulture: "",
  ratingCareerGrowth: "",
  pros: "",
  cons: "",
  justification: "",
};

function TeleCallingEntry() {
  const [form, setForm] = useState(EMPTY);
  const [companyQuery, setCompanyQuery] = useState("");
  const searchFn = useServerFn(searchCompanies);
  const submitFn = useServerFn(submitReviewAdminOnBehalf);

  const companiesQ = useQuery({
    queryKey: ["admin-tele-company-search", companyQuery],
    queryFn: () => searchFn({ data: { q: companyQuery } }),
    enabled: companyQuery.length > 0,
  });

  const mutation = useMutation({
    mutationFn: (payload: typeof EMPTY) =>
      submitFn({
        data: {
          companySlug: payload.companySlug,
          jobTitle: payload.jobTitle,
          location: payload.location,
          employmentStatus: payload.employmentStatus,
          employmentTenure: payload.employmentTenure,
          ratingCompensation: Number(payload.ratingCompensation),
          ratingManagement: Number(payload.ratingManagement),
          ratingWorkLife: Number(payload.ratingWorkLife),
          ratingCulture: Number(payload.ratingCulture),
          ratingCareerGrowth: Number(payload.ratingCareerGrowth),
          pros: payload.pros,
          cons: payload.cons,
          justification: payload.justification,
        },
      }),
    onSuccess: () => {
      toast.success(
        "Tele-review saved and published, with an audit-log entry.",
      );
      setForm((f) => ({
        ...EMPTY,
        companySlug: f.companySlug,
        companyLabel: f.companyLabel,
      }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = <K extends keyof typeof EMPTY>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.companySlug) return toast.error("Pick a company");
    if (!form.justification.trim() || form.justification.trim().length < 10) {
      return toast.error(
        "Justification is required (e.g. 'transcribed from paper exit-survey, ref #1182')",
      );
    }
    if (
      !form.ratingCompensation ||
      !form.ratingManagement ||
      !form.ratingWorkLife ||
      !form.ratingCulture ||
      !form.ratingCareerGrowth
    ) {
      return toast.error("All five ratings are required");
    }
    mutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <Toaster position="top-center" />
      <main className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Tele-Calling Review Entry
            </h1>
            <p className="text-xs text-muted-foreground">
              Internal use only · Published as{" "}
              <code className="rounded bg-secondary px-1 text-foreground">
                admin_on_behalf
              </code>
              , visibly badged on the public page, and written to the audit log.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <Section title="Company">
            <div className="space-y-2">
              <Input
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
                placeholder="Search for a company…"
              />
              {companiesQ.data && companiesQ.data.companies.length > 0 && (
                <Select
                  value={form.companySlug}
                  onValueChange={(v) => {
                    const c = companiesQ.data!.companies.find(
                      (x) => x.slug === v,
                    );
                    update("companySlug", v);
                    update("companyLabel", c?.name ?? "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companiesQ.data.companies.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.companyLabel && (
                <p className="text-xs text-muted-foreground">
                  Selected: {form.companyLabel}
                </p>
              )}
            </div>
          </Section>

          <Section title="Review Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Job Title" required>
                <Input
                  value={form.jobTitle}
                  onChange={(e) => update("jobTitle", e.target.value)}
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
              <Field label="Employment Status" required>
                <Select
                  value={form.employmentStatus}
                  onValueChange={(v) => update("employmentStatus", v)}
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
              <Field label="Tenure">
                <Input
                  value={form.employmentTenure}
                  onChange={(e) => update("employmentTenure", e.target.value)}
                  placeholder="e.g. 2 years"
                />
              </Field>
            </div>
          </Section>

          <Section title="Ratings (1–5)">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <RatingField
                label="Compensation"
                value={form.ratingCompensation}
                onChange={(v) => update("ratingCompensation", v)}
              />
              <RatingField
                label="Management"
                value={form.ratingManagement}
                onChange={(v) => update("ratingManagement", v)}
              />
              <RatingField
                label="Work-Life"
                value={form.ratingWorkLife}
                onChange={(v) => update("ratingWorkLife", v)}
              />
              <RatingField
                label="Culture"
                value={form.ratingCulture}
                onChange={(v) => update("ratingCulture", v)}
              />
              <RatingField
                label="Career Growth"
                value={form.ratingCareerGrowth}
                onChange={(v) => update("ratingCareerGrowth", v)}
              />
            </div>
          </Section>

          <Section title="Feedback">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Pros" required>
                <Textarea
                  rows={5}
                  value={form.pros}
                  onChange={(e) => update("pros", e.target.value)}
                  placeholder="What did they love?"
                />
              </Field>
              <Field label="Cons" required>
                <Textarea
                  rows={5}
                  value={form.cons}
                  onChange={(e) => update("cons", e.target.value)}
                  placeholder="What didn't work for them?"
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Justification (required)"
            subtitle="Required for the audit log — e.g. 'transcribed from paper exit-survey, ref #1182'."
            tone="muted"
          >
            <Textarea
              rows={3}
              value={form.justification}
              onChange={(e) => update("justification", e.target.value)}
              placeholder="Why is this being entered on the employee's behalf?"
            />
          </Section>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setForm(EMPTY)}
              disabled={mutation.isPending}
            >
              Clear
            </Button>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Submit Tele-Review
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  tone?: "muted";
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        tone === "muted"
          ? "rounded-xl border border-dashed border-border bg-secondary/40 p-5"
          : ""
      }
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} required>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
