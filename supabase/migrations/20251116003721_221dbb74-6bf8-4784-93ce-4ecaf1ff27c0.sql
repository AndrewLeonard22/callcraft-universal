-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create design_features table for customizable image generation features
CREATE TABLE IF NOT EXISTS public.design_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  feature_label TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  options JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.design_features ENABLE ROW LEVEL SECURITY;

-- Policies for design_features
CREATE POLICY "Users can view their organization's design features"
  ON public.design_features FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert design features"
  ON public.design_features FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update design features"
  ON public.design_features FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete design features"
  ON public.design_features FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_design_features_updated_at
  BEFORE UPDATE ON public.design_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default features for existing organizations
INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'pergola',
  'Pergola',
  1,
  '[{"id": "wood", "label": "Wood"}, {"id": "aluminum", "label": "Aluminum"}, {"id": "vinyl", "label": "Vinyl"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'pergola'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'pavers',
  'Pavers',
  2,
  '[{"id": "concrete", "label": "Concrete"}, {"id": "brick", "label": "Brick"}, {"id": "natural-stone", "label": "Natural Stone"}, {"id": "travertine", "label": "Travertine"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'pavers'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'outdoor-kitchen',
  'Outdoor Kitchen',
  3,
  '[{"id": "basic", "label": "Basic (Grill)"}, {"id": "standard", "label": "Standard (Grill + Counter)"}, {"id": "premium", "label": "Premium (Full Kitchen)"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'outdoor-kitchen'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'fire-pit',
  'Fire Pit',
  4,
  '[{"id": "round", "label": "Round"}, {"id": "square", "label": "Square"}, {"id": "linear", "label": "Linear"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'fire-pit'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'pool',
  'Pool',
  5,
  '[{"id": "rectangular", "label": "Rectangular"}, {"id": "freeform", "label": "Freeform"}, {"id": "lap", "label": "Lap Pool"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'pool'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'deck',
  'Deck',
  6,
  '[{"id": "wood", "label": "Wood"}, {"id": "composite", "label": "Composite"}, {"id": "pvc", "label": "PVC"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'deck'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'landscaping',
  'Landscaping',
  7,
  '[{"id": "tropical", "label": "Tropical"}, {"id": "desert", "label": "Desert/Xeriscaping"}, {"id": "traditional", "label": "Traditional"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'landscaping'
);

INSERT INTO public.design_features (organization_id, feature_name, feature_label, display_order, options)
SELECT 
  o.id,
  'lighting',
  'Outdoor Lighting',
  8,
  '[{"id": "path", "label": "Path Lights"}, {"id": "ambient", "label": "Ambient/String Lights"}, {"id": "accent", "label": "Accent/Uplighting"}]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.design_features df WHERE df.organization_id = o.id AND df.feature_name = 'lighting'
);