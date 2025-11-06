-- Create training modules table
CREATE TABLE public.training_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon_name TEXT DEFAULT 'Book',
  category TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training sections table (sub-items within modules)
CREATE TABLE public.training_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training benefits table
CREATE TABLE public.training_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.training_sections(id) ON DELETE CASCADE,
  benefit_text TEXT NOT NULL,
  benefit_type TEXT DEFAULT 'pro',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training features table
CREATE TABLE public.training_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.training_sections(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training videos table
CREATE TABLE public.training_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES public.training_modules(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.training_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_modules
CREATE POLICY "Users can view training modules in their organization"
ON public.training_modules FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can insert training modules"
ON public.training_modules FOR INSERT
WITH CHECK (can_manage_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can update training modules"
ON public.training_modules FOR UPDATE
USING (can_manage_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can delete training modules"
ON public.training_modules FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));

-- RLS Policies for training_sections
CREATE POLICY "Users can view training sections in their organization"
ON public.training_sections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = training_sections.module_id
    AND is_organization_member(auth.uid(), organization_id)
  )
);

CREATE POLICY "Admins can insert training sections"
ON public.training_sections FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = training_sections.module_id
    AND can_manage_organization(auth.uid(), organization_id)
  )
);

CREATE POLICY "Admins can update training sections"
ON public.training_sections FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = training_sections.module_id
    AND can_manage_organization(auth.uid(), organization_id)
  )
);

CREATE POLICY "Admins can delete training sections"
ON public.training_sections FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = training_sections.module_id
    AND can_manage_organization(auth.uid(), organization_id)
  )
);

-- RLS Policies for training_benefits
CREATE POLICY "Users can view training benefits in their organization"
ON public.training_benefits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.training_sections ts
    JOIN public.training_modules tm ON ts.module_id = tm.id
    WHERE ts.id = training_benefits.section_id
    AND is_organization_member(auth.uid(), tm.organization_id)
  )
);

CREATE POLICY "Admins can manage training benefits"
ON public.training_benefits FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.training_sections ts
    JOIN public.training_modules tm ON ts.module_id = tm.id
    WHERE ts.id = training_benefits.section_id
    AND can_manage_organization(auth.uid(), tm.organization_id)
  )
);

-- RLS Policies for training_features
CREATE POLICY "Users can view training features in their organization"
ON public.training_features FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.training_sections ts
    JOIN public.training_modules tm ON ts.module_id = tm.id
    WHERE ts.id = training_features.section_id
    AND is_organization_member(auth.uid(), tm.organization_id)
  )
);

CREATE POLICY "Admins can manage training features"
ON public.training_features FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.training_sections ts
    JOIN public.training_modules tm ON ts.module_id = tm.id
    WHERE ts.id = training_features.section_id
    AND can_manage_organization(auth.uid(), tm.organization_id)
  )
);

-- RLS Policies for training_videos
CREATE POLICY "Users can view training videos in their organization"
ON public.training_videos FOR SELECT
USING (
  (module_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = training_videos.module_id
    AND is_organization_member(auth.uid(), organization_id)
  ))
  OR
  (section_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.training_sections ts
    JOIN public.training_modules tm ON ts.module_id = tm.id
    WHERE ts.id = training_videos.section_id
    AND is_organization_member(auth.uid(), tm.organization_id)
  ))
);

CREATE POLICY "Admins can manage training videos"
ON public.training_videos FOR ALL
USING (
  (module_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.training_modules
    WHERE id = training_videos.module_id
    AND can_manage_organization(auth.uid(), organization_id)
  ))
  OR
  (section_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.training_sections ts
    JOIN public.training_modules tm ON ts.module_id = tm.id
    WHERE ts.id = training_videos.section_id
    AND can_manage_organization(auth.uid(), tm.organization_id)
  ))
);

-- Create indexes for better performance
CREATE INDEX idx_training_modules_org ON public.training_modules(organization_id);
CREATE INDEX idx_training_sections_module ON public.training_sections(module_id);
CREATE INDEX idx_training_benefits_section ON public.training_benefits(section_id);
CREATE INDEX idx_training_features_section ON public.training_features(section_id);
CREATE INDEX idx_training_videos_module ON public.training_videos(module_id);
CREATE INDEX idx_training_videos_section ON public.training_videos(section_id);

-- Trigger for updated_at
CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_training_sections_updated_at
  BEFORE UPDATE ON public.training_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();