-- Create service_types table
CREATE TABLE IF NOT EXISTS public.service_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Create policies for service_types
CREATE POLICY "Anyone can view service types"
ON public.service_types FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert service types"
ON public.service_types FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update service types"
ON public.service_types FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete service types"
ON public.service_types FOR DELETE
USING (true);

-- Add service_type_id to scripts table
ALTER TABLE public.scripts
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Seed with default service types
INSERT INTO public.service_types (name, icon_url) VALUES
  ('Pools', '/src/assets/logo-default.png'),
  ('Pavers', '/src/assets/logo-default.png'),
  ('Pergola', '/src/assets/logo-pergola.png'),
  ('Turf', '/src/assets/logo-default.png'),
  ('Outdoor Kitchen', '/src/assets/logo-default.png'),
  ('HVAC', '/src/assets/logo-hvac.png'),
  ('Landscaping', '/src/assets/logo-landscaping.png'),
  ('Solar', '/src/assets/logo-solar.png')
ON CONFLICT (name) DO NOTHING;