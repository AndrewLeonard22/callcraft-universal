-- Add image_url column to scripts table for template images
ALTER TABLE public.scripts
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for template images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-images', 'template-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view template images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload template images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update template images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete template images" ON storage.objects;

-- Create RLS policies for template-images bucket
CREATE POLICY "Anyone can view template images"
ON storage.objects FOR SELECT
USING (bucket_id = 'template-images');

CREATE POLICY "Anyone can upload template images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'template-images');

CREATE POLICY "Anyone can update template images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'template-images');

CREATE POLICY "Anyone can delete template images"
ON storage.objects FOR DELETE
USING (bucket_id = 'template-images');