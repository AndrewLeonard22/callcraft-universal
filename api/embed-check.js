// Reports whether a URL allows being iframed (X-Frame-Options / CSP
// frame-ancestors). The Website tab and Reschedule popup use this to show a
// designed "open in new tab" fallback instead of the browser's raw
// "refused to connect" error. Fail-open: if the probe itself fails, we let
// the iframe try — worst case is the browser error we already had.
export default async function handler(req, res) {
  const url = String(req.query.url || "");
  let parsed;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(parsed.href, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; embed-check)" },
    });
    clearTimeout(t);
    const xfo = (r.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (r.headers.get("content-security-policy") || "").toLowerCase();
    const cspBlocks = csp.includes("frame-ancestors") && !/frame-ancestors[^;]*\*/.test(csp);
    const blocked = xfo.includes("deny") || xfo.includes("sameorigin") || cspBlocks;
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ frameable: !blocked });
  } catch {
    return res.status(200).json({ frameable: true });
  }
}
