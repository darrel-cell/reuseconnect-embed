export const REFERRAL_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const REFERRAL_LOGO_MAX_WIDTH = 2000;
export const REFERRAL_LOGO_MAX_HEIGHT = 800;
export const REFERRAL_LOGO_MIN_WIDTH = 100;
export const REFERRAL_LOGO_MIN_HEIGHT = 30;
export const REFERRAL_LOGO_MIN_ASPECT_RATIO = 1;
export const REFERRAL_LOGO_MAX_ASPECT_RATIO = 6;

const ALLOWED_EXTENSIONS = new Set(['.svg', '.png', '.webp']);

function parseSvgAspectRatio(svgText: string): number | null {
  const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return parts[2] / parts[3];
    }
  }

  const widthMatch = svgText.match(/\bwidth=["']([\d.]+)/i);
  const heightMatch = svgText.match(/\bheight=["']([\d.]+)/i);
  const width = widthMatch ? Number(widthMatch[1]) : 0;
  const height = heightMatch ? Number(heightMatch[1]) : 0;
  if (width > 0 && height > 0) {
    return width / height;
  }

  return null;
}

function validateAspectRatio(width: number, height: number) {
  if (height <= 0) {
    return 'Could not read logo dimensions.';
  }
  const ratio = width / height;
  if (ratio < REFERRAL_LOGO_MIN_ASPECT_RATIO || ratio > REFERRAL_LOGO_MAX_ASPECT_RATIO) {
    return `Logo aspect ratio must be between ${REFERRAL_LOGO_MIN_ASPECT_RATIO}:1 and ${REFERRAL_LOGO_MAX_ASPECT_RATIO}:1 (width to height).`;
  }
  return null;
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read logo image.'));
    };
    image.src = url;
  });
}

export async function validateReferralLogoFile(file: File): Promise<string | null> {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return 'Allowed logo types: SVG, PNG, or WebP.';
  }
  if (file.size > REFERRAL_LOGO_MAX_BYTES) {
    return 'Logo must be 2 MB or smaller.';
  }

  if (ext === '.svg') {
    const svgText = await file.text();
    if (!svgText.includes('<svg')) {
      return 'Invalid SVG logo file.';
    }
    const ratio = parseSvgAspectRatio(svgText);
    if (!ratio) {
      return 'Could not read SVG logo dimensions. Ensure the file has a viewBox or width/height.';
    }
    const virtualWidth = REFERRAL_LOGO_MIN_WIDTH * ratio;
    return validateAspectRatio(virtualWidth, REFERRAL_LOGO_MIN_WIDTH);
  }

  try {
    const { width, height } = await loadImageDimensions(file);
    if (width < REFERRAL_LOGO_MIN_WIDTH || height < REFERRAL_LOGO_MIN_HEIGHT) {
      return `Logo must be at least ${REFERRAL_LOGO_MIN_WIDTH}×${REFERRAL_LOGO_MIN_HEIGHT} pixels.`;
    }
    if (width > REFERRAL_LOGO_MAX_WIDTH || height > REFERRAL_LOGO_MAX_HEIGHT) {
      return `Logo must be at most ${REFERRAL_LOGO_MAX_WIDTH}×${REFERRAL_LOGO_MAX_HEIGHT} pixels.`;
    }
    return validateAspectRatio(width, height);
  } catch {
    return 'Could not read logo image.';
  }
}
