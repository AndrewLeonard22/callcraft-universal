-- Remove client_id column from faqs table
ALTER TABLE public.faqs DROP COLUMN IF EXISTS client_id;