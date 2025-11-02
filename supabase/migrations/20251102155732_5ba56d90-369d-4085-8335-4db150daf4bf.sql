-- Add organization_id column to objection_handling_templates
ALTER TABLE public.objection_handling_templates 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Assign existing templates to Andrew's Team organization
UPDATE public.objection_handling_templates 
SET organization_id = 'aa9cef19-2e65-4df2-bb3f-a4220434df00'
WHERE organization_id IS NULL;

-- Make organization_id required
ALTER TABLE public.objection_handling_templates 
ALTER COLUMN organization_id SET NOT NULL;