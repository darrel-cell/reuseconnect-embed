// Utility functions for handling file URLs
import { API_BASE_URL } from '@/lib/config';

// Cache for blob URLs to avoid memory leaks
const blobUrlCache = new Map<string, string>();

/**
 * Converts a base64 data URL to a blob URL that can be opened in a new tab
 * Browsers block data URLs in window.open() for security reasons
 */
function convertDataUrlToBlobUrl(dataUrl: string): string {
  // Check if we already have a blob URL for this data URL
  if (blobUrlCache.has(dataUrl)) {
    return blobUrlCache.get(dataUrl)!;
  }

  try {
    // Extract the base64 data and mime type
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      console.warn('Invalid data URL format:', dataUrl.substring(0, 50) + '...');
      return dataUrl; // Return original if we can't parse it
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to binary
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Create blob URL
    const blobUrl = URL.createObjectURL(blob);
    
    // Cache it
    blobUrlCache.set(dataUrl, blobUrl);
    
    return blobUrl;
  } catch (error) {
    console.error('Failed to convert data URL to blob URL:', error);
    return dataUrl; // Return original on error
  }
}

/**
 * Converts a file URL to an authenticated URL that can be opened in a new tab
 * Handles:
 * - Relative paths like /uploads/evidence/photos/file.jpg
 * - Absolute URLs (S3 URLs, presigned URLs, etc.)
 * - Base64 data URLs (converts to blob URLs for new tab opening)
 * 
 * @param fileUrl - The file URL from the backend
 * @param forNewTab - If true, converts base64 data URLs to blob URLs (default: false)
 * @returns An authenticated URL that can be used in window.open() or <img src>
 */
export function getAuthenticatedFileUrl(fileUrl: string | null | undefined, forNewTab: boolean = false): string {
  // Handle null/undefined - return a placeholder to prevent about:blank
  if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim() === '') {
    console.warn('getAuthenticatedFileUrl: Received empty or invalid fileUrl', fileUrl);
    return '#';
  }

  const trimmedUrl = fileUrl.trim();
  
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.debug('getAuthenticatedFileUrl input:', trimmedUrl.substring(0, 100), 'forNewTab:', forNewTab);
  }

  // If it's already a full URL (http/https), return as is
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }

  // If it's a base64 data URL
  if (trimmedUrl.startsWith('data:')) {
    // For new tab opening, convert to blob URL (browsers block data URLs in window.open)
    if (forNewTab) {
      return convertDataUrlToBlobUrl(trimmedUrl);
    }
    // For img src, data URLs work fine
    return trimmedUrl;
  }

  // Remove /api from API_BASE_URL if present, since /uploads is not under /api
  // API_BASE_URL is typically http://localhost:3000/api
  // We need http://localhost:3000/uploads/...
  let baseUrl = API_BASE_URL;
  if (baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.replace('/api', '');
  }
  baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if present

  // Handle S3 keys that start with evidence/ or documents/ (without /uploads/ prefix)
  // These are stored as evidence/photos/file.jpg or documents/file.pdf
  // Note: If S3 is enabled, these should already be converted to presigned URLs by the backend
  // But we handle them here as a fallback
  if (trimmedUrl.startsWith('evidence/') || trimmedUrl.startsWith('documents/')) {
    const fullUrl = `${baseUrl}/uploads/${trimmedUrl}`;
    if (process.env.NODE_ENV === 'development') {
      console.debug('getAuthenticatedFileUrl: Converted S3 key to:', fullUrl);
    }
    return fullUrl;
  }

  // If it's a relative path starting with /uploads/, convert to full API URL
  if (trimmedUrl.startsWith('/uploads/')) {
    return `${baseUrl}${trimmedUrl}`;
  }

  // If it's a relative path without leading slash, add it
  if (trimmedUrl.startsWith('uploads/')) {
    return `${baseUrl}/${trimmedUrl}`;
  }

  // For any other relative path, assume it's under uploads
  // Ensure we don't double-add uploads if it's already there
  let finalUrl: string;
  if (trimmedUrl.startsWith('/')) {
    finalUrl = `${baseUrl}/uploads${trimmedUrl}`;
  } else {
    finalUrl = `${baseUrl}/uploads/${trimmedUrl}`;
  }
  
  // Final validation - ensure we have a valid URL
  if (!finalUrl || finalUrl === '#' || finalUrl === baseUrl || finalUrl === `${baseUrl}/uploads/`) {
    console.error('getAuthenticatedFileUrl: Generated invalid URL', { fileUrl, finalUrl, baseUrl });
    return '#';
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.debug('getAuthenticatedFileUrl output:', finalUrl);
  }
  
  return finalUrl;
}
