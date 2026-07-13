import { useState, useRef, useEffect, useCallback } from "react";
import { Pen, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { compressBase64Image, SIGNATURE_COMPRESSION_OPTIONS } from "@/utils/image-compression";

interface SignatureCaptureProps {
  signature: string | null;
  onSignatureChange: (signature: string | null) => void;
}

export function SignatureCapture({ signature, onSignatureChange }: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const dprRef = useRef(1);
  const onSignatureChangeRef = useRef(onSignatureChange);
  
  // Helper to check if signature is valid (not null, not empty, and is a valid data URL)
  const isValidSignature = (sig: string | null): boolean => {
    return !!sig && typeof sig === 'string' && sig.trim() !== '' && sig.startsWith('data:image/');
  };
  
  // Helper to check if canvas has actual content (not just white/transparent)
  const checkCanvasContent = useCallback((): boolean => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current || canvas.width === 0 || canvas.height === 0) {
      return false;
    }
    
    try {
      const imageData = ctxRef.current.getImageData(0, 0, canvas.width, canvas.height);
      // Check if there's any non-white, non-transparent pixel
      // A signature should have dark pixels (RGB values < 250) with alpha > 0
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        
        // Check for dark pixels (signature ink) - not just any alpha
        // White background has high RGB values, signature has low RGB values
        if (a > 0 && (r < 250 || g < 250 || b < 250)) {
          return true;
        }
      }
    } catch (e) {
      // Canvas might not be initialized yet
      return false;
    }
    return false;
  }, []);
  
  const [hasSignature, setHasSignature] = useState(false);

  // Keep the callback ref up to date
  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);

  // Initialize canvas once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctxRef.current = ctx;

    // Store current signature data for smooth resizing
    let currentSignatureData: string | null = null;

    // Function to update canvas size smoothly
    const updateCanvasSize = () => {
      if (!canvas || !ctx) return;

      // Get the container (parent) dimensions instead of canvas itself
      const container = canvas.parentElement;
      if (!container) return;
      
      // Force a reflow to ensure container has correct dimensions
      void container.offsetWidth;
      
      const containerRect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      
      // Use container dimensions to ensure perfect match
      // Ensure we have valid dimensions (minimum values to prevent errors)
      let newWidth = containerRect.width;
      let newHeight = containerRect.height;
      
      // If dimensions are invalid, try to get from computed style
      if (newWidth <= 0 || newHeight <= 0) {
        const computedStyle = window.getComputedStyle(container);
        newWidth = parseFloat(computedStyle.width) || container.clientWidth || 300;
        newHeight = parseFloat(computedStyle.height) || container.clientHeight || 75;
      }
      
      // Ensure minimum dimensions
      newWidth = Math.max(newWidth, 100);
      newHeight = Math.max(newHeight, 25);
      
      // Store current signature before resizing
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          currentSignatureData = canvas.toDataURL("image/png");
        } catch (e) {
          // Canvas might be empty, ignore
        }
      }
      
      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
      
      // Restore drawing styles
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // Restore signature if it exists (prioritize prop signature, then current data)
      const signatureToRestore = signature || currentSignatureData;
      if (signatureToRestore && isValidSignature(signatureToRestore)) {
        const img = new Image();
        img.onload = () => {
          if (ctx && canvas) {
            ctx.clearRect(0, 0, newWidth, newHeight);
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            // Verify canvas has content after drawing
            setTimeout(() => {
              const hasContent = checkCanvasContent();
              setHasSignature(hasContent);
            }, 50);
            // Update parent if we restored from current data
            if (!signature && currentSignatureData) {
              onSignatureChangeRef.current(canvas.toDataURL("image/png"));
            }
          }
        };
        img.onerror = () => {
          // If image fails to load, clear the canvas
          if (ctx && canvas) {
            ctx.clearRect(0, 0, newWidth, newHeight);
            setHasSignature(false);
          }
        };
        img.src = signatureToRestore;
      } else {
        // Clear canvas if no signature
        ctx.clearRect(0, 0, newWidth, newHeight);
        setHasSignature(false);
      }
    };

    // Set canvas size initially with a small delay to ensure container is rendered
    const initTimeout = setTimeout(() => {
      updateCanvasSize();
      // After canvas is initialized, verify if it actually has content
      setTimeout(() => {
        if (canvas && ctx) {
          const hasContent = checkCanvasContent();
          setHasSignature(hasContent);
        } else {
          setHasSignature(false);
        }
      }, 200);
    }, 0);

    const getCoordinates = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      
      if ("touches" in e && e.touches.length > 0) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      if ("clientX" in e) {
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }
      return { x: 0, y: 0 };
    };

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!ctxRef.current) return;
      
      isDrawingRef.current = true;
      const coords = getCoordinates(e);
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(coords.x, coords.y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current || !ctxRef.current) return;
      
      const coords = getCoordinates(e);
      ctxRef.current.lineTo(coords.x, coords.y);
      ctxRef.current.stroke();
    };

    const saveSignatureInternal = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !ctxRef.current) return;
      
      try {
        // Check if canvas has any content
        const imageData = ctxRef.current.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((channel, index) => {
          // Check alpha channel (every 4th value)
          if (index % 4 === 3) {
            return channel > 0;
          }
          return false;
        });

        if (hasContent) {
          const dataUrl = canvas.toDataURL("image/png");
          // Compress signature before saving
          try {
            const compressedSignature = await compressBase64Image(dataUrl, SIGNATURE_COMPRESSION_OPTIONS);
            onSignatureChangeRef.current(compressedSignature);
            setHasSignature(true);
          } catch (error) {
            console.error("Error compressing signature:", error);
            // Fallback to uncompressed if compression fails
            onSignatureChangeRef.current(dataUrl);
            setHasSignature(true);
          }
        } else {
          onSignatureChangeRef.current(null);
          setHasSignature(false);
        }
      } catch (error) {
        console.error("Error saving signature:", error);
      }
    };

    const stopDrawing = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (isDrawingRef.current && ctxRef.current) {
        isDrawingRef.current = false;
        // Auto-save signature after stroke completes
        saveSignatureInternal();
      }
    };

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);

    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchcancel", stopDrawing);

    // Throttle resize updates for smooth performance
    let resizeTimeout: NodeJS.Timeout | null = null;
    const throttledUpdateCanvasSize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        updateCanvasSize();
        resizeTimeout = null;
      }, 16); // ~60fps
    };

    // Add resize observer to handle container size changes smoothly
    const resizeObserver = new ResizeObserver((entries) => {
      // Immediately update on resize (throttled)
      throttledUpdateCanvasSize();
    });
    
    // Observe the container element (parent of canvas)
    const container = canvas.parentElement;
    if (container) {
      resizeObserver.observe(container);
      // Also observe the canvas itself as a fallback
      resizeObserver.observe(canvas);
    }

    // Also listen to window resize as fallback (throttled)
    const handleResize = () => {
      throttledUpdateCanvasSize();
    };
    window.addEventListener("resize", handleResize, { passive: true });
    
    // Also update on orientation change for mobile devices
    const handleOrientationChange = () => {
      setTimeout(() => updateCanvasSize(), 100);
    };
    window.addEventListener("orientationchange", handleOrientationChange, { passive: true });

    return () => {
      clearTimeout(initTimeout);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseleave", stopDrawing);
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
      canvas.removeEventListener("touchcancel", stopDrawing);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [signature]); // Re-run if signature changes

  // Sync hasSignature with signature prop changes and check canvas content
  useEffect(() => {
    // Always start by setting to false, then verify
    if (!canvasRef.current || !ctxRef.current) {
      setHasSignature(false);
      return;
    }
    
    const isValid = isValidSignature(signature);
    
    // If signature is valid, load it onto canvas
    if (isValid && signature) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const img = new Image();
      img.onload = () => {
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
          ctx.drawImage(img, 0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
          // Check canvas content after loading - verify it actually has dark pixels
          setTimeout(() => {
            const hasContent = checkCanvasContent();
            setHasSignature(hasContent);
          }, 100);
        }
      };
      img.onerror = () => {
        // If image fails to load, treat as invalid
        setHasSignature(false);
      };
      img.src = signature;
    } else {
      // No valid signature prop - check canvas content directly
      setTimeout(() => {
        const hasContent = checkCanvasContent();
        setHasSignature(hasContent);
      }, 50);
    }
  }, [signature, checkCanvasContent]);

  const saveSignature = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;

    // Check if canvas has any content
    const imageData = ctxRef.current.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((channel, index) => {
      // Check alpha channel (every 4th value)
      if (index % 4 === 3) {
        return channel > 0;
      }
      return false;
    });

    if (hasContent) {
      const dataUrl = canvas.toDataURL("image/png");
      // Compress signature before saving
      try {
        const compressedSignature = await compressBase64Image(dataUrl, SIGNATURE_COMPRESSION_OPTIONS);
        onSignatureChange(compressedSignature);
        setHasSignature(true);
      } catch (error) {
        console.error("Error compressing signature:", error);
        // Fallback to uncompressed if compression fails
        onSignatureChange(dataUrl);
        setHasSignature(true);
      }
    } else {
      onSignatureChange(null);
      setHasSignature(false);
    }
  }, [onSignatureChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;

    const ctx = ctxRef.current;
    // Clear the canvas visually
    ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    // Update state immediately
    setHasSignature(false);
    // Notify parent that signature is cleared
    onSignatureChangeRef.current(null);
  }, []);


  return (
    <div className="space-y-4 w-full min-w-0">
      <Card className="border-2 w-full min-w-0">
        <CardContent className="p-0 w-full min-w-0">
          <div className="relative w-full min-w-0 overflow-hidden" style={{ aspectRatio: "4/1", width: "100%" }}>
            <canvas
              ref={canvasRef}
              className="block w-full h-full touch-none cursor-crosshair bg-white"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={clearSignature}
          variant="outline"
          className="w-full"
          size="lg"
          disabled={!hasSignature}
          title="Clear the canvas to start over"
        >
          <RotateCcw className="h-5 w-5 mr-2" />
          Clear
        </Button>
      </div>

      {!hasSignature ? (
        <div className="text-center">
          <Pen className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Sign above using your finger or mouse
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-success font-medium">
            ✓ Signature captured
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Your signature has been saved. You can clear it to start over.
          </p>
        </div>
      )}
    </div>
  );
}

