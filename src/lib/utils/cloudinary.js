import { base44 } from '@/api/base44Client';

export async function uploadToCloudinary(file, folder = 'cashflow-pro') {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await base44.functions.invoke('uploadToCloudinary', {
    file: base64,
    folder,
  });

  return { url: response.data.url, public_id: response.data.public_id };
}