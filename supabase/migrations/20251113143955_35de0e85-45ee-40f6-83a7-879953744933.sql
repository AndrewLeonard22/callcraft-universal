-- Create call_agents table
CREATE TABLE public.call_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on call_agents
ALTER TABLE public.call_agents ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_agents
CREATE POLICY "Organization members can view their call agents"
  ON public.call_agents
  FOR SELECT
  USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can create call agents"
  ON public.call_agents
  FOR INSERT
  WITH CHECK (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Organization members can update their call agents"
  ON public.call_agents
  FOR UPDATE
  USING (is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can delete call agents"
  ON public.call_agents
  FOR DELETE
  USING (can_manage_organization(auth.uid(), organization_id));

-- Add call_agent_id to clients table
ALTER TABLE public.clients
ADD COLUMN call_agent_id UUID REFERENCES public.call_agents(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_clients_call_agent_id ON public.clients(call_agent_id);

-- Add trigger to update call_agents updated_at
CREATE TRIGGER update_call_agents_updated_at
  BEFORE UPDATE ON public.call_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();