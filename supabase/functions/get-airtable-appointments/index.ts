import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AIRTABLE_BASE = "appzEAl8r1TkFLiBR";
const AIRTABLE_APPOINTMENTS_TABLE = "Appointments";
const AIRTABLE_CLIENTS_TABLE = "Clients";

async function airtableFetch(token: string, path: string): Promise<any> {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("AIRTABLE_TOKEN");
    if (!token) throw new Error("AIRTABLE_TOKEN not configured");

    const url = new URL(req.url);
    const businessName = url.searchParams.get("businessName");
    if (!businessName) throw new Error("businessName query param required");

    // ── 1. Find the Airtable Client record ID matching businessName ──────
    // Use SEARCH for case-insensitive fuzzy match; handles trailing spaces
    // and slight naming differences (e.g. "Backyard Paradiso Colorado LLC ")
    const nameLower = businessName.trim().toLowerCase();
    const allClientsData = await airtableFetch(
      token,
      `${AIRTABLE_BASE}/${AIRTABLE_CLIENTS_TABLE}?maxRecords=100&fields%5B%5D=Client+Name&fields%5B%5D=City`
    );

    // Score each client record: exact trim match > contains match
    const scored = (allClientsData.records ?? []).map((r: any) => {
      const name: string = (r.fields["Client Name"] ?? "").trim();
      const nameLow = name.toLowerCase();
      let score = 0;
      if (nameLow === nameLower) score = 3;
      else if (nameLow.includes(nameLower) || nameLower.includes(nameLow)) score = 2;
      else {
        // word-level: check if most words overlap
        const wordsA = nameLower.split(/\W+/).filter(Boolean);
        const wordsB = nameLow.split(/\W+/).filter(Boolean);
        const overlap = wordsA.filter(w => wordsB.includes(w)).length;
        if (overlap >= 2) score = 1;
      }
      return { ...r, score };
    }).filter((r: any) => r.score > 0)
      .sort((a: any, b: any) => b.score - a.score);

    const clientRecord = scored[0];
    const clientCity: string = clientRecord?.fields?.["City"] ?? "";

    // Collect all matching client record IDs
    const clientRecordIds: string[] = scored.map((r: any) => r.id);
    if (clientRecordIds.length === 0) {
      return new Response(JSON.stringify({ appointments: [], clientCity, debug: `No match for: ${businessName}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Fetch upcoming appointments for this client ───────────────────
    // Filter: appointment date >= today AND client name matches any of our record IDs
    // Airtable linked-record filter: FIND(record_id, ARRAYJOIN({Client Name}))
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Build OR filter for all client record IDs
    const idFilters = clientRecordIds
      .map((id) => `FIND("${id}", ARRAYJOIN({Client Name}))`)
      .join(",");
    const dateFilter = `IS_AFTER({Appointment Date}, "${todayISO}")`;
    const combinedFilter = encodeURIComponent(
      `AND(OR(${idFilters}), ${dateFilter})`
    );

    const apptData = await airtableFetch(
      token,
      `${AIRTABLE_BASE}/${AIRTABLE_APPOINTMENTS_TABLE}?filterByFormula=${combinedFilter}&sort%5B0%5D%5Bfield%5D=Appointment+Date&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`
    );

    // ── 3. Shape into TodayAppt format ───────────────────────────────────
    const appointments = (apptData.records ?? []).map((rec: any, i: number) => {
      const f = rec.fields;
      const apptDate = new Date(f["Appointment Date"]);
      const time = apptDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Denver", // TODO: make timezone configurable per client
      });
      const dateStr = apptDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Denver",
      });
      const isToday =
        apptDate.toDateString() === new Date().toDateString();

      return {
        id: rec.id,
        number: i + 1,
        name: f["Lead Name"] ?? "Unknown",
        phone: f["Lead Phone"] ?? "",
        email: f["Lead Email"] ?? "",
        city: clientCity,   // best available; no per-lead city in Airtable yet
        serviceLabel: (f["Service / Campaign"] ?? "").trim(),
        time,
        dateStr,
        isToday,
        setter: f["Setter"] ?? "",
        projectNotes: f["Project Notes"] ?? "",
        ghlLink: f["GHL Contact Link"] ?? "",
        showStatus: f["Show Status"] ?? "",
        appointmentDate: f["Appointment Date"],
        // No lat/lng — caller geocodes using clientCity via Mapbox
      };
    });

    return new Response(
      JSON.stringify({ appointments, clientCity }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
