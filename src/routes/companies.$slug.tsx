import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/companies/$slug")({
  component: () => <Outlet />,
});