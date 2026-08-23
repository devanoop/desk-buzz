// In-memory CSRF token holder for the browser. Set once on login/signup/me()
// and read by attachCsrfToken (csrf-attacher.ts) on every subsequent
// mutating server-fn call — mirrors the shape of the old Supabase
// bearer-token attacher this replaces, just reading a plain variable
// instead of an SDK session.
let currentToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentToken = token;
}

export function getCsrfToken(): string | null {
  return currentToken;
}
