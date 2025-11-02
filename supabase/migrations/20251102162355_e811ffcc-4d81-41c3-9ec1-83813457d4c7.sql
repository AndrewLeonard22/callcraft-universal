-- Add archived status and last accessed tracking to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone DEFAULT now();

-- Create an index for better query performance on archived status
CREATE INDEX IF NOT EXISTS idx_clients_archived ON public.clients(archived);

-- Create an index for sorting by last accessed time
CREATE INDEX IF NOT EXISTS idx_clients_last_accessed ON public.clients(last_accessed_at DESC);

-- Add a comment to document the columns
COMMENT ON COLUMN public.clients.archived IS 'Indicates if the company is archived (hidden from main view)';
COMMENT ON COLUMN public.clients.last_accessed_at IS 'Timestamp of when the company was last accessed/viewed';