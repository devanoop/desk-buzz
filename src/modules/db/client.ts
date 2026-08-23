import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let _pool: Pool | undefined;
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

// Lazy singleton, same pattern as the app's existing Supabase clients
// (integrations/supabase/client.ts) — created on first use, not at import
// time, so importing this module never requires DATABASE_URL to already be
// set (matters for scripts/tests that don't touch the DB).
export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL environment variable.");
    }
    _pool = new Pool({ connectionString });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

export async function closeDb() {
  await _pool?.end();
  _pool = undefined;
  _db = undefined;
}
