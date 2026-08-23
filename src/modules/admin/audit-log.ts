import { getDb } from "../db/client";
import { auditLog } from "../db/schema";

/**
 * The only way anything is ever written to audit_log — no update/delete
 * function exists anywhere in this codebase for this table (see the schema
 * comment on auditLog). Every admin action that needs a paper trail
 * (admin-on-behalf review creation, redaction) calls this.
 */
export async function recordAuditLogEntry(input: {
  adminUserId: string;
  action: string;
  targetTable: string;
  targetId: string;
  justification: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLog).values(input);
}
