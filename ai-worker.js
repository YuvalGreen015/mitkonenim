// Mitkonenim AI server: one small file, AI only. Runs on Cloudflare Workers (free).
// Secret needed: GEMINI_KEY (your Google AI key). It stays here and is never shown to anyone.
// Optional text variable: ALLOWED_ORIGIN (default https://algreen015.github.io): only your site may use it.
const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const hits = new Map();   // simple per-visitor limit (best effort): 30 requests per minute

function head(origin, allowed) {
  const h = { "content-type": "application/json", "cache-control": "no-store", "vary": "origin" };
  if (origin && origin === allowed) { h["access-control-allow-origin"] = origin; h["access-control-allow-headers"] = "content-type"; h["access-control-allow-methods"] = "POST, GET, OPTIONS"; }
  return h;
}
const out = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: h });

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || "https://algreen015.github.io";
    const origin = req.headers.get("origin") || "";
    const h = head(origin, allowed);
    if (req.method === "OPTIONS") return new Response(null, { status: origin === allowed ? 204 : 403, headers: h });
    if (req.method === "GET") return out({ ok: true, ai: !!env.GEMINI_KEY }, 200, h);
    if (req.method !== "POST") return out({ error: "not found" }, 404, h);
    if (origin !== allowed) return out({ error: "not allowed" }, 403, h);
    if (!env.GEMINI_KEY) return out({ error: "ai not set up" }, 503, h);

    const ip = req.headers.get("cf-connecting-ip") || "x", t = Date.now();
    const rec = (hits.get(ip) || []).filter(x => t - x < 60000);
    if (rec.length >= 30) return out({ error: "slow down" }, 429, h);
    rec.push(t); hits.set(ip, rec); if (hits.size > 5000) hits.clear();

    const txt = await req.text();
    if (txt.length > 12_000_000) return out({ error: "too big" }, 413, h);
    let b; try { b = JSON.parse(txt || "{}"); } catch (e) { return out({ error: "bad json" }, 400, h); }
    const prompt = String(b.prompt || "").slice(0, 40000);
    if (!prompt) return out({ error: "bad request" }, 400, h);
    const files = (Array.isArray(b.files) ? b.files : []).slice(0, 5)
      .filter(f => f && /^(image\/[\w.+-]+|application\/pdf)$/.test(String(f.mime)) && /^[A-Za-z0-9+/=]+$/.test(String(f.data || "")))
      .map(f => ({ inlineData: { mimeType: f.mime, data: f.data } }));

    let last = 502;
    for (const model of MODELS) {
      let r;
      try {
        r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_KEY },
          body: JSON.stringify({ contents: [{ role: "user", parts: [...files, { text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000, temperature: 0.7 } })
        });
      } catch (e) { return out({ error: "ai unreachable" }, 502, h); }
      if (r.status === 404 || r.status === 429) { last = r.status; continue; }
      if (r.status === 400 || r.status === 401 || r.status === 403) return out({ error: "bad key" }, 502, h);
      if (!r.ok) return out({ error: "ai error" }, 502, h);
      const j = await r.json();
      const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || "").join("");
      return out({ text }, 200, h);
    }
    return out({ error: "busy" }, last === 429 ? 429 : 502, h);
  }
};
