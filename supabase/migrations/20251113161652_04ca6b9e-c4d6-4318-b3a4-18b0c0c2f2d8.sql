-- Drop the existing constraint that requires module_id or section_id
ALTER TABLE public.training_questions 
DROP CONSTRAINT IF EXISTS training_questions_module_or_section_check;

-- Add new constraint that allows standalone questions (both null) or linked questions
ALTER TABLE public.training_questions
ADD CONSTRAINT training_questions_module_or_section_check CHECK (
  (module_id IS NULL AND section_id IS NULL) OR
  (module_id IS NOT NULL AND section_id IS NULL) OR
  (module_id IS NULL AND section_id IS NOT NULL)
);