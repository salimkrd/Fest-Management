'use client';

import React, { useState } from 'react';
import { MarkEntry } from '@/types/fest';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Copy, Check, MessageSquare, ExternalLink, ShieldCheck, Key } from 'lucide-react';
import { buildWhatsAppDispatchUrl } from '@/domain/judgeAuth';
import { useFest } from '@/context/FestContext';

interface WhatsAppDispatchModalProps {
  markEntry: MarkEntry | null;
  isOpen: boolean;
  onClose: () => void;
  oneTimeSecret?: string;
  directUrl?: string;
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  markEntry,
  isOpen,
  onClose,
  oneTimeSecret,
  directUrl: issuedDirectUrl
}) => {
  const { theme } = useFest();
  const [copiedLink, setCopiedLink] = useState(false);
  const [dispatchedSuccess, setDispatchedSuccess] = useState(false);

  if (!markEntry) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const directLink = issuedDirectUrl ||
    `${origin}/judge/login?code=${encodeURIComponent(markEntry.accessCode || 'JRY-0001')}`;

  const whatsAppUrl = buildWhatsAppDispatchUrl({
    phone: markEntry.judgePhone,
    festName: theme.festivalName,
    competitionName: `${markEntry.competitionName} (${markEntry.categoryName})`,
    judgeName: markEntry.judgeName,
    accessCode: markEntry.accessCode || 'JRY-0001',
    oneTimeSecret: oneTimeSecret || '',
    directUrl: directLink
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppDispatch = () => {
    if (!oneTimeSecret || !issuedDirectUrl) return;
    window.open(whatsAppUrl, '_blank');
    setDispatchedSuccess(true);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Judge Assignment & WhatsApp Dispatch"
      description="Issue secure credentials and dispatch evaluation sheet directly to juror's phone"
      width="lg"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!oneTimeSecret || !issuedDirectUrl}
            leftIcon={<MessageSquare className="w-4 h-4" />}
            onClick={handleWhatsAppDispatch}
          >
            Open WhatsApp with Prepared Invite
          </Button>
        </div>
      }
    >
      <div className="space-y-5 sm:space-y-6">
        {/* Security Badge */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3.5 sm:p-4">
          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-[#111111]">Cryptographically Isolated Evaluation Sheet</h4>
            <p className="mt-0.5 text-[#526070]">
              The unique link binds strictly to <strong>{markEntry.competitionName}</strong>. The secret is shown only for this dispatch; only its hash is stored server-side.
            </p>
          </div>
        </div>

        {dispatchedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            WhatsApp web launched with pre-formatted invitation message!
          </div>
        )}

        {/* Competition Context */}
        <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E1E7EF] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#526070] font-medium">Competition</span>
            <span className="font-bold text-[#111111]">{markEntry.competitionName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#526070] font-medium">Event Code</span>
            <span className="font-mono font-semibold text-[#111111]">{markEntry.competitionCode}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#526070] font-medium">Category / Type</span>
            <span className="font-semibold text-[#111111]">{markEntry.categoryName} · {markEntry.type}</span>
          </div>
        </div>

        {/* Assigned Judge Profile */}
        <div>
          <Input
            label="Assigned Judge Profile"
            value={markEntry.judgeName}
            readOnly
            className="bg-[#F8FAFC]"
          />
        </div>
        {oneTimeSecret ? (
          <div>
            <Input
              label="Confidential Session Secret"
              value={oneTimeSecret}
              readOnly
              className="bg-[#F8FAFC] font-mono font-bold"
            />
          </div>
        ) : (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            The session secret is only available immediately after assignment creation. Generate a new assignment to issue a fresh secure link.
          </p>
        )}

        {/* Phone */}
        <div>
          <Input
            label="Judge Phone (WhatsApp Enabled)"
            value={markEntry.judgePhone}
            readOnly
            className="bg-[#F8FAFC]"
          />
        </div>

        {/* Unique Access Code */}
        <div>
          <Input
            label="Official Juror Access Code"
            value={markEntry.accessCode || 'JRY-4101'}
            readOnly
            leftIcon={<Key className="w-4 h-4 text-[#2563EB]" />}
            className="bg-[#F8FAFC] font-mono font-bold text-[#2563EB]"
          />
        </div>

        {/* Secure Link */}
        <div>
          <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1.5">
            Direct Juror Login URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={directLink}
              className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] px-3 py-2 text-xs font-mono text-[#111111] focus:outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              leftIcon={copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            >
              {copiedLink ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* WhatsApp Preview message */}
        <div>
          <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1.5">
            Prepared WhatsApp Dispatch Preview
          </label>
          <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-mono leading-5 text-emerald-950 whitespace-pre-line">
            {`Assalamu Alaikum / Greetings ${markEntry.judgeName},\n\nYou have been designated as an Official Adjudicator for \${theme.festivalName}.\nEvent: ${markEntry.competitionName} (${markEntry.categoryName})\nAccess Code: ${markEntry.accessCode || 'JRY-4101'}\n\nDirect Link: ${directLink}`}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
