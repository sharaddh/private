import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { X, Camera, CameraOff, Search, RefreshCw, AlertTriangle } from "lucide-react";

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [error, setError] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [useCamera, setUseCamera] = useState(true);
  const [starting, setStarting] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!useCamera) return;
    mountedRef.current = true;
    scannedRef.current = false;

    let retryCount = 0;

    async function startCamera() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        const backCamera = cameras.find(
          (c) => c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("rear") || c.label.toLowerCase().includes("environment")
        ) || cameras[cameras.length - 1] || { deviceId: undefined };

        const constraints: MediaStreamConstraints = {
          video: backCamera?.deviceId
            ? { deviceId: { exact: backCamera.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
            : { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mountedRef.current) { stopStream(stream); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!mountedRef.current) { stopStream(stream); return; }

        setStarting(false);
        scanFrame();
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("Camera error:", msg);

        if (msg.includes("NotAllowed") || msg.includes("Permission") || msg.includes("denied")) {
          setStarting(false);
          setError("Camera access denied. Please allow camera permissions in your browser settings.");
          setUseCamera(false);
        } else if (msg.includes("NotFound") || msg.includes("No camera")) {
          setStarting(false);
          setError("No camera found on this device.");
          setUseCamera(false);
        } else if (retryCount < 1) {
          retryCount++;
          await new Promise((r) => setTimeout(r, 600));
          if (!mountedRef.current) return;
          return startCamera();
        } else {
          setStarting(false);
          setError("Camera not available. Use manual entry below.");
          setUseCamera(false);
        }
      }
    }

    startCamera();

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animRef.current);
      stopStream(streamRef.current);
    };
  }, [useCamera]);

  function stopStream(stream: MediaStream | null) {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
  }

  function scanFrame() {
    if (!mountedRef.current || scannedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

    if (code && mountedRef.current) {
      scannedRef.current = true;
      stopStream(streamRef.current);
      onScan(code.data);
      return;
    }

    animRef.current = requestAnimationFrame(scanFrame);
  }

  const handleManualSubmit = useCallback(() => {
    if (!scanInput.trim()) return;
    onScan(scanInput.trim());
  }, [scanInput, onScan]);

  function retryCamera() {
    setError("");
    setStarting(true);
    setUseCamera(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-glass-lg overflow-hidden max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {useCamera ? <Camera size={18} className="text-primary-600" /> : <Search size={18} className="text-primary-600" />}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Scan QR Code</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {useCamera ? "Point the QR code toward the camera." : "Enter the SKU manually below."}
          </p>
        </div>

        {useCamera && (
          <div className="w-full aspect-[4/3] bg-gray-900 relative overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 aspect-square border-2 border-white/50 rounded-xl" />
            </div>
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                <div className="text-center text-white/60 space-y-3">
                  <div className="animate-spin w-8 h-8 border-3 border-white/30 border-t-white rounded-full mx-auto" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!useCamera && (
          <div className="px-5 py-6 space-y-3">
            {error && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 rounded-xl">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-lg tracking-wider font-mono"
                placeholder="Scan or type SKU..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualSubmit(); }}
                autoFocus
              />
              <button onClick={handleManualSubmit} className="btn-primary flex items-center gap-1.5 px-4">
                <Search size={16} /> Lookup
              </button>
            </div>
            <button onClick={retryCamera} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline">
              <RefreshCw size={14} /> Try camera again
            </button>
          </div>
        )}

        {useCamera && !starting && (
          <div className="flex items-center justify-center gap-2 px-5 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-dark-700">
            <CameraOff size={13} />
            Press Esc or click outside to cancel
          </div>
        )}
      </div>
    </div>
  );
}
