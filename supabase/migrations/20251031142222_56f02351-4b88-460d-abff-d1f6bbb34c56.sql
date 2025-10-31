-- Create organization roles enum
CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'member');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create organization_members table (linking users to organizations with roles)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role organization_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Add organization_id to existing tables
ALTER TABLE public.clients ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.scripts ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.service_types ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create security definer function to check organization membership
CREATE OR REPLACE FUNCTION public.is_organization_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Create security definer function to check organization role
CREATE OR REPLACE FUNCTION public.has_organization_role(_user_id UUID, _org_id UUID, _role organization_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- Create security definer function to check if user is owner or admin
CREATE OR REPLACE FUNCTION public.can_manage_organization(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  )
$$;

-- RLS Policies for organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (public.is_organization_member(auth.uid(), id));

CREATE POLICY "Owners and admins can update their organizations"
  ON public.organizations FOR UPDATE
  USING (public.can_manage_organization(auth.uid(), id));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can delete their organizations"
  ON public.organizations FOR DELETE
  USING (public.has_organization_role(auth.uid(), id, 'owner'));

-- RLS Policies for organization_members
CREATE POLICY "Members can view their organization members"
  ON public.organization_members FOR SELECT
  USING (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can manage members"
  ON public.organization_members FOR ALL
  USING (public.can_manage_organization(auth.uid(), organization_id));

-- Update RLS policies for clients
DROP POLICY IF EXISTS "Allow all operations on clients" ON public.clients;

CREATE POLICY "Organization members can view clients"
  ON public.clients FOR SELECT
  USING (
    organization_id IS NULL OR 
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "Organization members can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    organization_id IS NULL OR
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "Organization members can update clients"
  ON public.clients FOR UPDATE
  USING (
    organization_id IS NULL OR
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "Owners and admins can delete clients"
  ON public.clients FOR DELETE
  USING (
    organization_id IS NULL OR
    public.can_manage_organization(auth.uid(), organization_id)
  );

-- Update RLS policies for scripts
DROP POLICY IF EXISTS "Allow all operations on scripts" ON public.scripts;

CREATE POLICY "Organization members can view scripts"
  ON public.scripts FOR SELECT
  USING (
    organization_id IS NULL OR
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "Organization members can create scripts"
  ON public.scripts FOR INSERT
  WITH CHECK (
    organization_id IS NULL OR
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "Organization members can update scripts"
  ON public.scripts FOR UPDATE
  USING (
    organization_id IS NULL OR
    public.is_organization_member(auth.uid(), organization_id)
  );

CREATE POLICY "Owners and admins can delete scripts"
  ON public.scripts FOR DELETE
  USING (
    organization_id IS NULL OR
    public.can_manage_organization(auth.uid(), organization_id)
  );

-- Trigger to create organization and add creator as owner on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a default organization for the new user
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'display_name', 'My Organization') || '''s Team')
  RETURNING id INTO new_org_id;
  
  -- Add the user as the owner of this organization
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_organization
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_organization();

-- Add trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();