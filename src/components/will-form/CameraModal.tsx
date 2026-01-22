import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDeviceType } from '@/utils/deviceDetection';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title?: string;
}

/**
 * Camera capture modal with live preview and controls
 */
export function CameraModal({ isOpen, onClose, onCapture, title = "Take Photo" }: CameraModalProps) {
  const {
    stream,
    capturedImage,
    error,
    isInitializing,
    videoRef,
    canSwitchCamera,
    startCamera,
    closeCamera,
    capturePhoto,
    switchCamera,
    retake,
    confirmPhoto,
  } = useCameraCapture();

  // Start camera when modal opens with device-appropriate default
  useEffect(() => {
    if (isOpen && !stream && !isInitializing && !capturedImage) {
      const deviceType = getDeviceType();
      // Desktop: front camera, Mobile/Tablet: back camera
      const defaultMode = deviceType === 'desktop' ? 'user' : 'environment';
      startCamera(defaultMode);
    }
  }, [isOpen, stream, isInitializing, capturedImage, startCamera]);

  // Handle modal close
  useEffect(() => {
    if (!isOpen && stream) {
      closeCamera();
    }
  }, [isOpen, stream, closeCamera]);

  const handleClose = () => {
    closeCamera();
    onClose();
  };

  const handleConfirm = () => {
    const image = confirmPhoto();
    if (image) {
      onCapture(image);
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative bg-black">
          {/* Camera Preview or Captured Image */}
          {!capturedImage ? (
            <div className="relative aspect-[4/3] bg-black flex items-center justify-center">
              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="text-center text-white">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "w-full h-full object-cover",
                  isInitializing && "opacity-0"
                )}
              />

              {!stream && !isInitializing && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative aspect-[4/3] bg-black">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4">
          {!capturedImage ? (
            <div className="flex items-center justify-center gap-4">
              {/* Switch Camera Button (only if multiple cameras available) */}
              {stream && !error && canSwitchCamera && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  className="rounded-full h-12 w-12"
                >
                  <SwitchCamera className="h-5 w-5" />
                </Button>
              )}

              {/* Capture Button */}
              <Button
                type="button"
                size="lg"
                onClick={capturePhoto}
                disabled={!stream || isInitializing || !!error}
                className="rounded-full h-16 w-16 p-0"
              >
                <Camera className="h-6 w-6" />
              </Button>

              {/* Spacer for alignment */}
              {stream && !error && canSwitchCamera && <div className="w-12" />}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              {/* Retake Button */}
              <Button
                type="button"
                variant="outline"
                onClick={retake}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake
              </Button>

              {/* Use Photo Button */}
              <Button
                type="button"
                onClick={handleConfirm}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Use Photo
              </Button>
            </div>
          )}

          {/* Cancel Button */}
          {!capturedImage && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
