import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PENDING_KEY = "deskbuz:pendingAuthRedirect";

type RequireAuthArg = (() => void) | { redirectTo: string } | undefined;

type Ctx = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  requireAuth: (arg?: RequireAuthArg) => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

function readPendingRedirect(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function writePendingRedirect(path: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (path) window.localStorage.setItem(PENDING_KEY, path);
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    const consumePending = () => {
      const cb = pendingRef.current;
      pendingRef.current = null;
      if (cb) {
        setTimeout(cb, 50);
        // A callback supersedes any stored redirect for this flow.
        writePendingRedirect(null);
        return;
      }
      const path = readPendingRedirect();
      if (path) {
        writePendingRedirect(null);
        // Use a hard navigation so it works even if router context isn't ready
        // (e.g. immediately after OAuth provider redirects back to "/").
        setTimeout(() => {
          if (window.location.pathname + window.location.search !== path) {
            window.location.assign(path);
          }
        }, 50);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
      // If we just came back from an OAuth redirect, resume the pending action.
      if (data.session?.user) consumePending();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setOpen(false);
        consumePending();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const requireAuth = useCallback(
    (arg?: RequireAuthArg) => {
      if (user) {
        if (typeof arg === "function") arg();
        else if (arg && "redirectTo" in arg) {
          if (window.location.pathname + window.location.search !== arg.redirectTo) {
            window.location.assign(arg.redirectTo);
          }
        }
        return;
      }
      if (typeof arg === "function") {
        pendingRef.current = arg;
        // Also record the current path so OAuth round-trip can resume.
        writePendingRedirect(window.location.pathname + window.location.search);
      } else if (arg && "redirectTo" in arg) {
        pendingRef.current = null;
        writePendingRedirect(arg.redirectTo);
      } else {
        pendingRef.current = null;
        writePendingRedirect(window.location.pathname + window.location.search);
      }
      setOpen(true);
    },
    [user],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<Ctx>(
    () => ({ user, loading, signOut, requireAuth }),
    [user, loading, signOut, requireAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) pendingRef.current = null;
        }}
      />
    </AuthContext.Provider>
  );
}

function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("Enter a valid email and a password of 6+ characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setGoogleBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.href,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setGoogleBusy(false);
        return;
      }
      // If redirected:true the browser is leaving; otherwise session is set.
    } catch (err) {
      toast.error((err as Error).message);
      setGoogleBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            Please sign up or log in to securely submit your anonymous workplace
            review. Your identity is never shown publicly.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={googleSignIn}
          disabled={googleBusy || busy}
        >
          {googleBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleGlyph />
          )}
          Continue with Google
        </Button>

        <div className="relative my-2 text-center text-xs uppercase tracking-wider text-muted-foreground">
          <span className="bg-background px-2 relative z-10">or email</span>
          <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || googleBusy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function GoogleGlyph() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.1l6.6 4.8C14.6 15.1 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.1z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.7 13-4.7l-6-5.1c-2 1.4-4.4 2.3-7 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.5 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6 5.1c-.4.4 6.7-4.9 6.7-14.6 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
