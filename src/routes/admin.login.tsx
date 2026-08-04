import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserAdmin } from "@/lib/admin-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Kept for backwards-compatible imports; no longer used as a client-trusted flag.
export const ADMIN_AUTH_KEY = "deskbuz_admin_authed";

type Search = { error?: string; redirect?: string };

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    error: typeof s.error === "string" ? s.error : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin Login — DeskBuz" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/login" }) as Search;
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (search.error) toast.error(search.error);
  }, [search.error]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error("Invalid email or password");
        setLoading(false);
        return;
      }
      // Server-side role check
      const { isAdmin } = await isCurrentUserAdmin();
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error("This account does not have admin access.");
        setLoading(false);
        return;
      }
      toast.success("Signed in");
      navigate({ to: search.redirect ?? "/admin/tele-calling-entry" });
    } catch {
      toast.error("Sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const onResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Reset link sent to your email!");
        setMode("signin");
      }
    } catch {
      toast.error("Could not send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "signin" ? "Admin Sign In" : "Reset Password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Internal access only."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {mode === "signin" ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        ) : (
          <form onSubmit={onResetSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={resetLoading}>
              {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="flex w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
