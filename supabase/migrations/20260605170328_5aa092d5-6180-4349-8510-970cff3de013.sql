
-- 1) Hide sensitive columns on reviews from public/anon/authenticated readers
REVOKE SELECT (internal_admin_notes, verified_source_contact) ON public.reviews FROM anon, authenticated, PUBLIC;

-- 2) Tighten always-true INSERT policies with basic content checks
DROP POLICY IF EXISTS "Anyone can post a review" ON public.reviews;
CREATE POLICY "Anyone can post a review"
ON public.reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(job_title)) BETWEEN 1 AND 120
  AND length(btrim(pros)) BETWEEN 10 AND 2000
  AND length(btrim(cons)) BETWEEN 10 AND 2000
  AND rating_overall BETWEEN 1 AND 5
  AND employment_status IN ('current','former','intern','contract')
  AND internal_admin_notes IS NULL
  AND verified_source_contact IS NULL
);

DROP POLICY IF EXISTS "Anyone can post a salary" ON public.salaries;
CREATE POLICY "Anyone can post a salary"
ON public.salaries
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(job_title)) BETWEEN 1 AND 120
  AND annual_ctc_inr > 0
  AND experience_years >= 0 AND experience_years <= 60
);

DROP POLICY IF EXISTS "Anyone can add a company" ON public.companies;
CREATE POLICY "Anyone can add a company"
ON public.companies
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND length(btrim(slug)) BETWEEN 1 AND 200
);
