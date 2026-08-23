// Split out from csrf.ts specifically so client-side code (csrf-attacher.ts,
// which runs in the browser) can import the header name without pulling in
// csrf.ts's node:crypto usage into the client bundle.
export const CSRF_HEADER_NAME = "x-csrf-token";
