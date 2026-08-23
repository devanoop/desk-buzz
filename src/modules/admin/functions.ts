import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  auditLog,
  companies,
  ingestionJobs,
  dataSources,
  reviews,
  userRoles,
  users,
} from "../db/schema";
import { requireAdmin } from "../auth/middleware";
import { grantRole, revokeRole, type AppRole } from "../auth/roles";
import { logger } from "../logging/logger";

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({ limit: z.coerce.number().min(1).max(200).default(50) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: auditLog.id,
        adminEmail: users.email,
        action: auditLog.action,
        targetTable: auditLog.targetTable,
        targetId: auditLog.targetId,
        justification: auditLog.justification,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(users, eq(auditLog.adminUserId, users.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(data.limit);
    return { entries: rows };
  });

export const listIngestionJobs = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: ingestionJobs.id,
        sourceName: dataSources.name,
        sourceKey: dataSources.key,
        startedAt: ingestionJobs.startedAt,
        finishedAt: ingestionJobs.finishedAt,
        status: ingestionJobs.status,
        rowsIngested: ingestionJobs.rowsIngested,
        rowsSkipped: ingestionJobs.rowsSkipped,
        errorMessage: ingestionJobs.errorMessage,
        triggeredBy: ingestionJobs.triggeredBy,
      })
      .from(ingestionJobs)
      .innerJoin(dataSources, eq(ingestionJobs.sourceId, dataSources.id))
      .orderBy(desc(ingestionJobs.startedAt))
      .limit(100);
    return { jobs: rows };
  });

/** Per-company review counts split by submission source — surfaces admin-on-behalf volume per the brief. */
export const listCompanyReviewCountsBySource = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select({
        companyId: companies.id,
        companyName: companies.name,
        companySlug: companies.slug,
        submissionSource: reviews.submissionSource,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .innerJoin(companies, eq(reviews.companyId, companies.id))
      .groupBy(
        companies.id,
        companies.name,
        companies.slug,
        reviews.submissionSource,
      );

    const byCompany = new Map<
      string,
      {
        companyName: string;
        companySlug: string;
        self_submitted: number;
        admin_on_behalf: number;
        imported: number;
      }
    >();
    for (const row of rows) {
      if (!byCompany.has(row.companyId)) {
        byCompany.set(row.companyId, {
          companyName: row.companyName,
          companySlug: row.companySlug,
          self_submitted: 0,
          admin_on_behalf: 0,
          imported: 0,
        });
      }
      byCompany.get(row.companyId)![row.submissionSource] = row.count;
    }
    return { companies: Array.from(byCompany.values()) };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({ limit: z.coerce.number().min(1).max(200).default(100) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(data.limit);

    const roleRows = await db
      .select({ userId: userRoles.userId, role: userRoles.role })
      .from(userRoles);
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roleRows) {
      if (!rolesByUser.has(r.userId)) rolesByUser.set(r.userId, []);
      rolesByUser.get(r.userId)!.push(r.role);
    }

    return {
      users: userRows.map((u) => ({
        ...u,
        roles: rolesByUser.get(u.id) ?? [],
      })),
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator", "user"]),
        grant: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.grant) await grantRole(data.userId, data.role);
    else await revokeRole(data.userId, data.role);
    logger.info("admin.role_change", {
      targetUserId: data.userId,
      role: data.role,
      grant: data.grant,
      actingAdminId: context.userId,
    });
    return { ok: true };
  });
