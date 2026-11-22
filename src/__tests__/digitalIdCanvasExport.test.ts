import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@/types/fest';
import { exportDigitalIdAsPng } from '@/utils/canvasExport';
import { ID_CARD_DIMENSIONS } from '@/domain/idCardDesign';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQrCodeDataUrl') }
}));

const participant: Participant = {
  id: 'part-234db9d5-075d-472d-b6c2-0a2efb132a6a',
  bib: '#1001',
  name: 'Test Participant',
  email: '', phone: '', teamId: 'team-1',
  teamCode: 'ALP', teamName: 'Team Alpha',
  categoryId: 'senior', categoryName: 'Senior',
  classGrade: 'UG', division: 'A', dob: '2007-05-12',
  photoUrl: 'https://firebasestorage.googleapis.com/photo.jpg',
  registeredEventIds: [], idStatus: 'GENERATED'
};

describe('Digital ID PNG canonical SVG rasterization', () => {
  const drawImage = vi.fn();
  const linkClick = vi.fn();
  const link = { click: linkClick, remove: vi.fn(), href: '', download: '' };
  const createObjectURL = vi.fn(() => 'blob:id-card-png');
  const revokeObjectURL = vi.fn();

  let createdCanvas: { width: number; height: number; getContext: () => unknown; toBlob: unknown } | null = null;

  const ctx = {
    drawImage,
  };

  class FakeImage {
    src = '';
    naturalWidth = 2960;
    naturalHeight = 4200;
    async decode() { return; }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createdCanvas = null;
    vi.stubGlobal('window', { setTimeout: vi.fn() });
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          createdCanvas = {
            width: 0,
            height: 0,
            getContext: () => ctx,
            toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' }))
          };
          return createdCanvas;
        }
        return link;
      },
      body: { appendChild: vi.fn() }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('rasterizes canonical SVG onto 2960x4200 canvas with embedded photo and QR', async () => {
    const originalPhoto = new Blob(['participant image bytes'], { type: 'image/jpeg' });
    await exportDigitalIdAsPng(participant, 'SAHITHYOLSAV 2025', {
      token: 'signedtoken12345', qrPayload: 'secure qr accreditation', photoBlob: originalPhoto,
      institutionName: "Ma'din Suffa Campus Vavoor"
    });

    // 1. Single rasterization draw call of the canonical SVG
    expect(drawImage).toHaveBeenCalledTimes(1);

    // 2. High-resolution canvas dimensions (4x scale of 740x1050 = 2960 x 4200 px, 1016 DPI)
    const expectedWidth = ID_CARD_DIMENSIONS.baseWidth * ID_CARD_DIMENSIONS.exportScale;
    const expectedHeight = ID_CARD_DIMENSIONS.baseHeight * ID_CARD_DIMENSIONS.exportScale;
    expect(expectedWidth).toBe(2960);
    expect(expectedHeight).toBe(4200);
    expect(createdCanvas?.width).toBe(2960);
    expect(createdCanvas?.height).toBe(4200);

    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 2960, 4200);

    // 3. Inspect SVG artwork passed to Image
    const imageInstance = drawImage.mock.calls[0][0] as FakeImage;
    expect(imageInstance.src).toContain('data:image/svg+xml;charset=utf-8,');

    const svgString = decodeURIComponent(imageInstance.src.replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(svgString).toContain('SAHITHYOLSAV 2025');
    expect(svgString).toContain("Ma'din Suffa Campus Vavoor");
    expect(svgString).toContain('OFFICIAL FEST PASS');
    expect(svgString).toContain('Test Participant');
    expect(svgString).toContain('#1001');
    expect(svgString).toContain('Team Alpha (ALP)');
    expect(svgString).toContain('Senior');
    expect(svgString).toContain('0 Competitions');
    expect(svgString).toContain('Token: SIGNEDTOKEN12345');
    expect(svgString).toContain('data:image/jpeg;base64,');
    expect(svgString).toContain('data:image/png;base64,mockQrCodeDataUrl');

    // 4. Download trigger
    expect(linkClick).toHaveBeenCalledOnce();
    expect(link.download).toBe('Digital_ID_#1001_Test_Participant.png');
  });

  it('refuses to export when real photo exists but photoBlob was not loaded', async () => {
    await expect(exportDigitalIdAsPng(participant, 'SAHITHYOLSAV 2025', {
      token: 'signed', qrPayload: 'secure'
    })).rejects.toThrow(/photo must be loaded/i);
    expect(linkClick).not.toHaveBeenCalled();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('uses neutral initials fallback in canonical SVG when participant has no photo', async () => {
    await exportDigitalIdAsPng({ ...participant, photoUrl: '' }, 'SAHITHYOLSAV 2025', {
      token: 'signed', qrPayload: 'secure'
    });

    expect(drawImage).toHaveBeenCalledTimes(1);
    const imageInstance = drawImage.mock.calls[0][0] as FakeImage;
    const svgString = decodeURIComponent(imageInstance.src.replace('data:image/svg+xml;charset=utf-8,', ''));

    expect(svgString).toContain('data-testid="participant-photo-fallback"');
    expect(svgString).toContain('data-testid="participant-silhouette"');
    expect(svgString).toContain('data-testid="participant-initials"');
    expect(svgString).toContain('TP');
    expect(linkClick).toHaveBeenCalledOnce();
  });
});
