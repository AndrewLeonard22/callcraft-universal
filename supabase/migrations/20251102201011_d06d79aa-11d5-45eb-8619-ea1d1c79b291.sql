-- Create qualification questions table
CREATE TABLE public.qualification_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID
);

-- Enable RLS
ALTER TABLE public.qualification_questions ENABLE ROW LEVEL SECURITY;

-- Create policies for qualification questions
CREATE POLICY "Anyone can view qualification questions"
  ON public.qualification_questions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert qualification questions"
  ON public.qualification_questions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update qualification questions"
  ON public.qualification_questions
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete qualification questions"
  ON public.qualification_questions
  FOR DELETE
  USING (true);

-- Create qualification responses table
CREATE TABLE public.qualification_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.qualification_questions(id) ON DELETE CASCADE,
  is_asked BOOLEAN NOT NULL DEFAULT false,
  customer_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(script_id, question_id)
);

-- Enable RLS
ALTER TABLE public.qualification_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for qualification responses
CREATE POLICY "Organization members can view qualification responses"
  ON public.qualification_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = qualification_responses.script_id
      AND (scripts.organization_id IS NULL OR is_organization_member(auth.uid(), scripts.organization_id))
    )
  );

CREATE POLICY "Organization members can create qualification responses"
  ON public.qualification_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = qualification_responses.script_id
      AND (scripts.organization_id IS NULL OR is_organization_member(auth.uid(), scripts.organization_id))
    )
  );

CREATE POLICY "Organization members can update qualification responses"
  ON public.qualification_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = qualification_responses.script_id
      AND (scripts.organization_id IS NULL OR is_organization_member(auth.uid(), scripts.organization_id))
    )
  );

CREATE POLICY "Owners and admins can delete qualification responses"
  ON public.qualification_responses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.scripts
      WHERE scripts.id = qualification_responses.script_id
      AND (scripts.organization_id IS NULL OR can_manage_organization(auth.uid(), scripts.organization_id))
    )
  );

-- Add qualification summary field to scripts table
ALTER TABLE public.scripts
ADD COLUMN qualification_summary TEXT;

-- Create trigger for updated_at on qualification_responses
CREATE TRIGGER update_qualification_responses_updated_at
  BEFORE UPDATE ON public.qualification_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_qualification_questions_service_type ON public.qualification_questions(service_type_id);
CREATE INDEX idx_qualification_responses_script ON public.qualification_responses(script_id);