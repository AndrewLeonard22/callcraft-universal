-- Remove the NULL organization_id loophole from all policies
-- This ensures only organization members can see their own data

-- Fix service_types policies
DROP POLICY IF EXISTS "Organization members can view their service types" ON public.service_types;
DROP POLICY IF EXISTS "Organization members can create service types" ON public.service_types;
DROP POLICY IF EXISTS "Organization members can update their service types" ON public.service_types;
DROP POLICY IF EXISTS "Admins can delete service types" ON public.service_types;

CREATE POLICY "Organization members can view their service types"
ON public.service_types FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create service types"
ON public.service_types FOR INSERT
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their service types"
ON public.service_types FOR UPDATE
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete service types"
ON public.service_types FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));

-- Fix FAQs policies
DROP POLICY IF EXISTS "Organization members can view their FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Organization members can create FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Organization members can update their FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can delete FAQs" ON public.faqs;

CREATE POLICY "Organization members can view their FAQs"
ON public.faqs FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create FAQs"
ON public.faqs FOR INSERT
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their FAQs"
ON public.faqs FOR UPDATE
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete FAQs"
ON public.faqs FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));

-- Fix qualification_questions policies
DROP POLICY IF EXISTS "Organization members can view their qualification questions" ON public.qualification_questions;
DROP POLICY IF EXISTS "Organization members can create qualification questions" ON public.qualification_questions;
DROP POLICY IF EXISTS "Organization members can update their qualification questions" ON public.qualification_questions;
DROP POLICY IF EXISTS "Admins can delete qualification questions" ON public.qualification_questions;

CREATE POLICY "Organization members can view their qualification questions"
ON public.qualification_questions FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create qualification questions"
ON public.qualification_questions FOR INSERT
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their qualification questions"
ON public.qualification_questions FOR UPDATE
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete qualification questions"
ON public.qualification_questions FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));