import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/** Same shape as AdminGuard, but accepts either the moderator or admin role. */
export function ModeratorGuard({
  redirectPath,
  children,
}: {
  redirectPath: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const allowed = roles.includes("moderator") || roles.includes("admin");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({
        to: "/admin/login",
        search: {
          error: "Please sign in with a moderator or admin account.",
          redirect: redirectPath,
        },
      });
      return;
    }
    if (!allowed) {
      navigate({
        to: "/admin/login",
        search: {
          error: "Your account does not have moderator access.",
          redirect: redirectPath,
        },
      });
    }
  }, [loading, user, allowed, navigate, redirectPath]);

  if (loading || !user || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
