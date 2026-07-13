/**
 * Color utility functions for converting between color formats
 */

/**
 * Convert hex color to HSL format
 * @param hex - Hex color string (e.g., "#0d9488" or "0d9488")
 * @returns HSL string in format "hsl(h, s%, l%)"
 */
export function hexToHsl(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  return `hsl(${h}, ${s}%, ${lPercent}%)`;
}

/**
 * Validate hex color format
 */
export function isValidHex(hex: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

