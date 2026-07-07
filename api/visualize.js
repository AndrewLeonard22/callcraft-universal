// AI yard visualizer — the setter describes the upgrade ("turf + pergola over
// a paver patio"), we fetch the property's satellite view (Static Maps) and
// have Gemini's image model render the upgrade onto the REAL yard.
// Keys are server-side only (public repo).
// Server-side Static Maps needs a key that works WITHOUT a referer. A referrer-restricted
// key returns REQUEST_DENIED from a server → the visualizer would break the instant the client
// Maps key is locked. So prefer a DEDICATED, non-referrer-restricted server key (MAPS_SERVER_KEY:
// IP-restricted to Vercel egress or unrestricted, Static-Maps-only, quota-capped). Falls back to
// the deploy env's client key (works server-side only while it's still unrestricted), then to the
// already-public client key as a transitional last resort — remove once MAPS_SERVER_KEY is set.
const MAPS_KEY =
  process.env.MAPS_SERVER_KEY ||
  process.env.VITE_GOOGLE_MAPS_API_KEY ||
  "AIzaSyC4bx-C9vGvC0JEdRnd4B78Uvmhq6YtkbU";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { lat, lng, prompt } = req.body || {};
  if (typeof lat !== "number" || typeof lng !== "number" || !prompt?.trim())
    return res.status(400).json({ error: "lat, lng, prompt required" });
  const gemKey = process.env.GEMINI_API_KEY;
  if (!gemKey) return res.status(503).json({ error: "needs GEMINI_API_KEY" });
  try {
    // 1. the real yard, from above
    const imgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=20&size=640x640&scale=2&maptype=satellite&key=${MAPS_KEY}`;
    const imgResp = await fetch(imgUrl);
    if (!imgResp.ok) return res.status(502).json({ error: "satellite fetch failed" });
    const imgB64 = Buffer.from(await imgResp.arrayBuffer()).toString("base64");

    // 2. render the upgrade onto it
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${gemKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: "image/png", data: imgB64 } },
              { text: `This is an aerial satellite photo of a residential property. Photorealistically add the following outdoor-living upgrade to the backyard, keeping the house, driveway, neighboring properties and all surroundings exactly as they are: ${String(prompt).slice(0, 400)}. Render it as a realistic aerial view of the finished project.` },
            ],
          }],
        }),
      },
    );
    if (!r.ok) {
      const t = (await r.text()).slice(0, 200);
      return res.status(502).json({ error: `render failed: ${t}` });
    }
    const d = await r.json();
    const part = d?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    const out = part?.inlineData?.data || part?.inline_data?.data;
    if (!out) return res.status(502).json({ error: "no image in response" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ before: `data:image/png;base64,${imgB64}`, after: `data:image/png;base64,${out}` });
  } catch (e) {
    return res.status(502).json({ error: String(e).slice(0, 160) });
  }
}
