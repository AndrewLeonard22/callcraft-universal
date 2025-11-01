-- Create storage bucket for generated backyard images
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-backyards', 'generated-backyards', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the bucket
CREATE POLICY "Anyone can view generated backyard images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'generated-backyards');

CREATE POLICY "Authenticated users can upload generated backyard images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'generated-backyards' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own generated backyard images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'generated-backyards' 
  AND auth.uid() IS NOT NULL
);

-- Create table for saved generated images
CREATE TABLE public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  features TEXT[] NOT NULL,
  feature_options JSONB,
  feature_size TEXT NOT NULL DEFAULT 'medium',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can view generated images"
ON public.generated_images
FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create generated images"
ON public.generated_images
FOR INSERT
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update generated images"
ON public.generated_images
FOR UPDATE
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete generated images"
ON public.generated_images
FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));

-- Add trigger for updated_at
CREATE TRIGGER update_generated_images_updated_at
BEFORE UPDATE ON public.generated_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();