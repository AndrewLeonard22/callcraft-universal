-- Create service_detail_fields table for customizable service questions
CREATE TABLE public.service_detail_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_detail_fields ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Organization members can view their service detail fields"
ON public.service_detail_fields
FOR SELECT
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create service detail fields"
ON public.service_detail_fields
FOR INSERT
WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their service detail fields"
ON public.service_detail_fields
FOR UPDATE
USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Admins can delete service detail fields"
ON public.service_detail_fields
FOR DELETE
USING (can_manage_organization(auth.uid(), organization_id));

-- Create index for better query performance
CREATE INDEX idx_service_detail_fields_service_type ON public.service_detail_fields(service_type_id);
CREATE INDEX idx_service_detail_fields_org ON public.service_detail_fields(organization_id);