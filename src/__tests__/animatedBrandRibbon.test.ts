import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('INSPIRATH Animated Brand Ribbon / Marquee Strips', () => {
  const componentSrc = readProjectFile('src/components/domain/AnimatedBrandRibbon.tsx');
  const pageSrc = readProjectFile('src/app/public/page.tsx');
  const cssSrc = readProjectFile('src/app/public/public.css');

  describe('1. Asset Existence & Mapping', () => {
    it('verifies local PNG assets exist in public/images', () => {
      expect(existsSync(resolve(process.cwd(), 'public/images/brand-ribbon-gold.png'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public/images/brand-ribbon-red.png'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public/images/brand-ribbon-yellow.png'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public/images/Asset 1.png'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public/images/Asset 2.png'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'public/images/Asset 3.png'))).toBe(true);
    });

    it('maps Asset 3 (brand-ribbon-yellow.png) exclusively to ribbon-top-yellow (#FDBF0F)', () => {
      expect(componentSrc).toContain('/images/brand-ribbon-yellow.png');
      expect(componentSrc).toMatch(
        /id: 'ribbon-top-yellow'[\s\S]*?backgroundColor: '#FDBF0F'[\s\S]*?assetSrc: '\/images\/brand-ribbon-yellow\.png'/
      );
    });

    it('confirms middle and bottom ribbon artwork mappings remain unchanged with gold artwork', () => {
      expect(componentSrc).toMatch(
        /id: 'ribbon-bottom-red'[\s\S]*?backgroundColor: '#BA200F'[\s\S]*?assetSrc: '\/images\/brand-ribbon-gold\.png'/
      );
      expect(componentSrc).toMatch(
        /id: 'ribbon-middle-maroon'[\s\S]*?backgroundColor: '#2A0C0C'[\s\S]*?assetSrc: '\/images\/brand-ribbon-gold\.png'/
      );
    });
  });

  describe('2. Three Animated Ribbon Tracks & Exact Refined Palette', () => {
    it('implements 3 distinct ribbon tracks', () => {
      expect(componentSrc).toContain('ribbon-bottom-red');
      expect(componentSrc).toContain('ribbon-middle-maroon');
      expect(componentSrc).toContain('ribbon-top-yellow');
    });

    it('uses exact hex colors: Top #FDBF0F, Middle #2A0C0C, Bottom #BA200F', () => {
      // Top Yellow track
      expect(componentSrc).toContain('bg-[#FDBF0F]');
      expect(componentSrc).toContain('#FDBF0F');

      // Middle Dark Maroon track
      expect(componentSrc).toContain('bg-[#2A0C0C]');
      expect(componentSrc).toContain('#2A0C0C');

      // Bottom Red track
      expect(componentSrc).toContain('bg-[#BA200F]');
      expect(componentSrc).toContain('#BA200F');
      expect(componentSrc).not.toContain('#C13429');
    });

    it('places Red #BA200F at the bottom and Dark Maroon #2A0C0C in the middle', () => {
      expect(componentSrc).toMatch(
        /id: 'ribbon-bottom-red'[\s\S]*?backgroundColor: '#BA200F'[\s\S]*?positionClass: 'bottom-0 sm:bottom-0\.5'[\s\S]*?zIndexClass: 'z-10'/
      );
      expect(componentSrc).toMatch(
        /id: 'ribbon-middle-maroon'[\s\S]*?backgroundColor: '#2A0C0C'[\s\S]*?positionClass: 'bottom-5 sm:bottom-7 md:bottom-8'[\s\S]*?zIndexClass: 'z-20'/
      );
      expect(componentSrc).toMatch(
        /id: 'ribbon-top-yellow'[\s\S]*?backgroundColor: '#FDBF0F'[\s\S]*?zIndexClass: 'z-30'/
      );
    });

    it('applies diagonal rotation angles matching visual reference', () => {
      expect(componentSrc).toContain('rotate-[1.5deg]');
      expect(componentSrc).toContain('rotate-[0.4deg]');
      expect(componentSrc).toContain('rotate-[-1.9deg]');
    });

    it('applies proper stacking and layered drop shadows', () => {
      expect(componentSrc).toContain('z-10');
      expect(componentSrc).toContain('z-20');
      expect(componentSrc).toContain('z-30');
      expect(componentSrc).toContain('shadow-[0_8px_24px_rgba(0,0,0,0.35)]');
      expect(componentSrc).toContain('shadow-[0_10px_30px_rgba(0,0,0,0.35)]');
      expect(componentSrc).toContain('shadow-[0_14px_40px_rgba(0,0,0,0.45)]');
    });
  });


    it('increases ribbon artwork scale on mobile while preserving responsive sizing', () => {
      expect(componentSrc).toContain('h-6 sm:h-7 md:h-8 lg:h-9');
      expect((componentSrc.match(/h-6 sm:h-7 md:h-8 lg:h-9/g) || []).length).toBe(2);
    });

  describe('3. Seamless Hero Background Continuity & No Black Gap', () => {
    it('removes plain black background and uses bg-transparent in AnimatedBrandRibbon', () => {
      expect(componentSrc).toContain('bg-transparent');
      expect(componentSrc).not.toContain('bg-[#1B090B]');
      expect(componentSrc).not.toContain('border-t border-[#4A0A1C]/60');
    });

    it('places AnimatedBrandRibbon inside the hero section to inherit halftone artwork seamlessly', () => {
      const heroStartIdx = pageSrc.indexOf('id="home"');
      const ribbonIdx = pageSrc.indexOf('<AnimatedBrandRibbon />');
      const heroCloseIdx = pageSrc.indexOf('</section>', heroStartIdx);
      const expositionIdx = pageSrc.indexOf('The Idea Behind the Theme');

      expect(heroStartIdx).toBeGreaterThan(0);
      expect(ribbonIdx).toBeGreaterThan(heroStartIdx);
      expect(ribbonIdx).toBeLessThan(heroCloseIdx);
      expect(expositionIdx).toBeGreaterThan(heroCloseIdx);
    });

    it('overlays the ribbons across the hero and thematic section boundary without adding layout height', () => {
      expect(componentSrc).toContain('absolute inset-x-0 bottom-[-56px]');
      expect(pageSrc).toContain('relative z-20 w-full inspirath-halftone-hero');
      expect(pageSrc).toContain('overflow-x-clip overflow-y-visible');
      expect(pageSrc).toContain('relative z-0 w-full bg-[#FDBF0F]');
      expect(pageSrc).toContain('pb-20 sm:pb-24 lg:pb-28');
      expect(pageSrc).toContain('pt-24 sm:pt-28 pb-14 sm:pb-16');
    });

  });

  describe('4. Continuous Infinite Animation & CSS Keyframes', () => {
    it('defines linear infinite CSS keyframes with translate3d in public.css', () => {
      expect(cssSrc).toContain('@keyframes ribbonMarqueeLeft');
      expect(cssSrc).toContain('@keyframes ribbonMarqueeRight');
      expect(cssSrc).toContain('translate3d(0, 0, 0)');
      expect(cssSrc).toContain('translate3d(-50%, 0, 0)');
      expect(cssSrc).toContain('animation-timing-function: linear');
      expect(cssSrc).toContain('animation-iteration-count: infinite');
    });

    it('implements independent durations and alternating directions', () => {
      expect(componentSrc).toContain('animate-ribbon-left');
      expect(componentSrc).toContain('animate-ribbon-right');
      expect(componentSrc).toContain("duration: '42s'");
      expect(componentSrc).toContain("duration: '70s'");
      expect(componentSrc).toContain("duration: '56s'");
    });

    it('duplicates artwork seamlessly with Set 1 and Set 2 for gapless looping', () => {
      expect(componentSrc).toContain('Set 1: Primary Visible Sequence');
      expect(componentSrc).toContain('Set 2: Seamless Duplicate Sequence for Infinite Loop');
      expect(componentSrc).toContain('aria-hidden="true"');
    });
  });

  describe('5. Accessibility and Performance', () => {
    it('supports prefers-reduced-motion in public.css', () => {
      expect(cssSrc).toContain('@media (prefers-reduced-motion: reduce)');
      expect(cssSrc).toContain('.animate-ribbon-left');
      expect(cssSrc).toContain('.animate-ribbon-right');
      expect(cssSrc).toContain('animation: none !important');
    });

    it('provides accessible labeling and hides duplicate content from screen readers', () => {
      expect(componentSrc).toContain('aria-label="INSPIRATH Festival Brand Showcase"');
      expect(componentSrc).toContain('sr-only');
      expect(componentSrc).toContain('aria-hidden={i !== 0}');
    });

    it('prevents horizontal page overflow while allowing rotated bottom ribbon edges to remain visible', () => {
      expect(componentSrc).toContain('overflow-x-clip overflow-y-visible');
      expect(componentSrc).toContain('overflow-hidden ${track.positionClass}');
      expect(componentSrc).toContain('-left-[5%]');
      expect(componentSrc).toContain('w-[110%]');
    });

    it('preserves PNG aspect ratio with unoptimized local image rendering', () => {
      expect(componentSrc).toContain('width={1024}');
      expect(componentSrc).toContain('height={45}');
      expect(componentSrc).toContain('object-contain');
      expect(componentSrc).toContain('unoptimized');
    });
  });

  describe('6. Scope Restrictions & Hero Content Preservation', () => {
    it('preserves existing hero section content, CTAs, and badges', () => {
      expect(pageSrc).toContain('Proactive Paradigms');
      expect(pageSrc).toContain('/images/theme.png');
      expect(pageSrc).toContain('/images/lamp.png');
      expect(pageSrc).toContain('Explore Results');
      expect(pageSrc).toContain('Team Championship');
    });
  });
});
