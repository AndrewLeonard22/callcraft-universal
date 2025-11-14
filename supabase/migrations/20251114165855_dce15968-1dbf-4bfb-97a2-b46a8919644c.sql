-- Create table for wheel segments
CREATE TABLE IF NOT EXISTS public.wheel_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wheel_segments ENABLE ROW LEVEL SECURITY;

-- Create policies for wheel segments
CREATE POLICY "Users can view wheel segments in their organization"
ON public.wheel_segments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = wheel_segments.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage wheel segments"
ON public.wheel_segments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = wheel_segments.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = wheel_segments.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_wheel_segments_updated_at
BEFORE UPDATE ON public.wheel_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add some default wheel segments
INSERT INTO public.wheel_segments (organization_id, label, color, display_order)
SELECT 
  o.id,
  segment.label,
  segment.color,
  segment.display_order
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('Free Coffee', '#ef4444', 0),
    ('5 Minute Break', '#f59e0b', 1),
    ('Lunch on Us', '#10b981', 2),
    ('$50 Bonus', '#3b82f6', 3),
    ('Extra PTO Day', '#8b5cf6', 4),
    ('Gift Card', '#ec4899', 5),
    ('Try Again', '#6b7280', 6),
    ('Team Shoutout', '#14b8a6', 7)
) AS segment(label, color, display_order)
ON CONFLICT DO NOTHING;