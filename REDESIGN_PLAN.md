# Agent IQ Redesign Plan

**Prepared:** 2026-04-18  
**Scope:** ScriptViewer consolidation · Pricing calculator rebuild · UI redesign  
**Out of scope:** Auth, training/quiz, email sending, team invitations, Image Generator

---

## What I found in the code

Before the plan sections, here's what the audit surfaced that shapes every decision below.

**Data model today:** The `clients` table has only 8 columns (name, service_type, city, archived, call_agent_id, etc.). Everything else — owner name, address, website, calendars, photos, pricing — lives in `client_details` as an EAV (field_name / field_value) key-value store. This is why the ScriptViewer has 15+ `getDetailValue("field_name")` calls and why there's no type safety on any of it.

**Photos today:** Logo, owner photo, and work photos all go into one bucket `client-logos`, distinguished only by filename prefix (`work-{clientId}-{timestamp}.jpg`). Work photos are stored as a JSON array in a single `client_details` row. This works but can't be queried individually and has no ordering.

**Calculator today:** `OutdoorLivingCalculator.tsx` is 90 lines — a static checkbox list with flat hardcoded prices (`Pergola: $13,000`, `Turf: $8,000`, etc.). There's also inline per-service math in `ScriptViewer.tsx` (pergola dimensions → sq ft × $/sq ft, turf sq ft × $/sq ft). The inline calculators pull `price_per_sq_ft` from `client_details` but only show ±10% of a single midpoint — no ranges, no multi-service, no budget comparison.

**Script styling:** `FormattedScript` is a separate component (not in scope files, but referenced). The "yellow highlighter" is whatever CSS it applies to highlighted text. We're replacing that.

**CompanyProfileModal:** Currently triggered by clicking the client's name in the header. Contains most of the ClickUp context (owner photo, links, project requirements, services, things to know, photo gallery) but it's a modal — setters have to click to open it, and it disappears every time they scroll or click away.

**Pricing context the calculator needs:** The `estimate-backyard-price` edge function is AI vision-based (for the Image Generator). It's separate from the qualification calculator and we don't need to touch it.

---

## a. Data Model Changes

### Strategy: Hybrid

Keep `client_details` (EAV) for all existing fields — breaking the existing field_name lookups would risk 21 live clients. Add new structured fields as proper typed columns to the `clients` table (arrays, JSONB) where structure matters. Add two new tables: `pricing_config` and `lead_estimates`.

### Controlled vocabulary decision — hard_nos, services_advertised, excluded_zips

**These are NOT free-text fields.** Free-text means "NO POOLS", "no pools", "No Swimming Pools", and "NO POOL!!" all exist across 21 clients and the DQ logic silently breaks. Controlled vocabulary means the check `client.hard_nos.includes('pools')` always works.

**UI pattern:** A tag-input component that offers a predefined dropdown of known values but also accepts custom entries. The value stored is always a normalized lowercase slug. Display label is derived from the slug at render time.

**Predefined options by field:**

`hard_nos` slug → display label:
```
pools          → NO POOLS
decks          → NO DECKS  
electrical     → NO ELECTRICAL
lighting       → NO LIGHTING INSTALLS
hot_tubs       → NO HOT TUBS
tree_removal   → NO TREE REMOVAL
concrete       → NO CONCRETE
fencing        → NO FENCING
roofing        → NO ROOFING
```
Custom values allowed (stored as slugified input: "no vinyl pergolas" → `vinyl_pergolas`).

`services_advertised` slug → display label:
```
pavers         → Pavers / Hardscaping
turf           → Artificial Turf
pergola        → Pergolas
outdoor_kitchen → Outdoor Kitchens
fire_pit       → Fire Pits
pool_deck      → Pool Decks
retaining_wall → Retaining Walls
lighting       → Landscape Lighting
drainage       → Drainage Solutions
seating_wall   → Seating Walls
bbq_islands    → BBQ Islands
water_features → Water Features
```

