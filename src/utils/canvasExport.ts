/**
 * Canvas Export Utility for Official Posters and Participant Digital IDs
 * Generates genuine high-resolution PNG downloads directly in the browser.
 */

import { CompetitionResult, Participant, PublicThemeSettings, PosterConfig } from '@/types/fest';
import QRCode from 'qrcode';
import { FESTIVAL_NAME_FONTS, DEFAULT_FESTIVAL_NAME_FONT } from '@/domain/festivalFonts';
import { loadPosterFonts } from '@/domain/posterFonts';
import { getParticipantInitials } from '@/components/domain/ParticipantPhoto';
import { ID_CARD_DIMENSIONS, ID_CARD_COLORS } from '@/domain/idCardDesign';

/**
 * Generates and downloads a high-resolution Celebration Result Poster (PNG)
 */
export async function exportPosterAsPng(
  result: CompetitionResult,
  theme: PublicThemeSettings,
  config?: PosterConfig,
  templateName?: string
): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Poster downloads require a browser.');
  const { validatePosterConfig, normalizePosterConfig, posterDimensions, posterSvgDataUrl } = await import('@/domain/poster');
  const checked = validatePosterConfig(normalizePosterConfig(config));
  const { width, height } = posterDimensions(checked.aspectRatio);
  await loadPosterFonts([
    ...(checked.elements ?? [])
      .filter(element => element.type === 'text' && element.field !== 'festivalName')
      .map(element => element.fontFamily),
    ...(checked.winnerContainer?.layers ?? [])
      .filter(layer => layer.type === 'text')
      .map(layer => layer.fontFamily),
  ]);
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
  const filenameParts = [`Poster_${(result.competitionCode || 'Result').replace(/[^a-zA-Z0-9_-]/g, '_')}`];
  if (templateName?.trim()) filenameParts.push(templateName.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, ''));
  link.download = filenameParts.join('_') + '.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Generates and downloads a printable Participant Digital ID Card (PNG)
 * Exactly matches the 74mm x 105mm official INSPIRATH reference design.
 */
