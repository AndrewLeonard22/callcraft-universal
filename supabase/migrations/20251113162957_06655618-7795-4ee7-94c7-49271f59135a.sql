-- Create quiz scores table to track agent performance
CREATE TABLE public.quiz_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quiz_scores ENABLE ROW LEVEL SECURITY;

-- Users can view scores in their organization
CREATE POLICY "Organization members can view quiz scores"
ON public.quiz_scores
FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

-- Users can insert their own scores
CREATE POLICY "Users can insert their own quiz scores"
ON public.quiz_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_organization_member(auth.uid(), organization_id));

-- Create index for faster queries
CREATE INDEX idx_quiz_scores_org_user ON public.quiz_scores(organization_id, user_id);
CREATE INDEX idx_quiz_scores_completed ON public.quiz_scores(completed_at DESC);