`excluded_zips` — free-text is fine here (zip codes are inherently canonical). The tag input accepts 5-digit strings. Display: render the zip, plus optionally a city label if we have a lookup. DQ logic: `client.excluded_zips.includes(leadZip)`.

**Normalization on save:** Before inserting into the `TEXT[]` column, frontend normalizes the slug:
```ts
const slugify = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
```
This runs on every save so even if a CSM types a custom value like "No Vinyl Pergolas", it stores as `vinyl_pergolas`.

### Migration 1: New columns on `clients`

```sql
-- Migration: add_client_qualification_fields
ALTER TABLE public.clients
  ADD COLUMN hard_nos         TEXT[]    DEFAULT '{}',
  ADD COLUMN services_advertised TEXT[] DEFAULT '{}',
  ADD COLUMN excluded_zips    TEXT[]    DEFAULT '{}',
  ADD COLUMN additional_contacts JSONB  DEFAULT '[]',
  ADD COLUMN financing_offered   TEXT,
  ADD COLUMN avg_install_time    TEXT,
  ADD COLUMN things_to_know      TEXT;
-- things_to_know replaces other_key_info for new clients; 
-- other_key_info in client_details stays as fallback for existing

-- GIN indexes for array containment queries
CREATE INDEX idx_clients_hard_nos ON public.clients USING GIN (hard_nos);
CREATE INDEX idx_clients_services_advertised ON public.clients USING GIN (services_advertised);
CREATE INDEX idx_clients_excluded_zips ON public.clients USING GIN (excluded_zips);
```

**Reasoning for array columns vs EAV:** `hard_nos` and `services_advertised` need to drive UI logic (render red NO badges, trigger DQ warnings in the calculator). Storing them as arrays lets us do that in TypeScript without string parsing. `things_to_know` is a freeform text blob — single column is fine.

**additional_contacts schema:**
```json
[
  { "name": "Jane Smith", "role": "Sales Rep", "phone": "555-0101" },
  { "name": "Mike Jones", "role": "CSM", "phone": "555-0102" }
]
```
The current `sales_rep_name` / `sales_rep_phone` in client_details become legacy; new entries go into `additional_contacts`. Both coexist during transition.

### Migration 2: `pricing_config` table

```sql
-- Migration: create_pricing_config
CREATE TABLE public.pricing_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_key     TEXT NOT NULL,   -- 'pavers', 'turf', 'pergola', 'retaining_wall', 
                                   --  'outdoor_kitchen', 'fire_pit', 'pool_deck',
                                   --  'lighting', 'drainage', 'seating_wall'
  unit_type       TEXT NOT NULL,   -- 'sqft' | 'linft' | 'tier' | 'flat'
  price_low       NUMERIC(10,2),
  price_high      NUMERIC(10,2),
  tiers           JSONB DEFAULT '[]',
  -- tiers example: [{"label":"10x12","low":13000,"high":18000},{"label":"14x20","low":22000,"high":32000}]
  is_addon        BOOLEAN DEFAULT false,
  is_hard_no      BOOLEAN DEFAULT false,
  display_order   INTEGER DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, service_key)
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pricing_config for their org"
  ON public.pricing_config FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can manage pricing_config for their org"
  ON public.pricing_config FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pricing_config_client ON public.pricing_config(client_id);
```

**Core service_keys:** `pavers`, `turf`, `pool_deck`, `retaining_wall`, `pergola`, `outdoor_kitchen`, `fire_pit`, `lighting`, `drainage`, `seating_wall`, `custom`

**unit_type semantics:**
- `sqft` → setter enters square footage → low = sqft × price_low, high = sqft × price_high  
- `linft` → setter enters linear feet → same math  
- `tier` → setter picks a tier from the `tiers` array (e.g. pergola sizes)  
- `flat` → fixed range, no input required (e.g. fire pit = $3K–$6K)

### Migration 3: `lead_estimates` table (optional, enables "save to lead")

