import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCompanyProfile } from "@/lib/companies.functions";
import { ReviewForm } from "@/components/ReviewForm";
import { Navbar } from "@/components/Navbar";

const profileQuery = (slug: string) =>
  queryOptions({
    queryKey: ["company-profile", slug],
    queryFn: () => getCompanyProfile({ data: { slug } }),
  });

export const Route = createFileRoute("/companies/$slug/review")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(profileQuery(params.slug));
    if (!data.company) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Write a review · DeskBuz" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ScopedReviewForm,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-10 text-center text-sm text-destructive">{error.message}</div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-20 text-center text-sm">Company not found.</div>
    </div>
  ),
});

function ScopedReviewForm() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(slug));
  const c = data.company;

  if (!c) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading company details…</p>
        </main>
      </div>
    );
  }

  return <ReviewForm initial={{ name: c.name, slug: data.canonicalSlug ?? c.slug }} />;
}