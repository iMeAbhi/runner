// Client-side image compression + naming index for media uploads.
// Keeps payloads lightweight before they are piped to the Apps Script /
// Drive backend. Images are converted to base64 data so they survive the
// offline queue (IndexedDB) and a single JSON POST.

import imageCompression from 'browser-image-compression';

const COMPRESS_OPTS = {
  maxSizeMB: 0.7,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
  fileType: 'image/jpeg',
};

/** Sanitize a city name into a filesystem-safe token. */
function safeCity(city) {
  return (city || 'Unknown')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Compress a File and return an upload-ready descriptor.
 *
 * @param {File}   file
 * @param {object} opts { city, date }  (date as YYYY-MM-DD)
 * @returns {Promise<{name, mimeType, base64, bytes, previewUrl}>}
 */
export async function prepareImage(file, { city, date } = {}) {
  const compressed = await imageCompression(file, COMPRESS_OPTS);
  const base64 = await imageCompression.getDataUrlFromFile(compressed);

  const day = date || new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 7);
  // Unique naming index: YYYY-MM-DD_CityName_xxxxx.jpg
  const name = `${day}_${safeCity(city)}_${rand}.jpg`;

  return {
    name,
    mimeType: 'image/jpeg',
    base64, // full data URL (data:image/jpeg;base64,....)
    bytes: compressed.size,
    previewUrl: base64, // usable directly as <img src> while offline
    folder: `${day}_${safeCity(city)}`,
  };
}

/** Compress many files in parallel. */
export async function prepareImages(files, meta) {
  return Promise.all(Array.from(files).map((f) => prepareImage(f, meta)));
}

/** Strip the `data:...;base64,` prefix for backends that want raw base64. */
export function stripDataUrl(dataUrl) {
  const idx = dataUrl.indexOf('base64,');
  return idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
}
