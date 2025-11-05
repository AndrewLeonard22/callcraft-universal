-- Add display_order column to scripts table
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add display_order column to objection_handling_templates table
ALTER TABLE public.objection_handling_templates ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add display_order column to faqs table
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Update existing records to have sequential display_order based on created_at
WITH ordered_scripts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS new_order
  FROM public.scripts
)
UPDATE public.scripts
SET display_order = ordered_scripts.new_order
FROM ordered_scripts
WHERE scripts.id = ordered_scripts.id;

WITH ordered_objections AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS new_order
  FROM public.objection_handling_templates
)
UPDATE public.objection_handling_templates
SET display_order = ordered_objections.new_order
FROM ordered_objections
WHERE objection_handling_templates.id = ordered_objections.id;

WITH ordered_faqs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS new_order
  FROM public.faqs
)
UPDATE public.faqs
SET display_order = ordered_faqs.new_order
FROM ordered_faqs
WHERE faqs.id = ordered_faqs.id;