-- Allow saving images without organization_id since we now use client_id
ALTER TABLE public.generated_images
ALTER COLUMN organization_id DROP NOT NULL;