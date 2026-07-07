// Vercel serverless proxy for RentCast AVM — the key is a billable secret and
// this repo is PUBLIC, so the browser never sees it. Values move slowly:
// cache hard at the edge (7d) so repeat address checks cost zero credits.
export default async function handler(req, res) {
  const address = (req.query.address || "").toString().trim();
  if (!address) return res.status(400).json({ error: "address required" });
  const key = process.env.RENTCAST_API_KEY;
  if (!key) return res.status(503).json({ error: "not configured" });
  try {
    const r = await fetch(
      `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(address)}`,
      { headers: { "X-Api-Key": key, Accept: "application/json" } },
    );
    // RentCast returns 401 for BOTH an invalid key AND an inactive/lapsed subscription
    // (distinct bodies: auth/api-key-invalid vs billing/subscription-inactive) — either way
    // there's no value to show, so degrade gracefully, not as a 502.
    if (r.status === 401) return res.status(503).json({ error: "home value unavailable (RentCast key/subscription)" });
    // 404 = no AVM for this address (unknown / too few comps) — a NORMAL outcome on a
    // public address tool, not a gateway error. Return an empty value, not a 502.
    if (r.status === 404) return res.status(200).json({ value: null, low: null, high: null });
    if (r.status === 429) return res.status(503).json({ error: "rate limited" });
    if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` });
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=86400");
    return res.status(200).json({
      value: d.price ?? null,
      low: d.priceRangeLow ?? null,
      high: d.priceRangeHigh ?? null,
    });
  } catch {
    return res.status(502).json({ error: "upstream failed" });
  }
}
