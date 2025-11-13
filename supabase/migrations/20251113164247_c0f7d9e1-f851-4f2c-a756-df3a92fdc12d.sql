-- Add call_agent_id to quiz_scores table
ALTER TABLE public.quiz_scores
ADD COLUMN call_agent_id uuid REFERENCES public.call_agents(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_quiz_scores_call_agent_id ON public.quiz_scores(call_agent_id);