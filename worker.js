// Cloudflare Worker - שרת AI קטן שמסתיר את המפתח שלך.
// Settings > Variables and Secrets: GEMINI_KEY (Secret) = המפתח מ-aistudio.google.com/apikey
// אופציונלי: ALLOWED_ORIGIN = https://YOURNAME.github.io  (כך רק האתר שלך יוכל להשתמש בשרת)
const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allowed === '*' ? '*' : allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return new Response('ok', { headers: cors });
    if (allowed !== '*' && origin !== allowed) return new Response('forbidden', { status: 403, headers: cors });
    if (!env.GEMINI_KEY) return new Response('missing GEMINI_KEY', { status: 500, headers: cors });

    let prompt = '';
    try { prompt = String((await req.json()).prompt || ''); } catch (e) {}
    if (!prompt || prompt.length > 60000) return new Response('bad prompt', { status: 400, headers: cors });

    let lastStatus = 500, lastText = '';
    for (const model of MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16000, temperature: 0.7 },
          }),
        }
      );
      if (r.ok) {
        const j = await r.json();
        const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
          .map(p => p.text || '').join('');
        return new Response(JSON.stringify({ text }), { headers: { ...cors, 'content-type': 'application/json' } });
      }
      lastStatus = r.status; lastText = (await r.text()).slice(0, 300);
      if (r.status === 429) break;
    }
    return new Response(lastText || 'upstream error', { status: lastStatus, headers: cors });
  },
};
