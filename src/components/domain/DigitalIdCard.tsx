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
          width: 420,
          margin: 2,
          errorCorrectionLevel: 'H',
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

      let logoBlob: Blob | undefined;
      if (theme.logoUrl?.trim()) {
        // Configured logo is publicly readable; fetch same-origin for untainted PNG.
        const logoResponse = await fetch('/api/festival/logo', { cache: 'no-store' });
        if (logoResponse.ok) logoBlob = await logoResponse.blob();
      }
      await exportDigitalIdAsPng(participant, theme.festivalName, {
        token: signedToken,
        qrPayload: signedPayload,
        photoBlob,
        logoBlob,
        festivalNameFont: theme.festivalNameFont
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
        {/* Printable / downloadable ID card — shared by Admin, Team Manager and Participant portals. */}
        <div className="w-full max-w-[410px] rounded-[26px] border-[3px] border-[#60A5FA] overflow-hidden shadow-[0_12px_32px_rgba(37,99,235,0.20)] bg-white flex flex-col">
          <div className="bg-gradient-to-br from-[#0758D8] via-[#1675F7] to-[#38A5FF] text-white px-5 pt-5 pb-6 text-center relative overflow-hidden">
            <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full border-[18px] border-white/10" />
            <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full border-[20px] border-white/10" />
            <div className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-white text-[#0758D8] text-[11px] font-extrabold uppercase">
              {participant.categoryName}
            </div>
            <span className="relative text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-blue-100 block mb-3">Official Festival Pass</span>
            <h4 className="relative text-xl sm:text-2xl font-extrabold tracking-tight leading-tight break-words">
              <span className="festival-name">{theme.festivalName}</span>
            </h4>
            <p className="relative text-xs sm:text-sm text-blue-100 mt-1">Annual Cultural &amp; Literary Festival</p>
            <div className="relative flex justify-center mt-5">
              <div className="w-[108px] h-[108px] rounded-full p-1.5 bg-white ring-4 ring-blue-200 shadow-lg">
                <ParticipantPhoto photoUrl={participant.photoUrl} name={participant.name} shape="circle" size="lg" className="!w-full !h-full border-2 border-[#2563EB]" />
              </div>
              <span className="absolute -bottom-3 bg-black text-white text-sm font-extrabold px-6 py-1 rounded-full border-2 border-white shadow-md">{participant.bib}</span>
            </div>
          </div>

          <div className="px-5 pt-6 pb-4 text-center bg-gradient-to-b from-white to-blue-50/70">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] break-words">{participant.name}</h3>
            <p className="text-sm font-semibold text-[#64748B] mt-1">{participant.classGrade} · Division {participant.division}</p>
            <div className="mt-3 inline-flex max-w-full items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 text-[#0758D8] text-sm font-bold">
              <span className="w-2 h-2 shrink-0 rounded-full bg-blue-600" />
              <span className="break-words">{participant.teamName} ({participant.teamCode})</span>
            </div>
          </div>

          <div className="mx-4 mb-4 p-4 rounded-2xl border border-blue-100 bg-[#F8FBFF] grid grid-cols-2 gap-x-4 gap-y-4 text-left">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wide text-[#64748B] block">Participant ID</span>
              <span className="mt-1 font-bold text-xs text-[#111827] break-all block">{participant.id.toUpperCase()}</span>
            </div>
            <div className="min-w-0 border-l border-blue-100 pl-3">
              <span className="text-[10px] uppercase font-bold tracking-wide text-[#64748B] block">Category Tier</span>
              <span className="mt-1 font-extrabold text-sm text-[#111827] block break-words">{participant.categoryName}</span>
            </div>
            <div className="min-w-0 border-t border-blue-100 pt-3">
              <span className="text-[10px] uppercase font-bold tracking-wide text-[#64748B] block">Registered Contests</span>
              <span className="mt-1 font-extrabold text-sm text-[#111827] block">{participant.registeredEventIds.length} Competitions</span>
            </div>
            <div className="min-w-0 border-t border-blue-100 pt-3 border-l pl-3">
              <span className="text-[10px] uppercase font-bold tracking-wide text-[#64748B] block">Security Status</span>
              <span className="mt-1 font-extrabold text-sm text-emerald-700 block">✓ Verified Auth</span>
            </div>
          </div>

          <div className="mx-4 mb-4 rounded-2xl border-2 border-blue-100 bg-gradient-to-b from-white to-blue-50 px-4 pt-4 pb-3 flex flex-col items-center text-center">
            <div className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[#0758D8]">Scan at Venue Entrance &amp; Stage Gate</div>
            <div className="mt-3 w-[164px] h-[164px] p-2 bg-white rounded-2xl shadow-sm border border-blue-50 flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Verification for ${participant.bib}`} className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-14 h-14 text-neutral-400 animate-pulse" />
              )}
            </div>
            <div className="mt-3 w-full rounded-full bg-blue-50 border border-blue-100 px-3 py-2 text-[10px] sm:text-xs font-mono text-[#111827] break-all">
              <span className="font-extrabold text-[#0758D8]">TOKEN:</span> {fetchError ? 'AUTH ERROR' : signedToken ? signedToken.slice(0, 16).toUpperCase() : 'VERIFYING...'}
            </div>
            {fetchError && <p role="alert" className="mt-2 text-xs text-red-700">{fetchError}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
};
