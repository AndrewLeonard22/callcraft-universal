-- Create training questions table for flashcard quiz feature
CREATE TABLE IF NOT EXISTS public.training_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES public.training_modules(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.training_sections(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID NOT NULL,
  CONSTRAINT training_questions_module_or_section_check CHECK (
    (module_id IS NOT NULL AND section_id IS NULL) OR
    (module_id IS NULL AND section_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.training_questions ENABLE ROW LEVEL SECURITY;

-- Users can view training questions in their organization
CREATE POLICY "Users can view training questions in their organization"
ON public.training_questions
FOR SELECT
USING (
  is_organization_member(auth.uid(), organization_id)
);

-- Admins can manage training questions
CREATE POLICY "Admins can manage training questions"
ON public.training_questions
FOR ALL
USING (
  can_manage_organization(auth.uid(), organization_id)
);

-- Create index for faster queries
CREATE INDEX idx_training_questions_organization ON public.training_questions(organization_id);
CREATE INDEX idx_training_questions_module ON public.training_questions(module_id);
CREATE INDEX idx_training_questions_section ON public.training_questions(section_id);