```sql
-- Migration: create_lead_estimates
CREATE TABLE public.lead_estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  script_id       UUID REFERENCES public.scripts(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_items      JSONB NOT NULL DEFAULT '[]',
  -- line_items: [{"service_key":"pavers","label":"Pavers","qty":450,"unit":"sqft",
  --               "price_low":5400,"price_high":11250}]
  total_low       NUMERIC(10,2),
  total_high      NUMERIC(10,2),
  lead_budget_stated TEXT,   -- what the lead said ("$20K-$40K", "$50K", "not sure")
  lead_name       TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.lead_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage lead_estimates for their org"
  ON public.lead_estimates FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_lead_estimates_client ON public.lead_estimates(client_id);
CREATE INDEX idx_lead_estimates_script ON public.lead_estimates(script_id);
```

---

## b. Photo Storage

### Bucket structure

Create a second bucket for work photos, separate from logos:

| Bucket | Purpose | Path pattern |
|--------|---------|-------------|
| `client-logos` | Logo + owner photo (existing) | `{clientId}/logo.{ext}`, `{clientId}/owner.{ext}` |
| `client-work-photos` | Past project gallery | `{clientId}/{uuid}.{ext}` |

**Why separate:** Logos need CDN-friendly caching (slow-changing). Work photos are larger, uploaded more often, and may eventually be deleted individually. Keeping them separate makes RLS and purging easier.

### RLS policy for `client-work-photos`

```sql
-- Allow org members to read
CREATE POLICY "Org members can read work photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-work-photos'
    AND (
      SELECT is_organization_member(auth.uid(), organization_id)
      FROM public.clients
      WHERE id::text = split_part(name, '/', 1)
    )
  );

-- Allow org members to upload
CREATE POLICY "Org members can upload work photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-work-photos'
    AND (
      SELECT is_organization_member(auth.uid(), organization_id)
      FROM public.clients
      WHERE id::text = split_part(name, '/', 1)
    )
  );

-- Allow org members to delete
CREATE POLICY "Org members can delete work photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-work-photos'
    AND (
      SELECT is_organization_member(auth.uid(), organization_id)
      FROM public.clients
      WHERE id::text = split_part(name, '/', 1)
    )
  );
```

### Upload UX

- Multi-file drop zone in EditClient (drag-and-drop + click to browse)
- Instant preview with remove button on each tile
- Max 12 photos, 8MB each, JPEG/PNG/WEBP
- Photos stored as individual Storage objects (not JSON-in-EAV); allows ordering via filename timestamp
- Existing `work_photos` JSON array in client_details is read as fallback during migration; new uploads go to bucket

---

## c. New ScriptViewer Page Architecture

### Layout wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (sticky, h-14)                                                  │
│ [←] [Logo 32px] Business Name · Service Type · City    [Edit][Copy][↓] │
│                                                                         │
│ ⛔ HARD NOs: [NO DECKS] [NO POOLS] [NO ELECTRICAL]   ← red pill badges │
└─────────────────┬───────────────────────────────────────────────────────┘
                  │
