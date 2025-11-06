-- First, let's update the foreign key constraint to allow deletion
-- Drop the existing foreign key constraint
ALTER TABLE public.scripts 
DROP CONSTRAINT IF EXISTS scripts_service_type_id_fkey;

-- Add it back with ON DELETE SET NULL so deleting a service type sets the reference to NULL
ALTER TABLE public.scripts 
ADD CONSTRAINT scripts_service_type_id_fkey 
FOREIGN KEY (service_type_id) 
REFERENCES public.service_types(id) 
ON DELETE SET NULL;

-- Update service_types that have NULL organization_id to prevent them from being visible to everyone
-- We'll need to identify orphaned service types and either assign them or mark them for cleanup
-- For now, let's just make sure future service types always have an organization_id

-- Add a check to help identify problematic NULL organization_ids
CREATE OR REPLACE FUNCTION public.validate_service_type_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure organization_id is set for new service types
  IF NEW.organization_id IS NULL AND auth.uid() IS NOT NULL THEN
    -- Get the user's organization
    SELECT organization_id INTO NEW.organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-set organization_id on insert
DROP TRIGGER IF EXISTS set_service_type_organization ON public.service_types;
CREATE TRIGGER set_service_type_organization
  BEFORE INSERT ON public.service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_service_type_organization();