import { createFileRoute } from "@tanstack/react-router";
import { SalaryForm } from "@/components/SalaryForm";

export const Route = createFileRoute("/share-salary")({
  head: () => ({
    meta: [
      { title: "Share your salary · DeskBuz" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <SalaryForm initial={null} />,
});
