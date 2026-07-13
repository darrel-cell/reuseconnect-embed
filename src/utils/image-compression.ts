// Image compression utilities for frontend
import imageCompression, { type Options } from 'browser-image-compression';

// Maximum file size: 15MB
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes
const COMPRESSION_TIMEOUT_MS = 15000;

// Compression options for photos (evidence photos)
export const PHOTO_COMPRESSION_OPTIONS: Options = {
  maxSizeMB: 2, // Target size: 2MB (will compress to fit within this)
  maxWidthOrHeight: 1920, // Maximum width or height
  useWebWorker: true, // Use web worker for better performance
  fileType: 'image/jpeg', // Convert to JPEG for better compression
  initialQuality: 0.85, // Initial quality (0-1)
  alwaysKeepResolution: false, // Allow resizing if needed
};

// Compression options for signatures (smaller, simpler images)
export const SIGNATURE_COMPRESSION_OPTIONS: Options = {
  maxSizeMB: 0.5, // Target size: 500KB (signatures are simpler)
  maxWidthOrHeight: 1920, // Maximum width or height
  useWebWorker: true,
  fileType: 'image/png', // Keep PNG for signatures (transparency support)
  initialQuality: 0.9, // Higher quality for signatures
  alwaysKeepResolution: false,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        window.clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function compressFileWithFallback(file: File, options: Options): Promise<File> {
  const workerEnabledOptions: Options = {
    ...options,
    useWebWorker: options.useWebWorker !== false,
  };

  try {
    return await withTimeout(
      imageCompression(file, workerEnabledOptions),
      COMPRESSION_TIMEOUT_MS,
      'Image compression timed out in worker mode'
    );
  } catch (workerError) {
    // Fallback for embedded browsers/webviews where workers can hang or fail.
    const noWorkerOptions: Options = {
      ...options,
      useWebWorker: false,
    };

    try {
      return await withTimeout(
        imageCompression(file, noWorkerOptions),
        COMPRESSION_TIMEOUT_MS,
        'Image compression timed out in fallback mode'
      );
    } catch (fallbackError) {
      const workerMessage = workerError instanceof Error ? workerError.message : 'Unknown worker error';
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error';
      throw new Error(`Image compression failed. Worker mode: ${workerMessage}. Fallback mode: ${fallbackMessage}.`);
    }
  }
}

/**
 * Compress an image file before upload
 * @param file - The image file to compress
 * @param options - Compression options (defaults to photo options)
 * @returns Compressed file as base64 data URL
 */
export async function compressImage(
  file: File,
  options: Options = PHOTO_COMPRESSION_OPTIONS
): Promise<string> {
  try {
    // Check file size before compression
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Compress with worker first, then auto-fallback without worker when needed.
    const compressedFile = await compressFileWithFallback(file, options);

    // Check compressed file size
    if (compressedFile.size > MAX_FILE_SIZE) {
      throw new Error(`Compressed file size (${(compressedFile.size / 1024 / 1024).toFixed(2)}MB) still exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Convert compressed file to base64 data URL
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read compressed file'));
      };
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to compress image');
  }
}

/**
 * Compress a base64 image data URL
 * @param dataUrl - Base64 data URL string
 * @param options - Compression options (defaults to photo options)
 * @returns Compressed image as base64 data URL
 */
export async function compressBase64Image(
  dataUrl: string,
  options: Options = PHOTO_COMPRESSION_OPTIONS
): Promise<string> {
  try {
    // Convert data URL to File object
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type });

    // Compress using the file compression function
    return await compressImage(file, options);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to compress base64 image');
  }
}

/**
 * Get file size from base64 data URL
 * @param dataUrl - Base64 data URL string
 * @returns File size in bytes
 */
export function getBase64FileSize(dataUrl: string): number {
  if (!dataUrl || !dataUrl.includes(',')) {
    return 0;
  }
  const base64Data = dataUrl.split(',')[1];
  // Base64 is approximately 33% larger than binary
  return (base64Data.length * 3) / 4;
}
