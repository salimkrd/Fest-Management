/**
 * Canvas Export Utility for Official Posters and Participant Digital IDs
 * Generates genuine high-resolution PNG downloads directly in the browser.
 */

import { CompetitionResult, Participant, PublicThemeSettings, PosterConfig } from '@/types/fest';

/**
 * Generates and downloads a high-resolution Celebration Result Poster (PNG)
 */
export function exportPosterAsPng(
  result: CompetitionResult,
  theme: PublicThemeSettings,
  config?: PosterConfig
): void {
  if (typeof window === 'undefined') return;

  const aspectRatio = config?.aspectRatio || '1:1';
  const colorPreset = config?.colorPreset || 'royal';

  // Base resolution: 1080 width
  let width = 1080;
  let height = 1080;
  if (aspectRatio === '4:5') {
    height = 1350;
  } else if (aspectRatio === '9:16') {
    height = 1920;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background Gradients
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (colorPreset === 'crimson') {
    grad.addColorStop(0, '#7F1D1D');
    grad.addColorStop(0.5, '#991B1B');
    grad.addColorStop(1, '#450A0A');
  } else if (colorPreset === 'emerald') {
    grad.addColorStop(0, '#064E3B');
    grad.addColorStop(0.5, '#047857');
    grad.addColorStop(1, '#022C22');
  } else if (colorPreset === 'monochrome') {
    grad.addColorStop(0, '#18181B');
    grad.addColorStop(0.5, '#27272A');
    grad.addColorStop(1, '#09090B');
  } else {
    // Royal Blue
    grad.addColorStop(0, '#1E3A8A');
    grad.addColorStop(0.5, '#1D4ED8');
    grad.addColorStop(1, '#172554');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Outer decorative border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 12;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // Corner decorative accents
  ctx.fillStyle = '#F59E0B'; // Amber / Gold accent
  const cornerSize = 40;
  ctx.fillRect(36, 36, cornerSize, 8);
  ctx.fillRect(36, 36, 8, cornerSize);
  ctx.fillRect(width - 36 - cornerSize, 36, cornerSize, 8);
  ctx.fillRect(width - 44, 36, 8, cornerSize);
  ctx.fillRect(36, height - 44, cornerSize, 8);
  ctx.fillRect(36, height - 36 - cornerSize, 8, cornerSize);
  ctx.fillRect(width - 36 - cornerSize, height - 44, cornerSize, 8);
  ctx.fillRect(width - 44, height - 36 - cornerSize, 8, cornerSize);

  // Header Typography
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '700 24px Montserrat, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText(`${theme.festivalName.toUpperCase()} · OFFICIAL RESULT`, width / 2, 110);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 48px Montserrat, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(result.competitionName, width / 2, 175);

  // Category & Type Pill
  const categoryPillText = `${(result.categoryName || '').toUpperCase()}  |  ${(result.type || 'SOLO').toUpperCase()}`;
  ctx.font = '700 20px Montserrat, sans-serif';
  const pillWidth = ctx.measureText(categoryPillText).width + 48;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect((width - pillWidth) / 2, 205, pillWidth, 40, 20);
  ctx.fill();
  ctx.fillStyle = '#FBBF24';
  ctx.fillText(categoryPillText, width / 2, 232);

  // Winners Cards
  const rank1 = result.ranks.find(r => r.rank === 1);
  const rank2 = result.ranks.find(r => r.rank === 2);
  const rank3 = result.ranks.find(r => r.rank === 3);

  const cardWidth = width - 160;
  const cardX = 80;
  let startY = 280;
  const cardGap = 24;

  const drawWinnerCard = (
    rankNum: number,
    rankData: any,
    yPos: number,
    cardHeight: number,
    badgeColor: string,
    badgeTextColor: string,
    title: string
  ) => {
    if (!rankData) return;

    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(cardX, yPos, cardWidth, cardHeight, 24);
    ctx.fill();

    ctx.strokeStyle = rankNum === 1 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rank Badge Circle
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(cardX + 70, yPos + cardHeight / 2, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = badgeTextColor;
    ctx.font = '900 36px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${rankNum}`, cardX + 70, yPos + cardHeight / 2 + 13);

    // Winner Info (Left Aligned)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 32px Montserrat, sans-serif';
    const candidateName = rankData.candidateName || rankData.name || 'Contestant';
    ctx.fillText(candidateName, cardX + 135, yPos + cardHeight / 2 - 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 22px Montserrat, sans-serif';
    const teamString = `${rankData.teamName} (${rankData.teamCode || ''}) · Bib ${rankData.bib || 'N/A'}`;
    ctx.fillText(teamString, cardX + 135, yPos + cardHeight / 2 + 25);

    // Right side: Grade & Points
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE047';
    ctx.font = '800 28px Montserrat, sans-serif';
    const pointsText = `+${rankData.totalEarnedPoints || rankData.points || 0} PTS`;
    ctx.fillText(pointsText, cardX + cardWidth - 40, yPos + cardHeight / 2 - 10);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '700 20px Montserrat, sans-serif';
    ctx.fillText(`Grade ${rankData.grade || 'A'}`, cardX + cardWidth - 40, yPos + cardHeight / 2 + 24);
  };

  const cardH = aspectRatio === '9:16' ? 180 : 130;
  if (rank1) {
    drawWinnerCard(1, rank1, startY, cardH, '#F59E0B', '#111111', '1st Place');
    startY += cardH + cardGap;
  }
  if (rank2) {
    drawWinnerCard(2, rank2, startY, cardH, '#E2E8F0', '#111111', '2nd Place');
    startY += cardH + cardGap;
  }
  if (rank3) {
    drawWinnerCard(3, rank3, startY, cardH, '#F97316', '#FFFFFF', '3rd Place');
    startY += cardH + cardGap;
  }

  // Footer / Watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '600 18px Montserrat, sans-serif';
  ctx.fillText(
    `${theme.institutionName} · Official Festival Results Management System`,
    width / 2,
    height - 60
  );

  // Trigger Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeCode = (result.competitionCode || 'COMP').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `Poster_${safeCode}_Winners.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Generates and downloads a printable Participant Digital ID Card (PNG)
 */
export function exportDigitalIdAsPng(
  participant: Participant,
  festivalName: string = 'SAHITHYOLSAV 2025'
): void {
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

  // Draw simulated QR matrix block
  const qrX = width - 180;
  const qrY = 755;
  const qrSize = 100;
  ctx.fillStyle = '#111111';
  ctx.fillRect(qrX, qrY, qrSize, qrSize);

  // Inner white squares
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrX + 10, qrY + 10, qrSize - 20, qrSize - 20);
  ctx.fillStyle = '#111111';
  ctx.fillRect(qrX + 22, qrY + 22, 24, 24);
  ctx.fillRect(qrX + 54, qrY + 22, 24, 24);
  ctx.fillRect(qrX + 22, qrY + 54, 24, 24);
  ctx.fillRect(qrX + 54, qrY + 54, 12, 12);

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
