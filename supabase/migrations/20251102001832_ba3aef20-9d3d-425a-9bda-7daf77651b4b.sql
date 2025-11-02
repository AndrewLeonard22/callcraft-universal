-- Add price estimation columns to generated_images table
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS price_estimate jsonb,
ADD COLUMN IF NOT EXISTS estimated_at timestamp with time zone;