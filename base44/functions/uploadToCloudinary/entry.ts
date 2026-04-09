import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cloudName = (Deno.env.get('CLOUDINARY_CLOUD_NAME') || '').trim();
    const apiKey    = (Deno.env.get('CLOUDINARY_API_KEY') || '').trim();
    const apiSecret = (Deno.env.get('CLOUDINARY_API_SECRET') || '').trim();

    if (!cloudName || !apiKey || !apiSecret) {
      return Response.json({ error: 'Cloudinary credentials not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { file, folder = 'cashflow-pro' } = body;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Generate signature for authenticated upload
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;

    const msgBuffer = new TextEncoder().encode(toSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const formData = new FormData();
    formData.append('file', file); // base64 data URL accepted by Cloudinary
    formData.append('folder', folder);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ error: error.error?.message || 'Upload failed' }, { status: response.status });
    }

    const data = await response.json();
    return Response.json({
      url: data.secure_url,
      public_id: data.public_id,
      size: data.bytes,
      format: data.format,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});