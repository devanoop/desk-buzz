import { createMiddleware } from "@tanstack/react-start";
import { CSRF_HEADER_NAME } from "./csrf-constants";
import { getCsrfToken } from "./csrf-client";

/**
 * Must be registered as a global `functionMiddleware` in src/start.ts —
 * otherwise the browser never attaches the CSRF header to server-fn calls
 * and every mutating request gets rejected by requireAuth's CSRF check.
 */
export const attachCsrfToken = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = getCsrfToken();
    return next({ headers: token ? { [CSRF_HEADER_NAME]: token } : {} });
  },
);
