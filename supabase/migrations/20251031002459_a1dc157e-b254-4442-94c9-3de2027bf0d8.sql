-- Create storage bucket for client logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-logos', 'client-logos', true);

-- Create policies for client logos bucket
CREATE POLICY "Anyone can view client logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-logos');

CREATE POLICY "Anyone can upload client logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-logos');

CREATE POLICY "Anyone can update client logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'client-logos');

CREATE POLICY "Anyone can delete client logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-logos');