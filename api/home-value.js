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
    if (r.status === 403) return res.status(503).json({ error: "subscription inactive" });
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
