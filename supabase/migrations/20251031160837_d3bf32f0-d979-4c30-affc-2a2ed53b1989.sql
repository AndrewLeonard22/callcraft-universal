-- Create FAQs table
CREATE TABLE public.faqs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view FAQs" 
ON public.faqs 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert FAQs" 
ON public.faqs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update FAQs" 
ON public.faqs 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete FAQs" 
ON public.faqs 
FOR DELETE 
USING (true);