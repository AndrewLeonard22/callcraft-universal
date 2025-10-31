-- Add objection_handling field to scripts table for templates
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS objection_handling TEXT;

-- Create a separate table for objection handling templates
CREATE TABLE IF NOT EXISTS objection_handling_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE objection_handling_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for objection handling templates
CREATE POLICY "Allow all operations on objection_handling_templates" 
ON objection_handling_templates 
FOR ALL 
USING (true) 
WITH CHECK (true);