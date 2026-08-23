import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Globe,
  MapPin,
  Briefcase,
  Plus,
  MessageSquare,
  Banknote,
  Flag,
  Loader2,
} from "lucide-react";
import { getCompanyProfile } from "@/modules/companies/functions";
import { disputeReview } from "@/modules/reviews/functions";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { StarRating } from "@/components/StarRating";
import { useAuth } from "@/components/AuthProvider";

const profileQuery = (slug: string) =>
  queryOptions({
    queryKey: ["company-profile", slug],
    queryFn: () => getCompanyProfile({ data: { slug } }),
  });

export const Route = createFileRoute("/companies/$slug/")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      profileQuery(params.slug),
    );
    if (!data.company) throw notFound();
  },
  head: ({ params }) => {
    const title = `${params.slug} — Employee Reviews, Culture & Salaries | DeskBuz`;
    return { meta: [{ title }] };
  },
  component: CompanyPage,
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

const SUBMISSION_SOURCE_LABEL: Record<string, string> = {
  admin_on_behalf: "Transcribed by DeskBuz staff",
  imported: "Imported from an external source",
};

function CompanyPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(slug));
  const { requireAuth } = useAuth();
  const [tab, setTab] = useState("reviews");
  const [disputeTarget, setDisputeTarget] = useState<string | null>(null);

  // The route loader already throws notFound() when there's no company, but
  // that's a separate call from this useSuspenseQuery — TS can't narrow
  // across them, so this guard exists to satisfy the type checker (it's
  // unreachable at runtime by the time this component renders).
  if (!data.company) return null;
  const c = data.company;
  const goReview = () =>
    requireAuth({
      redirectTo: `/companies/${encodeURIComponent(c.slug)}/review`,
    });
  const goSalary = () =>
    requireAuth({
      redirectTo: `/companies/${encodeURIComponent(c.slug)}/share-salary`,
    });
  const reviews = data.reviews ?? [];
  const { ratingSummary, salaryByRole, benchmarkSalaries } = data;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Toaster position="top-center" />

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
                      href={
                        c.website.startsWith("http")
                          ? c.website
                          : `https://${c.website}`
                      }
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
            {ratingSummary.overall != null ? (
              <>
                <div className="text-4xl font-bold tabular-nums text-foreground">
                  {ratingSummary.overall.toFixed(1)}
                </div>
                <div className="space-y-1">
                  <StarRating value={ratingSummary.overall} size={18} />
                  <div className="text-xs text-muted-foreground">
                    {ratingSummary.count} review
                    {ratingSummary.count === 1 ? "" : "s"}
                  </div>
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
              Salaries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4">
            {reviews.length === 0 ? (
              <EmptyState
                title="No community reviews yet"
                description="No community reviews submitted yet for this company. Be the first to add yours!"
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
                      <h3 className="font-semibold text-foreground">
                        {r.jobTitle}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {r.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {r.location}
                          </span>
                        )}
                        {r.employmentTenure && (
                          <span>{r.employmentTenure}</span>
                        )}
                        <Badge variant="secondary" className="capitalize">
                          {r.employmentStatus} employee
                        </Badge>
                        {r.submissionSource !== "self_submitted" && (
                          // Visible badge, not a tooltip — required disclosure for
                          // admin-on-behalf/imported content, per the brief.
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-700 dark:text-amber-400"
                          >
                            {SUBMISSION_SOURCE_LABEL[r.submissionSource] ??
                              r.submissionSource}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={Number(r.ratingOverall)} />
                      <span className="text-sm font-medium tabular-nums">
                        {Number(r.ratingOverall).toFixed(1)}
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

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDisputeTarget(r.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Dispute this review
                    </button>
                  </div>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="salaries" className="space-y-6">
            {salaryByRole.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center shadow-sm">
                <div className="text-sm text-muted-foreground">
                  No community salary reports for {c.name} yet.
                </div>
                <Button className="mt-6" size="lg" onClick={goSalary}>
                  Share Your Salary anonymously
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Job Title</th>
                      <th className="px-6 py-3 font-semibold">Reports</th>
                      <th className="px-6 py-3 text-right font-semibold">
                        Range (min–median–max)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salaryByRole.map((s) => (
                      <tr key={s.jobTitle} className="text-sm">
                        <td className="px-6 py-4 font-medium text-foreground">
                          {s.jobTitle}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {s.count}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums text-foreground">
                          {formatINR(s.min)} –{" "}
                          <span className="font-semibold text-primary">
                            {formatINR(s.median)}
                          </span>{" "}
                          – {formatINR(s.max)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-border bg-secondary/30 px-6 py-3 text-xs text-muted-foreground">
                  Source: DeskBuz community — anonymous, moderator-approved
                  salary reports.
                </div>
              </div>
            )}

            {benchmarkSalaries.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-6 py-3 text-sm font-semibold text-foreground">
                  Government / third-party benchmark data for {c.name}
                </div>
                <table className="w-full">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Occupation</th>
                      <th className="px-6 py-3 font-semibold">Percentile</th>
                      <th className="px-6 py-3 font-semibold">Sample</th>
                      <th className="px-6 py-3 text-right font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {benchmarkSalaries.map((b) => (
                      <tr key={b.id} className="text-sm">
                        <td className="px-6 py-4 text-foreground">
                          {b.occupationTitle}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground uppercase">
                          {b.percentile}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {b.sampleSize ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums font-semibold text-foreground">
                          {b.payCurrency} {Number(b.payAmount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-1 border-t border-border bg-secondary/30 px-6 py-3 text-xs text-muted-foreground">
                  {Array.from(
                    new Set(
                      benchmarkSalaries.map(
                        (b) => `${b.sourceName} (${b.sourceLicence})`,
                      ),
                    ),
                  ).map((label) => (
                    <div key={label}>Source: {label}</div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <DisputeDialog
        reviewId={disputeTarget}
        onClose={() => setDisputeTarget(null)}
      />
    </div>
  );
}

function DisputeDialog({
  reviewId,
  onClose,
}: {
  reviewId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const disputeFn = useServerFn(disputeReview);
  const [contactEmail, setContactEmail] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      disputeFn({ data: { reviewId: reviewId!, contactEmail, reason } }),
    onSuccess: () => {
      toast.success("Thanks — a moderator will look into this.");
      queryClient.invalidateQueries();
      setContactEmail("");
      setReason("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!reviewId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute this review</DialogTitle>
          <DialogDescription>
            Flag this review for a moderator to look into. This doesn't remove
            it immediately.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="dispute-email" className="text-xs font-medium">
              Your contact email
            </Label>
            <Input
              id="dispute-email"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dispute-reason" className="text-xs font-medium">
              Reason (at least 20 characters)
            </Label>
            <Textarea
              id="dispute-reason"
              required
              minLength={20}
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this review should be reviewed by a moderator…"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Submit dispute
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