┌─────────────────┼───────────────────────────────────────────────────────┐
│ LEFT PANEL      │  MAIN SCRIPT AREA (scrollable)                       │
│ sticky, 300px   │                                                       │
│ scrollable      │  Script content with new typography:                 │
│                 │  - No yellow highlight                               │
│ ─── Quick Links ┤  - Callout blocks: border-l-2 + soft bg tint        │
│ 📅 Book Appt    │  - **bold** and _italic_ from rich text editor      │
│ 🔄 Reschedule   │  - Role label (SETTER/LEAD) in small caps           │
│ 🔗 CRM          │                                                       │
│ 🌐 Website      │                                                       │
│                 │                                                       │
│ ─── Things to   │                                                       │
│     Know ───────┤                                                       │
│ • Bullet notes  │                                                       │
│   from client   │                                                       │
│                 │                                                       │
│ ─── [TABS] ─────┤                                                       │
│  Info|Calc|Pics │                                                       │
│                 │                                                       │
│ [INFO TAB]      │                                                       │
│  Owner          │  [FAQs btn]  [Objections btn]  ← float bottom-right │
│  Sales Reps     │                                                       │
│  Address        │  [Qualify btn]  ← float bottom-left                 │
│  Services       │                                                       │
│  Min Price      │                                                       │
│  Avg Time       │                                                       │
│  Financing      │                                                       │
│                 │                                                       │
│ [CALC TAB]      │                                                       │
│  (see §d)       │                                                       │
│                 │                                                       │
│ [PHOTOS TAB]    │                                                       │
│  3-col grid     │                                                       │
│  click=lightbox │                                                       │
└─────────────────┴───────────────────────────────────────────────────────┘
```

### Hard NOs treatment

Hard NOs render as a horizontal strip directly in the top bar, always visible without scrolling:

```tsx
{client.hard_nos?.length > 0 && (
  <div className="flex items-center gap-1.5 flex-wrap">
    {client.hard_nos.map(no => (
      <span key={no} className="inline-flex items-center gap-1 px-2 py-0.5 
        bg-red-50 border border-red-200 text-red-700 text-xs font-semibold 
        rounded tracking-wide uppercase">
        <Ban className="h-3 w-3" /> {no}
      </span>
    ))}
  </div>
)}
```

If no hard_nos are set, the strip is absent (doesn't take up space).

### Photo gallery integration

Photos tab in the left panel shows a 3-column grid. Thumbnails are lazy-loaded. Click opens the existing full-screen lightbox (already built in CompanyProfileModal). The gallery does not dominate — it's behind a tab click, so it's present but not distracting during a call. Target max visible height: 360px with internal scroll if more than ~9 photos.

### Service area: replace full map with a live zip/city checker

~~Move the map to EditClient only.~~ **Correction:** The map itself is overkill for a live call (it eats ~400px of sidebar real estate), but the service area check must remain accessible during the call. Setters are currently flying blind on geography — a lead says "I'm in Renton" and the setter has no way to know Renton is an excluded city for that client without switching tabs to ClickUp.

**What replaces the map in the ScriptViewer left panel:**

```
┌──────────────────────────────────────┐
│ Service Area Check                   │
│  [  Zip or city...          ] [→]    │
│                                      │
│  ✓ Covington — within 35mi range    │
│  ✗ Renton — EXCLUDED ZONE          │
└──────────────────────────────────────┘
```

- Single text input: setter types a zip code or city name
- On submit (enter or button): check against `excluded_zips` array first (instant, no API call). If zip is in `excluded_zips`, show red DQ banner immediately — no map needed.
- If not excluded: call the existing Mapbox geocoding + distance logic to check if within `service_radius_miles`. Show green (within range) or amber (outside range, not hard-excluded).
- The excluded_zips check is synchronous and zero-latency — no Mapbox token required for the DQ case, which is the most important case.
- Full map stays in EditClient for admin use when setting up service areas.

**DQ banner for excluded zip** triggers the same red banner pattern as a hard NO:
```tsx
{isExcluded && (
  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 
                  text-red-700 rounded text-sm font-medium">
    <Ban className="h-4 w-4 flex-shrink-0" />
    {checkedLocation} is in an excluded zone — do not set appointment.
  </div>
)}
```

---

## d. Calculator Redesign

### Location: Left panel, "Calc" tab

The calculator lives in the same sticky left panel as the client context. Setters tab to it when the lead mentions budget or project scope. It stays visible alongside the script without scrolling.

### Interaction flow

**State 1 — Empty**
```
┌─────────────────────────────────────────┐
│ Project Builder                         │
│                                         │
│  Budget: [$____________]                │
│  (what did lead say?)                   │
│                                         │
│  + Add service ▾                        │
│    Pavers · Turf · Pergola · ...        │
│                                         │
│ No services added yet.                  │
└─────────────────────────────────────────┘
```

**State 2 — Building**
```
┌─────────────────────────────────────────┐
│ Project Builder           Budget: $40K  │
│                                         │
│  ✓ Pavers    [450] sq ft  $5.4K–$11K   │
│  ✓ Turf      [200] sq ft  $2.2K–$3.6K  │
│  ✓ Pergola   [14x20 ▾]   $22K–$32K    │
│  + Fire Pit  (flat)       $3K–$6K      │
│                                         │
│  ─── Add-ons ────────────              │
│  □ Lighting  $2K–$4K                   │
│  □ Drainage  $1.5K–$3K                 │
│                                         │
│  TOTAL ESTIMATE:  $29K – $53K          │
└─────────────────────────────────────────┘
```

**State 3 — Budget mismatch warning (amber)**
```
┌─────────────────────────────────────────┐
│  TOTAL: $29K–$53K    Budget: $40K       │
│                                         │
│  ⚠ High end exceeds stated budget.      │
│  Suggested script line:                 │
│  "That's actually on the lower end for  │
│   a full paver + pergola project —      │
│   most of our clients budget $45K–$60K  │
│   for what you're describing."          │
└─────────────────────────────────────────┘
```

**State 4 — Hard DQ (red banner)**
```
┌─────────────────────────────────────────┐
│  ⛔ DISQUALIFY — Project under minimum  │
│  Estimate $8K | Client min $15K         │
│  Do not set appointment.                │
└─────────────────────────────────────────┘
```
DQ triggers when:
- Estimate total_high < client's minimum project price
- Selected service is in `hard_nos` array
- Lead's zip is in `excluded_zips` array (zip input field in calculator)

### Save estimate — confirmed required in Phase 2

At the bottom of the calculator, a "Save Estimate" button writes a `lead_estimates` row. Required fields before saving: lead name (free text, pulled from qualification responses if available), line items, totals. Optional: stated budget, notes.

After save: toast confirmation + the estimate row is visible to CSM and client in EditClient under a new "Estimates" tab. This is how the CSM audits what was quoted post-call and how the client knows what pricing their setter communicated.

`lead_estimates` row written on save:
```ts
{
  client_id: client.id,
  script_id: scriptId,           // from URL param — links estimate to the call session
  organization_id,
  line_items: lineItems,         // [{service_key, label, qty, unit, price_low, price_high}]
  total_low,
  total_high,
  lead_budget_stated: budgetInput,
  lead_name: leadNameFromQualification ?? "",
  created_by: user.id
}
```

### Pricing data source

The calculator reads from `pricing_config` for this client. If a service has no `pricing_config` row, it falls back to the client_details service detail fields (existing pergola/turf pricing) or shows "No pricing configured."

---

## e. Visual Design Direction

### Typography scale

| Use | Size | Weight | Class |
|-----|------|--------|-------|
| Page title | 20px | 600 | `text-xl font-semibold` |
| Section header | 13px | 600 | `text-[13px] font-semibold uppercase tracking-wide` |
| Body / script | 15px | 400 | `text-[15px] leading-relaxed` |
| Label | 11px | 500 | `text-[11px] font-medium uppercase tracking-widest` |
| Detail value | 13px | 400 | `text-[13px]` |
| Caption | 11px | 400 | `text-[11px] text-muted-foreground` |

Script text should be 15px minimum — setters are reading this on a monitor, often at arm's length. 14px (shadcn default text-sm) is too small for sustained reading.

### Color palette

Keep the existing shadcn CSS variable system. Layer semantic colors on top:

```css
/* Add to globals.css */
--color-hard-no-bg:     #fef2f2;  /* red-50 */
--color-hard-no-border: #fca5a5;  /* red-300 */
--color-hard-no-text:   #b91c1c;  /* red-700 */

