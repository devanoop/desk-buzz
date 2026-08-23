import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { getDb } from "@/modules/db/client";
import { companies } from "@/modules/db/schema";

const BASE_URL = "https://deskbuz.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/salaries", changefreq: "weekly", priority: "0.8" },
          { path: "/review", changefreq: "monthly", priority: "0.7" },
          { path: "/share-salary", changefreq: "monthly", priority: "0.7" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const db = getDb();
          const rows = await db
            .select({ slug: companies.slug, createdAt: companies.createdAt })
            .from(companies)
            .orderBy(desc(companies.createdAt))
            .limit(50000);
          for (const c of rows) {
            if (!c.slug) continue;
            entries.push({
              path: `/companies/${encodeURIComponent(c.slug)}`,
              lastmod: c.createdAt.toISOString().split("T")[0],
              changefreq: "weekly",
              priority: "0.8",
            });
          }
        } catch (err) {
          console.error("sitemap: failed to load companies", err);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq
              ? `    <changefreq>${e.changefreq}</changefreq>`
              : null,
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
