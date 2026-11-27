import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Keyboard, Lock, ScanBarcode, X } from "lucide-react";
import logoUrl from "../assets/logo.png";

export const CLUB_CODE = "KUC-REG-2025-001";

// Minimal typing for the Barcode Detection API (not in the standard TS DOM
// lib). Supported in Chrome/Edge on Android & desktop; elsewhere the manual
// code entry below is the fallback.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof w.BarcodeDetector === "function" ? w.BarcodeDetector : null;
}

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [mode, setMode] = useState<"choose" | "scan" | "type">("choose");
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastBadRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const stopCamera = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => stopCamera, []);

  const checkCode = (raw: string): boolean => {
    if (normalize(raw) === normalize(CLUB_CODE)) {
      stopCamera();
      onUnlock();
      return true;
    }
    return false;
  };

  const startScan = async () => {
    setError(null);
    setCamError(null);
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setCamError(
        "Barcode scanning is not supported in this browser. Type the club code below instead.",
      );
      setMode("type");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(
        "The camera is not available on this device. Type the club code below instead.",
      );
      setMode("type");
      return;
    }
    setMode("scan");
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setStarting(false);
      const detector = new Detector({
        formats: ["code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"],
      });
      timerRef.current = window.setInterval(() => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        void detector
          .detect(v)
          .then((codes) => {
            const first = codes[0];
            if (!first?.rawValue) return;
            if (checkCode(first.rawValue)) return;
            // Wrong code: say so once per code, keep scanning.
            const now = Date.now();
            if (
              lastBadRef.current.code !== first.rawValue ||
              now - lastBadRef.current.at > 4000
            ) {
              lastBadRef.current = { code: first.rawValue, at: now };
              setError(
                `"${first.rawValue}" is not a valid KUC code. Point the camera at the KUC registration badge barcode and try again.`,
              );
            }
          })
          .catch(() => {
            // A failed frame is fine; the next tick retries.
          });
      }, 350);
    } catch {
      setStarting(false);
      stopCamera();
      setCamError(
        "The camera could not be opened. Allow camera permission, or type the club code below instead.",
      );
      setMode("type");
    }
  };

  const closeScan = () => {
    stopCamera();
    setError(null);
    setMode("choose");
  };

  const submitManual = (ev: FormEvent) => {
    ev.preventDefault();
    if (!manualCode.trim()) {
      setError("Type the code printed under the barcode on the club badge.");
      return;
    }
    if (!checkCode(manualCode)) {
      setError(
        `"${manualCode.trim()}" is not a valid KUC code. Check the code on the club badge and try again.`,
      );
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8">
      <div
        aria-hidden
        className="crescent absolute top-6 right-6 sm:top-10 sm:right-14 w-14 h-14 sm:w-20 sm:h-20 opacity-90"
      />
      <div className="w-full max-w-md rise">
        <div className="text-center mb-5">
          <img
            src={logoUrl}
            alt="KUC Kalanja club logo — a black-and-white striped shield with a football, five gold stars and a gold crescent moon on a night sky"
            className="mx-auto w-48 sm:w-60 h-auto rounded-[20px] gold-ring"
          />
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide mt-3">
            KUC <span className="gold-text">– KALANJA UNITED CLUB</span>
          </h1>
          <p className="text-[var(--dim)] text-sm tracking-[0.2em] uppercase mt-1">
            United we play, united we grow.
          </p>
        </div>

        <div className="card gold-ring p-4 mb-4">
          <p className="flex items-center gap-2 text-sm">
            <Lock size={16} className="gold-text shrink-0" />
            This site is locked. Scan the club badge barcode or type the club
            code to enter:
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void startScan()}
              className="w-full px-4 py-3.5 rounded-[10px] font-display font-semibold text-lg tracking-wide uppercase flex items-center justify-center gap-2"
              style={{ background: "var(--accent)", color: "#131313" }}
            >
              <ScanBarcode size={20} /> Scan Barcode
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCamError(null);
                setMode("type");
              }}
              className="w-full text-sm text-[var(--dim)] underline underline-offset-2 py-1"
            >
              Camera not working? Type the code instead
            </button>
          </div>
        )}

        {mode === "scan" && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide flex items-center gap-2">
                <Camera size={18} className="gold-text" /> Scan the badge barcode
              </h2>
              <button
                type="button"
                onClick={closeScan}
                aria-label="Stop scanning and go back"
                className="p-2 rounded-full hover:bg-[var(--surface-2)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="relative rounded-[10px] overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                playsInline
                muted
                aria-label="Camera view — point it at the barcode on the KUC registration badge"
                className="w-full h-full object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 rounded-lg pointer-events-none"
                style={{ borderColor: "var(--accent)" }}
              />
              {starting && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-white/90">
                  Opening camera…
                </p>
              )}
            </div>
            <p className="text-sm text-[var(--dim)] mt-2">
              Point the camera at the barcode on the club registration badge.
              The site opens as soon as the code is recognised.
            </p>
            {error && (
              <p className="text-sm mt-2" style={{ color: "var(--danger)" }} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setError(null);
                setMode("type");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline"
            >
              <Keyboard size={15} /> Type the code instead
            </button>
          </div>
        )}

        {mode === "type" && (
          <form onSubmit={submitManual} className="card p-4 space-y-3">
            <h2 className="font-display text-xl font-semibold uppercase tracking-wide flex items-center gap-2">
              <Keyboard size={18} className="gold-text" /> Type the club code
            </h2>
            {camError && (
              <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
                {camError}
              </p>
            )}
            <p className="text-sm text-[var(--dim)]">
              Enter the code printed under the barcode on the KUC registration
              badge.
            </p>
            <div>
              <label htmlFor="kuc-code">Club registration code</label>
              <input
                id="kuc-code"
                aria-label="Club registration code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="KUC-REG-2025-001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-[10px] font-semibold text-sm"
                style={{ background: "var(--accent)", color: "#131313" }}
              >
                Unlock
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCamError(null);
                  setMode("choose");
                }}
                className="px-4 py-2.5 rounded-[10px] font-semibold text-sm border"
                style={{ borderColor: "var(--border)" }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
