import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { companies, reviewDisputes, reviews } from "../db/schema";
import {
  requireAuth,
  requireVerifiedEmail,
  requireAdmin,
  requireModeratorOrAdmin,
} from "../auth/middleware";
import { checkRateLimit, RATE_LIMITS } from "../auth/rate-limit";
import { recordAuditLogEntry } from "../admin/audit-log";
import {
  MIN_CONS_CHARS,
  MIN_PROS_CHARS,
  moderateReview,
} from "../../lib/review-moderation";
import { logger } from "../logging/logger";

function clientIp(): string {
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

const EDIT_WINDOW_DAYS = 30;

const employmentStatusSchema = z.enum([
  "current",
  "former",
  "intern",
  "contract",
]);
const ratingSchema = z.coerce.number().min(1).max(5);

const reviewInputSchema = z.object({
  companySlug: z.string().min(1),
  jobTitle: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional().default(""),
  employmentStatus: employmentStatusSchema,
  employmentTenure: z.string().trim().max(60).optional().default(""),
  ratingCompensation: ratingSchema,
  ratingManagement: ratingSchema,
  ratingWorkLife: ratingSchema,
  ratingCulture: ratingSchema,
  ratingCareerGrowth: ratingSchema,
  pros: z.string().trim().min(MIN_PROS_CHARS).max(2000),
  cons: z.string().trim().min(MIN_CONS_CHARS).max(2000),
});

function averageRating(values: number[]): string {
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return (Math.round(avg * 10) / 10).toFixed(1);
}

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireVerifiedEmail])
  .inputValidator((data: unknown) => reviewInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.userId,
      "submit-review",
      RATE_LIMITS.submitReview,
    );

    const heuristicIssues = moderateReview({
      pros: data.pros,
      cons: data.cons,
    });
    if (heuristicIssues.length > 0) {
      throw new Error(heuristicIssues[0].message);
    }

    const db = getDb();
    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, data.companySlug),
    });
    if (!company) throw new Error("Company not found.");

    // One review per (user, company) per cooling-off period, same guard the
    // previous version of this app used.
    const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6);
    const prior = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.userId, context.userId),
        eq(reviews.companyId, company.id),
      ),
      orderBy: desc(reviews.createdAt),
    });
    if (prior && prior.createdAt > sixMonthsAgo) {
      throw new Error(
        "You've already reviewed this company in the last 6 months.",
      );
    }

    const [row] = await db
      .insert(reviews)
      .values({
        companyId: company.id,
        userId: context.userId,
        jobTitle: data.jobTitle,
        location: data.location || null,
        employmentStatus: data.employmentStatus,
        employmentTenure: data.employmentTenure || null,
        ratingOverall: averageRating([
          data.ratingCompensation,
          data.ratingManagement,
          data.ratingWorkLife,
          data.ratingCulture,
          data.ratingCareerGrowth,
        ]),
        ratingCompensation: String(data.ratingCompensation),
        ratingManagement: String(data.ratingManagement),
        ratingWorkLife: String(data.ratingWorkLife),
        ratingCulture: String(data.ratingCulture),
        ratingCareerGrowth: String(data.ratingCareerGrowth),
        pros: data.pros,
        cons: data.cons,
        submissionSource: "self_submitted",
        status: "pending", // always goes through the moderation queue — see modules/reviews/functions.ts moderateReviewSubmission
        editWindowExpiresAt: new Date(
          Date.now() + EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        ),
      })
      .returning({ id: reviews.id });

    return { ok: true, reviewId: row.id, companySlug: company.slug };
  });

async function loadOwnEditableReview(userId: string, reviewId: string) {
  const db = getDb();
  const review = await db.query.reviews.findFirst({
    where: eq(reviews.id, reviewId),
  });
  if (!review) throw new Error("Review not found.");
  if (
    review.submissionSource !== "self_submitted" ||
    review.userId !== userId
  ) {
    throw new Error("Forbidden: this isn't your review.");
  }
  if (
    !review.editWindowExpiresAt ||
    review.editWindowExpiresAt.getTime() < Date.now()
  ) {
    throw new Error("The edit window for this review has passed.");
  }
  return review;
}

