/**
 * Image processing utilities for camera capture
 * Handles EXIF orientation, resizing, compression, and thumbnail generation
 */

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;
const THUMBNAIL_SIZE = 300;
const THUMBNAIL_QUALITY = 0.7;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Load an image from a File or Blob
 */
function loadImage(source: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Read EXIF orientation from image file
 */
async function readExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      
      if (view.getUint16(0, false) !== 0xFFD8) {
        resolve(1); // Not a JPEG
        return;
      }
      
      const length = view.byteLength;
      let offset = 2;
      
      while (offset < length) {
        // Bounds check before reading
        if (offset + 2 > length) {
          resolve(1);
          return;
        }
        
        if (view.getUint16(offset + 2, false) <= 8) {
          resolve(1);
          return;
        }
        
        const marker = view.getUint16(offset, false);
        offset += 2;
        
        if (marker === 0xFFE1) {
          // Bounds check for EXIF data
          if (offset + 8 > length) {
            resolve(1);
            return;
          }
          
          const little = view.getUint16(offset + 8, false) === 0x4949;
          const markerLength = view.getUint16(offset, false);
          offset += markerLength;
          
          if (offset > view.byteLength || offset + 2 > length) {
            resolve(1);
            return;
          }
          
          const tags = view.getUint16(offset, little);
          offset += 2;
          
          for (let i = 0; i < tags; i++) {
            const tagOffset = offset + i * 12;
            // Bounds check for tag reading
            if (tagOffset + 12 > length) {
              resolve(1);
              return;
            }
            
            if (view.getUint16(tagOffset, little) === 0x0112) {
              if (tagOffset + 8 + 2 > length) {
                resolve(1);
                return;
              }
              resolve(view.getUint16(tagOffset + 8, little));
              return;
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          if (offset + 2 > length) {
            resolve(1);
            return;
          }
          offset += view.getUint16(offset, false);
        }
      }
      
      resolve(1);
    };
    
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // Read first 64KB
  });
}

/**
 * Calculate dimensions to fit within max size while maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  
  const ratio = width / height;
  
  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / ratio),
    };
  } else {
    return {
      width: Math.round(maxDimension * ratio),
      height: maxDimension,
    };
  }
}

/**
 * Apply EXIF orientation transformation to canvas
 */
function applyOrientation(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  orientation: number,
  width: number,
  height: number
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }
}

/**
 * Resize and compress image
 */
async function resizeAndCompress(
  img: HTMLImageElement,
  orientation: number,
  quality: number,
  maxDimension: number
): Promise<Blob> {
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxDimension
  );
  
  // For orientation 5-8, swap width and height for canvas size
  const needsSwap = orientation >= 5 && orientation <= 8;
  const canvasWidth = needsSwap ? height : width;
  const canvasHeight = needsSwap ? width : height;
  
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  
  // Apply orientation transformation
  ctx.save();
  applyOrientation(ctx, img, orientation, canvasWidth, canvasHeight);
  ctx.drawImage(img, 0, 0, width, height);
  ctx.restore();
  
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to compress image'));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Generate thumbnail from image
 */
async function generateThumbnail(
  img: HTMLImageElement,
  orientation: number
): Promise<string> {
  const blob = await resizeAndCompress(img, orientation, THUMBNAIL_QUALITY, THUMBNAIL_SIZE);
  return URL.createObjectURL(blob);
}

/**
 * Process image file: fix orientation, resize, compress
 * Returns processed file and thumbnail URL
 */
export async function processImageFile(
  file: File
): Promise<{ file: File; thumbnail: string }> {
  try {
    // Load image
    const img = await loadImage(file);
    
    // Read EXIF orientation
    const orientation = await readExifOrientation(file);
    
    // Generate thumbnail
    const thumbnail = await generateThumbnail(img, orientation);
    
    // Resize and compress main image
    let blob = await resizeAndCompress(img, orientation, JPEG_QUALITY, MAX_DIMENSION);
    
    // If still too large, compress more aggressively
    if (blob.size > MAX_FILE_SIZE) {
      blob = await resizeAndCompress(img, orientation, 0.7, MAX_DIMENSION);
    }
    
    // If still too large after aggressive compression, reject
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error('Image is too large even after compression. Please use a smaller image.');
    }
    
    // Create File from Blob
    const timestamp = Date.now();
    const processedFile = new File(
      [blob],
      `capture-${timestamp}.jpg`,
      { type: 'image/jpeg' }
    );
    
    return { file: processedFile, thumbnail };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

/**
 * Convert data URL to File
 */
export function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
}
