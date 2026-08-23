import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCompanyProfile } from "@/modules/companies/functions";
import { SalaryForm } from "@/components/SalaryForm";
import { Navbar } from "@/components/Navbar";

const profileQuery = (slug: string) =>
  queryOptions({
    queryKey: ["company-profile", slug],
    queryFn: () => getCompanyProfile({ data: { slug } }),
  });

export const Route = createFileRoute("/companies/$slug/share-salary")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      profileQuery(params.slug),
    );
    if (!data.company) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Share your salary · DeskBuz" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ScopedSalaryForm,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-10 text-center text-sm text-destructive">
        {error.message}
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-20 text-center text-sm">Company not found.</div>
    </div>
  ),
});

function ScopedSalaryForm() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(slug));
  const c = data.company;

  if (!c) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading company details…
          </p>
        </main>
      </div>
    );
  }

  return <SalaryForm initial={{ name: c.name, slug: c.slug }} />;
}
