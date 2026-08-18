import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Html5Qrcode } from 'html5-qrcode';
import { User } from '../../types';
import {
  Camera,
  Upload,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  User as UserIcon,
  Car,
  Phone,
  Mail,
  Sparkles,
  CameraOff,
  SwitchCamera,
  Check,
  Search,
} from 'lucide-react';

interface ModalQrScannerProps {
  users: User[];
  onUserIdentified: (user: User) => void;
}

export const ModalQrScanner: React.FC<ModalQrScannerProps> = ({
  users,
  onUserIdentified,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  
  // Camera state
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // Manual text / barcode input
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState('');
  
  // Scan status feedback
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Play audio beep
  const playBeep = useCallback((success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 880 : 400, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio context might be restricted
    }
  }, []);

  // Match scanned text against user database
  const handleProcessDecodedText = useCallback(
    (rawText: string) => {
      if (!rawText || !rawText.trim()) return;
      const cleanText = rawText.trim();

      let extractedName = '';
      let extractedPhone = '';
      let extractedVehicle = '';
      let extractedEmail = '';
      let extractedEmpId = '';

      // 1. Try parsing JSON
      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanText);
          extractedName = parsed.name || parsed.userName || parsed.fullName || '';
          extractedPhone = parsed.phone || parsed.mobile || '';
          extractedVehicle = parsed.vehicleNumber || parsed.vehicle || parsed.plate || '';
          extractedEmail = parsed.email || '';
          extractedEmpId = parsed.employeeId || parsed.passId || '';
        } catch {
          // fallback
        }
      }

      // 2. Multiline key-value parsing
      if (!extractedName || !extractedVehicle) {
        const lines = cleanText.split('\n');
        for (const line of lines) {
          const t = line.trim();
          const lower = t.toLowerCase();
          if (lower.startsWith('name:')) {
            extractedName = t.replace(/name:/i, '').trim();
          } else if (lower.startsWith('phone:') || lower.startsWith('mobile:')) {
            extractedPhone = t.replace(/(phone|mobile):/i, '').trim();
          } else if (lower.startsWith('vehicle number:') || lower.startsWith('vehicle:') || lower.startsWith('plate:')) {
            extractedVehicle = t.replace(/(vehicle( number)?|plate):/i, '').trim();
          } else if (lower.startsWith('email:')) {
            extractedEmail = t.replace(/email:/i, '').trim();
          } else if (lower.startsWith('pass id:') || lower.startsWith('employee id:')) {
            extractedEmpId = t.replace(/(pass|employee)( id)?:/i, '').trim();
          }
        }
      }

      // 3. Indian License Plate regex fallback
      if (!extractedVehicle) {
        const plateMatch = cleanText.match(/[A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,3}\s?[0-9]{1,4}/i);
        if (plateMatch) {
          extractedVehicle = plateMatch[0].toUpperCase();
        }
      }

      // 4. Find matching user in database
      const matched = users.find((u) => {
        const dbFullName = `${u.firstName} ${u.lastName}`.trim().toLowerCase();
        const searchName = extractedName.toLowerCase();
        const dbVehicle = (u.defaultVehicleNumber || '').replace(/[\s-]+/g, '').toUpperCase();
        const searchVehicle = extractedVehicle.replace(/[\s-]+/g, '').toUpperCase();
        const dbPhone = (u.phone || '').replace(/\D/g, '');
        const searchPhone = extractedPhone.replace(/\D/g, '');
        const dbEmail = (u.email || '').toLowerCase();
        const dbEmpId = (u.employeeId || '').toLowerCase();
        const lowerRaw = cleanText.toLowerCase();

        return (
          (extractedEmail && dbEmail === extractedEmail.toLowerCase()) ||
          (dbEmail && lowerRaw.includes(dbEmail)) ||
          (extractedEmpId && (dbEmpId === extractedEmpId.toLowerCase() || lowerRaw.includes(dbEmpId))) ||
          (searchVehicle && dbVehicle && (dbVehicle === searchVehicle || dbVehicle.includes(searchVehicle))) ||
          (searchPhone && searchPhone.length >= 7 && dbPhone.includes(searchPhone)) ||
          (searchName && (dbFullName === searchName || dbFullName.includes(searchName) || searchName.includes(dbFullName)))
        );
      });

      if (matched) {
        playBeep(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch {}
        }
        setScanNotice(`✓ Successfully Identified: ${matched.firstName} ${matched.lastName}!`);
        onUserIdentified(matched);
      } else {
        playBeep(false);
        setManualError(
          `QR Code scanned, but no matching registered user was found for: "${extractedName || extractedVehicle || cleanText.slice(0, 30)}"`
        );
      }
    },
    [users, playBeep, onUserIdentified]
  );

  // Stop camera scanner
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping modal camera:', e);
      }
      html5QrCodeRef.current = null;
    }
    if (isMountedRef.current) {
      setIsCameraScanning(false);
      setCameraLoading(false);
    }
  }, []);

  // Start camera scanner
  const startCamera = useCallback(async () => {
    await stopCamera();
    setCameraError(null);
    setCameraLoading(true);

    try {
      // Allow DOM element to mount
      await new Promise((resolve) => setTimeout(resolve, 150));
      const element = document.getElementById('modal-html5-qr-reader');
      if (!element || !isMountedRef.current) {
        setCameraLoading(false);
        return;
      }

      const qrInstance = new Html5Qrcode('modal-html5-qr-reader', { verbose: false });
      html5QrCodeRef.current = qrInstance;

      await qrInstance.start(
        { facingMode },
        {
          fps: 15,
          qrbox: (w, h) => {
            const minEdge = Math.min(w, h);
            const size = Math.max(160, Math.floor(minEdge * 0.75));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          stopCamera();
          handleProcessDecodedText(decodedText);
        },
        () => {
          // Frame scanner ignore
        }
      );

      if (isMountedRef.current) {
        setIsCameraScanning(true);
        setCameraLoading(false);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setCameraLoading(false);
      setIsCameraScanning(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission was blocked. Please enable camera access or use Image Upload.');
      } else {
        setCameraError('Camera unavailable in current environment. Use Image Upload or 1-Click Passes below.');
      }
    }
  }, [facingMode, handleProcessDecodedText, stopCamera]);

  useEffect(() => {
    isMountedRef.current = true;
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [activeTab, facingMode, startCamera, stopCamera]);

  // Decode Image File (jsQR + multi-pass binarization)
  const handleImageUpload = (file: File) => {
    setManualError('');
    setScanNotice('Scanning uploaded QR image...');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scan = (scale: number, binarize = false): string | null => {
          const c = document.createElement('canvas');
          const w = Math.floor(img.width * scale);
          const h = Math.floor(img.height * scale);
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) return null;
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);

          if (binarize) {
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              const v = lum > 128 ? 255 : 0;
              data[i] = v;
              data[i + 1] = v;
              data[i + 2] = v;
            }
          }

          const res = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
          return res ? res.data : null;
        };

        let decoded = scan(1.0);
        if (!decoded && (img.width > 1000 || img.height > 1000)) {
          decoded = scan(800 / Math.max(img.width, img.height));
        }
        if (!decoded) {
          decoded = scan(1.0, true);
        }
        if (!decoded) {
          decoded = scan(0.5);
        }

        if (decoded) {
          handleProcessDecodedText(decoded);
        } else {
          setManualError('No readable QR code found in this image. Try uploading a clearer photo or pick a test pass.');
          setScanNotice(null);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* Sub tabs: Live Camera | Upload Image | Manual / Sample Passes */}
      <div className="grid grid-cols-3 gap-1 bg-gray-200/90 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`py-1.5 px-2 text-xs font-extrabold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'camera'
              ? 'bg-[#1d4e89] text-white shadow-xs'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/50'
          }`}
        >
          <Camera className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Live Camera</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`py-1.5 px-2 text-xs font-extrabold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-[#1d4e89] text-white shadow-xs'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/50'
          }`}
        >
          <Upload className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Upload Image</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`py-1.5 px-2 text-xs font-extrabold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-[#1d4e89] text-white shadow-xs'
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-300/50'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Pass / Text ID</span>
        </button>
      </div>

      {/* Notice Banner */}
      {scanNotice && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{scanNotice}</span>
        </div>
      )}

      {/* Error Banner */}
      {manualError && (
        <div className="p-2.5 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2 text-xs text-red-800 font-medium animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>{manualError}</div>
        </div>
      )}

      {/* 1. LIVE CAMERA SCANNER */}
      {activeTab === 'camera' && (
        <div className="space-y-2.5">
          <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video max-h-56 flex items-center justify-center border-2 border-[#1d4e89]">
            {/* Viewport container */}
            <div id="modal-html5-qr-reader" className="w-full h-full object-cover" />

            {/* Viewfinder Target Graphic */}
            {isCameraScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] animate-pulse">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400" />
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-md animate-bounce" />
                </div>
              </div>
            )}

            {/* Loading Spinner */}
            {cameraLoading && (
              <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center gap-2 text-white">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-xs font-bold">Starting camera lens...</span>
              </div>
            )}

            {/* Camera Error Fallback */}
            {cameraError && !cameraLoading && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center text-white space-y-2">
                <CameraOff className="w-8 h-8 text-amber-400" />
                <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1 bg-[#1d4e89] hover:bg-[#153b68] text-white text-xs font-bold rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" /> Use Image
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-500 font-semibold flex items-center gap-1 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Point camera at passholder QR code
            </span>

            <button
              type="button"
              onClick={() => {
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
              }}
              className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-md flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span>Flip ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. IMAGE UPLOAD SCANNER */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <label className="border-2 border-dashed border-blue-300 hover:border-[#1d4e89] bg-blue-50/50 hover:bg-blue-50/80 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
            <Upload className="w-8 h-8 text-[#1d4e89]" />
            <div className="text-center">
              <span className="text-xs font-extrabold text-[#1d4e89] block">
                Choose QR Code Screenshot / Photo
              </span>
              <span className="text-[11px] text-gray-500">
                Supports PNG, JPG, JPEG from mobile or gallery
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </label>
        </div>
      )}

      {/* 3. MANUAL PASS / TEXT ID & 1-CLICK PASSES */}
      {activeTab === 'manual' && (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="e.g. HDFC-PASS-89241, MH 02 CP 4821, or user email"
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono font-medium text-gray-900 focus:outline-none focus:border-[#1d4e89]"
            />
            <button
              type="button"
              onClick={() => {
                if (!manualText.trim()) return;
                handleProcessDecodedText(manualText);
              }}
              className="px-3 py-2 bg-[#1d4e89] hover:bg-[#153b68] text-white font-bold text-xs rounded-lg shadow-2xs cursor-pointer flex-shrink-0"
            >
              Identify
            </button>
          </div>
        </div>
      )}

      {/* QUICK 1-CLICK TEST PASSES (from registered database) */}
      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Quick Employee QR Passes (1-Tap Simulation):
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white rounded-lg border border-gray-200">
          {users
            .filter((u) => u.role !== 'Admin')
            .slice(0, 8)
            .map((u) => {
              const passString = `HDFC BANK\nName: ${u.firstName} ${u.lastName}\nPhone: ${
                u.phone || '+91 98765 43210'
              }\nVehicle Number: ${u.defaultVehicleNumber || 'MH 02 CP 4821'}\nAllocated Category: ${
                u.allocatedLot ? `${u.allocatedCategory || 'Basement on GL'} (${u.allocationType || 'Permanent'})` : 'Not Allocated Yet'
              }\nPass ID: HDFC-PASS-${u.employeeId || u.id.slice(0, 6)}`;

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleProcessDecodedText(passString)}
                  className="px-2 py-1 bg-gray-50 hover:bg-blue-50 text-gray-800 hover:text-[#1d4e89] border border-gray-200 hover:border-blue-300 rounded-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                  title={`Simulate scanning pass for ${u.firstName} ${u.lastName}`}
                >
                  <UserIcon className="w-3 h-3 text-gray-400" />
                  <span>
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="text-[9px] font-mono text-red-600">
                    ({u.defaultVehicleNumber || 'No Plate'})
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};
