ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hard_nos            TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS services_advertised TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_zips       TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS additional_contacts JSONB     NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS financing_offered   TEXT,
  ADD COLUMN IF NOT EXISTS avg_install_time    TEXT,
  ADD COLUMN IF NOT EXISTS things_to_know      TEXT,
  ADD COLUMN IF NOT EXISTS hq_lat              FLOAT8,
  ADD COLUMN IF NOT EXISTS hq_lng              FLOAT8,
  ADD COLUMN IF NOT EXISTS hq_address          TEXT,
  ADD COLUMN IF NOT EXISTS excluded_areas      JSONB     NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_clients_hard_nos            ON public.clients USING GIN (hard_nos);
CREATE INDEX IF NOT EXISTS idx_clients_services_advertised ON public.clients USING GIN (services_advertised);
CREATE INDEX IF NOT EXISTS idx_clients_excluded_zips       ON public.clients USING GIN (excluded_zips);
CREATE INDEX IF NOT EXISTS idx_clients_excluded_areas      ON public.clients USING GIN (excluded_areas);