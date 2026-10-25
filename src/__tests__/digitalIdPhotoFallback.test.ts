import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ParticipantPhoto,
  getParticipantInitials,
  isStockPhotoPlaceholder
} from '@/components/domain/ParticipantPhoto';
import { DigitalIdCard } from '@/components/domain/DigitalIdCard';
import type { Participant } from '@/types/fest';

// Mock QRCode to avoid canvas dependencies in node test environment
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQrCodeDataUrl')
  }
}));

// Mock canvasExport to verify export function is referenced
vi.mock('@/utils/canvasExport', () => ({
  exportDigitalIdAsPng: vi.fn()
}));

// Mock Firebase client auth
vi.mock('@/lib/firebase/client', () => ({
  auth: {
    currentUser: null
  }
}));

describe('Digital ID Card & Participant Photo Fallback System', () => {
  const sampleParticipant: Participant = {
    id: 'part-1042',
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
    photoUrl: '',
    registeredEventIds: ['cmp-solo-1', 'cmp-group-1'],
    idStatus: 'GENERATED'
  };

  describe('getParticipantInitials helper', () => {
    it('extracts two-letter initials from multi-word names', () => {
      expect(getParticipantInitials('Nihad Mohammed')).toBe('NM');
      expect(getParticipantInitials('Faris Ibrahim Al-Bayan')).toBe('FA');
      expect(getParticipantInitials('Hassan Bilgrami')).toBe('HB');
    });

    it('extracts first two letters from single-word names', () => {
      expect(getParticipantInitials('Faris')).toBe('FA');
      expect(getParticipantInitials('Zayd')).toBe('ZA');
    });

    it('handles empty, null, and whitespace inputs gracefully', () => {
      expect(getParticipantInitials('')).toBe('');
      expect(getParticipantInitials('   ')).toBe('');
      expect(getParticipantInitials(null)).toBe('');
      expect(getParticipantInitials(undefined)).toBe('');
    });
  });

  describe('isStockPhotoPlaceholder helper', () => {
    it('identifies the deprecated Unsplash stock photo URL', () => {
      const unsplashUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
      expect(isStockPhotoPlaceholder(unsplashUrl)).toBe(true);
    });

    it('does not flag legitimate storage URLs or local photo paths', () => {
      expect(isStockPhotoPlaceholder('https://firebasestorage.googleapis.com/v0/b/fest/o/photos/nihad.jpg')).toBe(false);
      expect(isStockPhotoPlaceholder('https://staging.inspirath.org/photos/nihad.jpg')).toBe(false);
      expect(isStockPhotoPlaceholder('/uploads/participants/1042.png')).toBe(false);
      expect(isStockPhotoPlaceholder(null)).toBe(false);
      expect(isStockPhotoPlaceholder('')).toBe(false);
    });
  });

  describe('ParticipantPhoto component', () => {
    it('renders a neutral silhouette and initials placeholder when photoUrl is absent', () => {
      const html = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: undefined,
          name: 'Nihad Mohammed',
          size: 'lg',
          shape: 'circle'
        })
      );

      // Verify no Unsplash stock image is rendered
      expect(html).not.toContain('unsplash.com');
      expect(html).not.toContain('<img');

      // Verify the fallback container with testid and accessibility label
      expect(html).toContain('data-testid="participant-photo-fallback"');
      expect(html).toContain('aria-label="Photo placeholder for Nihad Mohammed"');

      // Verify presence of silhouette icon and initials
      expect(html).toContain('data-testid="participant-silhouette"');
      expect(html).toContain('data-testid="participant-initials"');
      expect(html).toContain('NM');
    });

    it('rejects the Unsplash stock fallback URL and renders neutral placeholder instead', () => {
      const stockUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
      const html = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: stockUrl,
          name: 'Faris Ibrahim',
          size: 'lg',
          shape: 'circle'
        })
      );

      expect(html).not.toContain('unsplash.com');
      expect(html).not.toContain('<img');
      expect(html).toContain('data-testid="participant-photo-fallback"');
      expect(html).toContain('FI');
    });

    it('renders a genuine uploaded image when a legitimate photoUrl is provided', () => {
      const legitUrl = 'https://firebasestorage.googleapis.com/v0/b/fest/o/photos/p1042.jpg';
      const html = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: legitUrl,
          name: 'Nihad Mohammed',
          size: 'lg',
          shape: 'circle'
        })
      );

      expect(html).toContain('<img');
      expect(html).toContain(`src="${legitUrl}"`);
      expect(html).toContain('alt="Nihad Mohammed"');
      expect(html).not.toContain('data-testid="participant-photo-fallback"');
    });

    it('supports explicit silhouette-only fallback mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: null,
          name: 'Nihad Mohammed',
          fallback: 'silhouette'
        })
      );

      expect(html).toContain('data-testid="participant-silhouette"');
      expect(html).not.toContain('data-testid="participant-initials"');
    });

    it('supports explicit initials-only fallback mode', () => {
      const html = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: null,
          name: 'Nihad Mohammed',
          fallback: 'initials'
        })
      );

      expect(html).toContain('data-testid="participant-initials"');
      expect(html).toContain('NM');
    });

    it('supports both rounded-full and rounded-2xl shapes for ID card and Dashboard', () => {
      const circleHtml = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          name: 'Test Participant',
          shape: 'circle'
        })
      );
      expect(circleHtml).toContain('rounded-full');

      const roundedHtml = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          name: 'Test Participant',
          shape: 'rounded'
        })
      );
      expect(roundedHtml).toContain('rounded-2xl');
    });
  });

  describe('DigitalIdCard component', () => {
    it('renders without any Unsplash stock image fallback when participant has no photo', () => {
      const html = renderToStaticMarkup(
        React.createElement(DigitalIdCard, {
          participant: sampleParticipant,
          isOpen: true,
          onClose: () => {}
        })
      );

      // Verify no Unsplash image is present in the rendered card
      expect(html).not.toContain('unsplash.com');

      // Verify neutral placeholder is rendered
      expect(html).toContain('data-testid="participant-photo-fallback"');
      expect(html).toContain('data-testid="participant-silhouette"');
      expect(html).toContain('data-testid="participant-initials"');
      expect(html).toContain('NM');

      // Verify participant details are preserved
      expect(html).toContain('Nihad Mohammed');
      expect(html).toContain('#1042');
      expect(html).toContain('Grade 12 - Div A');
      expect(html).toContain('Al-Farooq House (ALF)');
      expect(html).toContain('SENIOR');
      expect(html).toContain('2 Contests');
      expect(html).toContain('VERIFIED');

      // Verify official festival branding
      expect(html).toContain('SAHITHYOLSAV 2025');
      expect(html).toContain('OFFICIAL FESTIVAL PASS');

      // Verify action buttons
      expect(html).toContain('Download PNG');
      expect(html).toContain('Print ID Badge');
      expect(html).toContain('Close');
    });

    it('renders genuine participant photo when photoUrl is present', () => {
      const participantWithPhoto: Participant = {
        ...sampleParticipant,
        photoUrl: 'https://staging.inspirath.org/photos/nihad.jpg'
      };

      const html = renderToStaticMarkup(
        React.createElement(DigitalIdCard, {
          participant: participantWithPhoto,
          isOpen: true,
          onClose: () => {}
        })
      );

      expect(html).toContain('<img');
      expect(html).toContain('src="https://staging.inspirath.org/photos/nihad.jpg"');
      expect(html).not.toContain('unsplash.com');
    });

    it('returns null when participant is null or modal is closed', () => {
      const closedHtml = renderToStaticMarkup(
        React.createElement(DigitalIdCard, {
          participant: sampleParticipant,
          isOpen: false,
          onClose: () => {}
        })
      );
      expect(closedHtml).toBe('');

      const nullHtml = renderToStaticMarkup(
        React.createElement(DigitalIdCard, {
          participant: null,
          isOpen: true,
          onClose: () => {}
        })
      );
      expect(nullHtml).toBe('');
    });
  });

  describe('Consistent Fallback across Participant Dashboard and Digital ID Card', () => {
    it('ensures both Digital ID Card and Dashboard utilize the same neutral silhouette and initials', () => {
      // In DigitalIdCard: shape="circle", size="lg"
      const idCardPhotoHtml = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: sampleParticipant.photoUrl,
          name: sampleParticipant.name,
          shape: 'circle',
          size: 'lg'
        })
      );

      // In Participant Dashboard: shape="rounded", size="lg"
      const dashboardPhotoHtml = renderToStaticMarkup(
        React.createElement(ParticipantPhoto, {
          photoUrl: sampleParticipant.photoUrl,
          name: sampleParticipant.name,
          shape: 'rounded',
          size: 'lg'
        })
      );

      // Both must share the identical fallback container and elements
      expect(idCardPhotoHtml).toContain('data-testid="participant-photo-fallback"');
      expect(dashboardPhotoHtml).toContain('data-testid="participant-photo-fallback"');

      expect(idCardPhotoHtml).toContain('data-testid="participant-silhouette"');
      expect(dashboardPhotoHtml).toContain('data-testid="participant-silhouette"');

      expect(idCardPhotoHtml).toContain('data-testid="participant-initials"');
      expect(dashboardPhotoHtml).toContain('data-testid="participant-initials"');

      expect(idCardPhotoHtml).toContain('NM');
      expect(dashboardPhotoHtml).toContain('NM');

      // Neither must contain any third-party stock photos
      expect(idCardPhotoHtml).not.toContain('unsplash.com');
      expect(dashboardPhotoHtml).not.toContain('unsplash.com');
    });
  });
});
