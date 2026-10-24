'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface GreenRoomScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isProcessing?: boolean;
}

export const GreenRoomScanner: React.FC<GreenRoomScannerProps> = ({
  onScanSuccess,
  isProcessing = false
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const scannerRef = useRef<any>(null);
  const readerElementId = 'green-room-qr-reader';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScannedTimeRef = useRef<number>(0);

  const startScanner = async (desiredFacingMode = facingMode) => {
    setErrorMessage('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(readerElementId);
      }

      const html5QrCode = scannerRef.current;

      if (html5QrCode.isScanning) {
        await html5QrCode.stop();
      }

      await html5QrCode.start(
        { facingMode: desiredFacingMode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText: string) => {
          const now = Date.now();
          // Debounce 2 seconds between scans of identical data
          if (now - lastScannedTimeRef.current > 2000) {
            lastScannedTimeRef.current = now;
            setSuccessNotice('QR Code Captured. Verifying credentials...');
            setTimeout(() => setSuccessNotice(''), 2000);
            onScanSuccess(decodedText);
          }
        },
        () => {
          // Frame parse error (ignored during continuous scanning)
        }
      );

      setCameraActive(true);
      setHasCameraPermission(true);
    } catch (err: any) {
      console.warn('[GreenRoomScanner] Camera start error:', err);
      setCameraActive(false);
      setHasCameraPermission(false);
      const msg = err?.message || err?.toString() || '';
      if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
        setErrorMessage('Camera access denied. Please enable camera permissions in your browser settings.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setErrorMessage('No camera device detected on this system. You can upload a QR image or use manual search.');
      } else {
        setErrorMessage('Could not open camera stream. Try toggling camera or uploading a photo.');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.warn('[GreenRoomScanner] Error stopping scanner:', e);
      }
    }
    setCameraActive(false);
  };

  const toggleFacingMode = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (cameraActive) {
      await stopScanner();
      await startScanner(newMode);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const tempScanner = scannerRef.current || new Html5Qrcode(readerElementId);
      scannerRef.current = tempScanner;

      if (tempScanner.isScanning) {
        await tempScanner.stop();
        setCameraActive(false);
      }

      const decodedText = await tempScanner.scanFile(file, true);
      if (decodedText) {
        setSuccessNotice('QR Code Captured. Verifying credentials...');
        setTimeout(() => setSuccessNotice(''), 2000);
        onScanSuccess(decodedText);
      }
    } catch (err: any) {
      console.warn('[GreenRoomScanner] File scan error:', err);
      setErrorMessage('Could not find a valid QR code in this image. Please ensure the QR is clear and well-lit.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current = null;
        });
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-[#E1E7EF] p-5 shadow-xs flex flex-col items-center">
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#E1E7EF] mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111111]">Green Room Camera Scanner</h3>
            <p className="text-[11px] text-[#526070]">Scan Participant Digital ID Card or Accreditation Badge</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFacingMode}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Flip Camera (Front/Back)"
            >
              Flip
            </Button>
          )}

          <Button
            variant={cameraActive ? 'destructive' : 'primary'}
            size="sm"
            onClick={cameraActive ? stopScanner : () => startScanner()}
            disabled={isProcessing}
            leftIcon={<Camera className="w-3.5 h-3.5" />}
          >
            {cameraActive ? 'Stop Camera' : 'Start Camera'}
          </Button>
        </div>
      </div>

      {/* Viewfinder Area */}
      <div className="w-full max-w-[340px] aspect-square relative rounded-xl overflow-hidden bg-neutral-900 border-2 border-dashed border-[#CBD5E1] flex items-center justify-center shadow-inner">
        <div id={readerElementId} className="w-full h-full object-cover" />

        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-900/90 text-white z-10">
            <Camera className="w-12 h-12 text-neutral-400 mb-3 animate-pulse" />
            <h4 className="text-sm font-bold">Camera is Inactive</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-[240px]">
              Click &quot;Start Camera&quot; to scan badges or upload a QR image badge below.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4 bg-[#2563EB] hover:bg-blue-700"
              onClick={() => startScanner()}
            >
              Enable Scanner
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20 text-white animate-fade-in">
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs font-bold tracking-wide">Verifying Eligibility...</span>
          </div>
        )}

        {successNotice && (
          <div className="absolute top-3 left-3 right-3 bg-emerald-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md flex items-center gap-2 justify-center z-20 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            {successNotice}
          </div>
        )}
      </div>

      {errorMessage && (
        <div role="alert" className="w-full mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* File Upload Alternative */}
      <div className="w-full mt-4 pt-3 border-t border-[#E1E7EF] flex items-center justify-between">
        <span className="text-[11px] text-[#526070]">No camera? Upload QR snapshot:</span>
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isProcessing}
          />
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Upload Image
          </span>
        </label>
      </div>
    </div>
  );
};
