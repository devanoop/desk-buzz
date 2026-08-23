import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { me, logout as logoutFn } from "@/modules/auth/functions";
import { setCsrfToken } from "@/modules/auth/csrf-client";
import type { AppRole } from "@/modules/auth/roles";

export type CurrentUser = { id: string; email: string; emailVerified: boolean };

type RequireAuthArg = { redirectTo: string } | undefined;

type Ctx = {
  user: CurrentUser | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  /** Redirects to /login (preserving where to come back to) unless already signed in. */
  requireAuth: (arg?: RequireAuthArg) => boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const router = useRouter();
  const meFn = useServerFn(me);
  const logoutServerFn = useServerFn(logoutFn);

  const refresh = async () => {
    const result = await meFn();
    if (result) {
      setUser(result.user);
      setRoles(result.roles as AppRole[]);
      setCsrfToken(result.csrfToken);
    } else {
      setUser(null);
      setRoles([]);
      setCsrfToken(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await logoutServerFn();
    setUser(null);
    setRoles([]);
    setCsrfToken(null);
    await router.invalidate();
    navigate({ to: "/" });
  };

  const requireAuth = (arg?: RequireAuthArg) => {
    if (user) return true;
    const redirectTo =
      arg?.redirectTo ??
      (typeof window !== "undefined" ? window.location.pathname : "/");
    navigate({ to: "/login", search: { redirect: redirectTo } });
    return false;
  };

  return (
    <AuthContext.Provider
      value={{ user, roles, loading, signOut, requireAuth, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
