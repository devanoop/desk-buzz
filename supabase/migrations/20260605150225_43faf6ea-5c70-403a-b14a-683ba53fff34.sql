
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS collection_method TEXT NOT NULL DEFAULT 'self-service'
    CHECK (collection_method IN ('self-service','tele-calling','import')),
  ADD COLUMN IF NOT EXISTS verified_source_contact TEXT,
  ADD COLUMN IF NOT EXISTS internal_admin_notes TEXT;

-- Lock down column-level access so anon/authenticated can't read internal fields
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (
  id, company_id, job_title, location, employment_status,
  rating_overall, rating_work_life, rating_culture, rating_compensation,
  pros, cons, created_at, collection_method
) ON public.reviews TO anon, authenticated;
