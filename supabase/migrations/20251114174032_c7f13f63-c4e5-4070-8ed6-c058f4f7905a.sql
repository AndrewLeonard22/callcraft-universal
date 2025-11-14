-- Add service_type_id to training_modules to organize by service
ALTER TABLE public.training_modules 
ADD COLUMN service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_training_modules_service_type ON public.training_modules(service_type_id);

-- Update RLS policy to allow reading modules for the organization's service types
DROP POLICY IF EXISTS "Users can view training modules for their organization" ON public.training_modules;

CREATE POLICY "Users can view training modules for their organization"
ON public.training_modules
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);