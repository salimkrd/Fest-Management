'use client';

import React, { useState, useEffect } from 'react';
import { Participant } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, Download, QrCode } from 'lucide-react';
import { exportDigitalIdAsPng } from '@/utils/canvasExport';
import QRCode from 'qrcode';
import { auth } from '@/lib/firebase/client';
import { ParticipantPhoto, isStockPhotoPlaceholder } from '@/components/domain/ParticipantPhoto';
import { useFest } from '@/context/FestContext';

interface DigitalIdCardProps {
  participant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
  authMode?: 'firebase' | 'participant';
}

export const DigitalIdCard: React.FC<DigitalIdCardProps> = ({
  participant,
  isOpen,
  onClose,
  authMode = 'firebase'
}) => {
  const { theme } = useFest();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [signedToken, setSignedToken] = useState<string>('');
  const [signedPayload, setSignedPayload] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!participant || !isOpen) {
      setQrDataUrl('');
      setSignedToken('');
      setSignedPayload('');
      setFetchError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setFetchError(null);

    const fetchQrBadge = async () => {
      try {
        const idToken = authMode === 'firebase' && auth?.currentUser
          ? await auth.currentUser.getIdToken() : '';
        if (authMode === 'firebase' && !idToken) {
          throw new Error('Authentication required to retrieve participant accreditation badge.');
        }

        const res = await fetch(
          authMode === 'participant' ? '/api/participant/qr' : `/api/participants/${participant.id}/qr`,
          { headers: authMode === 'firebase' ? { Authorization: `Bearer ${idToken}` } : {}, cache: 'no-store' }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to retrieve signed QR accreditation code.');
        }

        const data = await res.json();
        if (!isMounted) return;

        setSignedToken(data.token);
        setSignedPayload(data.payload);

        const url = await QRCode.toDataURL(data.payload, {
          width: 180,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#111111',
            light: '#FFFFFF'
          }
        });

        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[DigitalIdCard] QR generation error:', err);
          setFetchError(err.message || 'Error generating QR badge');
          setLoading(false);
        }
      }
    };

    fetchQrBadge();

    return () => {
      isMounted = false;
    };
  }, [participant, isOpen, authMode]);

  if (!participant) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!participant || !signedToken || !signedPayload || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      let photoBlob: Blob | undefined;
      const photoUrl = participant.photoUrl?.trim();
      if (photoUrl && !isStockPhotoPlaceholder(photoUrl)) {
        const idToken = authMode === 'firebase'
          ? await auth?.currentUser?.getIdToken()
          : undefined;
        if (authMode === 'firebase' && !idToken) {
          throw new Error('Please sign in again to download this participant photo.');
        }
        // The authenticated endpoint reads the authoritative participant photo URL.
        // This avoids CORS/tainted canvases for Firebase Storage and external photos.
        const response = await fetch('/api/participant/photo/' + encodeURIComponent(participant.id), {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: idToken ? { Authorization: 'Bearer ' + idToken } : {}
        });
        if (!response.ok) {
          throw new Error('The participant photo could not be loaded for PNG export. Please check the photo URL and retry.');
        }
        photoBlob = await response.blob();
        if (!photoBlob.type.startsWith('image/')) {
          throw new Error('The participant photo response is not an image.');
        }
      }

      await exportDigitalIdAsPng(participant, theme.festivalName, {
        token: signedToken,
        qrPayload: signedPayload,
        photoBlob
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Unable to export Digital ID Card.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Participant Digital ID"
      description="Printable festival accreditation badge with security verification code"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownload}
              isLoading={exporting}
              disabled={loading || exporting || !qrDataUrl || !!fetchError}
            >
              Download PNG
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint} disabled={loading}>
              Print ID Badge
            </Button>
          </div>
        </div>
      }
    >
      {exportError && (
        <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 rounded-lg p-3 mb-3">
          {exportError}
        </p>
      )}
      <div className="flex justify-center py-2">
        {/* Printable Card */}
        <div className="w-[320px] rounded-2xl border-2 border-[#111111] overflow-hidden shadow-lg bg-white flex flex-col">
          {/* Top Banner */}
          <div className="bg-[#2563EB] text-white p-4 text-center relative">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 block">
              OFFICIAL FESTIVAL PASS
            </span>
            <h4 className="text-base font-bold tracking-tight">{theme.festivalName}</h4>
            <p className="text-[11px] text-blue-100">Annual Cultural &amp; Literary Festival</p>
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white text-[#2563EB] text-[10px] font-bold">
              {participant.categoryName.toUpperCase()}
            </div>
          </div>

          {/* Photo & Bib */}
          <div className="p-5 flex flex-col items-center text-center bg-gradient-to-b from-blue-50/50 to-white">
            <div className="relative">
              <ParticipantPhoto
                photoUrl={participant.photoUrl}
                name={participant.name}
                shape="circle"
                size="lg"
                className="border-4 border-white shadow-md"
              />
              <span className="absolute bottom-0 right-0 bg-[#111111] text-white text-[11px] font-bold px-2 py-0.5 rounded-full border border-white">
                {participant.bib}
              </span>
            </div>

            <h3 className="mt-3 text-base font-bold text-[#111111]">{participant.name}</h3>
            <p className="text-xs text-[#526070]">{participant.classGrade} - Div {participant.division}</p>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#2563EB] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              {participant.teamName} ({participant.teamCode})
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="px-5 py-3 border-t border-b border-[#E1E7EF] bg-[#F8FAFC] grid grid-cols-2 gap-2 text-left text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Participant ID</span>
              <span className="font-semibold text-[#111111] break-all block min-w-0">{participant.id.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Category Tier</span>
              <span className="font-semibold text-[#111111]">{participant.categoryName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Events Registered</span>
              <span className="font-semibold text-[#111111]">{participant.registeredEventIds.length} Contests</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#526070] block">Security Auth</span>
              <span className="font-semibold text-emerald-600">VERIFIED</span>
            </div>
          </div>

          {/* QR Code & Barcode */}
          <div className="p-4 bg-white flex items-center justify-between">
            <div className="text-left">
              <span className="text-[9px] text-[#526070] uppercase font-medium block">Scan at Venue Gate &amp; Green Room</span>
              <span className="text-[10px] font-mono text-[#111111]">
                {fetchError ? 'AUTH ERROR' : signedToken ? `TOKEN: ${signedToken.slice(0, 16).toUpperCase()}` : 'VERIFYING...'}
              </span>
            </div>
            <div className="w-14 h-14 bg-white border border-[#E1E7EF] rounded-lg p-0.5 flex items-center justify-center shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Verification for ${participant.bib}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="w-8 h-8 text-neutral-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
