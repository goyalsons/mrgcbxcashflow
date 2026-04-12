import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider, api_key, model, prompt } = await req.json();

    if (!provider || !api_key || !prompt) {
      return Response.json({ error: 'Missing required fields: provider, api_key, prompt' }, { status: 400 });
    }

    let response_text = '';

    if (provider === 'gemini') {
      const selectedModel = model || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${api_key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return Response.json({ error: data.error?.message || 'Gemini API error', details: data }, { status: 400 });
      }
      response_text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';

    } else if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': api_key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return Response.json({ error: data.error?.message || 'Claude API error', details: data }, { status: 400 });
      }
      response_text = data.content?.[0]?.text || 'No response from Claude';

    } else {
      return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return Response.json({ success: true, response: response_text, provider, model });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});