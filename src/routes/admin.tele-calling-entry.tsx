import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import {
  listCompaniesForAdmin,
  submitTeleReview,
} from "@/lib/admin-reviews.functions";
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
  company_id: "",
  job_title: "",
  location: "",
  employment_status: "current",
  rating_overall: "",
  rating_work_life: "",
  rating_culture: "",
  rating_compensation: "",
  pros: "",
  cons: "",
  verified_source_contact: "",
  internal_admin_notes: "",
};

function TeleCallingEntry() {
  const [form, setForm] = useState(EMPTY);
  const listFn = useServerFn(listCompaniesForAdmin);
  const submitFn = useServerFn(submitTeleReview);

  const companiesQ = useQuery({
    queryKey: ["admin-companies"],
    queryFn: () => listFn(),
  });

  const mutation = useMutation({
    mutationFn: (payload: typeof EMPTY) =>
      submitFn({
        data: {
          ...payload,
          rating_overall: Number(payload.rating_overall),
          rating_work_life: payload.rating_work_life as never,
          rating_culture: payload.rating_culture as never,
          rating_compensation: payload.rating_compensation as never,
          employment_status: payload.employment_status as never,
        },
      }),
    onSuccess: () => {
      toast.success("Tele-review saved");
      setForm((f) => ({ ...EMPTY, company_id: f.company_id }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = <K extends keyof typeof EMPTY>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.company_id) return toast.error("Pick a company");
    if (!form.rating_overall) return toast.error("Overall rating required");
    mutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <Toaster position="top-center" />
      <main className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Tele-Calling Review Entry
              </h1>
              <p className="text-xs text-muted-foreground">
                Internal use only · Data marked as <code className="rounded bg-secondary px-1 text-foreground">tele-calling</code>
              </p>
            </div>
          </div>
          {mutation.isSuccess && !mutation.isPending && (
            <div className="hidden items-center gap-1.5 text-sm text-primary sm:flex">
              <CheckCircle2 className="h-4 w-4" /> Last entry saved
            </div>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          {/* Core */}
          <Section title="Review Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Company" required>
                <Select
                  value={form.company_id}
                  onValueChange={(v) => update("company_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={companiesQ.isLoading ? "Loading…" : "Select a company"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(companiesQ.data?.companies ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Employment Status" required>
                <Select
                  value={form.employment_status}
                  onValueChange={(v) => update("employment_status", v)}
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

              <Field label="Job Title" required>
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
            </div>
          </Section>

          <Section title="Ratings (1–5)">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <RatingField label="Overall" required value={form.rating_overall} onChange={(v) => update("rating_overall", v)} />
              <RatingField label="Work-Life" value={form.rating_work_life} onChange={(v) => update("rating_work_life", v)} />
              <RatingField label="Culture" value={form.rating_culture} onChange={(v) => update("rating_culture", v)} />
              <RatingField label="Compensation" value={form.rating_compensation} onChange={(v) => update("rating_compensation", v)} />
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

          {/* Internal admin */}
          <Section
            title="Internal · Not Public"
            subtitle="These fields are stored privately and never shown on the company profile."
            tone="muted"
          >
            <div className="space-y-4">
              <Field label="Verified Source Contact">
                <Input
                  value={form.verified_source_contact}
                  onChange={(e) => update("verified_source_contact", e.target.value)}
                  placeholder="LinkedIn URL or phone number of the person called"
                />
              </Field>
              <Field label="Internal Admin Notes">
                <Textarea
                  rows={4}
                  value={form.internal_admin_notes}
                  onChange={(e) => update("internal_admin_notes", e.target.value)}
                  placeholder="Caller notes, follow-ups, validation flags…"
                />
              </Field>
            </div>
          </Section>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)} disabled={mutation.isPending}>
              Clear
            </Button>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} required={required}>
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
