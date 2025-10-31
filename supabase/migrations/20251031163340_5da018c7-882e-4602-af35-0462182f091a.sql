-- Add client_id column to faqs table to support client-specific FAQs
ALTER TABLE public.faqs
ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_faqs_client_id ON public.faqs(client_id);

-- Update the existing index name for clarity
CREATE INDEX IF NOT EXISTS idx_faqs_service_type_id ON public.faqs(service_type_id);