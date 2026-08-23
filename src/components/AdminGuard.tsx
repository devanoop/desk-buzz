import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/**
 * Client-only gate: redirects to /admin/login unless the visitor is signed
 * in AND holds the `admin` role. The authoritative check happens
 * server-side inside every admin server function via requireAdmin — this
 * gate is UX only, so non-admins don't see an empty broken page.
 */
export function AdminGuard({
  redirectPath,
  children,
}: {
  redirectPath: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({
        to: "/admin/login",
        search: {
          error: "Please sign in with an admin account.",
          redirect: redirectPath,
        },
      });
      return;
    }
    if (!roles.includes("admin")) {
      navigate({
        to: "/admin/login",
        search: {
          error: "Your account does not have admin access.",
          redirect: redirectPath,
        },
      });
    }
  }, [loading, user, roles, navigate, redirectPath]);

  if (loading || !user || !roles.includes("admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
