import { base44 } from '@/api/base44Client';

const SETTINGS_KEY = 'cashflow_pro_settings';

export function getCloudinaryConfig() {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return settings.cloudinary || {};
  } catch {
    return {};
  }
}

export async function uploadToCloudinary(file, folder = 'invoices') {
  const config = getCloudinaryConfig();
  
  if (!config.cloud_name || !config.api_key) {
    throw new Error('Cloudinary not configured. Please set it up in Settings.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'cashflow_pro');
  formData.append('folder', folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloud_name}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Upload failed');
  }

  const data = await response.json();
  return {
    url: data.secure_url,
    public_id: data.public_id,
    size: data.bytes,
    format: data.format,
  };
}