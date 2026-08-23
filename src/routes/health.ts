import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { getDb } from "@/modules/db/client";
import { logger } from "@/modules/logging/logger";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await getDb().execute(sql`select 1`);
          return Response.json(
            { status: "ok", db: "ok", timestamp: new Date().toISOString() },
            { status: 200 },
          );
        } catch (error) {
          logger.error("health_check_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            {
              status: "error",
              db: "unreachable",
              timestamp: new Date().toISOString(),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
