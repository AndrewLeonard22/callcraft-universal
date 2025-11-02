-- Fix security issue: Restrict objection_handling_templates to organization members

-- Drop the unrestricted policy
DROP POLICY IF EXISTS "Allow all operations on objection_handling_templates" ON public.objection_handling_templates;

-- Create secure policies that require organization membership
CREATE POLICY "Organization members can view templates" 
ON public.objection_handling_templates 
FOR SELECT 
TO authenticated
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create templates" 
ON public.objection_handling_templates 
FOR INSERT 
TO authenticated
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update templates" 
ON public.objection_handling_templates 
FOR UPDATE 
TO authenticated
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete templates" 
ON public.objection_handling_templates 
FOR DELETE 
TO authenticated
USING (can_manage_organization(auth.uid(), organization_id));