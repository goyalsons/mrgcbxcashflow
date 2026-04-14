import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Load credentials: body (Settings test) > DB app_settings > env secrets
    let dbCloudName = '', dbApiKey = '', dbApiSecret = '';
    try {
      const settingsRecords = await base44.asServiceRole.entities.AppSettings.filter({ key: 'app_settings_v1' });
      if (settingsRecords.length > 0) {
        const s = JSON.parse(settingsRecords[0].value || '{}');
        dbCloudName = s.cloudinary?.cloud_name || '';
        dbApiKey    = s.cloudinary?.api_key    || '';
        dbApiSecret = s.cloudinary?.api_secret || '';
      }
    } catch (e) { /* ignore */ }

    const cloudName = (body.cloud_name || dbCloudName || Deno.env.get('CLOUDINARY_CLOUD_NAME') || '').trim();
    const apiKey    = (body.api_key    || dbApiKey    || Deno.env.get('CLOUDINARY_API_KEY')    || '').trim();
    const apiSecret = (body.api_secret || dbApiSecret || Deno.env.get('CLOUDINARY_API_SECRET') || '').trim();

    console.log('[uploadToCloudinary] Using cloud_name:', cloudName || '(empty)');

    if (!cloudName || !apiKey || !apiSecret) {
      // Return 200 so frontend can read the error (non-2xx causes axios to throw before reading body)
      return Response.json({ error: 'Cloudinary credentials not configured. Provide cloud_name, api_key, and api_secret.' });
    }

    const { file, folder = 'cashflow-pro' } = body;

    if (!file) {
      // For connection test, skip actual upload and just verify credentials via a ping
      const testUrl = `https://api.cloudinary.com/v1_1/${cloudName}/ping`;
      const authHeader = 'Basic ' + btoa(`${apiKey}:${apiSecret}`);
      const pingRes = await fetch(testUrl, { headers: { 'Authorization': authHeader } });
      const pingData = await pingRes.json();
      console.log('[uploadToCloudinary] Ping response:', pingRes.status, JSON.stringify(pingData));
      if (!pingRes.ok) {
        return Response.json({ error: `Cloudinary auth failed (${pingRes.status}): ${pingData.error?.message || JSON.stringify(pingData)}` });
      }
      return Response.json({ success: true, message: 'Cloudinary connection verified successfully!' });
    }

    // Generate SHA-1 signature
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const msgBuffer = new TextEncoder().encode(toSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data);
      console.error('[uploadToCloudinary] Upload failed:', response.status, errMsg);
      return Response.json({ error: `Upload failed (${response.status}): ${errMsg}` });
    }

    return Response.json({
      url: data.secure_url,
      public_id: data.public_id,
      size: data.bytes,
      format: data.format,
    });
  } catch (error) {
    console.error('[uploadToCloudinary] Exception:', error.message);
    return Response.json({ error: error.message });
  }
});