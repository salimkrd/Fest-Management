'use client';

import React, { useState } from 'react';
import { MarkEntry } from '@/types/fest';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Copy, Check, MessageSquare, ExternalLink, ShieldCheck, Key } from 'lucide-react';
import { buildWhatsAppDispatchUrl } from '@/domain/judgeAuth';

interface WhatsAppDispatchModalProps {
  markEntry: MarkEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  markEntry,
  isOpen,
  onClose
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [dispatchedSuccess, setDispatchedSuccess] = useState(false);

  if (!markEntry) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const directLink = `${origin}/judge/login?code=${markEntry.accessCode || 'JRY-0001'}`;

  const whatsAppUrl = buildWhatsAppDispatchUrl({
    phone: markEntry.judgePhone,
    festName: 'Sahithyolsav 2025',
    competitionName: `${markEntry.competitionName} (${markEntry.categoryName})`,
    judgeName: markEntry.judgeName,
    accessCode: markEntry.accessCode || 'JRY-0001',
    oneTimeSecret: 'Sent confidentially via secure link',
    directUrl: directLink
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppDispatch = () => {
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
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<MessageSquare className="w-4 h-4" />}
            onClick={handleWhatsAppDispatch}
          >
            Open WhatsApp with Prepared Invite
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Security Badge */}
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-[#111111]">Cryptographically Isolated Evaluation Sheet</h4>
            <p className="mt-0.5 text-[#526070]">
              The unique link binds strictly to <strong>{markEntry.competitionName}</strong>. Only the salted password hash is stored server-side. Plaintext passwords are never saved.
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
              className="flex-1 min-h-[44px] px-3.5 py-2 bg-[#F8FAFC] border border-[#E1E7EF] text-xs font-mono rounded-lg text-[#111111] focus:outline-none"
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
          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs font-mono text-emerald-950 whitespace-pre-line">
            {`Assalamu Alaikum / Greetings ${markEntry.judgeName},\n\nYou have been designated as an Official Adjudicator for Sahithyolsav 2025.\nEvent: ${markEntry.competitionName} (${markEntry.categoryName})\nAccess Code: ${markEntry.accessCode || 'JRY-4101'}\n\nDirect Link: ${directLink}`}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
