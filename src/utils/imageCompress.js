// Client-side image compression via an HTML5 Canvas redraw.
//
// Keeps the production payload tiny: we downscale to a max edge and re-encode as
// JPEG before producing the base64 string that gets streamed to Apps Script.

const MAX_EDGE = 1600; // px — longest side after downscale
const QUALITY = 0.72; // JPEG quality

/**
 * @param {File|Blob} file
 * @returns {Promise<{ base64: string, mime: string, name: string }>}
 *   base64 is the raw (no data: prefix) payload, ready for DriveApp on the server.
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      const base64 = dataUrl.split(',')[1];
      resolve({
        base64,
        mime: 'image/jpeg',
        name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg',
      });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Compress many files, preserving order (used to seed the upload queue). */
export async function compressMany(files) {
  const out = [];
  for (const f of files) {
    try {
      out.push(await compressImage(f));
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}
