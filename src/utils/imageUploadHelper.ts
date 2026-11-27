import { Platform } from 'react-native';

export interface PickedImageInput {
  uri?: string;
  base64?: string | null;
  mimeType?: string | null;
}

/**
 * Nén và chuẩn hóa ảnh đã chụp/chọn thành Data URI (JPEG/PNG base64) tối ưu kích thước
 * để upload lên Google Drive qua Apps Script và phục vụ hiển thị trực tiếp trên Web.
 */
async function compressImageOnWeb(
  sourceUri: string,
  maxDimension: number,
  quality: number
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) {
            resolve(null);
            return;
          }
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUri = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUri && dataUri.startsWith('data:image/') ? dataUri : null);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = sourceUri;
    } catch {
      resolve(null);
    }
  });
}

export async function normalizePickedImageToDataUri(
  asset: PickedImageInput,
  maxDimension: number = 1280,
  quality: number = 0.7
): Promise<string | null> {
  if (!asset) return null;

  if (Platform.OS === 'web' && asset.uri) {
    const compressed = await compressImageOnWeb(asset.uri, maxDimension, quality);
    if (compressed) {
      return compressed;
    }
  }

  if (asset.base64) {
    const raw = String(asset.base64).trim();
    if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(raw)) {
      return raw.replace(/^data:image\/jpg;/i, 'data:image/jpeg;');
    }
    const mime =
      asset.mimeType && /^image\/(png|webp)$/i.test(asset.mimeType)
        ? asset.mimeType.toLowerCase()
        : 'image/jpeg';
    return `data:${mime};base64,${raw}`;
  }

  if (asset.uri && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(asset.uri)) {
    return asset.uri.replace(/^data:image\/jpg;/i, 'data:image/jpeg;');
  }

  return null;
}
