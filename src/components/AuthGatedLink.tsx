import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";

type LinkProps = ComponentProps<typeof Link>;

function buildPath(to: unknown, params: unknown): string {
  let path = String(to ?? "/");
  if (params && typeof params === "object") {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      path = path.replace(`$${k}`, encodeURIComponent(String(v)));
    }
  }
  return path;
}

/**
 * Renders a TanStack Link, but if the user is not authenticated the click
 * opens the auth dialog and navigates after a successful sign-in (including
 * after an OAuth redirect round-trip).
 */
export const AuthGatedLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function AuthGatedLink(props, ref) {
    const { user, requireAuth } = useAuth();

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      props.onClick?.(e);
      if (e.defaultPrevented) return;
      if (user) return;
      e.preventDefault();
      const redirectTo = buildPath(props.to, (props as { params?: unknown }).params);
      requireAuth({ redirectTo });
    };

    return <Link {...props} ref={ref} onClick={handleClick} />;
  },
);
