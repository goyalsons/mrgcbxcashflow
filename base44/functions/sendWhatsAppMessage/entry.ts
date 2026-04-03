import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const REDLAVA_BASE_URL = 'https://wa.redlava.in/api/v1/whatsapp';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  // Accept credentials from frontend payload, fallback to env secrets
  const apiKey = body.api_key || Deno.env.get('REDLAVA_API_KEY');
  const phoneId = body.phone_id || Deno.env.get('REDLAVA_PHONE_ID');

  if (!apiKey || !phoneId) {
    return Response.json({ error: 'RedLava credentials not configured. Please set API Key and Phone ID in Settings → WhatsApp.' }, { status: 500 });
  }

  const { action, templateName, language = 'en', templateVariables = [], to, fileUrl } = body;

  // Action: getTemplates — returns the list of template names stored in Settings
  if (action === 'getTemplates') {
    try {
      const settings = await base44.asServiceRole.entities.Settings.list();
      const waTemplates = settings?.[0]?.whatsapp_templates || [];
      return Response.json({ success: true, templates: waTemplates });
    } catch {
      return Response.json({ success: true, templates: [] });
    }
  }

  // Action: sendMessage — sends a WhatsApp template message via RedLava
  if (action === 'sendMessage') {
    if (!templateName || !to) {
      return Response.json({ error: 'templateName and to are required' }, { status: 400 });
    }

    const body = {
      templateName,
      language,
      to: String(to).replace(/^\+/, ''),
    };
    if (templateVariables.length > 0) body.templateVariables = templateVariables;
    if (fileUrl) body.fileUrl = fileUrl;

    const res = await fetch(`${REDLAVA_BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'x-phone-id': phoneId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      return Response.json({ success: true, messageId: data.messageId, timestamp: data.timestamp });
    } else {
      return Response.json({ success: false, error: data?.message || 'Failed to send message' }, { status: 400 });
    }
  }

  return Response.json({ error: 'Invalid action. Use sendMessage or getTemplates.' }, { status: 400 });
});