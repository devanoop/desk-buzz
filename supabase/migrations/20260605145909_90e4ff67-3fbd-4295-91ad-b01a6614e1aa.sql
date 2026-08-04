
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website TEXT;

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  location TEXT,
  employment_status TEXT NOT NULL CHECK (employment_status IN ('current','former','intern','contract')),
  rating_overall NUMERIC(2,1) NOT NULL CHECK (rating_overall >= 1 AND rating_overall <= 5),
  rating_work_life NUMERIC(2,1) CHECK (rating_work_life >= 1 AND rating_work_life <= 5),
  rating_culture NUMERIC(2,1) CHECK (rating_culture >= 1 AND rating_culture <= 5),
  rating_compensation NUMERIC(2,1) CHECK (rating_compensation >= 1 AND rating_compensation <= 5),
  pros TEXT NOT NULL,
  cons TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_company_idx ON public.reviews(company_id);
GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Anyone can post a review" ON public.reviews FOR INSERT WITH CHECK (true);

CREATE TABLE public.salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  experience_years NUMERIC(4,1) NOT NULL CHECK (experience_years >= 0 AND experience_years <= 60),
  annual_ctc_inr BIGINT NOT NULL CHECK (annual_ctc_inr >= 0),
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX salaries_company_idx ON public.salaries(company_id);
GRANT SELECT, INSERT ON public.salaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salaries TO authenticated;
GRANT ALL ON public.salaries TO service_role;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salaries are viewable by everyone" ON public.salaries FOR SELECT USING (true);
CREATE POLICY "Anyone can post a salary" ON public.salaries FOR INSERT WITH CHECK (true);

CREATE TABLE public.company_aggregates (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  benchmark_rating NUMERIC(2,1) CHECK (benchmark_rating >= 1 AND benchmark_rating <= 5),
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_aggregates TO anon, authenticated;
GRANT ALL ON public.company_aggregates TO service_role;
ALTER TABLE public.company_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aggregates are viewable by everyone" ON public.company_aggregates FOR SELECT USING (true);

INSERT INTO public.company_aggregates (company_id, benchmark_rating, source)
SELECT id, 4.1, 'Archive' FROM public.companies WHERE slug='acme-corp'
UNION ALL SELECT id, 3.6, 'Archive' FROM public.companies WHERE slug='globex'
UNION ALL SELECT id, 3.9, 'Archive' FROM public.companies WHERE slug='initech'
UNION ALL SELECT id, 4.3, 'Archive' FROM public.companies WHERE slug='umbrella-co'
UNION ALL SELECT id, 4.6, 'Archive' FROM public.companies WHERE slug='stark-industries';

INSERT INTO public.reviews (company_id, job_title, location, employment_status, rating_overall, rating_work_life, rating_culture, rating_compensation, pros, cons)
SELECT id, 'Senior Engineer', 'Bengaluru', 'current', 4.5, 4.0, 4.5, 4.0,
  'Great mentorship, modern stack, flexible hours and strong engineering culture.',
  'Compensation bands could be more transparent; promotions take time.'
FROM public.companies WHERE slug='stark-industries'
UNION ALL
SELECT id, 'Product Manager', 'Mumbai', 'former', 4.0, 3.5, 4.0, 4.5,
  'High ownership and visibility into strategy. Good comp.',
  'Long hours during launches. Limited remote flexibility.'
FROM public.companies WHERE slug='stark-industries';

INSERT INTO public.salaries (company_id, job_title, experience_years, annual_ctc_inr, location)
SELECT id, 'Software Engineer', 2, 1800000, 'Bengaluru' FROM public.companies WHERE slug='stark-industries'
UNION ALL SELECT id, 'Senior Engineer', 5, 3500000, 'Bengaluru' FROM public.companies WHERE slug='stark-industries'
UNION ALL SELECT id, 'Product Manager', 6, 4200000, 'Mumbai' FROM public.companies WHERE slug='stark-industries';
