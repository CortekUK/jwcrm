"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { getDeviceType, getAvailableCameras, isCameraSupported, type CameraCapabilities } from '@/utils/deviceDetection';

interface UseCameraCapture {
  isOpen: boolean;
  stream: MediaStream | null;
  capturedImage: string | null;
  error: string | null;
  isInitializing: boolean;
  facingMode: 'user' | 'environment';
  videoRef: React.RefObject<HTMLVideoElement>;
  availableCameras: CameraCapabilities | null;
  canSwitchCamera: boolean;
  openCamera: () => void;
  closeCamera: () => void;
  startCamera: (mode?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
  capturePhoto: () => void;
  switchCamera: () => void;
  retake: () => void;
  confirmPhoto: () => string | null;
}

/**
 * Hook for managing camera capture functionality
 */
export function useCameraCapture(): UseCameraCapture {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [availableCameras, setAvailableCameras] = useState<CameraCapabilities | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Detect available cameras
   */
  const detectCameras = useCallback(async () => {
    if (!isCameraSupported()) {
      setError('Camera not supported on this device');
      return null;
    }

    try {
      const cameras = await getAvailableCameras();
      setAvailableCameras(cameras);
      return cameras;
    } catch (err) {
      console.error('Failed to detect cameras:', err);
      return null;
    }
  }, []);

  /**
   * Start camera stream with intelligent device detection
   */
  const startCamera = useCallback(async (preferredMode?: 'user' | 'environment') => {
    console.log('🎥 startCamera called with preferredMode:', preferredMode);
    setIsInitializing(true);
    setError(null);
    
    try {
      // Check if camera is supported
      if (!isCameraSupported()) {
        console.error('❌ Camera not supported');
        throw new Error('Camera not supported on this device');
      }
      console.log('✅ Camera is supported');

      // Detect available cameras if not already done
      let cameras = availableCameras;
      if (!cameras) {
        console.log('🔍 Detecting cameras...');
        cameras = await detectCameras();
        console.log('📷 Camera detection result:', cameras);
        if (!cameras || !cameras.hasCamera) {
          console.error('❌ No camera found');
          throw new Error('No camera found on this device');
        }
      }

      // Determine which camera to use
      const deviceType = getDeviceType();
      console.log('📱 Device type:', deviceType);
      let modeToUse = preferredMode;
      
      if (!modeToUse) {
        // Auto-select based on device type and availability
        modeToUse = cameras.defaultFacingMode;
      }
      console.log('🎯 Using camera mode:', modeToUse);

      // Try to start camera with preferred mode
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: modeToUse },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Got media stream:', mediaStream);
        console.log('📹 Stream tracks:', mediaStream.getTracks());
        setStream(mediaStream);
        setFacingMode(modeToUse);

        if (videoRef.current) {
          console.log('📺 Attaching stream to video element');
          videoRef.current.srcObject = mediaStream;
          
          // Wait for video metadata to load before marking as ready
          videoRef.current.onloadedmetadata = () => {
            console.log('✅ Video metadata loaded');
            console.log('📐 Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
            
            videoRef.current?.play()
              .then(() => {
                console.log('✅ Video playing');
                setIsInitializing(false);
              })
              .catch(err => {
                console.error('❌ Failed to play video:', err);
                setIsInitializing(false);
              });
          };
        } else {
          console.warn('⚠️ Video ref not available');
          setIsInitializing(false);
        }
        
        console.log('✅ Camera stream attached, waiting for video to load...');
        return;
      } catch (err: any) {
        console.warn(`Failed to start ${modeToUse} camera:`, err);
        
        // Fallback: Try opposite camera
        if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
          const fallbackMode = modeToUse === 'user' ? 'environment' : 'user';
          
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: fallbackMode },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
            });
            
            setStream(fallbackStream);
            setFacingMode(fallbackMode);
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
            }
            setIsInitializing(false);
            return;
          } catch {
            // Last resort: Any camera without constraints
            try {
              const anyStream = await navigator.mediaDevices.getUserMedia({ video: true });
              setStream(anyStream);
              setFacingMode('user');
              if (videoRef.current) {
                videoRef.current.srcObject = anyStream;
              }
              setIsInitializing(false);
              return;
            } catch {
              throw new Error('Failed to access any camera');
            }
          }
        }
        
        throw err;
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      
      let errorMessage = 'Failed to access camera';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please enable camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, [availableCameras, detectCameras]);

  /**
   * Stop camera stream
   */
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  /**
   * Capture photo from video stream
   */
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !stream) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);

    // Stop the camera stream after capture
    stopCamera();
  }, [stream, stopCamera]);

  /**
   * Switch between front and back camera
   */
  const switchCamera = useCallback(async () => {
    stopCamera();
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newMode);
  }, [facingMode, startCamera, stopCamera]);

  /**
   * Retake photo
   */
  const retake = useCallback(async () => {
    setCapturedImage(null);
    setError(null);
    await startCamera(facingMode);
  }, [facingMode, startCamera]);

  /**
   * Confirm and return captured photo
   */
  const confirmPhoto = useCallback(() => {
    const image = capturedImage;
    setCapturedImage(null);
    return image;
  }, [capturedImage]);

  /**
   * Open camera modal
   */
  const openCamera = useCallback(() => {
    setIsOpen(true);
    startCamera();
  }, [startCamera]);

  /**
   * Close camera modal
   */
  const closeCamera = useCallback(() => {
    setIsOpen(false);
    stopCamera();
    setCapturedImage(null);
    setError(null);
  }, [stopCamera]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    isOpen,
    stream,
    capturedImage,
    error,
    isInitializing,
    facingMode,
    videoRef,
    availableCameras,
    canSwitchCamera: availableCameras ? availableCameras.cameraCount > 1 : false,
    openCamera,
    closeCamera,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    retake,
    confirmPhoto,
  };
}
