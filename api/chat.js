// /api/chat.js
// Vercel Serverless Function — proxies requests to Gemini so the API key
// never reaches the browser. Deployed automatically by Vercel because it
// lives in the /api directory.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set' });
    return;
  }

  const MODEL_NAME = 'gemini-flash-lite-latest';
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:streamGenerateContent?alt=sse&key=${apiKey}`;

  try {
    const geminiRes = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    // Stream the response straight back to the browser, chunk by chunk,
    // so the frontend's existing streaming/reader code keeps working.
    res.writeHead(geminiRes.status, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const reader = geminiRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error('Gemini proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to reach Gemini API' });
    } else {
      res.end();
    }
  }
}
