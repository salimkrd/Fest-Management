/**
 * Canvas Export Utility for Official Posters and Participant Digital IDs
 * Generates genuine high-resolution PNG downloads directly in the browser.
 */

import { CompetitionResult, Participant, PublicThemeSettings, PosterConfig } from '@/types/fest';
import QRCode from 'qrcode';
import { loadPosterFonts } from '@/domain/posterFonts';
import { getParticipantInitials } from '@/components/domain/ParticipantPhoto';
import { ID_CARD_DIMENSIONS } from '@/domain/idCardDesign';
import { extractIdCardData, buildIdCardSvg, type IdCardAssets } from '@/domain/idCardSvg';

/**
 * Converts a Blob to a base64 Data URI safely across browser and test environments.
 */
export async function blobToDataUri(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed to read image blob as data URI.'));
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader error.'));
      reader.readAsDataURL(blob);
    });
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

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
 * Generates and downloads a printable Participant Digital ID Card (PNG).
 * Rasterizes the exact canonical SVG artwork (buildIdCardSvg) to guarantee
 * 100% visual parity between on-screen preview, print, and downloaded PNG.
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
    registeredCompetitionsCount?: number;
  }
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Do not silently substitute an initial when a genuine preview photo exists.
  const realPhotoUrl = participant.photoUrl?.trim();
  if (realPhotoUrl && !realPhotoUrl.includes('1534528741775-53994a69daeb') && !options?.photoBlob) {
    throw new Error('Participant photo must be loaded before the PNG can be exported.');
  }

  if (!options?.qrPayload || !options?.token) {
    throw new Error('Verified QR credentials are required before downloading a digital ID.');
  }

  // 1. Prepare genuine photo as base64 data URI to avoid canvas tainting
  let photoDataUri: string | undefined;
  if (options?.photoBlob) {
    try {
      photoDataUri = await blobToDataUri(options.photoBlob);
    } catch (photoErr) {
      console.error('[canvasExport] Photo blob conversion error:', photoErr);
      throw new Error('Participant photo could not be prepared for PNG export.');
    }
  }

  // 2. Generate signed QR badge as base64 data URI
  let qrDataUri: string;
  try {
    qrDataUri = await QRCode.toDataURL(options.qrPayload, {
      width: 800,
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: '#000000', light: '#FFFFFF' }
    });
  } catch (qrErr) {
    console.error('[canvasExport] QR rendering error:', qrErr);
    throw new Error('Unable to render the verified QR. No invalid badge was downloaded.');
  }

  // 3. Assemble data and render canonical SVG
  const cardData = extractIdCardData(participant, {
    festivalName,
    institutionName: options?.institutionName,
    festivalNameFont: options?.festivalNameFont,
    ...(options?.registeredCompetitionsCount !== undefined
      ? { registeredCompetitionsCount: options.registeredCompetitionsCount }
      : {})
  });

  const assets: IdCardAssets = {
    photoDataUri,
    qrDataUri,
    photoFallbackInitials: getParticipantInitials(participant.name)
  };

  const svgMarkup = buildIdCardSvg(cardData, assets);

  // 4. Await document fonts if available in browser
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* Fallback system fonts if font loading fails */
    }
  }

  // 5. Decode canonical SVG artwork as an Image
  const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  const artwork = new Image();
  artwork.src = svgDataUri;
  await artwork.decode();

  // 6. Rasterize onto high-resolution canvas (2960 x 4200 px, 1016 DPI)
  const exportScale = ID_CARD_DIMENSIONS.exportScale; // 4
  const width = ID_CARD_DIMENSIONS.baseWidth * exportScale;   // 2960
  const height = ID_CARD_DIMENSIONS.baseHeight * exportScale; // 4200

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser could not prepare canvas for PNG export.');

  // Single rasterization call of the canonical SVG
  ctx.drawImage(artwork, 0, 0, width, height);

  // 7. Trigger PNG download
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