export const editOwnReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    reviewInputSchema.extend({ reviewId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await loadOwnEditableReview(context.userId, data.reviewId);

    const heuristicIssues = moderateReview({
      pros: data.pros,
      cons: data.cons,
    });
    if (heuristicIssues.length > 0) throw new Error(heuristicIssues[0].message);

    const db = getDb();
    // Edited content goes back into the moderation queue — an edit can
    // reintroduce exactly the kind of problem moderation exists to catch,
    // so it doesn't get to skip the queue just because the original did.
    await db
      .update(reviews)
      .set({
        jobTitle: data.jobTitle,
        location: data.location || null,
        employmentStatus: data.employmentStatus,
        employmentTenure: data.employmentTenure || null,
        ratingOverall: averageRating([
          data.ratingCompensation,
          data.ratingManagement,
          data.ratingWorkLife,
          data.ratingCulture,
          data.ratingCareerGrowth,
        ]),
        ratingCompensation: String(data.ratingCompensation),
        ratingManagement: String(data.ratingManagement),
        ratingWorkLife: String(data.ratingWorkLife),
        ratingCulture: String(data.ratingCulture),
        ratingCareerGrowth: String(data.ratingCareerGrowth),
        pros: data.pros,
        cons: data.cons,
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, data.reviewId));

    return { ok: true };
  });

export const deleteOwnReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z.object({ reviewId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await loadOwnEditableReview(context.userId, data.reviewId);
    const db = getDb();
    await db.delete(reviews).where(eq(reviews.id, data.reviewId));
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Admin-on-behalf submission — guardrails per the brief, not optional:
//   - submission_source is always "admin_on_behalf", never spoofable as
//     self_submitted (there's no input field for it — the handler sets it).
//   - justification is a required, validated non-empty field.
//   - every creation writes an audit_log row.
//   - rate-limited separately from self-submission.
//   - the public page renders a visible badge for non-self-submitted
//     reviews (see src/components/ReviewCard.tsx) — not a UI nicety, part
//     of the guardrail.
// ---------------------------------------------------------------------------

const adminOnBehalfSchema = reviewInputSchema.extend({
  justification: z.string().trim().min(10).max(2000),
});

export const submitReviewAdminOnBehalf = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) => adminOnBehalfSchema.parse(data))
  .handler(async ({ data, context }) => {
    await checkRateLimit(
      context.userId,
      "admin-on-behalf",
      RATE_LIMITS.adminOnBehalf,
    );

    const db = getDb();
    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, data.companySlug),
    });
    if (!company) throw new Error("Company not found.");

    const [row] = await db
      .insert(reviews)
      .values({
        companyId: company.id,
        userId: null,
        jobTitle: data.jobTitle,
        location: data.location || null,
        employmentStatus: data.employmentStatus,
        employmentTenure: data.employmentTenure || null,
        ratingOverall: averageRating([
          data.ratingCompensation,
          data.ratingManagement,
          data.ratingWorkLife,
          data.ratingCulture,
          data.ratingCareerGrowth,
        ]),
        ratingCompensation: String(data.ratingCompensation),
        ratingManagement: String(data.ratingManagement),
        ratingWorkLife: String(data.ratingWorkLife),
        ratingCulture: String(data.ratingCulture),
        ratingCareerGrowth: String(data.ratingCareerGrowth),
        pros: data.pros,
        cons: data.cons,
        submissionSource: "admin_on_behalf",
        // Admin has already exercised judgment transcribing this (that
        // judgment plus the justification/audit trail *is* the review step
        // for this path) — it publishes immediately rather than sitting in
        // the same queue as anonymous self-submissions.
        status: "approved",
        editWindowExpiresAt: null, // no author to edit it later
      })
      .returning({ id: reviews.id });

    await recordAuditLogEntry({
      adminUserId: context.userId,
      action: "review.admin_on_behalf_create",
      targetTable: "reviews",
      targetId: row.id,
      justification: data.justification,
    });

    return { ok: true, reviewId: row.id };
  });

const redactSchema = z.object({
  reviewId: z.string().uuid(),
  justification: z.string().trim().min(10).max(2000),
});

