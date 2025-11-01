-- Add client_id column to generated_images table
ALTER TABLE public.generated_images
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Update RLS policies to work with client_id
DROP POLICY IF EXISTS "Organization members can view generated images" ON public.generated_images;
DROP POLICY IF EXISTS "Organization members can create generated images" ON public.generated_images;
DROP POLICY IF EXISTS "Organization members can update generated images" ON public.generated_images;
DROP POLICY IF EXISTS "Owners and admins can delete generated images" ON public.generated_images;

-- Create new RLS policies that check via client's organization
CREATE POLICY "Users can view generated images for their clients"
ON public.generated_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = generated_images.client_id
    AND (clients.organization_id IS NULL OR is_organization_member(auth.uid(), clients.organization_id))
  )
);

CREATE POLICY "Users can create generated images for their clients"
ON public.generated_images
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = generated_images.client_id
    AND (clients.organization_id IS NULL OR is_organization_member(auth.uid(), clients.organization_id))
  )
);

CREATE POLICY "Users can update generated images for their clients"
ON public.generated_images
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = generated_images.client_id
    AND (clients.organization_id IS NULL OR is_organization_member(auth.uid(), clients.organization_id))
  )
);

CREATE POLICY "Users can delete generated images for their clients"
ON public.generated_images
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = generated_images.client_id
    AND (clients.organization_id IS NULL OR can_manage_organization(auth.uid(), clients.organization_id))
  )
);