--color-warning-bg:     #fffbeb;  /* amber-50 */
--color-warning-border: #fcd34d;  /* amber-300 */
--color-warning-text:   #92400e;  /* amber-800 */

--color-dq-bg:          #fef2f2;
--color-dq-border:      #ef4444;

--color-things-to-know-bg:    hsl(var(--muted)/0.4);
--color-things-to-know-border: hsl(var(--border));
```

### Script callout styling (replacing yellow highlight)

The current yellow highlight should be replaced in `FormattedScript`. New treatment:

```tsx
// For text marked as a callout/highlight:
<span className="border-l-2 border-primary/60 pl-2 bg-primary/5 
                 rounded-r-sm inline-block my-0.5">
  {content}
</span>

// For "SETTER:" role labels:
<span className="text-[10px] font-bold uppercase tracking-widest 
                 text-primary/70 mr-1.5">
  SETTER
</span>

// For "LEAD:" role labels:
<span className="text-[10px] font-bold uppercase tracking-widest 
                 text-muted-foreground mr-1.5">
  LEAD
</span>
```

### Density philosophy

Linear/Attio-style: pack information tightly, use consistent 4px/8px/12px/16px spacing increments. No card with more than 16px padding. Section headers at 11px uppercase create visual hierarchy without consuming vertical space. The left panel should show ~6-8 data points above the fold without scrolling.

### Changes from shadcn defaults

1. **Remove** card box-shadows from the ScriptViewer sidebar — flat borders only
2. **Reduce** card padding from `p-6` → `p-4` in the left panel  
3. **Increase** script body font to 15px (from 14px)  
4. **Remove** the `bg-amber-500/10` amber tint from "Things to Know" — it implies warning; use neutral muted instead
5. **Tabs** in the left panel: use a tighter pill tab style (not the full-width TabsList), 10px text
6. **Links** in the quick-link section: render as full-width action rows with icon + label, not bare hyperlinks

---

## f. Migration Strategy for 21 Existing Clients

### What breaks if we do nothing

Nothing breaks immediately. All existing `client_details` fields continue to work. The new columns (`hard_nos`, `services_advertised`, etc.) default to empty arrays and null. Setters see the same ScriptViewer they see today until we ship Phase 1.

### What needs manual backfill

| Field | Source | Priority |
|-------|--------|----------|
| `hard_nos` | ClickUp doc "Hard NOs" section | **Critical** — must be populated before setters use new ScriptViewer |
| `things_to_know` | ClickUp doc "Things to Know" bullets | High |
| `services_advertised` | ClickUp doc services list | High |
| `appointment_calendar` | Already in client_details for most | Check, fill gaps |
| `reschedule_calendar` | Already in client_details for most | Check, fill gaps |
| `pricing_config` rows | New data — requires client interview or CSM input | Medium |
| `financing_offered` | Can pull from `other_key_info` text | Low |
| `avg_install_time` | Can pull from `other_key_info` text | Low |
| `excluded_zips` | Only needed if clients have zip exclusions | Low |

### Backfill approach

1. Export all 21 ClickUp docs to a spreadsheet (one row per client)
2. Build a "Quick Fill" panel in EditClient that surfaces the new fields prominently at the top: hard_nos tag input (with predefined options), things_to_know textarea, services_advertised tag input, excluded_zips tag input. These fields go at the top of the page, not buried in a tab.
3. Rory or SK does a focused backfill session — realistic estimate is **10–15 min per client × 21 clients = 3–5 hours total** (reading each ClickUp doc, copying/selecting values). Schedule this as a half-day block, not "we'll populate it eventually." If it doesn't get scheduled, the DQ logic ships empty and is useless.
4. No automated migration script needed; manual entry ensures accuracy and catches errors in the source ClickUp docs.

**Critical path:** Phase 1 ships with empty `hard_nos` for all clients until the backfill session happens. This is acceptable — setters just don't see red NO badges yet. But the session must be scheduled before Phase 1 goes to production, not after. The feature is only as good as the data in it.

### Coexistence logic for things_to_know

In ScriptViewer, render `client.things_to_know` if non-null, else fall back to `getDetailValue("other_key_info")`. Same pattern for services_advertised vs services_offered in client_details. This means existing clients get the new UI even before their data is backfilled into the new columns.

---

## g. Phasing

### Phase 1: ScriptViewer Consolidation (2–3 weeks, immediate setter value)

**Goal:** Setters never open ClickUp during a call.

1. Add new columns to `clients` (migration 1)
2. Update `clients` TypeScript type
3. Redesign ScriptViewer layout: new top bar with hard NOs strip, left panel with tabs (Info / Calc / Photos), remove service area map from this page
4. Info tab: surfaces all existing client_details fields + new columns, coexistence fallbacks
5. Photos tab: gallery grid pulling from `client-work-photos` bucket + fallback to existing JSON array
6. Quick links section: appointment calendar, reschedule calendar, CRM as prominent action rows
7. Things to Know: render as bullet list from new column (fallback to other_key_info)
8. Replace yellow highlight in FormattedScript with new callout style
9. Update EditClient to include hard_nos (tag input), things_to_know, services_advertised, additional_contacts
10. Update CreateClient to include same new fields

**Deliverable:** A setter can open ScriptViewer and find every piece of information they currently get from ClickUp, without switching tabs.

### Phase 2: Calculator Rebuild (2–3 weeks, biggest qualification impact)

**Goal:** Setters can qualify on price live, with DQ warnings.

1. Add `pricing_config` table (migration 2)
2. Add `lead_estimates` table (migration 3)
3. Build pricing config UI in EditClient (per-service pricing table with low/high/tiers)
4. Replace `OutdoorLivingCalculator.tsx` with new `ProjectCalculator` component
5. Replace inline pergola/turf calculators in ScriptViewer with the unified calculator
6. Calculator features: multi-service builder, quantity inputs, price ranges, add-ons, budget input, budget mismatch warning, DQ banner
7. Save estimate to `lead_estimates`
8. Wire DQ logic: check against client.hard_nos, client minimum price, excluded_zips

**Deliverable:** A setter building an estimate gets real ranges, sees a DQ banner if the project is under minimum, and can save the estimate before ending the call.

### Phase 3: Visual Polish (1–2 weeks)

**Goal:** The app feels like premium SaaS, not a settings page.

1. Typography changes (script body 15px, label sizing)
2. Semantic color tokens for hard NOs, warnings, DQ
3. Left panel density improvements (reduce padding, tighter tabs)
4. Script callout styling (left border + soft tint replaces yellow highlight)
5. Link rows in quick-links section
6. Audit other pages for consistency (Dashboard, EditClient) but don't redesign them
7. New photo upload UX in EditClient (multi-drop zone with instant previews)

---

## Resolved decisions

| Question | Decision |
|----------|----------|
| hard_nos / services_advertised input type | Controlled vocabulary — predefined slugs + custom allowed, normalized on save |
| excluded_zips input type | Free-text tag input (zip codes are canonical) |
| Service area map in ScriptViewer | Replace full map with lightweight zip/city DQ checker; full map stays in EditClient |
| Save estimate | Required in Phase 2 Day 1, not deferred |
| Migration time estimate | 3–5 hours (half-day), must be scheduled before Phase 1 goes to production |
| Calculator position | Left panel tab — confirmed |
| Phasing | Phase 1 → 2 → 3 in sequence, not concurrent |

## Open questions (still unresolved)

1. **Hard NOs strip overflow:** If a client has 7+ NOs, the top bar pill strip wraps into a second line and starts taking up call-console real estate. Proposed solution: show first 4 NOs inline, "+ N more" pill that expands on hover. Acceptable? Or should we just let it wrap?

2. **Pricing_config population:** Who populates the per-service pricing rows for each client, and when? The calculator is inert until these exist. Options: (a) Rory does it during the same backfill session as hard_nos, pulling numbers from the ClickUp doc; (b) the client provides a pricing sheet; (c) we pre-populate with conservative industry defaults and let clients edit. Recommend (a) or (c), not (b) — waiting on clients will block Phase 2 indefinitely.

3. **Excluded zip display label:** When we store `["98058", "98056"]` (Renton zips), the DQ checker shows the raw zip. Should we resolve that to a city name ("Renton")? Mapbox reverse geocoding can do this, but adds a round-trip. Alternative: store as `{"98058": "Renton", "98056": "Renton"}` JSONB so the city label is explicit. Simpler, no API call required. Recommend JSONB if the city label matters for setter clarity.
