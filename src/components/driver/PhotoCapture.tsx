import { useState, useRef, useEffect } from "react";
import { Camera, X, Upload, Image as ImageIcon, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { compressImage, compressBase64Image, MAX_FILE_SIZE, PHOTO_COMPRESSION_OPTIONS } from "@/utils/image-compression";

interface PhotoCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoCapture({ photos, onPhotosChange, maxPhotos = 10 }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Cleanup stream when component unmounts or camera closes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setError(null);
  };

  const startCamera = async () => {
    try {
      setError(null);
      
      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Open dialog first (shows loading state)
      setIsCameraOpen(true);

      // Request camera access
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (constraintErr) {
        // If specific constraints fail, try with default settings
        console.warn('Camera constraints not supported, trying default settings:', constraintErr);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setStream(mediaStream);
      
      // Set video stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Show error message
      let errorMsg = 'Failed to access camera. Please check your browser permissions.';
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        errorMsg = 'Camera access denied. Please allow camera access in your browser settings.';
      } else if (errorMessage.includes('not found') || errorMessage.includes('NotFoundError')) {
        errorMsg = 'No camera found. Please connect a camera and try again.';
      }
      
      setError(errorMsg);
      
      // Show error in toast notification
      toast.error('Camera Access Failed', {
        description: errorMsg,
        duration: 5000,
      });
      
      // Dialog will remain open showing the error message
      // User can close it manually via the Cancel button or X button
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to data URL (base64 image)
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Check if we can add more photos
    if (photos.length >= maxPhotos) {
      setError(`Maximum ${maxPhotos} photos reached.`);
      return;
    }

    // Compress the image before adding
    setIsCompressing(true);
    try {
      const compressedPhoto = await compressBase64Image(photoDataUrl, PHOTO_COMPRESSION_OPTIONS);
      onPhotosChange([...photos, compressedPhoto]);
      
      // Show success feedback briefly before closing
      setTimeout(() => {
        stopCamera();
      }, 500);
    } catch (error) {
      console.error('Failed to compress photo:', error);
      toast.error('Failed to compress photo', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
      setError('Failed to compress photo. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);
    
    // Restart camera with new facing mode
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error switching camera:', err);
      setError('Failed to switch camera. Please try again.');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const remainingSlots = maxPhotos - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    setIsCompressing(true);
    const compressedPhotos: string[] = [];

    try {
      for (const file of filesToProcess) {
        if (file.type.startsWith("image/")) {
          // Check file size before compression
          if (file.size > MAX_FILE_SIZE) {
            toast.error("File too large", {
              description: `${file.name} exceeds the maximum file size of ${MAX_FILE_SIZE / 1024 / 1024}MB. Please choose a smaller image.`,
            });
            continue;
          }

          try {
            // Compress the image
            const compressedPhoto = await compressImage(file, PHOTO_COMPRESSION_OPTIONS);
            compressedPhotos.push(compressedPhoto);
          } catch (error) {
            console.error(`Failed to compress ${file.name}:`, error);
            toast.error("Compression failed", {
              description: `Failed to compress ${file.name}. ${error instanceof Error ? error.message : 'Please try again.'}`,
            });
          }
        } else {
          toast.error("Invalid file type", {
            description: `${file.name} is not a valid image file.`,
          });
        }
      }

      // Add all compressed photos at once
      if (compressedPhotos.length > 0) {
        onPhotosChange([...photos, ...compressedPhotos]);
      }
    } finally {
      setIsCompressing(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  const openCamera = () => {
    startCamera();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant="default"
          type="button"
          onClick={openCamera}
          disabled={photos.length >= maxPhotos}
          className="flex-1"
          size="lg"
        >
          <Camera className="h-5 w-5 mr-2" />
          Take Photo
        </Button>
        <Button
          type="button"
          onClick={openFilePicker}
          disabled={photos.length >= maxPhotos || isCompressing}
          variant="outline"
          className="flex-1"
          size="lg"
        >
          {isCompressing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Compressing...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mr-2" />
              Upload
            </>
          )}
        </Button>
      </div>

      {/* Camera Preview Dialog */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => {
        if (!open) stopCamera();
      }}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Camera Preview</DialogTitle>
            <DialogDescription>
              Position yourself and click "Capture Photo" to take the picture
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative bg-black rounded-lg overflow-hidden">
            {/* Video preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto max-h-[60vh] object-contain"
            />
            
            {/* Canvas for capturing (hidden) */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Error message */}
            {error && (
              <div className="absolute top-4 left-4 right-4 bg-destructive text-destructive-foreground p-3 rounded-md text-sm">
                {error}
              </div>
            )}
          </div>
          
          {/* Camera controls */}
          <div className="flex gap-2 px-6 pb-6 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={stopCamera}
              className="flex-1"
            >
              Cancel
            </Button>
            
            {/* Switch camera button (only show on devices with multiple cameras) */}
            <Button
              type="button"
              variant="outline"
              onClick={switchCamera}
              className="flex-shrink-0"
              title="Switch camera (front/back)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              onClick={capturePhoto}
              disabled={photos.length >= maxPhotos || isCompressing}
              className="flex-1 bg-primary text-primary-foreground"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Compressing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Capture Photo
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        multiple={maxPhotos > 1}
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <Card key={index} className="relative group overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-square">
                  <img
                    src={photo}
                    alt={`Evidence photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No photos captured yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tap "Take Photo" or "Upload" to add evidence photos
            </p>
          </CardContent>
        </Card>
      )}

      {photos.length > 0 && photos.length < maxPhotos && (
        <p className="text-xs text-muted-foreground text-center">
          {photos.length} of {maxPhotos} photos captured
        </p>
      )}

      {photos.length >= maxPhotos && (
        <p className="text-xs text-warning-foreground text-center">
          Maximum {maxPhotos} photos reached
        </p>
      )}
    </div>
  );
}

