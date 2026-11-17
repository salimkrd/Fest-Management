import React from 'react';
import Image from 'next/image';

interface RibbonTrackConfig {
  id: string;
  bgColorClass: string;
  backgroundColor: string;
  rotationClass: string;
  positionClass: string;
  shadowClass: string;
  zIndexClass: string;
  animationClass: string;
  duration: string;
  assetSrc: string;
  altText: string;
}

const RIBBON_TRACKS: RibbonTrackConfig[] = [
  // Strip 1: Bottom Strip - Deep Forest Green, tilted +1.5deg, scrolling right
  {
    id: 'ribbon-bottom-green',
    bgColorClass: 'bg-[oklch(0.44_0.09_155)]',
    backgroundColor: '#1f613c',
    rotationClass: 'rotate-[1.5deg]',
    positionClass: 'bottom-1 sm:bottom-2',
    shadowClass: 'shadow-[0_8px_24px_rgba(0,0,0,0.3)]',
    zIndexClass: 'z-10',
    animationClass: 'animate-ribbon-right',
    duration: '56s',
    assetSrc: '/images/brand-ribbon-gold.png',
    altText: 'INSPIRATH Festival Brand Ribbon in Gold on Deep Green',
  },
  // Strip 2: Middle Strip - Radiant Festival Gold, tilted +0.4deg, scrolling left
  {
    id: 'ribbon-middle-gold',
    bgColorClass: 'bg-[oklch(0.8_0.13_78)]',
    backgroundColor: '#ebb353',
    rotationClass: 'rotate-[0.4deg]',
    positionClass: 'bottom-6 sm:bottom-8 md:bottom-9',
    shadowClass: 'shadow-[0_10px_30px_rgba(0,0,0,0.35)]',
    zIndexClass: 'z-20',
    animationClass: 'animate-ribbon-left',
    duration: '70s',
    assetSrc: '/images/brand-ribbon-red.png',
    altText: 'INSPIRATH Festival Brand Ribbon in Red on Gold',
  },
  // Strip 3: Top Strip - Rich Ruby-Crimson, tilted -1.9deg, scrolling left
  {
    id: 'ribbon-top-red',
    bgColorClass: 'bg-[oklch(0.54_0.18_29)]',
    backgroundColor: '#c13429',
    rotationClass: 'rotate-[-1.9deg]',
    positionClass: 'bottom-11 sm:bottom-14 md:bottom-16',
    shadowClass: 'shadow-[0_14px_40px_rgba(0,0,0,0.45)]',
    zIndexClass: 'z-30',
    animationClass: 'animate-ribbon-left',
    duration: '42s',
    assetSrc: '/images/brand-ribbon-gold.png',
    altText: 'INSPIRATH Festival Brand Ribbon in Gold on Ruby Red',
  },
];

export function AnimatedBrandRibbon() {
  return (
    <section
      aria-label="INSPIRATH Festival Brand Showcase"
      className="relative w-full overflow-hidden select-none bg-[#1B090B] pointer-events-none h-28 sm:h-32 md:h-36 border-t border-[#4A0A1C]/60"
    >
      <span className="sr-only">INSPIRATH - Official Festival Brand Showcase</span>

      <div className="relative w-full h-full">
        {RIBBON_TRACKS.map(track => (
          <div
            key={track.id}
            data-ribbon-strip={track.id}
            className={`absolute -left-[5%] w-[110%] sm:-left-[4%] sm:w-[108%] overflow-hidden ${track.positionClass} ${track.rotationClass} ${track.zIndexClass} ${track.bgColorClass} ${track.shadowClass}`}
            style={{
              backgroundColor: track.backgroundColor,
              transformOrigin: 'center center',
            }}
          >
            <div
              className={`flex w-max will-change-transform ${track.animationClass}`}
              style={{
                animationDuration: track.duration,
              }}
            >
              {/* Set 1: Primary Visible Sequence */}
              <div className="flex shrink-0 items-center py-1.5 sm:py-2 md:py-2.5">
                {[...Array(6)].map((_, i) => (
                  <Image
                    key={`set1-${i}`}
                    src={track.assetSrc}
                    alt={i === 0 ? track.altText : ''}
                    aria-hidden={i !== 0}
                    width={1024}
                    height={45}
                    className="h-5 sm:h-6 md:h-7 lg:h-8 w-auto shrink-0 select-none object-contain"
                    draggable={false}
                    unoptimized
                    priority
                  />
                ))}
              </div>

              {/* Set 2: Seamless Duplicate Sequence for Infinite Loop */}
              <div
                className="flex shrink-0 items-center py-1.5 sm:py-2 md:py-2.5"
                aria-hidden="true"
              >
                {[...Array(6)].map((_, i) => (
                  <Image
                    key={`set2-${i}`}
                    src={track.assetSrc}
                    alt=""
                    width={1024}
                    height={45}
                    className="h-5 sm:h-6 md:h-7 lg:h-8 w-auto shrink-0 select-none object-contain"
                    draggable={false}
                    unoptimized
                    priority
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
