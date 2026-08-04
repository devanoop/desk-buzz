import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCompanyProfile } from "@/lib/companies.functions";
import { SalaryForm } from "@/components/SalaryForm";
import { Navbar } from "@/components/Navbar";

const profileQuery = (slug: string) =>
  queryOptions({
    queryKey: ["company-profile", slug],
    queryFn: () => getCompanyProfile({ data: { slug } }),
  });

export const Route = createFileRoute("/companies/$slug/share-salary")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(profileQuery(params.slug));
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

function ScopedSalaryForm() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(slug));
  const c = data.company!;
  return <SalaryForm initial={{ name: c.name, slug: data.canonicalSlug ?? c.slug }} />;
}
