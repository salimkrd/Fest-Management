import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@/types/fest';
import { exportDigitalIdAsPng } from '@/utils/canvasExport';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') }
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

describe('Digital ID PNG canvas photo rendering', () => {
  const drawImage = vi.fn();
  const fillText = vi.fn();
  const linkClick = vi.fn();
  const link = { click: linkClick, remove: vi.fn(), href: '', download: '' };
  const createObjectURL = vi.fn(() => 'blob:photo');
  const revokeObjectURL = vi.fn();
  const ctx = {
    drawImage, fillText, fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    roundRect: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    save: vi.fn(), clip: vi.fn(), restore: vi.fn(),
    fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left', font: '', letterSpacing: ''
  };
  class FakeImage {
    src = '';
    naturalWidth = 400;
    naturalHeight = 200;
    async decode() { return; }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { setTimeout: vi.fn() });
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', {
      createElement: (tag: string) => tag === 'canvas'
        ? { width: 0, height: 0, getContext: () => ctx,
          toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' })) }
        : link,
      body: { appendChild: vi.fn() }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('draws real participant photo inside circular avatar and still draws QR', async () => {
    const originalPhoto = new Blob(['participant image'], { type: 'image/jpeg' });
    await exportDigitalIdAsPng(participant, 'SAHITHYOLSAV 2025', {
      token: 'signedtoken', qrPayload: 'secure qr', photoBlob: originalPhoto
    });
    // One draw for the real portrait, one for the signed QR.
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect((drawImage.mock.calls[0][0] as FakeImage).src).toBe('blob:photo');
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(fillText).toHaveBeenCalledWith('SAHITHYOLSAV 2025', 320, 105);
    expect(linkClick).toHaveBeenCalledOnce();
    expect(link.download).toContain('Digital_ID_#1001');
    const idLines = fillText.mock.calls.filter(call => call[1] === 70 && call[3] === 245);
    expect(idLines.length).toBeGreaterThanOrEqual(2);
    expect(idLines.every(call => call[0].length <= 18)).toBe(true);
  });

  it('refuses to replace a genuine photo with initials on download errors', async () => {
    await expect(exportDigitalIdAsPng(participant, 'SAHITHYOLSAV 2025', {
      token: 'signed', qrPayload: 'secure'
    })).rejects.toThrow(/photo must be loaded/i);
    expect(linkClick).not.toHaveBeenCalled();
  });

  it('uses initials only when participant has no real uploaded photo', async () => {
    await exportDigitalIdAsPng({ ...participant, photoUrl: '' }, 'SAHITHYOLSAV 2025', {
      token: 'signed', qrPayload: 'secure'
    });
    expect(drawImage).toHaveBeenCalledTimes(1); // QR only
    expect(fillText.mock.calls.some(call => call[0] === 'T')).toBe(true);
    expect(linkClick).toHaveBeenCalledOnce();
  });
});
