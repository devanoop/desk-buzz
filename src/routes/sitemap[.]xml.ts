import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://deskbuz.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/review", changefreq: "monthly", priority: "0.7" },
          { path: "/share-salary", changefreq: "monthly", priority: "0.7" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
          const key =
            process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (url && key) {
            const supabase = createClient(url, key, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data } = await supabase
              .from("companies")
              .select("slug, created_at")
              .order("created_at", { ascending: false })
              .limit(50000);
            for (const c of data ?? []) {
              if (!c.slug) continue;
              const lastmod = c.created_at
                ? new Date(c.created_at).toISOString().split("T")[0]
                : undefined;
              entries.push({
                path: `/companies/${encodeURIComponent(c.slug)}`,
                lastmod,
                changefreq: "weekly",
                priority: "0.8",
              });
            }
          }
        } catch (err) {
          console.error("sitemap: failed to load companies", err);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
