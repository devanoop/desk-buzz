import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import {
  confirmEmailVerification,
  requestEmailVerification,
} from "@/modules/auth/functions";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type Search = { token?: string };

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verify your email · DeskBuz" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const { user, refresh } = useAuth();
  const confirmFn = useServerFn(confirmEmailVerification);
  const resendFn = useServerFn(requestEmailVerification);
  const [state, setState] = useState<
    "idle" | "verifying" | "success" | "error"
  >(token ? "verifying" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    confirmFn({ data: { token } })
      .then(async () => {
        setState("success");
        await refresh();
      })
      .catch((err: Error) => {
        setState("error");
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resend = async () => {
    setResending(true);
    try {
      await resendFn();
      toast.success("Verification email sent — check your inbox.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navbar />
      <Toaster position="top-center" />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          {state === "verifying" && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Verifying your email…
              </p>
            </>
          )}
          {state === "success" && (
            <>
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-foreground">
                Email verified
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You can now write reviews and share salaries.
              </p>
              <Button asChild className="mt-6">
                <Link to="/">Go home</Link>
              </Button>
            </>
          )}
          {(state === "idle" || state === "error") && (
            <>
              <div className="mx-auto w-fit rounded-full bg-secondary p-4 text-muted-foreground">
                <MailWarning className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-foreground">
                {state === "error"
                  ? "That link didn't work"
                  : "Verify your email"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {state === "error"
                  ? error
                  : "Check your inbox for a verification link."}
              </p>
              {user && (
                <Button className="mt-6" onClick={resend} disabled={resending}>
                  {resending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Resend verification email
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
