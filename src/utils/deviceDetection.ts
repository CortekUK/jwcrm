/**
 * Device Detection Utilities
 * Comprehensive device and camera capability detection
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface CameraCapabilities {
  hasCamera: boolean;
  hasFrontCamera: boolean;
  hasBackCamera: boolean;
  cameraCount: number;
  defaultFacingMode: 'user' | 'environment';
}

/**
 * Detect device type based on user agent, screen size, and touch support
 */
export function getDeviceType(): DeviceType {
  const userAgent = navigator.userAgent.toLowerCase();
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const screenWidth = window.innerWidth;

  // Check for mobile devices in user agent
  const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);

  // Mobile: Small screens with touch
  if (isMobileUA || (screenWidth < 768 && hasTouch)) {
    return 'mobile';
  }

  // Tablet: Medium screens with touch
  if (isTabletUA || (screenWidth >= 768 && screenWidth <= 1024 && hasTouch)) {
    return 'tablet';
  }

  // Desktop: Everything else
  return 'desktop';
}

/**
 * Check if camera is supported by the browser
 */
export function isCameraSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    navigator.mediaDevices.enumerateDevices
  );
}

/**
 * Detect available cameras on the device
 */
export async function getAvailableCameras(): Promise<CameraCapabilities> {
  if (!isCameraSupported()) {
    return {
      hasCamera: false,
      hasFrontCamera: false,
      hasBackCamera: false,
      cameraCount: 0,
      defaultFacingMode: 'user',
    };
  }

  try {
    // Request permission first (required for accurate device enumeration)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      // Permission denied or no camera - continue anyway
    }

    // Enumerate devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    const cameraCount = videoDevices.length;
    const hasCamera = cameraCount > 0;

    // Try to detect front/back cameras
    let hasFrontCamera = false;
    let hasBackCamera = false;

    videoDevices.forEach(device => {
      const label = device.label.toLowerCase();
      if (label.includes('front') || label.includes('user')) {
        hasFrontCamera = true;
      } else if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
        hasBackCamera = true;
      }
    });

    // If we can't determine from labels, make educated guess
    if (!hasFrontCamera && !hasBackCamera && hasCamera) {
      const deviceType = getDeviceType();
      if (deviceType === 'desktop') {
        // Desktops typically have front cameras only
        hasFrontCamera = true;
        hasBackCamera = false;
      } else {
        // Mobile/tablet - assume both if multiple, or front if single
        if (cameraCount > 1) {
          hasFrontCamera = true;
          hasBackCamera = true;
        } else {
          hasFrontCamera = true;
        }
      }
    }

    // Determine default facing mode
    const deviceType = getDeviceType();
    let defaultFacingMode: 'user' | 'environment' = 'user';

    if (deviceType === 'desktop') {
      defaultFacingMode = 'user'; // Desktop webcams are front-facing
    } else if (deviceType === 'mobile' || deviceType === 'tablet') {
      // Mobile/tablet: prefer back camera for document scanning
      defaultFacingMode = hasBackCamera ? 'environment' : 'user';
    }

    return {
      hasCamera,
      hasFrontCamera,
      hasBackCamera,
      cameraCount,
      defaultFacingMode,
    };
  } catch (error) {
    console.error('Failed to detect cameras:', error);
    return {
      hasCamera: false,
      hasFrontCamera: false,
      hasBackCamera: false,
      cameraCount: 0,
      defaultFacingMode: 'user',
    };
  }
}

/**
 * Detect if running on iOS Safari (requires special handling)
 */
export function isIOSSafari(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
  return isIOS && isSafari;
}
