-- Add service_name to scripts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='scripts' AND column_name='service_name') THEN
    ALTER TABLE public.scripts ADD COLUMN service_name TEXT NOT NULL DEFAULT 'General Service';
  END IF;
END $$;

-- Add is_template flag if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='scripts' AND column_name='is_template') THEN
    ALTER TABLE public.scripts ADD COLUMN is_template BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create index for templates if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scripts_is_template') THEN
    CREATE INDEX idx_scripts_is_template ON public.scripts(is_template);
  END IF;
END $$;