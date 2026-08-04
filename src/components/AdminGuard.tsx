import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/admin-auth.functions";

/**
 * Client-only gate: ensures the visitor is signed-in AND holds the
 * `admin` role in `public.user_roles`. Falls back to `/admin/login`
 * otherwise. The authoritative check happens server-side inside every
 * admin server function via `requireSupabaseAdmin`; this gate is just for
 * UX so non-admins don't see an empty broken page.
 */
export function AdminGuard({
  redirectPath,
  children,
}: {
  redirectPath: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user) {
        if (!cancelled)
          navigate({
            to: "/admin/login",
            search: {
              error: "Please sign in with an admin account.",
              redirect: redirectPath,
            },
          });
        return;
      }
      try {
        const { isAdmin } = await isCurrentUserAdmin();
        if (cancelled) return;
        if (!isAdmin) {
          navigate({
            to: "/admin/login",
            search: {
              error: "Your account does not have admin access.",
              redirect: redirectPath,
            },
          });
          return;
        }
        setState("ok");
      } catch {
        if (!cancelled)
          navigate({
            to: "/admin/login",
            search: {
              error: "Unable to verify admin access. Please sign in again.",
              redirect: redirectPath,
            },
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, redirectPath]);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
