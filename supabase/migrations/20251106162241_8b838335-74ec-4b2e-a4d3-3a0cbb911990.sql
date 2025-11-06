-- Fix RLS policies for service_types to be organization-specific
DROP POLICY IF EXISTS "Anyone can view service types" ON public.service_types;
DROP POLICY IF EXISTS "Anyone can insert service types" ON public.service_types;
DROP POLICY IF EXISTS "Anyone can update service types" ON public.service_types;
DROP POLICY IF EXISTS "Anyone can delete service types" ON public.service_types;

CREATE POLICY "Organization members can view their service types"
ON public.service_types FOR SELECT
USING (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create service types"
ON public.service_types FOR INSERT
WITH CHECK (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their service types"
ON public.service_types FOR UPDATE
USING (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete service types"
ON public.service_types FOR DELETE
USING (organization_id IS NULL OR can_manage_organization(auth.uid(), organization_id));

-- Fix RLS policies for faqs to be organization-specific
DROP POLICY IF EXISTS "Anyone can view FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Anyone can insert FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Anyone can update FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Anyone can delete FAQs" ON public.faqs;

-- Add organization_id to faqs table if not exists
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS organization_id UUID;

CREATE POLICY "Organization members can view their FAQs"
ON public.faqs FOR SELECT
USING (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create FAQs"
ON public.faqs FOR INSERT
WITH CHECK (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their FAQs"
ON public.faqs FOR UPDATE
USING (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete FAQs"
ON public.faqs FOR DELETE
USING (organization_id IS NULL OR can_manage_organization(auth.uid(), organization_id));

-- Fix RLS policies for qualification_questions to be organization-specific
DROP POLICY IF EXISTS "Anyone can view qualification questions" ON public.qualification_questions;
DROP POLICY IF EXISTS "Anyone can insert qualification questions" ON public.qualification_questions;
DROP POLICY IF EXISTS "Anyone can update qualification questions" ON public.qualification_questions;
DROP POLICY IF EXISTS "Anyone can delete qualification questions" ON public.qualification_questions;

CREATE POLICY "Organization members can view their qualification questions"
ON public.qualification_questions FOR SELECT
USING (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create qualification questions"
ON public.qualification_questions FOR INSERT
WITH CHECK (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their qualification questions"
ON public.qualification_questions FOR UPDATE
USING (organization_id IS NULL OR is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete qualification questions"
ON public.qualification_questions FOR DELETE
USING (organization_id IS NULL OR can_manage_organization(auth.uid(), organization_id));