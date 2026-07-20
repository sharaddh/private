import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { X, Camera, CameraOff, Search, RefreshCw, AlertTriangle, Clock } from "lucide-react";

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* audio beep is best-effort */ }
}

export default function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [error, setError] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [useCamera, setUseCamera] = useState(true);
  const [starting, setStarting] = useState(true);
  const [scanTimer, setScanTimer] = useState(0);
  const [scanSuccess, setScanSuccess] = useState(false);
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
    setScanSuccess(false);
    setScanTimer(0);

    const timer = setInterval(() => {
      if (!mountedRef.current) return;
      setScanTimer((t) => t + 1);
    }, 1000);

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
      clearInterval(timer);
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

  let frameSkip = 0;

  function scanFrame() {
    if (!mountedRef.current || scannedRef.current) return;
    frameSkip = (frameSkip + 1) % 3;
    if (frameSkip !== 0) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

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
      setScanSuccess(true);
      stopStream(streamRef.current);
      playBeep();
      try { navigator.vibrate?.(200); } catch {}
      setTimeout(() => onScan(code.data), 300);
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
    setScanTimer(0);
    setUseCamera(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="overflow-hidden max-w-sm w-full bg-th-surface rounded-[8px]" onClick={(e) => e.stopPropagation()} style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {useCamera ? <Camera size={18} className="text-[#1ed760]" /> : <Search size={18} className="text-[#1ed760]" />}
            <h3 className="text-[20px] font-bold text-th-text">Scan QR Code</h3>
          </div>
          <button onClick={onClose} title="Close (Esc)" aria-label="Close scanner" className="p-1.5 hover:bg-th-elevated rounded-[9999px] text-th-secondary">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-2">
          <p className="text-[18px] text-th-secondary">
            {useCamera ? "Point the QR code toward the camera." : "Enter the SKU manually below."}
          </p>
        </div>

        {useCamera && (
          <div className="w-full aspect-[4/3] bg-[#000000] relative overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 aspect-square border-2 border-[#1ed760]/50 rounded-[8px] animate-pulse" />
            </div>
            {scanSuccess && (
              <div className="absolute inset-0 bg-[#1ed760]/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-th-text text-lg font-bold">✓ Scanned!</div>
                  <div className="text-th-text/70 text-xs mt-1">Redirecting...</div>
                </div>
              </div>
            )}
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#000000]/90">
                <div className="text-center text-th-text/60 space-y-3">
                  <div className="animate-spin w-8 h-8 border-3 border-th-text/30 border-t-th-text rounded-full mx-auto" />
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!useCamera && (
          <div className="px-5 py-6 space-y-3">
            {error && (
              <div className="flex items-center gap-2 text-[18px] text-[#f59e0b] bg-[#f59e0b]/10 px-4 py-3 rounded-[8px]">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 text-[20px] tracking-wider font-mono px-4 py-2.5 rounded-lg bg-th-elevated text-th-text placeholder-th-muted focus:outline-none focus:border-[#1ed760] transition-all duration-200"
                style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
                placeholder="Type or scan SKU..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualSubmit(); }}
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
              <button type="button" onClick={handleManualSubmit} className="flex items-center gap-1.5 px-4 bg-[#1ed760] hover:bg-[#1ed760]/90 text-black font-semibold rounded-lg uppercase tracking-wider text-[18px] transition-all duration-200">
                <Search size={16} /> Lookup
              </button>
            </div>
            <button type="button" onClick={retryCamera} className="flex items-center gap-1.5 text-[18px] text-[#1ed760] hover:underline">
              <RefreshCw size={14} /> Try camera again
            </button>
          </div>
        )}

        {useCamera && !starting && (
          <>
            <div className="flex items-center justify-center gap-2 px-5 py-3 text-[16px] text-th-secondary border-t border-th-border">
              <CameraOff size={13} />
              {scanTimer > 8 && <span className="text-amber-500 font-medium">Still scanning... try bringing the QR closer.</span>}
              {scanTimer <= 8 && <span>Press Esc or click outside to cancel</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
