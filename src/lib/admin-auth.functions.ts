import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware that requires the caller to be authenticated AND have the
 * `admin` role recorded in public.user_roles. Uses the service-role client
 * to call the SECURITY DEFINER `has_role` function (which is locked down so
 * only service_role can invoke it).
 */
export const requireSupabaseAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) {
      console.error("[requireSupabaseAdmin] has_role rpc failed", error);
      throw new Error("Forbidden");
    }
    if (!data) throw new Error("Forbidden");
    return next({ context });
  });

/**
 * Client-callable check used by the admin UI to decide whether to render
 * the dashboard or redirect to /admin/login. Returns `{ isAdmin: boolean }`.
 * Never throws on a missing role — only on auth failure.
 */
export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) {
      console.error("[isCurrentUserAdmin] has_role rpc failed", error);
      return { isAdmin: false };
    }
    return { isAdmin: Boolean(data) };
  });