export async function exportDigitalIdAsPng(
  participant: Participant,
  festivalName: string = 'SAHITHYOLSAV 2025',
  options?: {
    token?: string;
    qrPayload?: string;
    photoBlob?: Blob;
    logoBlob?: Blob;
    festivalNameFont?: string;
    institutionName?: string;
  }
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Do not silently substitute an initial when a genuine preview photo exists.
  const realPhotoUrl = participant.photoUrl?.trim();
  if (realPhotoUrl && !realPhotoUrl.includes('1534528741775-53994a69daeb') && !options?.photoBlob) {
    throw new Error('Participant photo must be loaded before the PNG can be exported.');
  }

  // Exact 74mm x 105mm aspect ratio (74:105)
  // 740 x 1050 base units at 4x scale = 2960 x 4200 px (over 1000 DPI for ultra-sharp prints)
  const width = ID_CARD_DIMENSIONS.baseWidth;
  const height = ID_CARD_DIMENSIONS.baseHeight;
  const exportScale = ID_CARD_DIMENSIONS.exportScale;

  const canvas = document.createElement('canvas');
  canvas.width = width * exportScale;
  canvas.height = height * exportScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(exportScale, exportScale);

  // 1. Crisp White Base Background
  ctx.fillStyle = ID_CARD_COLORS.cardBgWhite;
  ctx.fillRect(0, 0, width, height);

  // 2. Upper Crimson Red Header with Wave Bottom Cutout
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, 605);
  ctx.bezierCurveTo(600, 625, 480, 580, 370, 585);
  ctx.bezierCurveTo(260, 590, 140, 635, 0, 620);
  ctx.closePath();
  ctx.clip();

  // Rich gradient fill from reference design
  const redGradient = ctx.createLinearGradient(0, 0, 0, 620);
  redGradient.addColorStop(0, ID_CARD_COLORS.headerRedGradientStart);
  redGradient.addColorStop(0.5, ID_CARD_COLORS.headerRed);
  redGradient.addColorStop(1, ID_CARD_COLORS.headerRedGradientEnd);
  ctx.fillStyle = redGradient;
  ctx.fillRect(0, 0, width, 630);

  // Subtle Halftone / Dot Grid pattern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let dx = 8; dx < width; dx += 16) {
    for (let dy = 8; dy < 620; dy += 16) {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Golden Amber Starbursts (8-pointed flower bursts from reference design)
  const drawBurst = (cx: number, cy: number, radius: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = ID_CARD_COLORS.starburstAmber;
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.roundRect(-radius * 0.16, -radius, radius * 0.32, radius * 2, radius * 0.16);
      ctx.fill();
      ctx.rotate(Math.PI / 4);
    }
    ctx.restore();
  };
  drawBurst(-10, 380, 140);
  drawBurst(710, 140, 150);

  ctx.restore(); // Restore clipping boundary

  // 3. Top Typography
  ctx.textAlign = 'center';

  // Kicker: OFFICIAL FEST PASS
  ctx.fillStyle = ID_CARD_COLORS.textWhite;
  ctx.font = '700 16px Montserrat, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('OFFICIAL FEST PASS', width / 2, 55);

  // FEST NAME
  const fontChoice = FESTIVAL_NAME_FONTS.find(font => font.name === options?.festivalNameFont)
    || FESTIVAL_NAME_FONTS.find(font => font.name === DEFAULT_FESTIVAL_NAME_FONT)!;
  const canvasFont = fontChoice.name === 'Montserrat' ? 'Montserrat, sans-serif' : fontChoice.family;
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try { await document.fonts.load('800 36px "' + fontChoice.name + '"'); }
    catch { /* Built-in system fallback used if remote font unavailable */ }
  }
  ctx.font = '800 36px ' + canvasFont;
  ctx.letterSpacing = '1px';
  ctx.fillText(festivalName.toUpperCase(), width / 2, 105);

  // Institution Name
  if (options?.institutionName?.trim()) {
    ctx.fillStyle = ID_CARD_COLORS.textWhiteMuted;
    ctx.font = '600 18px Montserrat, sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText(options.institutionName.trim(), width / 2, 140);
  }

  // 4. Circular Participant Photo Container
  const avatarCenterY = 280;
  const avatarRadius = 110;

  // Solid White Circle Border / Backplate
  ctx.fillStyle = ID_CARD_COLORS.textWhite;
  ctx.beginPath();
  ctx.arc(width / 2, avatarCenterY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.fill();

  if (options?.photoBlob) {
    const localUrl = URL.createObjectURL(options.photoBlob);
    try {
      const photo = new Image();
      photo.src = localUrl;
      await photo.decode();
      if (!photo.naturalWidth || !photo.naturalHeight) {
        throw new Error('Participant photo has invalid dimensions.');
      }
      const diameter = avatarRadius * 2;
      const scale = Math.max(diameter / photo.naturalWidth, diameter / photo.naturalHeight);
      const drawnWidth = photo.naturalWidth * scale;
      const drawnHeight = photo.naturalHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, avatarCenterY, avatarRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        photo,
        (width - drawnWidth) / 2,
        avatarCenterY - drawnHeight / 2,
        drawnWidth,
        drawnHeight
      );
      ctx.restore();
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  } else {
    // Neutral fallback silhouette and initials
    ctx.fillStyle = '#F3F4F6';
    ctx.beginPath();
    ctx.arc(width / 2, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();

    const initials = getParticipantInitials(participant.name);
    ctx.fillStyle = '#4B5563';
    ctx.font = '800 64px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(initials || participant.name.charAt(0).toUpperCase(), width / 2, avatarCenterY + 22);
  }

  // 5. Bib Number
  ctx.textAlign = 'center';
  ctx.fillStyle = ID_CARD_COLORS.textWhite;
  ctx.font = '700 18px Montserrat, sans-serif';
  ctx.letterSpacing = '1px';
  const bibText = participant.bib.startsWith('#') ? participant.bib : `#${participant.bib}`;
  ctx.fillText(bibText, width / 2, 435);

  // 6. Participant Name in Yellow
  ctx.fillStyle = ID_CARD_COLORS.nameYellow;
  ctx.font = '900 36px Montserrat, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(participant.name, width / 2, 480, width - 60);

  // 7. Lower Section: Two Balanced Columns
  // Left Column: Team, Category, Participant ID, Registered Contests, Token
  ctx.textAlign = 'left';
  const leftX = 45;

  // Team Name
  ctx.fillStyle = ID_CARD_COLORS.textBlack;
  ctx.font = '800 24px Montserrat, sans-serif';
  const teamText = `${participant.teamName}${participant.teamCode ? ` (${participant.teamCode})` : ''}`;
  ctx.fillText(teamText, leftX, 650, 320);

  // Category Name
  ctx.font = '700 22px Montserrat, sans-serif';
  ctx.fillText(participant.categoryName, leftX, 685, 320);

  // Participant Id
  ctx.fillStyle = ID_CARD_COLORS.textBlack;
  ctx.font = '700 15px Montserrat, sans-serif';
  ctx.fillText('Participant Id:', leftX, 725);

  ctx.fillStyle = '#1F2937';
  ctx.font = '600 12.5px Montserrat, sans-serif';
  const participantId = participant.id.toUpperCase();
  const idLines = participantId.match(/.{1,18}/g) || [participantId];
  idLines.forEach((line, index) => {
    ctx.fillText(line, leftX, 746 + index * 18, 320);
  });

  // Registered Contests
  ctx.fillStyle = ID_CARD_COLORS.textBlack;
  ctx.font = '700 15px Montserrat, sans-serif';
  ctx.fillText('Registered Contests:', leftX, 810);

  ctx.fillStyle = ID_CARD_COLORS.textBlack;
  ctx.font = '800 18px Montserrat, sans-serif';
  ctx.fillText(`${participant.registeredEventIds?.length || 0} Competitions`, leftX, 836);

  // Token
  ctx.fillStyle = ID_CARD_COLORS.textMuted;
  ctx.font = '600 12px monospace';
  const tokenDisplay = `Token: ${options?.token ? options.token.slice(0, 24).toUpperCase() : 'VERIFIED'}`;
  ctx.fillText(tokenDisplay, leftX, 875, 320);

  // Right Column: Rounded Black Border QR Code Box
  if (!options?.qrPayload || !options?.token) {
    throw new Error('Verified QR credentials are required before downloading a digital ID.');
  }

  const qrBoxX = 390;
  const qrBoxY = 620;
  const qrBoxSize = 305;

  ctx.fillStyle = ID_CARD_COLORS.cardBgWhite;
  ctx.strokeStyle = ID_CARD_COLORS.qrBorderBlack;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32);
  ctx.fill();
  ctx.stroke();

  try {
    const qrDataUrl = await QRCode.toDataURL(options.qrPayload, {
      width: 800,
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await qrImg.decode();
    ctx.drawImage(qrImg, qrBoxX + 20, qrBoxY + 20, 265, 265);
  } catch (qrErr) {
    console.error('[canvasExport] QR rendering error:', qrErr);
    throw new Error('Unable to render the verified QR. No invalid badge was downloaded.');
  }

  // 8. Very Bottom: Decorative Literary Ribbon Strip
  const ribbonY = 1005;
  const ribbonH = 45;
  const numTiles = 20;
  const tileW = width / numTiles;

  for (let i = 0; i < numTiles; i++) {
    const isBurgundy = i % 2 === 0;
    const tileX = i * tileW;

    ctx.fillStyle = isBurgundy ? ID_CARD_COLORS.ribbonBurgundy : ID_CARD_COLORS.cardBgWhite;
    ctx.fillRect(tileX, ribbonY, tileW, ribbonH);

    // Draw cultural/literary icon glyph inside
    ctx.fillStyle = isBurgundy ? ID_CARD_COLORS.cardBgWhite : ID_CARD_COLORS.ribbonBurgundy;
    const iconType = i % 4;
    const iconCenterX = tileX + tileW / 2;
    const iconCenterY = ribbonY + ribbonH / 2;

    if (iconType === 0) {
      // Lamp / Lantern
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(iconCenterX - 4, iconCenterY + 4, 8, 3);
    } else if (iconType === 2) {
      // Open book
      ctx.fillRect(iconCenterX - 6, iconCenterY - 5, 5, 10);
      ctx.fillRect(iconCenterX + 1, iconCenterY - 5, 5, 10);
    } else {
      // Quill feather
      ctx.beginPath();
      ctx.moveTo(iconCenterX - 4, iconCenterY + 6);
      ctx.lineTo(iconCenterX + 4, iconCenterY - 6);
      ctx.lineTo(iconCenterX + 2, iconCenterY - 6);
      ctx.lineTo(iconCenterX - 5, iconCenterY + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Top dividing line for ribbon
  ctx.strokeStyle = ID_CARD_COLORS.ribbonBurgundy;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ribbonY);
  ctx.lineTo(width, ribbonY);
  ctx.stroke();

  // 9. Download trigger
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value
      ? resolve(value)
      : reject(new Error('Could not create the participant ID PNG.')), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `Digital_ID_${participant.bib}_${participant.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
