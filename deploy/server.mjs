// Production entry point for Node hosts (Railway, Render, Fly, plain Docker).
//
// `npm run build` produces a platform-agnostic Fetch handler at
// dist/server/server.js (no built-in HTTP listener — see the comment in
// vite.config.ts). This file adapts that handler to a real Node HTTP server
// with srvx, the same adapter library the `nitro` package itself uses for
// its Node preset. It also serves the built client assets from dist/client,
// since nothing else does that for us outside of a CDN/edge platform.
import { serve } from "srvx/node";
import { serveStatic } from "srvx/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const { default: handler } = await import(
  join(repoRoot, "dist", "server", "server.js")
);

const port = process.env.PORT ?? 3000;
const host = process.env.HOST;

serve({
  port,
  hostname: host,
  middleware: [serveStatic({ dir: join(repoRoot, "dist", "client") })],
  fetch: (request) => handler.fetch(request, {}, {}),
});
