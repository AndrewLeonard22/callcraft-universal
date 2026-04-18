-- Add structured qualification fields to clients table
-- hard_nos / services_advertised / excluded_zips stored as TEXT[] with normalized slugs
-- things_to_know replaces other_key_info (EAV fallback preserved for existing clients)

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hard_nos            TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS services_advertised TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_zips       TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS additional_contacts JSONB     NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS financing_offered   TEXT,
  ADD COLUMN IF NOT EXISTS avg_install_time    TEXT,
  ADD COLUMN IF NOT EXISTS things_to_know      TEXT;

-- GIN indexes for array containment queries (DQ logic uses @> operator)
CREATE INDEX IF NOT EXISTS idx_clients_hard_nos
  ON public.clients USING GIN (hard_nos);

CREATE INDEX IF NOT EXISTS idx_clients_services_advertised
  ON public.clients USING GIN (services_advertised);

CREATE INDEX IF NOT EXISTS idx_clients_excluded_zips
  ON public.clients USING GIN (excluded_zips);
