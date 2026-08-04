CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX companies_name_idx ON public.companies (lower(name));
GRANT SELECT, INSERT ON public.companies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies are viewable by everyone" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Anyone can add a company" ON public.companies FOR INSERT WITH CHECK (true);

INSERT INTO public.companies (name, slug, industry, description) VALUES
  ('Acme Corp', 'acme-corp', 'Technology', 'A leading tech company.'),
  ('Globex', 'globex', 'Finance', 'Global financial services.'),
  ('Initech', 'initech', 'Software', 'Enterprise software solutions.'),
  ('Umbrella Co', 'umbrella-co', 'Pharmaceuticals', 'Pharma research and development.'),
  ('Stark Industries', 'stark-industries', 'Manufacturing', 'Advanced manufacturing and defense.');