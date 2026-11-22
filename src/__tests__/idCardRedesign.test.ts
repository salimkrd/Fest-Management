import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IdCardBadge } from '@/components/domain/IdCardBadge';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import {
  ID_CARD_DIMENSIONS,
  ID_CARD_COLORS,
  formatCardBib,
  formatRegisteredContests,
  formatCardToken
} from '@/domain/idCardDesign';
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

describe('INSPIRATH ID Card Complete Redesign (74mm x 105mm)', () => {
  const sampleParticipant: Participant = {
    id: 'part-c37b82fa-9021-4d3e-8e5f-172901234567',
    bib: '#1042',
    name: 'Nihad Mohammed',
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
    });

    it('defines authoritative reference colors', () => {
      expect(ID_CARD_COLORS.headerRed).toBe('#931B1E');
      expect(ID_CARD_COLORS.nameYellow).toBe('#FBBF24');
      expect(ID_CARD_COLORS.cardBgWhite).toBe('#FFFFFF');
      expect(ID_CARD_COLORS.qrBorderBlack).toBe('#000000');
    });
  });

  describe('2. IdCardBadge Shared Presentation Component', () => {
    it('renders all reference design fields in their designated positions', () => {
      const html = renderToStaticMarkup(
        React.createElement(IdCardBadge, {
          participant: sampleParticipant,
          festivalName: 'INSPIRATH 2025',
          institutionName: "Suffa University Campus",
          qrDataUrl: 'data:image/png;base64,mockQr',
          signedToken: 'abcdef1234567890abcdef1234567890'
        })
      );

      // Kicker
      expect(html).toContain('OFFICIAL FEST PASS');

      // Festival Name & Institution Name
      expect(html).toContain('INSPIRATH 2025');
      expect(html).toContain('Suffa University Campus');

      // Circular Photo
      expect(html).toContain('<img');
      expect(html).toContain('src="https://staging.inspirath.org/photos/nihad.jpg"');

      // Bib Number & Yellow Participant Name
      expect(html).toContain('#1042');
      expect(html).toContain('Nihad Mohammed');
      expect(html).toContain('text-[#FBBF24]');

      // Left Column Details
      expect(html).toContain('Al-Farooq House (ALF)');
      expect(html).toContain('Senior');
      expect(html).toContain('Participant Id:');
      expect(html).toContain('PART-C37B82FA-9021-4D3E-8E5F-172901234567');
      expect(html).toContain('Registered Contests:');
      expect(html).toContain('3 Competitions');
      expect(html).toContain('Token:');
      expect(html).toContain('ABCDEF1234567890ABCD');

      // Right Column QR Code Container
      expect(html).toContain('border-black');
      expect(html).toContain('data:image/png;base64,mockQr');

      // Bottom Decorative Literary Ribbon
      expect(html).toContain('bg-[#931B1E]');
      expect(html).toContain('svg');
    });

    it('does not reintroduce removed fields such as Class/Grade on the card', () => {
      const html = renderToStaticMarkup(
        React.createElement(IdCardBadge, {
          participant: sampleParticipant,
          festivalName: 'INSPIRATH 2025'
        })
      );

      // Verified: ClassGrade ('Grade 12') and Division ('Div A') are strictly excluded from the card
      expect(html).not.toContain('Grade 12');
      expect(html).not.toContain('Div A');
    });

    it('handles long participant names and long teams gracefully without layout breaks', () => {
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
      expect(html).toContain('truncate');
    });
  });

  describe('3. Single Reusable Component Integration across Portals', () => {
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

  describe('4. Formatting Helpers', () => {
    it('formatCardBib ensures clean leading hash', () => {
      expect(formatCardBib('1042')).toBe('#1042');
      expect(formatCardBib('#1042')).toBe('#1042');
      expect(formatCardBib('')).toBe('#0000');
    });

    it('formatRegisteredContests formats count with "Competitions"', () => {
      expect(formatRegisteredContests(0)).toBe('0 Competitions');
      expect(formatRegisteredContests(5)).toBe('5 Competitions');
    });

    it('formatCardToken trims and capitalizes token', () => {
      expect(formatCardToken('abc123xyz')).toBe('ABC123XYZ');
      expect(formatCardToken('')).toBe('VERIFYING...');
    });
  });
});
