import { createFileRoute } from "@tanstack/react-router";
import { ReviewForm } from "@/components/ReviewForm";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Write a review · DeskBuz" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <ReviewForm initial={null} />,
});