/**
 * The *only* mutation an admin has against a self_submitted review's text —
 * there is no "edit review text" function for admins anywhere in this
 * module, by design. Stores the pre-redaction content and requires a
 * justification, both written where the audit trail can't be bypassed.
 */
export const redactReview = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) => redactSchema.parse(data))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.reviewId),
    });
    if (!review) throw new Error("Review not found.");
    if (review.status === "redacted")
      throw new Error("This review has already been redacted.");

    const originalSnapshot = JSON.stringify({
      jobTitle: review.jobTitle,
      pros: review.pros,
      cons: review.cons,
      redactedAt: new Date().toISOString(),
    });

    await db
      .update(reviews)
      .set({
        pros: "[This review has been redacted by a DeskBuz administrator.]",
        cons: "[This review has been redacted by a DeskBuz administrator.]",
        status: "redacted",
        originalText: originalSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, data.reviewId));

    await recordAuditLogEntry({
      adminUserId: context.userId,
      action: "review.redact",
      targetTable: "reviews",
      targetId: data.reviewId,
      justification: data.justification,
    });

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Moderation queue — moderator or admin
// ---------------------------------------------------------------------------

export const listModerationQueue = createServerFn({ method: "GET" })
  .middleware([requireModeratorOrAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: reviews.id,
        companyId: reviews.companyId,
        companyName: companies.name,
        companySlug: companies.slug,
        jobTitle: reviews.jobTitle,
        pros: reviews.pros,
        cons: reviews.cons,
        submissionSource: reviews.submissionSource,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(companies, eq(reviews.companyId, companies.id))
      .where(eq(reviews.status, "pending"))
      .orderBy(reviews.createdAt);
    return { reviews: rows };
  });

export const moderateReviewDecision = createServerFn({ method: "POST" })
  .middleware([requireModeratorOrAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({
        reviewId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    await db
      .update(reviews)
      .set({
        status: data.decision === "approve" ? "approved" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, data.reviewId));
    logger.info("review.moderated", {
      reviewId: data.reviewId,
      decision: data.decision,
      moderatorId: context.userId,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Company-facing dispute flow — no company accounts exist, so this is
// public and unauthenticated, gated only by rate limiting.
// ---------------------------------------------------------------------------

export const disputeReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        reviewId: z.string().uuid(),
        contactEmail: z.string().trim().toLowerCase().email().max(254),
        reason: z.string().trim().min(20).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await checkRateLimit(
      clientIp(),
      "dispute-review",
      RATE_LIMITS.disputeReview,
    );

    const db = getDb();
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.reviewId),
    });
    if (!review) throw new Error("Review not found.");

    await db.insert(reviewDisputes).values({
      reviewId: data.reviewId,
      companyId: review.companyId,
      raisedByContact: data.contactEmail,
      reason: data.reason,
    });

    return { ok: true };
  });

export const listOpenDisputes = createServerFn({ method: "GET" })
  .middleware([requireModeratorOrAdmin])
  .handler(async () => {
    const db = getDb();
    const rows = await db
      .select({
        id: reviewDisputes.id,
        reviewId: reviewDisputes.reviewId,
        companyName: companies.name,
        companySlug: companies.slug,
        raisedByContact: reviewDisputes.raisedByContact,
        reason: reviewDisputes.reason,
        createdAt: reviewDisputes.createdAt,
        reviewJobTitle: reviews.jobTitle,
        reviewPros: reviews.pros,
        reviewCons: reviews.cons,
      })
      .from(reviewDisputes)
      .innerJoin(companies, eq(reviewDisputes.companyId, companies.id))
      .innerJoin(reviews, eq(reviewDisputes.reviewId, reviews.id))
      .where(eq(reviewDisputes.status, "open"))
      .orderBy(reviewDisputes.createdAt);
    return { disputes: rows };
  });

export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireModeratorOrAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({
        disputeId: z.string().uuid(),
        decision: z.enum(["resolved", "dismissed"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = getDb();
    await db
      .update(reviewDisputes)
      .set({
        status: data.decision,
        resolvedBy: context.userId,
        resolvedAt: new Date(),
      })
      .where(eq(reviewDisputes.id, data.disputeId));
    return { ok: true };
  });
