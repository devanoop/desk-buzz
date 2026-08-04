import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAdmin } from "./admin-auth.functions";

export const listCompaniesForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .order("name");
    if (error) {
      console.error("[listCompaniesForAdmin] db error", error);
      throw new Error("Unable to load companies. Please try again.");
    }
    return { companies: data ?? [] };
  });

const ratingField = z.coerce.number().min(1).max(5);
const optionalRating = z
  .union([z.literal(""), z.coerce.number().min(1).max(5)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const submitTeleReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAdmin])
  .inputValidator((data: unknown) =>
    z
      .object({
        company_id: z.string().uuid(),
        job_title: z.string().trim().min(1).max(120),
        location: z.string().trim().max(120).optional().default(""),
        employment_status: z.enum(["current", "former", "intern", "contract"]),
        rating_overall: ratingField,
        rating_work_life: optionalRating,
        rating_culture: optionalRating,
        rating_compensation: optionalRating,
        pros: z.string().trim().min(1).max(2000),
        cons: z.string().trim().min(1).max(2000),
        verified_source_contact: z.string().trim().max(500).optional().default(""),
        internal_admin_notes: z.string().trim().max(4000).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const notes = [
      data.verified_source_contact
        ? `Verified Source Contact: ${data.verified_source_contact}`
        : null,
      data.internal_admin_notes ? `Notes: ${data.internal_admin_notes}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { error } = await supabaseAdmin.from("reviews").insert({
      company_id: data.company_id,
      job_title: data.job_title,
      location: data.location || null,
      employment_status: data.employment_status,
      rating_overall: data.rating_overall,
      rating_work_life: data.rating_work_life,
      rating_culture: data.rating_culture,
      rating_compensation: data.rating_compensation,
      pros: data.pros,
      cons: data.cons,
      collection_method: "tele-calling",
      verified_source_contact: data.verified_source_contact || null,
      internal_admin_notes: notes || null,
    });
    if (error) {
      console.error("[submitTeleReview] insert error", error);
      throw new Error("Unable to save tele-review. Please try again.");
    }
    return { ok: true };
  });
