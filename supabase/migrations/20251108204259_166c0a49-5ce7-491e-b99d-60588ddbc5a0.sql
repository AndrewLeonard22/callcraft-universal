-- Add company_logo_url column to profiles table for whitelabeling
ALTER TABLE public.profiles 
ADD COLUMN company_logo_url TEXT;

COMMENT ON COLUMN public.profiles.company_logo_url IS 'Custom company logo URL for whitelabel branding';