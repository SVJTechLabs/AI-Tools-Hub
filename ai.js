// SVJ AI Tools — Serverless API Proxy
// Keys are stored in Vercel Environment Variables (never exposed to client)

export default async function handler(req, res) {
    // CORS headers for local dev + Vercel
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid prompt' });
    }

    const GEMINI_KEY = process.env.GEMINI_KEY;
    const GROQ_KEY = process.env.GROQ_KEY;

    // ── 1. Try Gemini ──
    if (GEMINI_KEY) {
        try {
            const gRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                }
            );
            const gData = await gRes.json();
            if (!gData.error) {
                return res.json({ result: gData.candidates[0].content.parts[0].text });
            }
        } catch (_) { /* fall through to Groq */ }
    }

    // ── 2. Fallback to Groq (Llama 3.3 70B) ──
    if (!GROQ_KEY) {
        return res.status(500).json({ error: 'No AI service available. Check environment variables.' });
    }

    try {
        const gqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2048,
                temperature: 0.7
            })
        });
        const gqData = await gqRes.json();
        if (gqData.error) throw new Error(gqData.error.message);
        return res.json({ result: gqData.choices[0].message.content });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Both AI services unavailable. Try again later.' });
    }
}
