#!/usr/bin/env node
// Bootstraps the first admin (or moderator) account. There is no in-app UI
// for this by design — it would otherwise be a chicken-and-egg problem, and
// a superuser role shouldn't be grantable through a web form anyway.
//
// Usage:
//   1. Sign up normally through the app (creates a verified `user`).
//   2. npm run grant-admin -- you@example.com
//   3. npm run grant-admin -- you@example.com --role=moderator

import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/modules/db/client";
import { users } from "../src/modules/db/schema";
import { grantRole, type AppRole } from "../src/modules/auth/roles";

function parseArgs(argv: string[]) {
  const email = argv.find((a) => !a.startsWith("--"));
  const roleArg = argv.find((a) => a.startsWith("--role="));
  const role = (roleArg?.split("=")[1] ?? "admin") as AppRole;
  if (!email) {
    throw new Error(
      "Usage: npm run grant-admin -- <email> [--role=admin|moderator]",
    );
  }
  if (!["admin", "moderator", "user"].includes(role)) {
    throw new Error(`Invalid role "${role}". Use admin, moderator, or user.`);
  }
  return { email, role };
}

async function main() {
  const { email, role } = parseArgs(process.argv.slice(2));
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  if (!user) {
    throw new Error(
      `No account found for ${email}. Sign up through the app first, then run this again.`,
    );
  }
  await grantRole(user.id, role);
  console.log(`Granted "${role}" to ${email} (user id ${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
