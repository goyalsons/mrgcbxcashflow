import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { v2 as cloudinary } from 'npm:cloudinary@2.5.1';

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

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const body = await req.json();
    const { file, folder = 'cashflow-pro' } = body;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const data = await cloudinary.uploader.upload(file, { folder, resource_type: 'auto' });

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