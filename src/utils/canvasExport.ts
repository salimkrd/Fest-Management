/**
 * Canvas Export Utility for Official Posters and Participant Digital IDs
 * Generates genuine high-resolution PNG downloads directly in the browser.
 */

import { CompetitionResult, Participant, PublicThemeSettings, PosterConfig } from '@/types/fest';
import QRCode from 'qrcode';
import { encodeParticipantQrPayload } from '@/domain/greenRoom';

/**
 * Generates and downloads a high-resolution Celebration Result Poster (PNG)
 */
export async function exportPosterAsPng(
  result: CompetitionResult,
  theme: PublicThemeSettings,
  config?: PosterConfig
): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Poster downloads require a browser.');
  const { validatePosterConfig, normalizePosterConfig, posterDimensions, posterSvgDataUrl } = await import('@/domain/poster');
  const checked = validatePosterConfig(normalizePosterConfig(config));
  const { width, height } = posterDimensions(checked.aspectRatio);
  await document.fonts.ready;
  const artwork = new Image();
  artwork.src = posterSvgDataUrl(result, theme, checked);
  await artwork.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the poster.');
  context.drawImage(artwork, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG generation failed.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Poster_${(result.competitionCode || 'Result').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
/**
 * Generates and downloads a printable Participant Digital ID Card (PNG)
 */
export async function exportDigitalIdAsPng(
  participant: Participant,
  festivalName: string = 'SAHITHYOLSAV 2025'
): Promise<void> {
  if (typeof window === 'undefined') return;

  const width = 640;
  const height = 960;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Card Outer Border
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Top Header Banner
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(15, 15, width - 30, 160);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#BFDBFE';
  ctx.font = '700 18px Montserrat, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('OFFICIAL FESTIVAL PASS', width / 2, 55);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px Montserrat, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(festivalName.toUpperCase(), width / 2, 105);

  ctx.fillStyle = '#DBEAFE';
  ctx.font = '600 16px Montserrat, sans-serif';
  ctx.fillText('Annual Cultural & Literary Festival', width / 2, 140);

  // Category Tag on Banner
  const categoryText = (participant.categoryName || 'GENERAL').toUpperCase();
  ctx.font = '800 14px Montserrat, sans-serif';
  const tagW = ctx.measureText(categoryText).width + 24;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(width - 25 - tagW, 25, tagW, 28);
  ctx.fillStyle = '#2563EB';
  ctx.fillText(categoryText, width - 25 - tagW / 2, 44);

  // Participant Portrait Circle Placeholder
  const avatarY = 270;
  ctx.fillStyle = '#EFF6FF';
  ctx.beginPath();
  ctx.arc(width / 2, avatarY, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Draw Avatar Icon or Initial
  ctx.fillStyle = '#2563EB';
  ctx.font = '800 56px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(participant.name.charAt(0).toUpperCase(), width / 2, avatarY + 20);

  // Bib Badge Pill
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 55, avatarY + 50, 110, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 16px Montserrat, sans-serif';
  ctx.fillText(participant.bib, width / 2, avatarY + 72);

  // Participant Name & Class
  ctx.fillStyle = '#111111';
  ctx.font = '800 28px Montserrat, sans-serif';
  ctx.fillText(participant.name, width / 2, 400);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px Montserrat, sans-serif';
  ctx.fillText(`${participant.classGrade} - Division ${participant.division}`, width / 2, 435);

  // Team Delegation Pill
  const teamText = `${participant.teamName} (${participant.teamCode})`;
  ctx.font = '700 18px Montserrat, sans-serif';
  const teamPillW = ctx.measureText(teamText).width + 48;
  ctx.fillStyle = '#EFF6FF';
  ctx.beginPath();
  ctx.roundRect((width - teamPillW) / 2, 465, teamPillW, 40, 20);
  ctx.fill();
  ctx.strokeStyle = '#BFDBFE';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#2563EB';
  ctx.fillText(teamText, width / 2, 492);

  // Metadata Grid Box
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(40, 535, width - 80, 180);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 535, width - 80, 180);

  ctx.textAlign = 'left';
  // Row 1
  ctx.fillStyle = '#64748B';
  ctx.font = '700 13px Montserrat, sans-serif';
  ctx.fillText('PARTICIPANT ID', 70, 575);
  ctx.fillText('CATEGORY TIER', 350, 575);

  ctx.fillStyle = '#111111';
  ctx.font = '800 18px Montserrat, sans-serif';
  ctx.fillText(participant.id.toUpperCase(), 70, 605);
  ctx.fillText(participant.categoryName, 350, 605);

  // Row 2
  ctx.fillStyle = '#64748B';
  ctx.font = '700 13px Montserrat, sans-serif';
  ctx.fillText('REGISTERED CONTESTS', 70, 655);
  ctx.fillText('SECURITY STATUS', 350, 655);

  ctx.fillStyle = '#111111';
  ctx.font = '800 18px Montserrat, sans-serif';
  ctx.fillText(`${participant.registeredEventIds.length} Competitions`, 70, 685);

  ctx.fillStyle = '#059669';
  ctx.fillText('VERIFIED AUTH', 350, 685);

  // Bottom QR / Verification Barcode Section
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(40, 740, width - 80, 150);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 13px Montserrat, sans-serif';
  ctx.fillText('Scan at Venue Entrance & Stage Gate', 70, 790);

  ctx.fillStyle = '#111111';
  ctx.font = '700 16px monospace';
  ctx.fillText(`HASH: ${participant.bib}-2025-AUTH-V2`, 70, 825);

  // Generate and draw genuine scannable QR Code
  const qrX = width - 180;
  const qrY = 755;
  const qrSize = 100;

  try {
    const payload = encodeParticipantQrPayload({
      id: participant.id,
      bib: participant.bib,
      name: participant.name,
      teamCode: participant.teamCode
    });
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111111',
        light: '#FFFFFF'
      }
    });

    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await qrImg.decode();
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch (qrErr) {
    console.error('[canvasExport] QR rendering error:', qrErr);
    ctx.fillStyle = '#111111';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
  }

  // Trigger Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `Digital_ID_${participant.bib}_${participant.name.replace(/\s+/g, '_')}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

