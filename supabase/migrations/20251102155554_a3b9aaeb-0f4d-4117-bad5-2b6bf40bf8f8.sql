-- Fix security issue: Remove public access to clients table
-- All clients must belong to an organization for proper access control

-- Drop existing policies
DROP POLICY IF EXISTS "Organization members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Organization members can create clients" ON public.clients;
DROP POLICY IF EXISTS "Organization members can update clients" ON public.clients;
DROP POLICY IF EXISTS "Owners and admins can delete clients" ON public.clients;

-- Create new secure policies that require organization membership
CREATE POLICY "Organization members can view clients" 
ON public.clients 
FOR SELECT 
TO authenticated
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create clients" 
ON public.clients 
FOR INSERT 
TO authenticated
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update clients" 
ON public.clients 
FOR UPDATE 
TO authenticated
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete clients" 
ON public.clients 
FOR DELETE 
TO authenticated
USING (can_manage_organization(auth.uid(), organization_id));

-- Make organization_id NOT NULL to enforce proper organization association
ALTER TABLE public.clients ALTER COLUMN organization_id SET NOT NULL;