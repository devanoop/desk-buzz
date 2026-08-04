ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.companies TO anon;
GRANT SELECT, INSERT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

GRANT SELECT ON public.company_aggregates TO anon, authenticated;
GRANT ALL ON public.company_aggregates TO service_role;

GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT ON public.salaries TO anon, authenticated;
GRANT INSERT ON public.salaries TO anon, authenticated;
GRANT ALL ON public.salaries TO service_role;

DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
CREATE POLICY "Companies are viewable by everyone"
  ON public.companies FOR SELECT
  TO anon, authenticated
  USING (true);