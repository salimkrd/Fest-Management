import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IdCardBadge } from '@/components/domain/IdCardBadge';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import {
  ID_CARD_DIMENSIONS,
  ID_CARD_COLORS,
  ID_CARD_LAYOUT,
  formatCardBib,
  formatRegisteredContests,
  formatCardToken
} from '@/domain/idCardDesign';
import {
  buildIdCardSvg,
  extractIdCardData,
  idCardSvgDataUrl,
  type IdCardData,
  type IdCardAssets
} from '@/domain/idCardSvg';
import type { Participant } from '@/types/fest';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQr')
  }
}));

vi.mock('@/utils/canvasExport', () => ({
  exportDigitalIdAsPng: vi.fn()
}));

vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: null }
}));

describe('INSPIRATH ID Card Canonical SVG Architecture (74mm x 105mm)', () => {
  const sampleParticipant: Participant = {
    id: 'part-c37b82fa-9021-4d3e-8e5f-172901234567',
    bib: '#1042',
    name: 'Nihad Mohammed',
    place: 'Pattambi',
    dob: '2010-05-12',
    teamId: 'team-alpha',
    teamName: 'Al-Farooq House',
    teamCode: 'ALF',
    categoryId: 'cat-senior',
    categoryName: 'Senior',
    classGrade: 'Grade 12',
    division: 'A',
    email: 'nihad@school.org',
    phone: '+91 98470 11042',
    photoUrl: 'https://staging.inspirath.org/photos/nihad.jpg',
    registeredEventIds: ['cmp-1', 'cmp-2', 'cmp-3'],
    idStatus: 'GENERATED'
  };

  describe('1. Exact Physical Dimensions & Design Geometry', () => {
    it('enforces exact 74mm x 105mm physical print dimensions and 74:105 aspect ratio', () => {
      expect(ID_CARD_DIMENSIONS.widthMm).toBe(74);
      expect(ID_CARD_DIMENSIONS.heightMm).toBe(105);
      expect(ID_CARD_DIMENSIONS.aspectRatio).toBeCloseTo(74 / 105, 5);
      expect(ID_CARD_DIMENSIONS.baseWidth).toBe(740);
      expect(ID_CARD_DIMENSIONS.baseHeight).toBe(1050);
      // Scaled output at 4x gives 2960 x 4200 px (over 1000 DPI)
      expect(ID_CARD_DIMENSIONS.baseWidth * ID_CARD_DIMENSIONS.exportScale).toBe(2960);
      expect(ID_CARD_DIMENSIONS.baseHeight * ID_CARD_DIMENSIONS.exportScale).toBe(4200);

      // Supplied participant pass layout: portrait in red header, details/QR on white panel.
      expect(ID_CARD_LAYOUT.header.height).toBe(675);
      expect(ID_CARD_LAYOUT.header.photo.radius).toBe(143);
      expect(ID_CARD_LAYOUT.header.photo.centerY).toBe(385);
      expect(ID_CARD_LAYOUT.qr.y).toBe(718);
      expect(ID_CARD_LAYOUT.qr.x).toBe(405);
      expect(ID_CARD_LAYOUT.footer.height).toBe(32);
    });

    it('defines authoritative reference colors', () => {
      expect(ID_CARD_COLORS.headerRed).toBe('#9E1B1E');
      expect(ID_CARD_COLORS.nameYellow).toBe('#FBBF24');
      expect(ID_CARD_COLORS.cardBgWhite).toBe('#FFFFFF');
      expect(ID_CARD_COLORS.qrBorderBlack).toBe('#000000');
    });
  });

  describe('2. Canonical buildIdCardSvg Pure Renderer', () => {
    it('generates complete self-contained SVG artwork with all reference elements', () => {
      const cardData: IdCardData = {
        festivalName: 'INSPIRATH 2025',
        institutionName: 'Suffa University Campus',
        participantName: 'Nihad Mohammed',
        place: 'Pattambi',
        bib: '#1042',
        teamName: 'Al-Farooq House',
        categoryName: 'Senior',
        registeredCompetitionsCount: 3,
      };

      const assets: IdCardAssets = {
        photoDataUri: 'data:image/jpeg;base64,mockPhotoDataUri',
        qrDataUri: 'data:image/png;base64,mockQrCodeDataUri'
      };

      const svg = buildIdCardSvg(cardData, assets);

      // Root viewBox and aspect ratio
      expect(svg).toContain('viewBox="0 0 740 1050"');
      expect(svg).toContain('aspect-ratio:74/105');

      // Header, Halftone, Starbursts & Wave
      expect(svg).toContain('id-header-gradient');
      expect(svg).toContain('id-starburst-left');
      expect(svg).toContain('id-halftone');

      // All non-festival ID text uses Sora; the festival title keeps its selected font.
      expect(svg).toContain("text { font-family: 'Sora', Arial, sans-serif; }");
      expect(svg).toContain('.festival-title { font-family: Montserrat, Arial, sans-serif; }');
      expect(svg).toContain('OFFICIAL FEST PASS');
      expect(svg).toContain('INSPIRATH 2025');
      expect(svg).toContain('Suffa University Campus');

      // Photo and QR
      expect(svg).toContain('data:image/jpeg;base64,mockPhotoDataUri');
      expect(svg).toContain('data:image/png;base64,mockQrCodeDataUri');

      // Bib & Yellow Name
      expect(svg).toContain('#1042');
      expect(svg).toContain('Nihad Mohammed');
      expect(svg).toContain('Pattambi');
      expect(svg).toContain(ID_CARD_COLORS.nameYellow);

      // Left Column Metadata
      expect(svg).toContain('Al-Farooq House');
      expect(svg).toContain('Senior');
      expect(svg).toContain('Registered Contests:');
      expect(svg).toContain('3 Competitions');

      // QR Container border
      expect(svg).toContain('stroke="#111111"');
      expect(svg).toContain('stroke-width="3"');

      expect(svg).toContain('Bib Number');
      expect(svg).toContain('Team Name');
      expect(svg).toContain('Category Name');
      expect(svg).toContain('Registered Contests:');
      expect(svg).toContain('#1042');
      expect(svg).not.toContain('Participant Id:');
      expect(svg).not.toContain('Token:');
    });

    it('renders neutral silhouette and initials fallback when no photo data URI is provided', () => {
      const cardData: IdCardData = {
        festivalName: 'INSPIRATH 2025',
        participantName: 'Nihad Mohammed',
        bib: '#1042',
        teamName: 'Al-Farooq House',
        categoryName: 'Senior',
        registeredCompetitionsCount: 1
      };

      const svg = buildIdCardSvg(cardData, {});

      expect(svg).toContain('data-testid="participant-photo-fallback"');
      expect(svg).toContain('data-testid="participant-silhouette"');
      expect(svg).toContain('data-testid="participant-initials"');
      expect(svg).toContain('NM');
    });

    it('idCardSvgDataUrl returns properly encoded data URI', () => {
      const cardData: IdCardData = {
        festivalName: 'INSPIRATH 2025',
        participantName: 'Nihad Mohammed',
        bib: '#1042',
        teamName: 'Al-Farooq House',
        categoryName: 'Senior',
        registeredCompetitionsCount: 1
      };

      const dataUrl = idCardSvgDataUrl(cardData);
      expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      expect(dataUrl).toContain(encodeURIComponent('INSPIRATH 2025'));
    });
  });

  describe('3. IdCardBadge Shared Presentation Component in Preview & Print', () => {
    it('renders the exact canonical SVG inside the preview element', () => {
      const html = renderToStaticMarkup(
        React.createElement(IdCardBadge, {
          participant: sampleParticipant,
          festivalName: 'INSPIRATH 2025',
          institutionName: "Suffa University Campus",
          qrDataUrl: 'data:image/png;base64,mockQr',
        })
      );

      // Embedded canonical SVG
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 740 1050"');
      expect(html).toContain('OFFICIAL FEST PASS');
      expect(html).toContain('INSPIRATH 2025');
      expect(html).toContain('Suffa University Campus');
      expect(html).toContain('<image');
      expect(html).toContain('href="https://staging.inspirath.org/photos/nihad.jpg"');
      expect(html).toContain('#1042');
      expect(html).toContain('Nihad Mohammed');
      expect(html).toContain('fill="#FBBF24"');
      expect(html).toContain('Al-Farooq House');
      expect(html).toContain('Senior');
      expect(html).toContain('Pattambi');
      expect(html).toContain('3 Competitions');
    });

    it('strictly omits removed fields such as Class/Grade from the canonical SVG', () => {
      const html = renderToStaticMarkup(
        React.createElement(IdCardBadge, {
          participant: sampleParticipant,
          festivalName: 'INSPIRATH 2025'
        })
      );

      expect(html).not.toContain('Grade 12');
      expect(html).not.toContain('Div A');
      expect(html).not.toContain('Participant Id:');
      expect(html).not.toContain('Token:');
    });

    it('safely scales typography for exceptionally long names to prevent layout breaking', () => {
      const longParticipant: Participant = {
        ...sampleParticipant,
        name: 'Sayyid Muhammad Abdurrahman Faris Al-Bukhari Thangal',
        teamName: 'Imam Abu Hanifa Academic House of Scholars and Thinkers',
        teamCode: 'IAH-SCHOLARS',
        registeredEventIds: Array.from({ length: 15 }, (_, i) => `cmp-${i}`)
      };

      const html = renderToStaticMarkup(
        React.createElement(IdCardBadge, {
          participant: longParticipant,
          festivalName: 'INSPIRATH FESTIVAL OF LITERATURE & ARTS 2025'
        })
      );

      expect(html).toContain('Sayyid Muhammad Abdurrahman Faris Al-Bukhari Thangal');
      expect(html).toContain('15 Competitions');
      // Scaled down font size for long name
      expect(html).toContain('font-size="25"');
    });
  });

  describe('4. Single Reusable Component Integration across Portals', () => {
    it('DigitalIdCard embeds the IdCardBadge inside the printable container', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalIdCard, {
          participant: sampleParticipant,
          isOpen: true,
          onClose: () => {}
        })
      );

      expect(html).toContain('id="printable-id-card"');
      expect(html).toContain('class="id-card-printable-container');
      expect(html).toContain('data-testid="participant-id-card"');
      expect(html).toContain('data-status="VERIFIED"');
      expect(html).toContain('Download PNG');
      expect(html).toContain('Print ID Badge');
    });
  });

  describe('5. Formatting Helpers', () => {
    it('formatCardBib ensures clean leading hash', () => {
      expect(formatCardBib('1042')).toBe('#1042');
      expect(formatCardBib('#1042')).toBe('#1042');
      expect(formatCardBib('')).toBe('#0000');
    });

    it('formatRegisteredContests formats count with "Competitions"', () => {
      expect(formatRegisteredContests(0)).toBe('0 Competitions');
      expect(formatRegisteredContests(5)).toBe('5 Competitions');
    });

    it('formatCardToken remains available for QR credentials but is not printed on the card', () => {
      expect(formatCardToken('abc123xyz')).toBe('ABC123XYZ');
      expect(formatCardToken('')).toBe('VERIFYING...');
    });
  });
});
