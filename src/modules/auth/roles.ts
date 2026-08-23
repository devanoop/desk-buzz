import { eq, and } from "drizzle-orm";
import { getDb } from "../db/client";
import { userRoles } from "../db/schema";

export type AppRole = "admin" | "moderator" | "user";

export async function getRolesForUser(userId: string): Promise<AppRole[]> {
  const db = getDb();
  const rows = await db.query.userRoles.findMany({
    where: eq(userRoles.userId, userId),
  });
  return rows.map((r) => r.role);
}

export async function userHasRole(
  userId: string,
  role: AppRole,
): Promise<boolean> {
  const db = getDb();
  const row = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, userId), eq(userRoles.role, role)),
  });
  return !!row;
}

export async function grantRole(userId: string, role: AppRole): Promise<void> {
  const db = getDb();
  await db.insert(userRoles).values({ userId, role }).onConflictDoNothing();
}

export async function revokeRole(userId: string, role: AppRole): Promise<void> {
  const db = getDb();
  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
}
