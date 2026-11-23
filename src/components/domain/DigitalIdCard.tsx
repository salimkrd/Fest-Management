'use client';

import React, { useState, useEffect } from 'react';
import { Participant } from '@/types/fest';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, Download } from 'lucide-react';
import { exportDigitalIdAsPng } from '@/utils/canvasExport';
import QRCode from 'qrcode';
import { auth } from '@/lib/firebase/client';
import { isStockPhotoPlaceholder } from '@/components/domain/ParticipantPhoto';
import { useSafeFest, defaultTheme } from '@/context/FestContext';
import { IdCardBadge } from '@/components/domain/IdCardBadge';

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
  const fest = useSafeFest();
  const theme = fest?.theme || defaultTheme;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [registeredCompetitionsCount, setRegisteredCompetitionsCount] = useState<number | null>(null);
  const [signedToken, setSignedToken] = useState<string>('');
  const [signedPayload, setSignedPayload] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const participantId = participant?.id;

  // Manage print isolation lifecycle when print is requested
  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('id-card-print-active');
      return;
    }

    const handleBeforePrint = () => {
      document.body.classList.add('id-card-print-active');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('id-card-print-active');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('id-card-print-active');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!participantId || !isOpen) {
      setQrDataUrl('');
      setRegisteredCompetitionsCount(null);
      setSignedToken('');
      setSignedPayload('');
      setFetchError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setRegisteredCompetitionsCount(null);
    setFetchError(null);

    const fetchQrBadge = async () => {
      try {
        const idToken = authMode === 'firebase' && auth?.currentUser
          ? await auth.currentUser.getIdToken() : '';
        if (authMode === 'firebase' && !idToken) {
          throw new Error('Authentication required to retrieve participant accreditation badge.');
        }

        const res = await fetch(
          authMode === 'participant' ? '/api/participant/qr' : `/api/participants/${participantId}/qr`,
          { headers: authMode === 'firebase' ? { Authorization: `Bearer ${idToken}` } : {}, cache: 'no-store' }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to retrieve signed QR accreditation code.');
        }

        const data = await res.json() as {
          token?: string;
          payload?: string;
          registeredCompetitionsCount?: number;
        };
        if (!isMounted) return;
        if (!Number.isInteger(data.registeredCompetitionsCount) || (data.registeredCompetitionsCount ?? -1) < 0) {
          throw new Error('Could not verify this participant’s registered competition count. Please reopen the ID card.');
        }

        setRegisteredCompetitionsCount(data.registeredCompetitionsCount!);
        setSignedToken(data.token || '');
        setSignedPayload(data.payload);

        const url = await QRCode.toDataURL(data.payload, {
          width: 800,
          margin: 4,
          errorCorrectionLevel: 'Q',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error('[DigitalIdCard] QR generation error:', err);
          setFetchError(err instanceof Error ? err.message : 'Error generating QR badge');
          setLoading(false);
        }
      }
    };

    fetchQrBadge();

    return () => {
      isMounted = false;
      setQrDataUrl('');
      setRegisteredCompetitionsCount(null);
      setSignedToken('');
      setSignedPayload('');
      setFetchError(null);
    };
  }, [participantId, isOpen, authMode]);

  if (!participant) return null;

  const handlePrint = () => {
    document.body.classList.add('id-card-print-active');
    window.print();
  };

  const handleDownload = async () => {
    if (!participant || !signedToken || !signedPayload || registeredCompetitionsCount === null || exporting) return;
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
        photoBlob,
        festivalNameFont: theme.festivalNameFont,
        institutionName: theme.institutionName,
        registeredCompetitionsCount
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
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" size="md" className="w-full sm:w-auto" onClick={onClose}>
            Close
          </Button>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              className="w-full sm:w-auto"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleDownload}
              isLoading={exporting}
              disabled={loading || exporting || !qrDataUrl || registeredCompetitionsCount === null || !!fetchError}
            >
              Download PNG
            </Button>
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
              disabled={loading || registeredCompetitionsCount === null || !!fetchError}
            >
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

      {fetchError && (
        <p role="alert" className="text-xs font-semibold text-red-700 bg-red-50 rounded-lg p-3 mb-3">
          {fetchError}
        </p>
      )}

      <div className="flex justify-center py-2">
        {/* Printable / downloadable ID card — shared by Admin, Team Manager and Participant portals */}
        <div
          id="printable-id-card"
          className="id-card-printable-container w-full max-w-[340px] rounded-2xl overflow-hidden shadow-xl border border-neutral-200 bg-white"
        >
          <IdCardBadge
            participant={participant}
            festivalName={theme.festivalName}
            institutionName={theme.institutionName}
            festivalNameFont={theme.festivalNameFont}
            registeredCompetitionsCount={registeredCompetitionsCount}
            qrDataUrl={qrDataUrl}
            loadingQr={loading}
            fetchError={fetchError}
          />
        </div>
      </div>
    </Modal>
  );
};
