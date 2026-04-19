-- Area map fields for ScriptViewer map tab
-- hq_lat/hq_lng: geocoded HQ coordinates for radius circle + distance calc
-- hq_address: display label shown in sidebar ("from Bellevue HQ")
-- excluded_areas: JSONB array of {id,label,type,mapbox_id,bbox,center,zips?}
--   bbox = [west, south, east, north] in WGS-84
--   type = 'city' | 'county' | 'zip'

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hq_lat         FLOAT8,
  ADD COLUMN IF NOT EXISTS hq_lng         FLOAT8,
  ADD COLUMN IF NOT EXISTS hq_address     TEXT,
  ADD COLUMN IF NOT EXISTS excluded_areas JSONB NOT NULL DEFAULT '[]';

-- GIN index so containment/existence queries on excluded_areas are fast
CREATE INDEX IF NOT EXISTS idx_clients_excluded_areas
  ON public.clients USING GIN (excluded_areas);
