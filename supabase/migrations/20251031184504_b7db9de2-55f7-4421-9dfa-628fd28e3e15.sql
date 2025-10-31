-- Create team_invitations table to track pending invites
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(organization_id, email, status)
);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can view invitations for their org
CREATE POLICY "Members can view their organization invitations"
ON public.team_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = team_invitations.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy: Owners and admins can insert invitations
CREATE POLICY "Owners and admins can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (
  can_manage_organization(auth.uid(), organization_id)
);

-- Policy: Owners and admins can update invitations
CREATE POLICY "Owners and admins can update invitations"
ON public.team_invitations
FOR UPDATE
USING (
  can_manage_organization(auth.uid(), organization_id)
);

-- Policy: Owners and admins can delete invitations
CREATE POLICY "Owners and admins can delete invitations"
ON public.team_invitations
FOR DELETE
USING (
  can_manage_organization(auth.uid(), organization_id)
);

-- Create index for faster lookups
CREATE INDEX idx_team_invitations_org_status ON public.team_invitations(organization_id, status);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);

-- Function to auto-expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$;